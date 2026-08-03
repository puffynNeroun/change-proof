import { realpath } from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import {
  GitPrimitiveError,
  createGitRepositoryPrimitives,
} from "./git-repository-primitives.mjs";
import {
  runBoundedCommand,
} from "./run-bounded-command.mjs";
import {
  evaluateBoundary,
} from "./evaluate-boundary.mjs";
import {
  OwnedWorkspaceLifecycleError,
} from "./owned-workspace-lifecycle.mjs";

export const EXPLICIT_ENVELOPE_ERROR_CODES =
  Object.freeze({
    INVALID_CONFIGURATION: "EXPLICIT_ENVELOPE_INVALID_CONFIGURATION",
    INVALID_REPOSITORY_ROOT: "EXPLICIT_ENVELOPE_INVALID_REPOSITORY_ROOT",
    INVALID_OWNED_INVOCATION: "EXPLICIT_ENVELOPE_INVALID_OWNED_INVOCATION",
    INVALID_BASE_COMMIT: "EXPLICIT_ENVELOPE_INVALID_BASE_COMMIT",
    INVALID_HEAD_COMMIT: "EXPLICIT_ENVELOPE_INVALID_HEAD_COMMIT",
    UNRESOLVED_BASE_COMMIT: "EXPLICIT_ENVELOPE_UNRESOLVED_BASE_COMMIT",
    UNRESOLVED_HEAD_COMMIT: "EXPLICIT_ENVELOPE_UNRESOLVED_HEAD_COMMIT",
    INVALID_PATH_COLLECTION: "EXPLICIT_ENVELOPE_INVALID_PATH_COLLECTION",
    UNSAFE_PATH: "EXPLICIT_ENVELOPE_UNSAFE_PATH",
    DUPLICATE_PATH: "EXPLICIT_ENVELOPE_DUPLICATE_PATH",
    EMPTY_ENVELOPE: "EXPLICIT_ENVELOPE_EMPTY",
    STATE_C_NOT_BASED_ON_BASE: "EXPLICIT_ENVELOPE_STATE_C_NOT_BASED_ON_BASE",
    STATE_C_NOT_INITIALLY_CLEAN: "EXPLICIT_ENVELOPE_STATE_C_NOT_INITIALLY_CLEAN",
    STATE_C_NOT_DETACHED: "EXPLICIT_ENVELOPE_STATE_C_NOT_DETACHED",
    INCLUDED_PATH_NOT_CHANGED: "EXPLICIT_ENVELOPE_INCLUDED_PATH_NOT_CHANGED",
    UNSUPPORTED_ENTRY_TYPE: "EXPLICIT_ENVELOPE_UNSUPPORTED_ENTRY_TYPE",
    UNSUPPORTED_MODE_TRANSITION: "EXPLICIT_ENVELOPE_UNSUPPORTED_MODE_TRANSITION",
    UNSUPPORTED_PATH_SHAPE_TRANSITION: "EXPLICIT_ENVELOPE_UNSUPPORTED_PATH_SHAPE_TRANSITION",
    RESTORE_FAILED: "EXPLICIT_ENVELOPE_RESTORE_FAILED",
    GIT_PROCESS_ERROR: "EXPLICIT_ENVELOPE_GIT_PROCESS_ERROR",
    GIT_TIMEOUT: "EXPLICIT_ENVELOPE_GIT_TIMEOUT",
    GIT_SIGNAL: "EXPLICIT_ENVELOPE_GIT_SIGNAL",
    GIT_STDOUT_TRUNCATED: "EXPLICIT_ENVELOPE_GIT_STDOUT_TRUNCATED",
    GIT_STDERR_TRUNCATED: "EXPLICIT_ENVELOPE_GIT_STDERR_TRUNCATED",
    MALFORMED_NUL_OUTPUT: "EXPLICIT_ENVELOPE_MALFORMED_NUL_OUTPUT",
    WORKTREE_INDEX_DIVERGENCE: "EXPLICIT_ENVELOPE_WORKTREE_INDEX_DIVERGENCE",
    RESULTING_PATHS_FAILED: "EXPLICIT_ENVELOPE_RESULTING_PATHS_FAILED",
    STATE_C_BLOBS_FAILED: "EXPLICIT_ENVELOPE_STATE_C_BLOBS_FAILED",
    INCOMPLETE_EVIDENCE: "EXPLICIT_ENVELOPE_INCOMPLETE_EVIDENCE",
  });

