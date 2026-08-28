import {
  lstat,
  realpath,
} from "node:fs/promises";

import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  createGitRepositoryPrimitives,
} from "./git-repository-primitives.mjs";

import {
  createOwnedWorkspaceLifecycle,
} from "./owned-workspace-lifecycle.mjs";

import {
  createExplicitEnvelopeMaterializer,
} from "./materialize-explicit-envelope.mjs";

import {
  runBoundedCommand,
} from "./run-bounded-command.mjs";

import {
  classifyNodeTestExecution,
  inspectNodeTestEvidence,
} from "./classify-node-test.mjs";

import {
  resolveStateWorkingDirectory,
} from "./resolve-state-working-directory.mjs";

import {
  buildPrepareCandidate,
} from "./prepare-candidate.mjs";

import {
  computeRepositoryContextSha256,
} from "./provenance-digests.mjs";

import {
  writeExclusiveArtifact,
} from "../cli/write-exclusive-artifact.mjs";

export const PREPARE_RUN_ERROR_CODES =
  Object.freeze({
    INVALID_INPUT:
      "PREPARE_RUN_INVALID_INPUT",

    REPOSITORY_CONTEXT_FAILED:
      "PREPARE_RUN_REPOSITORY_CONTEXT_FAILED",

    EXECUTION_OPERATIONAL_FAILURE:
      "PREPARE_RUN_EXECUTION_OPERATIONAL_FAILURE",

    CANDIDATE_TARGET_INVALID:
      "PREPARE_RUN_CANDIDATE_TARGET_INVALID",

    CANDIDATE_TARGET_INSIDE_REPOSITORY:
      "PREPARE_RUN_CANDIDATE_TARGET_INSIDE_REPOSITORY",

    CLEANUP_NOT_VERIFIED:
      "PREPARE_RUN_CLEANUP_NOT_VERIFIED",

    SERIALIZATION_FAILED:
      "PREPARE_RUN_SERIALIZATION_FAILED",
  });

export class PrepareRunError
  extends Error {
  constructor(
    code,
    stage,
    details = {},
    cause = null,
  ) {
    super(code);

    this.name =
      "PrepareRunError";

    this.code =
      code;

    this.stage =
      stage;

    for (
      const [key, value]
      of Object.entries(details)
    ) {
      this[key] = value;
    }

    if (cause !== null) {
      Object.defineProperty(
        this,
        "cause",
        {
          configurable: true,
          enumerable: false,
          value: cause,
          writable: false,
        },
      );
    }
  }
}

function prepareError(
  code,
  stage,
  details = {},
  cause = null,
) {
  return new PrepareRunError(
    code,
    stage,
    details,
    cause,
  );
}

function isRecord(
  value,
) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function isContained(
  parent,
  child,
) {
  const relation =
    relative(
      parent,
      child,
    );

  return (
    relation === "" ||
    (
      relation !== ".." &&
      !relation.startsWith(
        `..${sep}`,
      ) &&
      !isAbsolute(
        relation,
      )
    )
  );
}

function requirePrepareInput(
  input,
) {
  if (
    !isRecord(input) ||
    !isRecord(
      input.prepareConfig,
    ) ||
    typeof input.prepareToolVersion !==
      "string" ||
    input.prepareToolVersion.length === 0 ||
    typeof input.candidatePath !==
      "string" ||
    input.candidatePath.length === 0
  ) {
    throw prepareError(
      PREPARE_RUN_ERROR_CODES
        .INVALID_INPUT,
      "validate_input",
    );
  }

  return input.prepareConfig;
}

function notRun() {
  return {
    status:
      "NOT_RUN",
  };
}

function notEvaluated() {
  return {
    status:
      "NOT_EVALUATED",
  };
}

function observed(
  testOutcome,
  inspection,
) {
  return {
    status:
      "OBSERVED",

    testOutcome,

    inspection,
  };
}

function executionProcessOperational(
  executionResult,
) {
  return (
    executionResult.timedOut === true ||
    executionResult.processErrorCode !==
      null ||
    executionResult.signal !== null ||
    executionResult.stdoutTruncated ===
      true ||
    executionResult.stderrTruncated ===
      true
  );
}

function throwOperational(
  inspection,
  classification = null,
) {
  throw prepareError(
    PREPARE_RUN_ERROR_CODES
      .EXECUTION_OPERATIONAL_FAILURE,
    "execution",
    {
      structuralStatus:
        inspection.structuralStatus,

      classificationOutcome:
        classification?.outcome ??
        null,

      classificationReasonCode:
        classification?.reasonCode ??
        null,
    },
  );
}

