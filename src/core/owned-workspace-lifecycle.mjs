import { randomUUID } from "node:crypto";
import {
  lstat,
  mkdtemp,
  open,
  readFile,
  realpath,
  rm,
} from "node:fs/promises";
import {
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import {
  runBoundedCommand,
} from "./run-bounded-command.mjs";

export const OWNED_WORKSPACE_MARKER =
  ".change-proof-owned";

export const OWNED_WORKSPACE_ERROR_CODES =
  Object.freeze({
    INVALID_CONFIGURATION:
      "OWNED_WORKSPACE_INVALID_CONFIGURATION",
    WORKSPACE_CREATION_FAILED:
      "OWNED_WORKSPACE_CREATION_FAILED",
    MARKER_CREATION_FAILED:
      "OWNED_WORKSPACE_MARKER_CREATION_FAILED",
    MARKER_MISSING:
      "OWNED_WORKSPACE_MARKER_MISSING",
    MARKER_MISMATCH:
      "OWNED_WORKSPACE_MARKER_MISMATCH",
    OWNERSHIP_VALIDATION_FAILED:
      "OWNED_WORKSPACE_OWNERSHIP_VALIDATION_FAILED",
    CONTAINMENT_FAILED:
      "OWNED_WORKSPACE_CONTAINMENT_FAILED",
    TARGET_EXISTS:
      "OWNED_WORKSPACE_TARGET_EXISTS",
    GIT_PROCESS_ERROR:
      "OWNED_WORKSPACE_GIT_PROCESS_ERROR",
    GIT_TIMEOUT:
      "OWNED_WORKSPACE_GIT_TIMEOUT",
    GIT_SIGNAL:
      "OWNED_WORKSPACE_GIT_SIGNAL",
    GIT_OUTPUT_TRUNCATED:
      "OWNED_WORKSPACE_GIT_OUTPUT_TRUNCATED",
    REPOSITORY_INVALID:
      "OWNED_WORKSPACE_REPOSITORY_INVALID",
    COMMIT_INVALID:
      "OWNED_WORKSPACE_COMMIT_INVALID",
    COMMIT_UNRESOLVED:
      "OWNED_WORKSPACE_COMMIT_UNRESOLVED",
    WORKTREE_ADD_FAILED:
      "OWNED_WORKSPACE_WORKTREE_ADD_FAILED",
    WORKTREE_IDENTITY_MISMATCH:
      "OWNED_WORKSPACE_WORKTREE_IDENTITY_MISMATCH",
    WORKTREE_NOT_DETACHED:
      "OWNED_WORKSPACE_WORKTREE_NOT_DETACHED",
    WORKTREE_DIRTY:
      "OWNED_WORKSPACE_WORKTREE_DIRTY",
    WORKTREE_REMOVE_FAILED:
      "OWNED_WORKSPACE_WORKTREE_REMOVE_FAILED",
    PRUNE_FAILED:
      "OWNED_WORKSPACE_PRUNE_FAILED",
    WORKSPACE_REMOVE_FAILED:
      "OWNED_WORKSPACE_REMOVE_FAILED",
    INCOMPLETE_CLEANUP:
      "OWNED_WORKSPACE_INCOMPLETE_CLEANUP",
    PRIMARY_AND_CLEANUP_FAILURE:
      "OWNED_WORKSPACE_PRIMARY_AND_CLEANUP_FAILURE",
  });

export class OwnedWorkspaceLifecycleError extends Error {
  constructor(
    code,
    operation,
    metadata = {},
    cause,
  ) {
    super(`${code}:${operation}`,
      cause === undefined ? {} : { cause });

    this.name = "OwnedWorkspaceLifecycleError";
    this.code = code;
    this.operation = operation;

    for (const [key, value] of
      Object.entries(metadata)) {
      this[key] = value;
    }
  }
}

function lifecycleError(
  code,
  operation,
  metadata = {},
  cause,
) {
  return new OwnedWorkspaceLifecycleError(
    code,
    operation,
    metadata,
    cause,
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
  throw lifecycleError(
    OWNED_WORKSPACE_ERROR_CODES
      .INVALID_CONFIGURATION,
    "validate_configuration",
    { field },
  );
}

function requireString(field, value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0") ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    invalidConfiguration(field);
  }
}

function requirePositiveInteger(field, value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    invalidConfiguration(field);
  }
}