export class ExplicitEnvelopeMaterializationError extends Error {
  constructor(code, operation, metadata = {}) {
    super(`${code}:${operation}`);
    this.name =
      "ExplicitEnvelopeMaterializationError";
    this.code = code;
    this.operation = operation;

    for (const [key, value] of
      Object.entries(metadata)) {
      this[key] = value;
    }
  }
}

function materializationError(
  code,
  operation,
  metadata = {},
) {
  return new ExplicitEnvelopeMaterializationError(
    code,
    operation,
    metadata,
  );
}

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function invalidConfiguration(field) {
  throw materializationError(
    EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_CONFIGURATION,
    "validate_configuration",
    { field },
  );
}

function requireString(field, value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    invalidConfiguration(field);
  }
}

function normalizeEnvironment(value) {
  if (!isRecord(value)) {
    invalidConfiguration("environment");
  }

  const normalized = {};

  for (const key of Object.keys(value).sort()) {
    const item = value[key];

    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0") ||
      typeof item !== "string" ||
      item.includes("\0")
    ) {
      invalidConfiguration("environment");
    }

    normalized[key] = item;
  }

  return normalized;
}

function normalizeConfiguration(configuration) {
  if (!isRecord(configuration)) {
    invalidConfiguration("configuration");
  }

  const {
    gitExecutable,
    environment,
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes,
  } = configuration;

  requireString("gitExecutable", gitExecutable);

  for (const [field, value] of
    Object.entries({
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
    })) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1
    ) {
      invalidConfiguration(field);
    }
  }

  if (timeoutMs > 2_147_483_647) {
    invalidConfiguration("timeoutMs");
  }

  return Object.freeze({
    gitExecutable,
    environment: Object.freeze({
      ...normalizeEnvironment(environment),
    }),
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes,
  });
}

function normalizeCommitId(field, value, code) {
  if (
    typeof value !== "string" ||
    !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
      .test(value)
  ) {
    throw materializationError(
      code,
      "validate_commit_id",
      { field },
    );
  }

  return value;
}

function normalizeIncludedPaths(value) {
  if (!Array.isArray(value)) {
    throw materializationError(
      EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_PATH_COLLECTION,
      "validate_included_paths",
    );
  }

  if (value.length === 0) {
    throw materializationError(
      EXPLICIT_ENVELOPE_ERROR_CODES.EMPTY_ENVELOPE,
      "validate_included_paths",
    );
  }

  const seen = new Set();
  const normalized = [];

  for (const path of value) {
    if (
      typeof path !== "string" ||
      path.length === 0 ||
      path.includes("\0") ||
      path === "." ||
      path === ".." ||
      path.startsWith("/") ||
      /^[A-Za-z]:[\\/]/.test(path) ||
      path.includes("\\")
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.UNSAFE_PATH,
        "validate_included_paths",
      );
    }

    const segments = path.split("/");

    if (
      segments.some((segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === "..")
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.UNSAFE_PATH,
        "validate_included_paths",
      );
    }

    if (seen.has(path)) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.DUPLICATE_PATH,
        "validate_included_paths",
      );
    }

    seen.add(path);
    normalized.push(path);
  }

  normalized.sort();

  for (
    let index = 0;
    index < normalized.length;
    index += 1
  ) {
    for (
      let nestedIndex = index + 1;
      nestedIndex < normalized.length;
      nestedIndex += 1
    ) {
      if (
        normalized[nestedIndex]
          .startsWith(`${normalized[index]}/`)
      ) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.UNSUPPORTED_PATH_SHAPE_TRANSITION,
          "validate_selected_path_prefixes",
        );
      }
    }
  }

  return normalized;
}

function processMetadata(result) {
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    processErrorCode: result.processErrorCode,
    stdoutTruncated: result.stdoutTruncated,
    stderrTruncated: result.stderrTruncated,
  };
}

