import {
  runBoundedCommand,
} from "./run-bounded-command.mjs";

export const GIT_PRIMITIVE_ERROR_CODES =
  Object.freeze({
    PROCESS_ERROR:
      "GIT_PROCESS_ERROR",

    TIMEOUT:
      "GIT_TIMEOUT",

    SIGNAL:
      "GIT_SIGNAL",

    OUTPUT_TRUNCATED:
      "GIT_OUTPUT_TRUNCATED",

    REPOSITORY_ROOT_FAILED:
      "GIT_REPOSITORY_ROOT_FAILED",

    REF_RESOLUTION_FAILED:
      "GIT_REF_RESOLUTION_FAILED",

    CHANGED_PATHS_FAILED:
      "GIT_CHANGED_PATHS_FAILED",

    BLOB_LOOKUP_FAILED:
      "GIT_BLOB_LOOKUP_FAILED",

    STATUS_FAILED:
      "GIT_STATUS_FAILED",

    MALFORMED_OUTPUT:
      "GIT_MALFORMED_OUTPUT",
  });

export class GitPrimitiveError extends Error {
  constructor(
    code,
    operation,
    executionResult = null,
  ) {
    super(`${code}:${operation}`);

    this.name =
      "GitPrimitiveError";

    this.code = code;
    this.operation = operation;

    this.exitCode =
      executionResult?.exitCode ??
      null;

    this.signal =
      executionResult?.signal ??
      null;

    this.timedOut =
      executionResult?.timedOut ??
      false;

    this.processErrorCode =
      executionResult
        ?.processErrorCode ??
      null;

    this.stdoutTruncated =
      executionResult
        ?.stdoutTruncated ??
      false;

    this.stderrTruncated =
      executionResult
        ?.stderrTruncated ??
      false;
  }
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireString(
  name,
  value,
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    throw new Error(
      `invalid_git_string:${name}`,
    );
  }
}

function requirePositiveInteger(
  name,
  value,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(
      `invalid_git_integer:${name}`,
    );
  }
}

function normalizeEnvironment(value) {
  if (!isRecord(value)) {
    throw new Error(
      "invalid_git_environment",
    );
  }

  const normalized = {};

  for (
    const key of
      Object.keys(value).sort()
  ) {
    const item = value[key];

    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0")
    ) {
      throw new Error(
        "invalid_git_environment_key",
      );
    }

    if (
      typeof item !== "string" ||
      item.includes("\0")
    ) {
      throw new Error(
        `invalid_git_environment_value:${key}`,
      );
    }

    normalized[key] = item;
  }

  return normalized;
}

function normalizeCommitId(value) {
  if (
    typeof value !== "string" ||
    !/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/
      .test(value)
  ) {
    throw new Error(
      "invalid_git_commit_id",
    );
  }

  return value.toLowerCase();
}

function validateRef(value) {
  requireString("ref", value);

  if (
    value.includes("\n") ||
    value.includes("\r")
  ) {
    throw new Error(
      "invalid_git_ref",
    );
  }
}

function normalizeRepositoryPath(value) {
  requireString(
    "repositoryPath",
    value,
  );

  if (
    value.startsWith("/") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("\\")
  ) {
    throw new Error(
      "invalid_git_repository_path",
    );
  }

  const segments =
    value.split("/");

  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === "..",
    )
  ) {
    throw new Error(
      "invalid_git_repository_path",
    );
  }

  return value;
}

function normalizeRepositoryPaths(
  value,
) {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    throw new Error(
      "invalid_git_repository_paths",
    );
  }

  const normalized =
    value.map(
      normalizeRepositoryPath,
    );

  const unique =
    new Set(normalized);

  if (
    unique.size !==
    normalized.length
  ) {
    throw new Error(
      "duplicate_git_repository_path",
    );
  }

  return [...unique].sort();
}

function createPrimitiveError(
  code,
  operation,
  executionResult,
) {
  return new GitPrimitiveError(
    code,
    operation,
    executionResult,
  );
}

