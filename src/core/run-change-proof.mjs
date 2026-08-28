import {
  resolveStateWorkingDirectory,
} from "./resolve-state-working-directory.mjs";

import { realpath } from "node:fs/promises";
import {
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import {
  buildEvidenceReport,
  serializeEvidenceReport,
} from "./build-evidence-report.mjs";
import {
  classifyExpectedNodeTestRegression,
  classifyNodeTestExecution,
} from "./classify-node-test.mjs";
import {
  evaluateEvidence,
} from "./evaluate-evidence.mjs";
import {
  createGitRepositoryPrimitives,
} from "./git-repository-primitives.mjs";
import {
  createExplicitEnvelopeMaterializer,
} from "./materialize-explicit-envelope.mjs";
import {
  createOwnedWorkspaceLifecycle,
} from "./owned-workspace-lifecycle.mjs";
import {
  renderEvidenceReportMarkdown,
} from "./render-evidence-report-markdown.mjs";
import {
  runBoundedCommand,
} from "./run-bounded-command.mjs";

const GIT_EXECUTABLE = "git";

const LIMITATIONS = Object.freeze([
  "Only explicitly selected paths were evaluated.",
  "The result does not prove implementation correctness.",
  "Worktrees provide state isolation but not a security sandbox.",
  "Trusted local repository code was executed.",
  "Dependencies were not discovered automatically.",
  "Relevant tests were not discovered automatically.",
]);

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function invalidInput(field) {
  throw new Error(`invalid_change_proof_input:${field}`);
}

function requireString(field, value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    invalidInput(field);
  }

  return value;
}

function requirePositiveInteger(field, value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  ) {
    invalidInput(field);
  }

  return value;
}

function normalizeEnvironment(value) {
  if (!isRecord(value)) {
    invalidInput("command.environment");
  }

  const environment = {};

  for (const key of Object.keys(value).sort()) {
    const item = value[key];

    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0") ||
      typeof item !== "string" ||
      item.includes("\0")
    ) {
      invalidInput("command.environment");
    }

    environment[key] = item;
  }

  return environment;
}

function normalizeArguments(value) {
  if (!Array.isArray(value)) {
    invalidInput("command.arguments");
  }

  return value.map((argument) => {
    if (
      typeof argument !== "string" ||
      argument.includes("\0")
    ) {
      invalidInput("command.arguments");
    }

    return argument;
  });
}

function normalizeWorkingDirectory(value) {
  requireString("command.workingDirectory", value);

  if (
    isAbsolute(value) ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.includes("\\") ||
    value.split("/").includes("..")
  ) {
    invalidInput("command.workingDirectory");
  }

  return value;
}