function mapExecutionToObservation(
  executionResult,
  dependencies,
) {
  const inspection =
    dependencies
      .inspectNodeTestEvidence(
        executionResult,
      );

  if (
    executionProcessOperational(
      executionResult,
    )
  ) {
    throwOperational(
      inspection,
    );
  }

  const observedCount =
    inspection.observedTestCount;

  let classification = null;

  if (
    Number.isSafeInteger(
      observedCount,
    ) &&
    observedCount > 0
  ) {
    classification =
      dependencies
        .classifyNodeTestExecution({
          executionResult,

          expectedTestCount:
            observedCount,
        });

    if (
      classification.invalidFailure ===
        true
    ) {
      throwOperational(
        inspection,
        classification,
      );
    }
  }

  if (
    inspection.structuralStatus ===
      "LOAD_FAILURE"
  ) {
    throwOperational(
      inspection,
      classification,
    );
  }

  if (
    classification !== null &&
    classification.outcome ===
      "PASS" &&
    classification.reasonCode ===
      "NODE_TEST_PASS"
  ) {
    return observed(
      "PASS",
      inspection,
    );
  }

  if (
    inspection.structuralStatus ===
      "COMPLETE" &&
    classification !== null &&
    (
      classification.reasonCode ===
        "ASSERTION_REQUIRES_EXPECTATION" ||
      classification.reasonCode ===
        "UNSUPPORTED_TEST_FAILURE"
    )
  ) {
    return observed(
      "FAIL",
      inspection,
    );
  }

  return observed(
    "UNCLASSIFIABLE",
    inspection,
  );
}

async function validateCandidateTarget(
  {
    candidatePath,
    repositoryRootRealpath,
    gitCommonDirRealpath,
  },
  dependencies,
) {
  const absoluteTarget =
    resolve(
      candidatePath,
    );

  const parent =
    dirname(
      absoluteTarget,
    );

  let metadata;
  let canonicalParent;

  try {
    metadata =
      await dependencies.lstat(
        parent,
      );

    canonicalParent =
      await dependencies.realpath(
        parent,
      );
  } catch (error) {
    throw prepareError(
      PREPARE_RUN_ERROR_CODES
        .CANDIDATE_TARGET_INVALID,
      "validate_candidate_target",
      {},
      error,
    );
  }

  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    canonicalParent !==
      resolve(parent)
  ) {
    throw prepareError(
      PREPARE_RUN_ERROR_CODES
        .CANDIDATE_TARGET_INVALID,
      "validate_candidate_target",
    );
  }

  const canonicalTarget =
    resolve(
      canonicalParent,
      basename(
        absoluteTarget,
      ),
    );

  if (
    isContained(
      repositoryRootRealpath,
      canonicalTarget,
    ) ||
    isContained(
      gitCommonDirRealpath,
      canonicalTarget,
    )
  ) {
    throw prepareError(
      PREPARE_RUN_ERROR_CODES
        .CANDIDATE_TARGET_INSIDE_REPOSITORY,
      "validate_candidate_target",
    );
  }

  return canonicalTarget;
}

function serializeCandidate(
  candidate,
) {
  try {
    return (
      JSON.stringify(
        candidate,
        null,
        2,
      ) +
      "\n"
    );
  } catch (error) {
    throw prepareError(
      PREPARE_RUN_ERROR_CODES
        .SERIALIZATION_FAILED,
      "serialize_candidate",
      {},
      error,
    );
  }
}

const DEFAULT_DEPENDENCIES =
  Object.freeze({
    buildPrepareCandidate,
    classifyNodeTestExecution,
    computeRepositoryContextSha256,
    createExplicitEnvelopeMaterializer,
    createGitRepositoryPrimitives,
    createOwnedWorkspaceLifecycle,
    inspectNodeTestEvidence,
    lstat,
    realpath,
    resolveStateWorkingDirectory,
    runBoundedCommand,
    writeExclusiveArtifact,
  });