function verifyExecutionResult(
  executionResult,
  operation,
  commandFailureCode,
) {
  if (executionResult.timedOut) {
    throw createPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .TIMEOUT,
      operation,
      executionResult,
    );
  }

  if (
    executionResult
      .processErrorCode !== null
  ) {
    throw createPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .PROCESS_ERROR,
      operation,
      executionResult,
    );
  }

  if (
    executionResult.signal !== null
  ) {
    throw createPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .SIGNAL,
      operation,
      executionResult,
    );
  }

  if (
    executionResult.stdoutTruncated ||
    executionResult.stderrTruncated
  ) {
    throw createPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .OUTPUT_TRUNCATED,
      operation,
      executionResult,
    );
  }

  if (
    executionResult.exitCode !== 0
  ) {
    throw createPrimitiveError(
      commandFailureCode,
      operation,
      executionResult,
    );
  }
}

function parseSingleLine(
  output,
  operation,
) {
  const value =
    output.replace(/\r?\n$/, "");

  if (
    value.length === 0 ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes("\uFFFD")
  ) {
    throw new GitPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .MALFORMED_OUTPUT,
      operation,
    );
  }

  return value;
}

function parseNulRecords(
  output,
  operation,
) {
  if (output === "") {
    return [];
  }

  if (
    !output.endsWith("\0") ||
    output.includes("\uFFFD")
  ) {
    throw new GitPrimitiveError(
      GIT_PRIMITIVE_ERROR_CODES
        .MALFORMED_OUTPUT,
      operation,
    );
  }

  return output
    .slice(0, -1)
    .split("\0");
}

/**
 * Creates read-only Git repository primitives.
 *
 * This layer resolves repository facts only. It does not create worktrees,
 * restore files, stage changes, commit, mutate refs, or evaluate evidence.
 */