function normalizeIncludedPaths(value) {
  if (!Array.isArray(value) || value.length === 0) {
    invalidInput("envelope.includedPaths");
  }

  const paths = value.map((path) => {
    requireString("envelope.includedPaths", path);

    const segments = path.split("/");

    if (
      isAbsolute(path) ||
      /^[A-Za-z]:[\\/]/.test(path) ||
      path.includes("\\") ||
      segments.some((segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === "..")
    ) {
      invalidInput("envelope.includedPaths");
    }

    return path;
  });

  if (new Set(paths).size !== paths.length) {
    invalidInput("envelope.includedPaths");
  }

  return paths.sort();
}

function normalizeExpectedFailures(value) {
  if (!Array.isArray(value) || value.length === 0) {
    invalidInput(
      "classification.stateC.expectedFailures",
    );
  }

  return value.map((failure) => {
    if (!isRecord(failure)) {
      invalidInput(
        "classification.stateC.expectedFailures",
      );
    }

    const testName = requireString(
      "classification.stateC.expectedFailures.testName",
      failure.testName,
    );

    if (
      !Array.isArray(failure.outputIncludes) ||
      failure.outputIncludes.length === 0
    ) {
      invalidInput(
        "classification.stateC.expectedFailures.outputIncludes",
      );
    }

    const outputIncludes =
      failure.outputIncludes.map((fragment) =>
        requireString(
          "classification.stateC.expectedFailures.outputIncludes",
          fragment,
        ));

    return {
      testName,
      outputIncludes,
    };
  });
}

function normalizeInput(input) {
  if (!isRecord(input)) {
    invalidInput("input");
  }

  const command = input.command;
  const envelope = input.envelope;
  const classification = input.classification;

  if (
    !isRecord(command) ||
    !isRecord(envelope) ||
    !isRecord(classification) ||
    !isRecord(classification.stateA) ||
    !isRecord(classification.stateB) ||
    !isRecord(classification.stateC)
  ) {
    invalidInput("input");
  }

  const repositoryRoot = resolve(requireString(
    "repositoryRoot",
    input.repositoryRoot,
  ));

  return {
    repositoryRoot,
    baseRef: requireString("baseRef", input.baseRef),
    headRef: requireString("headRef", input.headRef),
    command: {
      executable: requireString(
        "command.executable",
        command.executable,
      ),
      arguments: normalizeArguments(command.arguments),
      workingDirectory: normalizeWorkingDirectory(
        command.workingDirectory,
      ),
      environment: normalizeEnvironment(
        command.environment,
      ),
      timeoutMs: requirePositiveInteger(
        "command.timeoutMs",
        command.timeoutMs,
      ),
      maxStdoutBytes: requirePositiveInteger(
        "command.maxStdoutBytes",
        command.maxStdoutBytes,
      ),
      maxStderrBytes: requirePositiveInteger(
        "command.maxStderrBytes",
        command.maxStderrBytes,
      ),
    },
    envelope: {
      includedPaths: normalizeIncludedPaths(
        envelope.includedPaths,
      ),
    },
    classification: {
      stateA: {
        expectedTestCount: requirePositiveInteger(
          "classification.stateA.expectedTestCount",
          classification.stateA.expectedTestCount,
        ),
      },
      stateB: {
        expectedTestCount: requirePositiveInteger(
          "classification.stateB.expectedTestCount",
          classification.stateB.expectedTestCount,
        ),
      },
      stateC: {
        expectedTestCount: requirePositiveInteger(
          "classification.stateC.expectedTestCount",
          classification.stateC.expectedTestCount,
        ),
        expectedFailures: normalizeExpectedFailures(
          classification.stateC.expectedFailures,
        ),
      },
    },
    toolVersion: requireString(
      "toolVersion",
      input.toolVersion,
    ),
    temporaryParentDirectory: resolve(requireString(
      "temporaryParentDirectory",
      input.temporaryParentDirectory,
    )),
    workspacePrefix: requireString(
      "workspacePrefix",
      input.workspacePrefix,
    ),
  };
}

function notRunState(reasonCode) {
  return {
    framework: "node:test",
    outcome: "NOT_RUN",
    reasonCode,
    testDiscovered: false,
    testExecuted: false,
    assertionObserved: false,
    invalidFailure: false,
    tapVersionPresent: false,
    summary: null,
    failedSubtests: [],
  };
}

function emptyBoundary(reasonCode) {
  return {
    valid: false,
    basedOnBase: false,
    selectedPathsMatchHead: false,
    unchangedPathsMatchBase: false,
    resultingChangedPaths: [],
    reasonCodes: [reasonCode],
  };
}

async function executeState(
  worktreePath,
  command,
  classification,
  expectedFailures = null,
) {
  const workingDirectory =
    await resolveStateWorkingDirectory(
      worktreePath,
      command.workingDirectory,
    );
  const execution = await runBoundedCommand({
    executable: command.executable,
    arguments: [...command.arguments],
    workingDirectory,
    environment: { ...command.environment },
    timeoutMs: command.timeoutMs,
    maxStdoutBytes: command.maxStdoutBytes,
    maxStderrBytes: command.maxStderrBytes,
  });
  const classified = expectedFailures === null
    ? classifyNodeTestExecution({
        executionResult: execution,
        expectedTestCount:
          classification.expectedTestCount,
      })
    : classifyExpectedNodeTestRegression({
        executionResult: execution,
        expectedTestCount:
          classification.expectedTestCount,
        expectedFailures: expectedFailures.map(
          (failure) => ({
            testName: failure.testName,
            outputIncludes: [
              ...failure.outputIncludes,
            ],
          }),
        ),
      });

  return {
    execution,
    classification: classified,
  };
}

function projectExecution(execution) {
  if (execution === null) {
    return null;
  }

  return {
    exitCode: execution.exitCode,
    signal: execution.signal,
    timedOut: execution.timedOut,
    processErrorCode: execution.processErrorCode,
    stdoutTruncated: execution.stdoutTruncated,
    stderrTruncated: execution.stderrTruncated,
    durationMs: execution.durationMs,
  };
}

function cloneSummary(summary) {
  if (!isRecord(summary)) {
    return null;
  }

  return {
    tests: summary.tests,
    pass: summary.pass,
    fail: summary.fail,
    cancelled: summary.cancelled,
    skipped: summary.skipped,
    todo: summary.todo,
  };
}

function projectState(commitId, internalState) {
  const classification = internalState.classification;

  return {
    commitId,
    framework: classification.framework ?? null,
    outcome: classification.outcome,
    reasonCode: classification.reasonCode ?? null,
    testDiscovered:
      classification.testDiscovered === true,
    testExecuted:
      classification.testExecuted === true,
    assertionObserved:
      classification.assertionObserved === true,
    invalidFailure:
      classification.invalidFailure === true,
    tapVersionPresent:
      classification.tapVersionPresent === true,
    summary: cloneSummary(classification.summary),
    failedSubtests: Array.isArray(
      classification.failedSubtests,
    )
      ? [...classification.failedSubtests]
      : [],
    execution: projectExecution(
      internalState.execution,
    ),
  };
}

function projectBoundary(boundary) {
  return {
    valid: boundary.valid === true,
    basedOnBase: boundary.basedOnBase === true,
    selectedPathsMatchHead:
      boundary.selectedPathsMatchHead === true,
    unchangedPathsMatchBase:
      boundary.unchangedPathsMatchBase === true,
    resultingChangedPaths: [
      ...boundary.resultingChangedPaths,
    ],
    reasonCodes: [...boundary.reasonCodes],
  };
}

function emptyEnvelope(requestedIncludedPaths, changedPaths) {
  return {
    requestedIncludedPaths: [
      ...requestedIncludedPaths,
    ],
    includedPaths: [],
    excludedChangedPaths: changedPaths.filter(
      (path) => !requestedIncludedPaths.includes(path),
    ),
    headChangedPaths: [...changedPaths],
    materializedPaths: [],
    resultingChangedPaths: [],
    baseBlobIds: {},
    headBlobIds: {},
    stateCBlobIds: {},
    baseModes: {},
    headModes: {},
    stateCModes: {},
  };
}

function projectEnvelope(requestedIncludedPaths, evidence) {
  if (evidence === null) {
    return null;
  }

  return {
    requestedIncludedPaths: [
      ...requestedIncludedPaths,
    ],
    includedPaths: [...evidence.includedPaths],
    excludedChangedPaths: [
      ...evidence.excludedChangedPaths,
    ],
    headChangedPaths: [
      ...evidence.headChangedPaths,
    ],
    materializedPaths: [
      ...evidence.materializedPaths,
    ],
    resultingChangedPaths: [
      ...evidence.resultingChangedPaths,
    ],
    baseBlobIds: { ...evidence.baseBlobIds },
    headBlobIds: { ...evidence.headBlobIds },
    stateCBlobIds: { ...evidence.stateCBlobIds },
    baseModes: { ...evidence.baseModes },
    headModes: { ...evidence.headModes },
    stateCModes: { ...evidence.stateCModes },
  };
}

function projectWorkspace(cleanup) {
  return {
    ownershipValidated:
      cleanup.ownershipValidated === true,
    resourcesRegistered:
      cleanup.resourcesRegistered.length,
    worktreesCreated:
      cleanup.worktreesCreated.length,
    worktreesRemoved:
      cleanup.worktreesRemoved.length,
    workspaceRemoved:
      cleanup.workspaceRemoved === true,
    cleanupCompleted:
      cleanup.cleanupCompleted === true,
    cleanupFailureCodes: [
      ...cleanup.cleanupFailureCodes,
    ],
    resourcesNotRemoved:
      cleanup.resourcesNotRemoved.length,
  };
}

function processConfiguration(input) {
  return {
    gitExecutable: GIT_EXECUTABLE,
    environment: { ...input.command.environment },
    timeoutMs: input.command.timeoutMs,
    maxStdoutBytes: input.command.maxStdoutBytes,
    maxStderrBytes: input.command.maxStderrBytes,
  };
}

/**
 * Runs the internal three-state Change Proof engine without writing files.
 */
export async function runChangeProof(input) {
  const startedAtMilliseconds = Date.now();
  const startedAt = new Date(
    startedAtMilliseconds,
  ).toISOString();
  const normalized = normalizeInput(input);
  const configuration = processConfiguration(normalized);
  const primitives =
    createGitRepositoryPrimitives(configuration);
  const repositoryRoot =
    await primitives.resolveRepositoryRoot(
      normalized.repositoryRoot,
    );
  const baseCommitId = await primitives.resolveCommit(
    repositoryRoot,
    normalized.baseRef,
  );
  const headCommitId = await primitives.resolveCommit(
    repositoryRoot,
    normalized.headRef,
  );
  const changedPaths = await primitives.listChangedPaths(
    repositoryRoot,
    baseCommitId,
    headCommitId,
  );
  const lifecycle = createOwnedWorkspaceLifecycle({
    ...configuration,
    temporaryParentDirectory:
      normalized.temporaryParentDirectory,
    workspacePrefix: normalized.workspacePrefix,
    repositoryRoot,
  });
  const materializer =
    createExplicitEnvelopeMaterializer(configuration);

  const lifecycleResult =
    await lifecycle.withOwnedWorkspace(
      async (invocation) => {
        const stateAWorktree =
          await invocation.createDetachedWorktree({
            name: "state-a",
            commitId: baseCommitId,
          });
        const stateA = await executeState(
          stateAWorktree.path,
          normalized.command,
          normalized.classification.stateA,
        );

        if (
          stateA.classification.outcome !== "PASS" ||
          stateA.classification.invalidFailure === true
        ) {
          const stateB = {
            execution: null,
            classification: notRunState(
              "STATE_A_DID_NOT_PASS",
            ),
          };
          const stateC = {
            execution: null,
            classification: notRunState(
              "STATE_A_DID_NOT_PASS",
            ),
          };
          const boundary = emptyBoundary(
            "STATE_C_NOT_RUN",
          );

          return {
            stateA,
            stateB,
            stateC,
            stateACommitId: baseCommitId,
            stateBCommitId: null,
            stateCCommitId: null,
            envelope: emptyEnvelope(
              normalized.envelope.includedPaths,
              changedPaths,
            ),
            boundary,
            aggregate: evaluateEvidence({
              stateA: stateA.classification,
              stateB: stateB.classification,
              stateC: stateC.classification,
              boundary,
            }),
          };
        }

        const stateBWorktree =
          await invocation.createDetachedWorktree({
            name: "state-b",
            commitId: headCommitId,
          });
        const stateB = await executeState(
          stateBWorktree.path,
          normalized.command,
          normalized.classification.stateB,
        );

        if (
          stateB.classification.outcome !== "PASS" ||
          stateB.classification.invalidFailure === true
        ) {
          const stateC = {
            execution: null,
            classification: notRunState(
              "STATE_B_DID_NOT_PASS",
            ),
          };
          const boundary = emptyBoundary(
            "STATE_C_NOT_RUN",
          );

          return {
            stateA,
            stateB,
            stateC,
            stateACommitId: baseCommitId,
            stateBCommitId: headCommitId,
            stateCCommitId: null,
            envelope: emptyEnvelope(
              normalized.envelope.includedPaths,
              changedPaths,
            ),
            boundary,
            aggregate: evaluateEvidence({
              stateA: stateA.classification,
              stateB: stateB.classification,
              stateC: stateC.classification,
              boundary,
            }),
          };
        }

        const materialized =
          await materializer.materializeExplicitEnvelope(
            invocation,
            {
              repositoryRoot,
              baseCommitId,
              headCommitId,
              includedPaths: [
                ...normalized.envelope.includedPaths,
              ],
            },
          );
        const stateC = await executeState(
          materialized.stateCWorktreePath,
          normalized.command,
          normalized.classification.stateC,
          normalized.classification.stateC
            .expectedFailures,
        );
        const boundary = {
          valid:
            materialized.boundary.boundaryValid,
          basedOnBase:
            materialized.boundary.basedOnBase,
          selectedPathsMatchHead:
            materialized.boundary
              .selectedPathsMatchHead,
          unchangedPathsMatchBase:
            materialized.boundary
              .unchangedPathsMatchBase,
          resultingChangedPaths: [
            ...materialized.boundary
              .resultingChangedPaths,
          ],
          reasonCodes: [
            ...materialized.boundary.reasonCodes,
          ],
        };

        return {
          stateA,
          stateB,
          stateC,
          stateACommitId: baseCommitId,
          stateBCommitId: headCommitId,
          stateCCommitId:
            materialized.evidence.stateCBaseCommitId,
          envelope: projectEnvelope(
            normalized.envelope.includedPaths,
            materialized.evidence,
          ),
          boundary,
          aggregate: evaluateEvidence({
            stateA: stateA.classification,
            stateB: stateB.classification,
            stateC: stateC.classification,
            boundary,
          }),
        };
      },
    );

  const evidence = lifecycleResult.value;
  const report = buildEvidenceReport({
    toolVersion: normalized.toolVersion,
    repository: {
      baseRef: normalized.baseRef,
      headRef: normalized.headRef,
      baseCommitId,
      headCommitId,
      changedPaths: [...changedPaths],
    },
    command: {
      executable: normalized.command.executable,
      arguments: [...normalized.command.arguments],
      workingDirectory:
        normalized.command.workingDirectory,
      environmentKeys: Object.keys(
        normalized.command.environment,
      ),
      timeoutMs: normalized.command.timeoutMs,
      maxStdoutBytes:
        normalized.command.maxStdoutBytes,
      maxStderrBytes:
        normalized.command.maxStderrBytes,
    },
    envelope: evidence.envelope,
    timing: {
      startedAt,
      durationMs:
        Date.now() - startedAtMilliseconds,
    },
    states: {
      stateA: projectState(
        evidence.stateACommitId,
        evidence.stateA,
      ),
      stateB: projectState(
        evidence.stateBCommitId,
        evidence.stateB,
      ),
      stateC: projectState(
        evidence.stateCCommitId,
        evidence.stateC,
      ),
    },
    boundary: projectBoundary(evidence.boundary),
    workspace: projectWorkspace(
      lifecycleResult.cleanup,
    ),
    verdict: evidence.aggregate.verdict,
    reasons: [evidence.aggregate.reason],
    limitations: [...LIMITATIONS],
    warnings: [],
  });
  const json = serializeEvidenceReport(report);
  const markdown = renderEvidenceReportMarkdown(report);

  return {
    report,
    json,
    markdown,
  };
}