function filesystemMetadata(error) {
  return {
    filesystemErrorCode:
      typeof error?.code === "string" &&
      error.code.length > 0
        ? error.code
        : "UNKNOWN_FILESYSTEM_ERROR",
  };
}

function normalizeEnvironment(value) {
  if (!isRecord(value)) {
    invalidConfiguration("environment");
  }

  const result = {};

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

    result[key] = item;
  }

  return result;
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
    temporaryParentDirectory,
    workspacePrefix,
    repositoryRoot,
  } = configuration;

  for (const [field, value] of
    Object.entries({
      gitExecutable,
      temporaryParentDirectory,
      workspacePrefix,
      repositoryRoot,
    })) {
    requireString(field, value);
  }

  if (
    workspacePrefix === "." ||
    workspacePrefix === ".." ||
    workspacePrefix.includes("/") ||
    workspacePrefix.includes("\\")
  ) {
    invalidConfiguration("workspacePrefix");
  }

  for (const [field, value] of
    Object.entries({
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
    })) {
    requirePositiveInteger(field, value);
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
    temporaryParentDirectory:
      resolve(temporaryParentDirectory),
    workspacePrefix,
    repositoryRoot: resolve(repositoryRoot),
  });
}

function processMetadata(result) {
  return {
    exitCode: result.exitCode,
    signal: result.signal,
    timedOut: result.timedOut,
    processErrorCode:
      result.processErrorCode,
    stdoutTruncated:
      result.stdoutTruncated,
    stderrTruncated:
      result.stderrTruncated,
  };
}

function processFailureCode(result) {
  if (result.timedOut) {
    return OWNED_WORKSPACE_ERROR_CODES
      .GIT_TIMEOUT;
  }

  if (result.processErrorCode !== null) {
    return OWNED_WORKSPACE_ERROR_CODES
      .GIT_PROCESS_ERROR;
  }

  if (result.signal !== null) {
    return OWNED_WORKSPACE_ERROR_CODES
      .GIT_SIGNAL;
  }

  if (
    result.stdoutTruncated ||
    result.stderrTruncated
  ) {
    return OWNED_WORKSPACE_ERROR_CODES
      .GIT_OUTPUT_TRUNCATED;
  }

  return null;
}

function assertCommandResult(
  result,
  operation,
  nonzeroCode,
  acceptedExitCodes = [0],
) {
  const operationalCode =
    processFailureCode(result);

  if (operationalCode !== null) {
    throw lifecycleError(
      operationalCode,
      operation,
      processMetadata(result),
    );
  }

  if (!acceptedExitCodes.includes(result.exitCode)) {
    throw lifecycleError(
      nonzeroCode,
      operation,
      processMetadata(result),
    );
  }
}

function parseSingleLine(output, code, operation) {
  const value = output.replace(/\r?\n$/, "");

  if (
    value.length === 0 ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes("\uFFFD")
  ) {
    throw lifecycleError(code, operation);
  }

  return value;
}

function normalizeCommitId(value) {
  if (
    typeof value !== "string" ||
    !/^(?:[0-9a-fA-F]{40}|[0-9a-fA-F]{64})$/
      .test(value)
  ) {
    throw lifecycleError(
      OWNED_WORKSPACE_ERROR_CODES
        .COMMIT_INVALID,
      "validate_commit",
    );
  }

  return value.toLowerCase();
}