export function createPrepareRunner(
  overrides = {},
) {
  const dependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...overrides,
  };

  async function runPrepare(
    input,
    configuration,
  ) {
    const prepareConfig =
      requirePrepareInput(
        input,
      );

    const primitives =
      dependencies
        .createGitRepositoryPrimitives(
          configuration,
        );

    let repositoryRootRealpath;
    let gitCommonDirRealpath;
    let baseCommitId;
    let headCommitId;

    try {
      const repositoryRoot =
        await primitives
          .resolveRepositoryRoot(
            prepareConfig.repositoryRoot,
          );

      repositoryRootRealpath =
        await dependencies.realpath(
          repositoryRoot,
        );

      gitCommonDirRealpath =
        await primitives
          .resolveGitCommonDir(
            repositoryRootRealpath,
          );

      baseCommitId =
        await primitives
          .resolveCommit(
            repositoryRootRealpath,
            prepareConfig.baseRef,
          );

      headCommitId =
        await primitives
          .resolveCommit(
            repositoryRootRealpath,
            prepareConfig.headRef,
          );
    } catch (error) {
      throw prepareError(
        PREPARE_RUN_ERROR_CODES
          .REPOSITORY_CONTEXT_FAILED,
        "resolve_repository_context",
        {},
        error,
      );
    }

    const repositoryContextSha256 =
      dependencies
        .computeRepositoryContextSha256({
          repositoryRootRealpath,

          gitCommonDirRealpath,
        });

    const candidateTarget =
      await validateCandidateTarget(
        {
          candidatePath:
            input.candidatePath,

          repositoryRootRealpath,

          gitCommonDirRealpath,
        },
        dependencies,
      );

    const lifecycle =
      dependencies
        .createOwnedWorkspaceLifecycle({
          ...configuration,

          repositoryRoot:
            repositoryRootRealpath,

          temporaryParentDirectory:
            prepareConfig
              .temporaryParentDirectory,

          workspacePrefix:
            prepareConfig
              .workspacePrefix,
        });

    const materializer =
      dependencies
        .createExplicitEnvelopeMaterializer(
          configuration,
        );

    const lifecycleResult =
      await lifecycle
        .withOwnedWorkspace(
          async (invocation) => {
            const stateAWorktree =
              await invocation
                .createDetachedWorktree({
                  name:
                    "state-a",

                  commitId:
                    baseCommitId,
                });

            const stateBWorktree =
              await invocation
                .createDetachedWorktree({
                  name:
                    "state-b",

                  commitId:
                    headCommitId,
                });

            const executeState =
              async (
                worktreePath,
              ) => {
                const workingDirectory =
                  await dependencies
                    .resolveStateWorkingDirectory(
                      worktreePath,
                      prepareConfig
                        .command
                        .workingDirectory,
                    );

                const executionResult =
                  await dependencies
                    .runBoundedCommand({
                      executable:
                        prepareConfig
                          .command
                          .executable,

                      arguments: [
                        ...prepareConfig
                          .command
                          .arguments,
                      ],

                      workingDirectory,

                      environment: {
                        ...prepareConfig
                          .command
                          .environment,
                      },

                      timeoutMs:
                        prepareConfig
                          .command
                          .timeoutMs,

                      maxStdoutBytes:
                        prepareConfig
                          .command
                          .maxStdoutBytes,

                      maxStderrBytes:
                        prepareConfig
                          .command
                          .maxStderrBytes,
                    });

                return mapExecutionToObservation(
                  executionResult,
                  dependencies,
                );
              };

            const stateA =
              await executeState(
                stateAWorktree.path,
              );

            if (
              stateA.testOutcome !==
                "PASS"
            ) {
              return {
                states: {
                  stateA,

                  stateB:
                    notRun(),

                  stateC:
                    notRun(),
                },

                boundary:
                  notEvaluated(),
              };
            }

            const stateB =
              await executeState(
                stateBWorktree.path,
              );

            if (
              stateB.testOutcome !==
                "PASS"
            ) {
              return {
                states: {
                  stateA,
                  stateB,

                  stateC:
                    notRun(),
                },

                boundary:
                  notEvaluated(),
              };
            }

            const materialized =
              await materializer
                .materializeExplicitEnvelope(
                  invocation,
                  {
                    repositoryRoot:
                      repositoryRootRealpath,

                    baseCommitId,

                    headCommitId,

                    includedPaths: [
                      ...prepareConfig
                        .envelope
                        .includedPaths,
                    ],
                  },
                );

            const boundaryEvidence =
              materialized.boundary;

            const boundary = {
              status:
                "OBSERVED",

              ...boundaryEvidence,
            };

            if (
              boundaryEvidence.boundaryValid !==
                true
            ) {
              return {
                states: {
                  stateA,
                  stateB,

                  stateC:
                    notRun(),
                },

                boundary,
              };
            }

            const stateC =
              await executeState(
                materialized
                  .stateCWorktreePath,
              );

            return {
              states: {
                stateA,
                stateB,
                stateC,
              },

              boundary,
            };
          },
        );

    if (
      lifecycleResult.cleanup
        .cleanupCompleted !==
      true
    ) {
      throw prepareError(
        PREPARE_RUN_ERROR_CODES
          .CLEANUP_NOT_VERIFIED,
        "verify_cleanup",
      );
    }

    /*
     * Frozen invariant:
     * candidate construction occurs only after lifecycle cleanup
     * has successfully returned.
     */
    const candidateInput = {
      prepareConfig,

      prepareToolVersion:
        input.prepareToolVersion,

      repositoryContextSha256,

      resolvedCommits: {
        base:
          baseCommitId,

        head:
          headCommitId,
      },

      cleanupVerified:
        true,

      states:
        lifecycleResult.value.states,

      boundary:
        lifecycleResult.value.boundary,
    };

    if (
      Object.hasOwn(
        input,
        "metadata",
      )
    ) {
      candidateInput.metadata =
        input.metadata;
    }

    const candidate =
      dependencies
        .buildPrepareCandidate(
          candidateInput,
        );

    const artifact =
      await dependencies
        .writeExclusiveArtifact({
          targetPath:
            candidateTarget,

          content:
            serializeCandidate(
              candidate,
            ),
        });

    return Object.freeze({
      candidate,

      candidatePath:
        artifact.targetPath,

      cleanup:
        lifecycleResult.cleanup,
    });
  }

  return Object.freeze({
    runPrepare,
  });
}

const defaultRunner =
  createPrepareRunner();

export const runPrepare =
  defaultRunner.runPrepare;