export function createGitRepositoryPrimitives(
  configuration = {},
) {
  if (!isRecord(configuration)) {
    throw new Error(
      "invalid_git_configuration",
    );
  }

  const {
    gitExecutable,
    environment,
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes,
  } = configuration;

  requireString(
    "gitExecutable",
    gitExecutable,
  );

  const normalizedEnvironment =
    normalizeEnvironment(
      environment,
    );

  requirePositiveInteger(
    "timeoutMs",
    timeoutMs,
  );

  requirePositiveInteger(
    "maxStdoutBytes",
    maxStdoutBytes,
  );

  requirePositiveInteger(
    "maxStderrBytes",
    maxStderrBytes,
  );

  const commandConfiguration =
    Object.freeze({
      gitExecutable,
      environment:
        Object.freeze({
          ...normalizedEnvironment,
        }),
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
    });

  async function runGit(
    workingDirectory,
    argumentsList,
    operation,
    commandFailureCode,
  ) {
    requireString(
      "workingDirectory",
      workingDirectory,
    );

    const executionResult =
      await runBoundedCommand({
        executable:
          commandConfiguration
            .gitExecutable,

        arguments: [
          "--no-pager",
          "--literal-pathspecs",
          ...argumentsList,
        ],

        workingDirectory,

        environment: {
          ...commandConfiguration
            .environment,
        },

        timeoutMs:
          commandConfiguration
            .timeoutMs,

        maxStdoutBytes:
          commandConfiguration
            .maxStdoutBytes,

        maxStderrBytes:
          commandConfiguration
            .maxStderrBytes,
      });

    verifyExecutionResult(
      executionResult,
      operation,
      commandFailureCode,
    );

    return executionResult.stdout;
  }

  async function resolveRepositoryRoot(
    directory,
  ) {
    requireString(
      "directory",
      directory,
    );

    const output =
      await runGit(
        directory,
        [
          "rev-parse",
          "--show-toplevel",
        ],
        "resolve_repository_root",
        GIT_PRIMITIVE_ERROR_CODES
          .REPOSITORY_ROOT_FAILED,
      );

    return parseSingleLine(
      output,
      "resolve_repository_root",
    );
  }

  async function resolveCommit(
    repositoryRoot,
    reference,
  ) {
    requireString(
      "repositoryRoot",
      repositoryRoot,
    );

    validateRef(reference);

    const output =
      await runGit(
        repositoryRoot,
        [
          "rev-parse",
          "--verify",
          "--quiet",
          "--end-of-options",
          `${reference}^{commit}`,
        ],
        "resolve_commit",
        GIT_PRIMITIVE_ERROR_CODES
          .REF_RESOLUTION_FAILED,
      );

    return normalizeCommitId(
      parseSingleLine(
        output,
        "resolve_commit",
      ),
    );
  }

  async function listChangedPaths(
    repositoryRoot,
    baseCommitId,
    headCommitId,
  ) {
    requireString(
      "repositoryRoot",
      repositoryRoot,
    );

    const base =
      normalizeCommitId(
        baseCommitId,
      );

    const head =
      normalizeCommitId(
        headCommitId,
      );

    const output =
      await runGit(
        repositoryRoot,
        [
          "diff",
          "--name-only",
          "-z",
          "--no-renames",
          "--no-ext-diff",
          "--no-textconv",
          base,
          head,
          "--",
        ],
        "list_changed_paths",
        GIT_PRIMITIVE_ERROR_CODES
          .CHANGED_PATHS_FAILED,
      );

    const paths =
      parseNulRecords(
        output,
        "list_changed_paths",
      );

    const unique =
      new Set(paths);

    if (
      unique.size !==
      paths.length
    ) {
      throw new GitPrimitiveError(
        GIT_PRIMITIVE_ERROR_CODES
          .MALFORMED_OUTPUT,
        "list_changed_paths",
      );
    }

    for (const path of paths) {
      normalizeRepositoryPath(path);
    }

    return [...paths].sort();
  }

  async function readCommitBlobIds(
    repositoryRoot,
    commitId,
    repositoryPaths,
  ) {
    requireString(
      "repositoryRoot",
      repositoryRoot,
    );

    const commit =
      normalizeCommitId(commitId);

    const paths =
      normalizeRepositoryPaths(
        repositoryPaths,
      );

    const output =
      await runGit(
        repositoryRoot,
        [
          "ls-tree",
          "-z",
          "--full-tree",
          commit,
          "--",
          ...paths,
        ],
        "read_commit_blob_ids",
        GIT_PRIMITIVE_ERROR_CODES
          .BLOB_LOOKUP_FAILED,
      );

    const records =
      parseNulRecords(
        output,
        "read_commit_blob_ids",
      );

    const result = {};

    for (const path of paths) {
      result[path] = null;
    }

    for (const record of records) {
      const separator =
        record.indexOf("\t");

      if (separator < 1) {
        throw new GitPrimitiveError(
          GIT_PRIMITIVE_ERROR_CODES
            .MALFORMED_OUTPUT,
          "read_commit_blob_ids",
        );
      }

      const metadata =
        record.slice(
          0,
          separator,
        );

      const path =
        record.slice(
          separator + 1,
        );

      const parts =
        metadata.split(" ");

      if (parts.length !== 3) {
        throw new GitPrimitiveError(
          GIT_PRIMITIVE_ERROR_CODES
            .MALFORMED_OUTPUT,
          "read_commit_blob_ids",
        );
      }

      const [
        ,
        objectType,
        objectId,
      ] = parts;

      if (
        !Object.hasOwn(
          result,
          path,
        ) ||
        result[path] !== null ||
        objectType !== "blob"
      ) {
        throw new GitPrimitiveError(
          GIT_PRIMITIVE_ERROR_CODES
            .MALFORMED_OUTPUT,
          "read_commit_blob_ids",
        );
      }

      result[path] =
        normalizeCommitId(
          objectId,
        );
    }

    return result;
  }

  async function isWorktreeClean(
    repositoryRoot,
  ) {
    requireString(
      "repositoryRoot",
      repositoryRoot,
    );

    const output =
      await runGit(
        repositoryRoot,
        [
          "status",
          "--porcelain=v1",
          "-z",
          "--untracked-files=all",
          "--ignore-submodules=none",
        ],
        "read_worktree_status",
        GIT_PRIMITIVE_ERROR_CODES
          .STATUS_FAILED,
      );

    if (
      output.includes("\uFFFD")
    ) {
      throw new GitPrimitiveError(
        GIT_PRIMITIVE_ERROR_CODES
          .MALFORMED_OUTPUT,
        "read_worktree_status",
      );
    }

    return output.length === 0;
  }

  return Object.freeze({
    resolveRepositoryRoot,
    resolveCommit,
    listChangedPaths,
    readCommitBlobIds,
    isWorktreeClean,
  });
}