function normalizeStateName(value) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/
      .test(value) ||
    value === "." ||
    value === ".."
  ) {
    throw lifecycleError(
      OWNED_WORKSPACE_ERROR_CODES
        .CONTAINMENT_FAILED,
      "validate_state_name",
    );
  }

  return value;
}

function isContained(parent, candidate) {
  const pathFromParent =
    relative(parent, candidate);

  return (
    pathFromParent.length > 0 &&
    pathFromParent !== ".." &&
    !pathFromParent.startsWith("../") &&
    !isAbsolute(pathFromParent)
  );
}

function identity(stat) {
  return {
    device: stat.dev,
    inode: stat.ino,
  };
}

function sameIdentity(left, stat) {
  return (
    left !== null &&
    left.device === stat.dev &&
    left.inode === stat.ino
  );
}

async function statOrNull(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

function cleanupEvidence(invocation) {
  return {
    workspacePath: invocation.workspacePath,
    ownershipValidated:
      invocation.cleanupOwnershipValidated,
    resourcesRegistered:
      invocation.resources.map(
        (resource) => resource.path,
      ),
    worktreesCreated:
      invocation.resources
        .filter((resource) => resource.created)
        .map((resource) => resource.path),
    worktreesRemoved: [
      ...invocation.worktreesRemoved,
    ],
    workspaceRemoved:
      invocation.workspaceRemoved,
    cleanupCompleted:
      invocation.cleanupCompleted,
    cleanupFailureCodes: [
      ...invocation.cleanupFailureCodes,
    ],
    resourcesNotRemoved:
      invocation.resources
        .filter((resource) => !resource.removed)
        .map((resource) => resource.path),
  };
}

function freezeContext(context) {
  return Object.freeze(context);
}

/**
 * Creates a fail-closed owned workspace lifecycle.
 *
 * Worktrees isolate repository state; they do not sandbox code execution.
 * The caller must supply a complete environment and immutable commit IDs.
 */
export function createOwnedWorkspaceLifecycle(
  configuration = {},
) {
  const config =
    normalizeConfiguration(configuration);

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
      environment: {
        ...config.environment,
      },
      timeoutMs: config.timeoutMs,
      maxStdoutBytes:
        config.maxStdoutBytes,
      maxStderrBytes:
        config.maxStderrBytes,
    });
  }

  async function resolveConfiguredPaths() {
    let temporaryParentRealPath;
    let repositoryRealPath;

    try {
      temporaryParentRealPath =
        await realpath(
          config.temporaryParentDirectory,
        );
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKSPACE_CREATION_FAILED,
        "resolve_temporary_parent",
        filesystemMetadata(error),
      );
    }

    try {
      repositoryRealPath =
        await realpath(config.repositoryRoot);
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .REPOSITORY_INVALID,
        "resolve_repository_root",
        filesystemMetadata(error),
      );
    }

    const result = await runGit(
      repositoryRealPath,
      ["rev-parse", "--show-toplevel"],
    );

    assertCommandResult(
      result,
      "validate_repository_root",
      OWNED_WORKSPACE_ERROR_CODES
        .REPOSITORY_INVALID,
    );

    const reportedRoot = resolve(
      parseSingleLine(
        result.stdout,
        OWNED_WORKSPACE_ERROR_CODES
          .REPOSITORY_INVALID,
        "validate_repository_root",
      ),
    );

    let reportedRealPath;

    try {
      reportedRealPath =
        await realpath(reportedRoot);
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .REPOSITORY_INVALID,
        "validate_repository_root",
        filesystemMetadata(error),
      );
    }

    if (reportedRealPath !== repositoryRealPath) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .REPOSITORY_INVALID,
        "validate_repository_root",
      );
    }

    return {
      temporaryParentRealPath,
      repositoryRealPath,
    };
  }

  async function validateOwnership(invocation) {
    if (
      invocation.workspacePath ===
        invocation.temporaryParentRealPath ||
      invocation.workspacePath ===
        invocation.repositoryRealPath ||
      !isContained(
        invocation.temporaryParentRealPath,
        invocation.workspacePath,
      )
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .CONTAINMENT_FAILED,
        "validate_workspace_containment",
      );
    }

    const workspaceStat =
      await statOrNull(invocation.workspacePath);

    if (
      workspaceStat === null ||
      !workspaceStat.isDirectory() ||
      workspaceStat.isSymbolicLink()
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_workspace_identity",
      );
    }

    let workspaceRealPath;

    try {
      workspaceRealPath =
        await realpath(invocation.workspacePath);
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_workspace_identity",
        filesystemMetadata(error),
      );
    }

    if (
      workspaceRealPath !==
        invocation.workspaceRealPath ||
      !sameIdentity(
        invocation.workspaceIdentity,
        workspaceStat,
      )
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_workspace_identity",
      );
    }

    const markerStat =
      await statOrNull(invocation.markerPath);

    let openedMarkerStat;

    try {
      openedMarkerStat =
        await invocation.markerHandle.stat();
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_ownership_marker",
        filesystemMetadata(error),
      );
    }

    if (markerStat === null) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .MARKER_MISSING,
        "validate_ownership_marker",
      );
    }

    if (
      !markerStat.isFile() ||
      markerStat.isSymbolicLink() ||
      !sameIdentity(
        invocation.markerIdentity,
        markerStat,
      ) ||
      !sameIdentity(
        invocation.markerIdentity,
        openedMarkerStat,
      )
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_ownership_marker",
      );
    }

    let markerValue;

    try {
      markerValue =
        await readFile(
          invocation.markerPath,
          "utf8",
        );
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_ownership_marker",
        filesystemMetadata(error),
      );
    }

    if (markerValue !== invocation.markerValue) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .MARKER_MISMATCH,
        "validate_ownership_marker",
      );
    }

    invocation.cleanupOwnershipValidated = true;
  }

  async function validateResource(
    invocation,
    resource,
  ) {
    if (
      !isContained(
        invocation.workspaceRealPath,
        resource.path,
      )
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .CONTAINMENT_FAILED,
        "validate_resource_containment",
      );
    }

    const resourceStat =
      await statOrNull(resource.path);

    if (resourceStat === null) {
      return null;
    }

    let openedResourceStat;

    try {
      openedResourceStat =
        await resource.handle?.stat();
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_resource_identity",
        filesystemMetadata(error),
      );
    }

    if (
      !resourceStat.isDirectory() ||
      resourceStat.isSymbolicLink()
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_resource_identity",
      );
    }

    let resourceRealPath;

    try {
      resourceRealPath =
        await realpath(resource.path);
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_resource_identity",
        filesystemMetadata(error),
      );
    }

    if (
      resourceRealPath !== resource.path ||
      !isContained(
        invocation.workspaceRealPath,
        resourceRealPath,
      ) ||
      resource.identity === null ||
      resource.handle === null ||
      !sameIdentity(
        resource.identity,
        resourceStat,
      ) ||
      !sameIdentity(
        resource.identity,
        openedResourceStat,
      )
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .OWNERSHIP_VALIDATION_FAILED,
        "validate_resource_identity",
      );
    }

    return resourceStat;
  }

  async function listRegisteredWorktrees(
    invocation,
  ) {
    const result = await runGit(
      invocation.repositoryRealPath,
      ["worktree", "list", "--porcelain", "-z"],
    );

    assertCommandResult(
      result,
      "list_worktrees",
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_REMOVE_FAILED,
    );

    if (
      result.stdout.length > 0 &&
      !result.stdout.endsWith("\0")
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_REMOVE_FAILED,
        "parse_worktree_list",
      );
    }

    return new Set(
      result.stdout
        .split("\0")
        .filter((record) =>
          record.startsWith("worktree "))
        .map((record) =>
          record.slice("worktree ".length)),
    );
  }

  async function createDetachedWorktree(
    invocation,
    specification,
  ) {
    if (!isRecord(specification)) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .INVALID_CONFIGURATION,
        "validate_worktree_specification",
        { field: "worktreeSpecification" },
      );
    }

    const name =
      normalizeStateName(specification.name);
    const commitId =
      normalizeCommitId(specification.commitId);
    const targetPath =
      join(invocation.workspaceRealPath, name);

    if (
      !isContained(
        invocation.workspaceRealPath,
        targetPath,
      ) ||
      targetPath === invocation.repositoryRealPath
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .CONTAINMENT_FAILED,
        "validate_worktree_target",
      );
    }

    if (
      invocation.resources.some(
        (resource) =>
          resource.path === targetPath,
      ) ||
      await statOrNull(targetPath) !== null
    ) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .TARGET_EXISTS,
        "create_detached_worktree",
      );
    }

    const resource = {
      name,
      path: targetPath,
      commitId,
      created: false,
      removed: false,
      identity: null,
      handle: null,
    };

    invocation.resources.push(resource);

    const resolveResult = await runGit(
      invocation.repositoryRealPath,
      [
        "rev-parse",
        "--verify",
        "--quiet",
        "--end-of-options",
        `${commitId}^{commit}`,
      ],
    );

    assertCommandResult(
      resolveResult,
      "resolve_worktree_commit",
      OWNED_WORKSPACE_ERROR_CODES
        .COMMIT_UNRESOLVED,
    );

    const resolvedCommit =
      parseSingleLine(
        resolveResult.stdout,
        OWNED_WORKSPACE_ERROR_CODES
          .COMMIT_UNRESOLVED,
        "resolve_worktree_commit",
      ).toLowerCase();

    if (resolvedCommit !== commitId) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .COMMIT_UNRESOLVED,
        "resolve_worktree_commit",
      );
    }

    const addResult = await runGit(
      invocation.repositoryRealPath,
      [
        "worktree",
        "add",
        "--detach",
        "--",
        targetPath,
        commitId,
      ],
    );

    try {
      const partialStat =
        await statOrNull(targetPath);

      if (
        partialStat !== null &&
        partialStat.isDirectory() &&
        !partialStat.isSymbolicLink()
      ) {
        const partialRealPath =
          await realpath(targetPath);

        if (partialRealPath === targetPath) {
          const partialHandle =
            await open(targetPath, "r");
          const openedPartialStat =
            await partialHandle.stat();

          if (
            sameIdentity(
              identity(partialStat),
              openedPartialStat,
            )
          ) {
            resource.identity =
              identity(partialStat);
            resource.handle =
              partialHandle;
          } else {
            await partialHandle.close();
          }
        }
      }
    } catch {
      // Cleanup will fail closed when it validates the resource.
    }

    assertCommandResult(
      addResult,
      "add_detached_worktree",
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_ADD_FAILED,
    );

    resource.created = true;

    if (resource.identity === null) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_IDENTITY_MISMATCH,
        "verify_worktree_identity",
      );
    }

    const headResult = await runGit(
      targetPath,
      ["rev-parse", "HEAD"],
    );

    assertCommandResult(
      headResult,
      "verify_worktree_head",
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_IDENTITY_MISMATCH,
    );

    const actualHead =
      parseSingleLine(
        headResult.stdout,
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_IDENTITY_MISMATCH,
        "verify_worktree_head",
      ).toLowerCase();

    if (actualHead !== commitId) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_IDENTITY_MISMATCH,
        "verify_worktree_head",
      );
    }

    const detachedResult = await runGit(
      targetPath,
      ["symbolic-ref", "--quiet", "HEAD"],
    );

    assertCommandResult(
      detachedResult,
      "verify_detached_head",
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_NOT_DETACHED,
      [1],
    );

    const statusResult = await runGit(
      targetPath,
      [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
      ],
    );

    assertCommandResult(
      statusResult,
      "verify_clean_worktree",
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_DIRTY,
    );

    if (statusResult.stdout !== "") {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_DIRTY,
        "verify_clean_worktree",
      );
    }

    return Object.freeze({
      name,
      path: targetPath,
      commitId,
      detached: true,
      clean: true,
    });
  }

  async function cleanInvocation(invocation) {
    try {
      await validateOwnership(invocation);
    } catch (error) {
      invocation.cleanupFailureCodes.push(
        error instanceof
          OwnedWorkspaceLifecycleError
          ? error.code
          : OWNED_WORKSPACE_ERROR_CODES
              .OWNERSHIP_VALIDATION_FAILED,
      );
      return cleanupEvidence(invocation);
    }

    for (
      let index =
        invocation.resources.length - 1;
      index >= 0;
      index -= 1
    ) {
      const resource =
        invocation.resources[index];

      try {
        const resourceStat =
          await validateResource(
            invocation,
            resource,
          );

        const registrations =
          await listRegisteredWorktrees(
            invocation,
          );
        const removalWasRequired =
          resource.created ||
          resourceStat !== null ||
          registrations.has(resource.path);

        if (registrations.has(resource.path)) {
          const removeResult = await runGit(
            invocation.repositoryRealPath,
            [
              "worktree",
              "remove",
              "--force",
              "--",
              resource.path,
            ],
          );

          assertCommandResult(
            removeResult,
            "remove_registered_worktree",
            OWNED_WORKSPACE_ERROR_CODES
              .WORKTREE_REMOVE_FAILED,
          );
        } else if (resourceStat !== null) {
          await rm(resource.path, {
            recursive: true,
            force: false,
          });
        }

        const remainingRegistrations =
          await listRegisteredWorktrees(
            invocation,
          );
        const remainingStat =
          await statOrNull(resource.path);

        if (
          remainingRegistrations.has(
            resource.path,
          ) ||
          remainingStat !== null
        ) {
          throw lifecycleError(
            OWNED_WORKSPACE_ERROR_CODES
              .WORKTREE_REMOVE_FAILED,
            "verify_worktree_removed",
          );
        }

        resource.removed = true;

        if (removalWasRequired) {
          invocation.worktreesRemoved.push(
            resource.path,
          );
        }
      } catch (error) {
        invocation.cleanupFailureCodes.push(
          error instanceof
            OwnedWorkspaceLifecycleError
            ? error.code
            : OWNED_WORKSPACE_ERROR_CODES
                .WORKTREE_REMOVE_FAILED,
        );
      }
    }

    if (
      invocation.resources.some(
        (resource) => !resource.removed,
      )
    ) {
      invocation.cleanupFailureCodes.push(
        OWNED_WORKSPACE_ERROR_CODES
          .INCOMPLETE_CLEANUP,
      );
      return cleanupEvidence(invocation);
    }

    try {
      await validateOwnership(invocation);
      await rm(invocation.workspacePath, {
        recursive: true,
        force: false,
      });

      if (
        await statOrNull(
          invocation.workspacePath,
        ) !== null
      ) {
        throw lifecycleError(
          OWNED_WORKSPACE_ERROR_CODES
            .WORKSPACE_REMOVE_FAILED,
          "verify_workspace_removed",
        );
      }

      invocation.workspaceRemoved = true;
    } catch (error) {
      invocation.cleanupFailureCodes.push(
        error instanceof
          OwnedWorkspaceLifecycleError
          ? error.code
          : OWNED_WORKSPACE_ERROR_CODES
              .WORKSPACE_REMOVE_FAILED,
      );
    }

    invocation.cleanupCompleted =
      invocation.workspaceRemoved &&
      invocation.cleanupFailureCodes.length === 0;

    if (!invocation.cleanupCompleted) {
      invocation.cleanupFailureCodes.push(
        OWNED_WORKSPACE_ERROR_CODES
          .INCOMPLETE_CLEANUP,
      );
    }

    return cleanupEvidence(invocation);
  }

  async function createInvocation() {
    const {
      temporaryParentRealPath,
      repositoryRealPath,
    } = await resolveConfiguredPaths();

    let workspacePath;

    try {
      workspacePath = await mkdtemp(
        join(
          temporaryParentRealPath,
          config.workspacePrefix,
        ),
      );
    } catch (error) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .WORKSPACE_CREATION_FAILED,
        "create_workspace",
        filesystemMetadata(error),
      );
    }

    const workspaceRealPath =
      await realpath(workspacePath);
    const workspaceStat =
      await lstat(workspacePath);
    const ownershipToken = randomUUID();
    const markerValue =
      `change-proof-owned:${ownershipToken}\n`;
    const markerPath = join(
      workspaceRealPath,
      OWNED_WORKSPACE_MARKER,
    );

    let markerHandle;

    try {
      markerHandle = await open(
        markerPath,
        "wx",
        0o600,
      );
      await markerHandle.writeFile(
        markerValue,
        "utf8",
      );
    } catch (error) {
      await markerHandle?.close();
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .MARKER_CREATION_FAILED,
        "create_ownership_marker",
        filesystemMetadata(error),
      );
    }

    const markerStat =
      await lstat(markerPath);

    return {
      temporaryParentRealPath,
      repositoryRealPath,
      workspacePath: workspaceRealPath,
      workspaceRealPath,
      workspaceIdentity:
        identity(workspaceStat),
      ownershipToken,
      markerPath,
      markerValue,
      markerIdentity: identity(markerStat),
      markerHandle,
      resources: [],
      worktreesRemoved: [],
      cleanupOwnershipValidated: false,
      workspaceRemoved: false,
      cleanupCompleted: false,
      cleanupFailureCodes: [],
    };
  }

  async function withOwnedWorkspace(callback) {
    if (typeof callback !== "function") {
      invalidConfiguration("callback");
    }

    const invocation =
      await createInvocation();
    const context = freezeContext({
      workspacePath:
        invocation.workspacePath,
      ownershipToken:
        invocation.ownershipToken,
      markerPath:
        invocation.markerPath,
      createDetachedWorktree:
        async (specification) =>
          await createDetachedWorktree(
            invocation,
            specification,
          ),
    });

    let value;
    let primaryError = null;

    try {
      value = await callback(context);
    } catch (error) {
      primaryError = error;
    }

    let cleanup;

    try {
      cleanup =
        await cleanInvocation(invocation);
    } finally {
      await invocation.markerHandle.close();

      for (const resource of
        invocation.resources) {
        await resource.handle?.close();
      }
    }

    if (primaryError !== null) {
      if (cleanup.cleanupCompleted) {
        if (
          primaryError !== null &&
          (
            typeof primaryError === "object" ||
            typeof primaryError === "function"
          )
        ) {
          try {
            Object.defineProperty(
              primaryError,
              "cleanup",
              {
                value: cleanup,
                enumerable: false,
                configurable: true,
              },
            );
          } catch {
            // Exact primary-error identity takes precedence.
          }
        }

        throw primaryError;
      }

      const combined = lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .PRIMARY_AND_CLEANUP_FAILURE,
        "run_owned_workspace",
        { cleanup },
        primaryError,
      );

      Object.defineProperty(
        combined,
        "primaryError",
        {
          value: primaryError,
          enumerable: false,
        },
      );

      throw combined;
    }

    if (!cleanup.cleanupCompleted) {
      throw lifecycleError(
        OWNED_WORKSPACE_ERROR_CODES
          .INCOMPLETE_CLEANUP,
        "cleanup_owned_workspace",
        { cleanup },
      );
    }

    return {
      value,
      cleanup,
    };
  }

  return Object.freeze({
    withOwnedWorkspace,
  });
}