function verifyExecution(
  result,
  operation,
  nonzeroCode,
  acceptedExitCodes = [0],
) {
  let code = null;

  if (result.timedOut) {
    code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_TIMEOUT;
  } else if (result.processErrorCode !== null) {
    code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_PROCESS_ERROR;
  } else if (result.signal !== null) {
    code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_SIGNAL;
  } else if (result.stdoutTruncated) {
    code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_STDOUT_TRUNCATED;
  } else if (result.stderrTruncated) {
    code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_STDERR_TRUNCATED;
  } else if (!acceptedExitCodes.includes(
    result.exitCode,
  )) {
    code = nonzeroCode;
  }

  if (code !== null) {
    throw materializationError(
      code,
      operation,
      processMetadata(result),
    );
  }
}

function parseNulRecords(output, operation) {
  if (output === "") {
    return [];
  }

  if (
    !output.endsWith("\0") ||
    output.includes("\uFFFD")
  ) {
    throw materializationError(
      EXPLICIT_ENVELOPE_ERROR_CODES.MALFORMED_NUL_OUTPUT,
      operation,
    );
  }

  return output.slice(0, -1).split("\0");
}

function ancestorsOf(paths) {
  const ancestors = new Set();

  for (const path of paths) {
    const segments = path.split("/");

    for (
      let index = 1;
      index < segments.length;
      index += 1
    ) {
      ancestors.add(
        segments.slice(0, index).join("/"),
      );
    }
  }

  return [...ancestors].sort();
}

function isContained(parent, candidate) {
  const pathFromParent = relative(parent, candidate);

  return (
    pathFromParent.length > 0 &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith("../") &&
    !isAbsolute(pathFromParent)
  );
}

function cloneMap(value) {
  const result = {};

  for (const key of Object.keys(value).sort()) {
    result[key] = value[key];
  }

  return result;
}

function cloneBoundary(value) {
  return {
    basedOnBase: value.basedOnBase,
    selectedPathsMatchHead:
      value.selectedPathsMatchHead,
    unchangedPathsMatchBase:
      value.unchangedPathsMatchBase,
    resultingChangedPaths: [
      ...value.resultingChangedPaths,
    ],
    boundaryValid: value.boundaryValid,
    reasonCodes: [...value.reasonCodes],
  };
}

/**
 * Creates the M2.8 explicit State C materializer.
 *
 * The owned invocation supplies lifecycle and cleanup. This module restores
 * only caller-selected paths and constructs boundary evidence; it does not
 * execute tests, evaluate verdicts, or create commits or refs.
 */
export function createExplicitEnvelopeMaterializer(
  configuration = {},
) {
  const config = normalizeConfiguration(configuration);
  const primitives = createGitRepositoryPrimitives({
    gitExecutable: config.gitExecutable,
    environment: { ...config.environment },
    timeoutMs: config.timeoutMs,
    maxStdoutBytes: config.maxStdoutBytes,
    maxStderrBytes: config.maxStderrBytes,
  });

  async function runGit(
    workingDirectory,
    argumentsList,
  ) {
    return await runBoundedCommand({
      executable: config.gitExecutable,
      arguments: [
        "--no-pager",
        "--literal-pathspecs",
        ...argumentsList,
      ],
      workingDirectory,
      environment: { ...config.environment },
      timeoutMs: config.timeoutMs,
      maxStdoutBytes: config.maxStdoutBytes,
      maxStderrBytes: config.maxStderrBytes,
    });
  }

  function mapPrimitiveError(
    error,
    operation,
    fallbackCode,
  ) {
    if (!(error instanceof GitPrimitiveError)) {
      throw materializationError(
        fallbackCode,
        operation,
      );
    }

    const metadata = {
      exitCode: error.exitCode,
      signal: error.signal,
      timedOut: error.timedOut,
      processErrorCode: error.processErrorCode,
      stdoutTruncated: error.stdoutTruncated,
      stderrTruncated: error.stderrTruncated,
    };

    let code = fallbackCode;

    if (error.timedOut) {
      code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_TIMEOUT;
    } else if (error.processErrorCode !== null) {
      code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_PROCESS_ERROR;
    } else if (error.signal !== null) {
      code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_SIGNAL;
    } else if (error.stdoutTruncated) {
      code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_STDOUT_TRUNCATED;
    } else if (error.stderrTruncated) {
      code = EXPLICIT_ENVELOPE_ERROR_CODES.GIT_STDERR_TRUNCATED;
    }

    throw materializationError(
      code,
      operation,
      metadata,
    );
  }

  async function callPrimitive(
    operation,
    fallbackCode,
    callback,
  ) {
    try {
      return await callback();
    } catch (error) {
      mapPrimitiveError(
        error,
        operation,
        fallbackCode,
      );
    }
  }

  async function readTreeEntries(
    repositoryRoot,
    commitId,
    paths,
  ) {
    const entries = {};
    const orderedPaths = [...paths].sort();

    for (const path of orderedPaths) {
      entries[path] = null;
    }

    for (const requestedPath of orderedPaths) {
      const result = await runGit(
        repositoryRoot,
        [
          "ls-tree",
          "-z",
          "--full-tree",
          commitId,
          "--",
          requestedPath,
        ],
      );

      verifyExecution(
        result,
        "read_tree_entries",
        EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      );

      const records = parseNulRecords(
        result.stdout,
        "parse_tree_entries",
      );

      if (records.length === 0) {
        continue;
      }

      if (records.length !== 1) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.MALFORMED_NUL_OUTPUT,
          "parse_tree_entries",
        );
      }

      const [record] = records;
      const separator = record.indexOf("\t");

      if (separator < 1) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.MALFORMED_NUL_OUTPUT,
          "parse_tree_entries",
        );
      }

      const metadata = record
        .slice(0, separator)
        .split(" ");
      const returnedPath = record.slice(separator + 1);

      if (
        metadata.length !== 3 ||
        !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
          .test(metadata[2]) ||
        returnedPath !== requestedPath ||
        entries[requestedPath] !== null
      ) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.MALFORMED_NUL_OUTPUT,
          "parse_tree_entries",
        );
      }

      entries[requestedPath] = {
        mode: metadata[0],
        type: metadata[1],
        objectId: metadata[2],
      };
    }

    return entries;
  }

  function validateEntryContracts(
    changedPaths,
    ancestors,
    baseEntries,
    headEntries,
  ) {
    for (const path of ancestors) {
      for (const entry of [
        baseEntries[path],
        headEntries[path],
      ]) {
        if (entry !== null && entry.type !== "tree") {
          throw materializationError(
            EXPLICIT_ENVELOPE_ERROR_CODES.UNSUPPORTED_PATH_SHAPE_TRANSITION,
            "validate_path_shape",
          );
        }
      }
    }

    for (const path of changedPaths) {
      const baseEntry = baseEntries[path];
      const headEntry = headEntries[path];

      for (const entry of [baseEntry, headEntry]) {
        if (entry === null) {
          continue;
        }

        if (entry.type === "tree") {
          throw materializationError(
            EXPLICIT_ENVELOPE_ERROR_CODES.UNSUPPORTED_PATH_SHAPE_TRANSITION,
            "validate_changed_entry",
          );
        }

        if (
          entry.type !== "blob" ||
          !["100644", "100755"].includes(entry.mode)
        ) {
          throw materializationError(
            EXPLICIT_ENVELOPE_ERROR_CODES.UNSUPPORTED_ENTRY_TYPE,
            "validate_changed_entry",
          );
        }
      }

      if (
        baseEntry !== null &&
        headEntry !== null &&
        baseEntry.mode !== headEntry.mode
      ) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.UNSUPPORTED_MODE_TRANSITION,
          "validate_changed_entry_mode",
        );
      }
    }
  }

  async function readIndexEntries(
    stateCPath,
    paths,
  ) {
    const entries = {};

    for (const path of paths) {
      entries[path] = null;
    }

    const result = await runGit(
      stateCPath,
      ["ls-files", "--stage", "-z", "--", ...paths],
    );

    verifyExecution(
      result,
      "read_state_c_index",
      EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_BLOBS_FAILED,
    );

    for (const record of parseNulRecords(
      result.stdout,
      "parse_state_c_index",
    )) {
      const separator = record.indexOf("\t");

      if (separator < 1) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.MALFORMED_NUL_OUTPUT,
          "parse_state_c_index",
        );
      }

      const metadata = record
        .slice(0, separator)
        .split(" ");
      const path = record.slice(separator + 1);

      if (
        metadata.length !== 3 ||
        metadata[2] !== "0" ||
        !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/
          .test(metadata[1]) ||
        !Object.hasOwn(entries, path) ||
        entries[path] !== null ||
        !["100644", "100755"].includes(metadata[0])
      ) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_BLOBS_FAILED,
          "parse_state_c_index",
        );
      }

      entries[path] = {
        mode: metadata[0],
        objectId: metadata[1],
      };
    }

    return entries;
  }

  async function materializeExplicitEnvelope(
    ownedInvocation,
    specification = {},
  ) {
    if (
      !isRecord(ownedInvocation) ||
      typeof ownedInvocation.createDetachedWorktree !==
        "function" ||
      typeof ownedInvocation.workspacePath !== "string" ||
      !isAbsolute(ownedInvocation.workspacePath)
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_OWNED_INVOCATION,
        "validate_owned_invocation",
      );
    }

    if (!isRecord(specification)) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_CONFIGURATION,
        "validate_materialization_specification",
        { field: "specification" },
      );
    }

    if (
      typeof specification.repositoryRoot !== "string" ||
      specification.repositoryRoot.length === 0 ||
      specification.repositoryRoot.includes("\0")
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_REPOSITORY_ROOT,
        "validate_repository_root",
      );
    }

    const repositoryRoot = resolve(specification.repositoryRoot);
    const baseCommitId = normalizeCommitId(
      "baseCommitId",
      specification.baseCommitId,
      EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_BASE_COMMIT,
    );
    const headCommitId = normalizeCommitId(
      "headCommitId",
      specification.headCommitId,
      EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_HEAD_COMMIT,
    );
    const includedPaths = normalizeIncludedPaths(
      specification.includedPaths,
    );

    const reportedRoot = await callPrimitive(
      "resolve_repository_root",
      EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_REPOSITORY_ROOT,
      () => primitives.resolveRepositoryRoot(
        repositoryRoot,
      ),
    );

    let repositoryRealPath;
    let reportedRealPath;

    try {
      [repositoryRealPath, reportedRealPath] =
        await Promise.all([
          realpath(repositoryRoot),
          realpath(reportedRoot),
        ]);
    } catch {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_REPOSITORY_ROOT,
        "resolve_repository_realpath",
      );
    }

    if (repositoryRealPath !== reportedRealPath) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_REPOSITORY_ROOT,
        "validate_repository_root",
      );
    }

    const resolvedBase = await callPrimitive(
      "resolve_base_commit",
      EXPLICIT_ENVELOPE_ERROR_CODES.UNRESOLVED_BASE_COMMIT,
      () => primitives.resolveCommit(
        repositoryRealPath,
        baseCommitId,
      ),
    );
    const resolvedHead = await callPrimitive(
      "resolve_head_commit",
      EXPLICIT_ENVELOPE_ERROR_CODES.UNRESOLVED_HEAD_COMMIT,
      () => primitives.resolveCommit(
        repositoryRealPath,
        headCommitId,
      ),
    );

    if (resolvedBase !== baseCommitId) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.UNRESOLVED_BASE_COMMIT,
        "resolve_base_commit",
      );
    }

    if (resolvedHead !== headCommitId) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.UNRESOLVED_HEAD_COMMIT,
        "resolve_head_commit",
      );
    }

    const headChangedPaths = await callPrimitive(
      "list_head_changed_paths",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.listChangedPaths(
        repositoryRealPath,
        baseCommitId,
        headCommitId,
      ),
    );
    const changedPathSet = new Set(headChangedPaths);

    if (
      includedPaths.some((path) =>
        !changedPathSet.has(path))
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INCLUDED_PATH_NOT_CHANGED,
        "validate_included_paths_changed",
      );
    }

    const ancestorPaths = ancestorsOf(headChangedPaths);
    const treeQueryPaths = [
      ...new Set([
        ...headChangedPaths,
        ...ancestorPaths,
      ]),
    ].sort();
    const baseEntries = await readTreeEntries(
      repositoryRealPath,
      baseCommitId,
      treeQueryPaths,
    );
    const headEntries = await readTreeEntries(
      repositoryRealPath,
      headCommitId,
      treeQueryPaths,
    );

    validateEntryContracts(
      headChangedPaths,
      ancestorPaths,
      baseEntries,
      headEntries,
    );

    const baseBlobIds = await callPrimitive(
      "read_base_blob_ids",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.readCommitBlobIds(
        repositoryRealPath,
        baseCommitId,
        headChangedPaths,
      ),
    );
    const headBlobIds = await callPrimitive(
      "read_head_blob_ids",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.readCommitBlobIds(
        repositoryRealPath,
        headCommitId,
        headChangedPaths,
      ),
    );

    let stateC;

    try {
      stateC = await ownedInvocation
        .createDetachedWorktree({
          name: "state-c",
          commitId: baseCommitId,
        });
    } catch (error) {
      if (error instanceof OwnedWorkspaceLifecycleError) {
        throw error;
      }

      if (
        error instanceof
          ExplicitEnvelopeMaterializationError ) {
        throw error;
      }

      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_OWNED_INVOCATION,
        "create_state_c_worktree",
      );
    }

    if (
      !isRecord(stateC) ||
      typeof stateC.path !== "string" ||
      !isAbsolute(stateC.path) ||
      !isContained(
        resolve(ownedInvocation.workspacePath),
        resolve(stateC.path),
      )
    ) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_OWNED_INVOCATION,
        "validate_state_c_worktree",
      );
    }

    let stateCRealPath;

    try {
      stateCRealPath = await realpath(stateC.path);
    } catch {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_OWNED_INVOCATION,
        "resolve_state_c_worktree",
      );
    }

    if (stateCRealPath !== resolve(stateC.path)) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.INVALID_OWNED_INVOCATION,
        "validate_state_c_worktree",
      );
    }

    const stateCBaseSha = await callPrimitive(
      "read_initial_state_c_head",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.resolveCommit(
        stateCRealPath,
        "HEAD",
      ),
    );

    if (stateCBaseSha !== baseCommitId) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_NOT_BASED_ON_BASE,
        "verify_initial_state_c_head",
      );
    }

    const initiallyClean = await callPrimitive(
      "read_initial_state_c_status",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.isWorktreeClean(
        stateCRealPath,
      ),
    );

    if (!initiallyClean) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_NOT_INITIALLY_CLEAN,
        "verify_initial_state_c_status",
      );
    }

    const initialDetachedResult = await runGit(
      stateCRealPath,
      ["symbolic-ref", "--quiet", "HEAD"],
    );

    verifyExecution(
      initialDetachedResult,
      "verify_initial_state_c_detached",
      EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_NOT_DETACHED,
      [1],
    );

    const restoreResult = await runGit(
      stateCRealPath,
      [
        "restore",
        `--source=${headCommitId}`,
        "--staged",
        "--worktree",
        "--",
        ...includedPaths,
      ],
    );

    verifyExecution(
      restoreResult,
      "restore_explicit_envelope",
      EXPLICIT_ENVELOPE_ERROR_CODES.RESTORE_FAILED,
    );

    const finalStateCBaseSha = await callPrimitive(
      "read_final_state_c_head",
      EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
      () => primitives.resolveCommit(
        stateCRealPath,
        "HEAD",
      ),
    );

    if (finalStateCBaseSha !== baseCommitId) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_NOT_BASED_ON_BASE,
        "verify_final_state_c_head",
      );
    }

    const finalDetachedResult = await runGit(
      stateCRealPath,
      ["symbolic-ref", "--quiet", "HEAD"],
    );

    verifyExecution(
      finalDetachedResult,
      "verify_final_state_c_detached",
      EXPLICIT_ENVELOPE_ERROR_CODES.STATE_C_NOT_DETACHED,
      [1],
    );

    const consistencyResult = await runGit(
      stateCRealPath,
      [
        "diff",
        "--quiet",
        "--no-ext-diff",
        "--no-textconv",
        "--",
      ],
    );

    verifyExecution(
      consistencyResult,
      "verify_worktree_index_consistency",
      EXPLICIT_ENVELOPE_ERROR_CODES.WORKTREE_INDEX_DIVERGENCE,
    );

    const untrackedResult = await runGit(
      stateCRealPath,
      ["ls-files", "--others", "-z", "--"],
    );

    verifyExecution(
      untrackedResult,
      "read_untracked_state_c_paths",
      EXPLICIT_ENVELOPE_ERROR_CODES.WORKTREE_INDEX_DIVERGENCE,
    );

    if (parseNulRecords(
      untrackedResult.stdout,
      "parse_untracked_state_c_paths",
    ).length > 0) {
      throw materializationError(
        EXPLICIT_ENVELOPE_ERROR_CODES.WORKTREE_INDEX_DIVERGENCE,
        "verify_no_untracked_state_c_paths",
      );
    }

    const resultingPathsResult = await runGit(
      stateCRealPath,
      [
        "diff",
        "--cached",
        "--name-only",
        "-z",
        "--no-renames",
        "--no-ext-diff",
        "--no-textconv",
        baseCommitId,
        "--",
      ],
    );

    verifyExecution(
      resultingPathsResult,
      "collect_resulting_changed_paths",
      EXPLICIT_ENVELOPE_ERROR_CODES.RESULTING_PATHS_FAILED,
    );

    const resultingChangedPaths = parseNulRecords(
      resultingPathsResult.stdout,
      "parse_resulting_changed_paths",
    ).sort();
    const indexEntries = await readIndexEntries(
      stateCRealPath,
      headChangedPaths,
    );
    const stateCBlobIds = {};
    const baseModes = {};
    const headModes = {};
    const stateCModes = {};

    for (const path of headChangedPaths) {
      stateCBlobIds[path] =
        indexEntries[path]?.objectId ?? null;
      baseModes[path] =
        baseEntries[path]?.mode ?? null;
      headModes[path] =
        headEntries[path]?.mode ?? null;
      stateCModes[path] =
        indexEntries[path]?.mode ?? null;

      const expectedEntry = includedPaths.includes(path)
        ? headEntries[path]
        : baseEntries[path];
      const actualEntry = indexEntries[path];

      if (
        expectedEntry !== null &&
        actualEntry !== null &&
        expectedEntry.mode !== actualEntry.mode
      ) {
        throw materializationError(
          EXPLICIT_ENVELOPE_ERROR_CODES.INCOMPLETE_EVIDENCE,
          "verify_state_c_index_mode",
        );
      }
    }

    const boundary = evaluateBoundary({
      baseSha: baseCommitId,
      stateCBaseSha: finalStateCBaseSha,
      includedPaths,
      headChangedPaths,
      materializedPaths: includedPaths,
      resultingChangedPaths,
      baseBlobIds,
      headBlobIds,
      stateCBlobIds,
    });
    const excludedChangedPaths =
      headChangedPaths.filter((path) =>
        !includedPaths.includes(path));
    const authoritativeBoundary = cloneBoundary(boundary);
    const evidence = {
      baseCommitId,
      headCommitId,
      stateCBaseCommitId: finalStateCBaseSha,
      includedPaths: [...includedPaths],
      excludedChangedPaths,
      headChangedPaths: [...headChangedPaths],
      materializedPaths: [...includedPaths],
      resultingChangedPaths: [
        ...resultingChangedPaths,
      ],
      baseBlobIds: cloneMap(baseBlobIds),
      headBlobIds: cloneMap(headBlobIds),
      stateCBlobIds: cloneMap(stateCBlobIds),
      baseModes: cloneMap(baseModes),
      headModes: cloneMap(headModes),
      stateCModes: cloneMap(stateCModes),
      boundary: cloneBoundary(authoritativeBoundary),
    };

    return {
      stateCWorktreePath: stateCRealPath,
      evidence,
      boundary: authoritativeBoundary,
    };
  }

  return Object.freeze({
    materializeExplicitEnvelope,
  });
}
