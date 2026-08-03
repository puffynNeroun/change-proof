import {
  copyFile,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  runBoundedCommand,
} from "../../src/core/run-bounded-command.mjs";
import {
  classifyExpectedNodeTestRegression,
  classifyNodeTestExecution,
} from "../../src/core/classify-node-test.mjs";
import {
  createGitRepositoryPrimitives,
} from "../../src/core/git-repository-primitives.mjs";
import {
  createOwnedWorkspaceLifecycle,
} from "../../src/core/owned-workspace-lifecycle.mjs";
import {
  createExplicitEnvelopeMaterializer,
} from "../../src/core/materialize-explicit-envelope.mjs";
import {
  evaluateEvidence,
} from "../../src/core/evaluate-evidence.mjs";

const SELECTED_TEST_PATH =
  "test/qualifies-for-free-shipping.test.js";
const SOURCE_PATH =
  "src/qualifies-for-free-shipping.js";
const COMMAND_TIMEOUT_MS = 10_000;
const OUTPUT_LIMIT_BYTES = 1024 * 1024;
const WORKSPACE_PREFIX =
  "change-proof-m1-state-c-";

const requiredPathNames = Object.freeze([
  "basePackage",
  "baseImplementation",
  "baseTest",
  "headPackage",
  "headImplementation",
  "headTest",
]);

function explicitEnvironment() {
  const environment = {
    LC_ALL: "C",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
  };

  if (
    typeof process.env.PATH === "string" &&
    process.env.PATH.length > 0
  ) {
    environment.PATH = process.env.PATH;
  }

  return environment;
}

function gitExecutable() {
  const configured =
    process.env.CHANGE_PROOF_GIT;

  return (
    typeof configured === "string" &&
    configured.length > 0
  )
    ? configured
    : "git";
}

function processConfiguration() {
  return {
    gitExecutable: gitExecutable(),
    environment: explicitEnvironment(),
    timeoutMs: COMMAND_TIMEOUT_MS,
    maxStdoutBytes: OUTPUT_LIMIT_BYTES,
    maxStderrBytes: OUTPUT_LIMIT_BYTES,
  };
}

function validateStateCInputs(paths) {
  const errors = [];

  for (const name of requiredPathNames) {
    const path = paths?.[name];

    if (
      typeof path !== "string" ||
      path.length === 0
    ) {
      errors.push(`missing_path_value:${name}`);
    } else if (!existsSync(path)) {
      errors.push(`fixture_path_not_found:${name}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

function processFailure(result) {
  return (
    result.timedOut ||
    result.processErrorCode !== null ||
    result.signal !== null ||
    result.stdoutTruncated ||
    result.stderrTruncated ||
    result.exitCode !== 0
  );
}

async function runFixtureGit(
  argumentsList,
  workingDirectory,
) {
  const configuration =
    processConfiguration();
  const result = await runBoundedCommand({
    executable: configuration.gitExecutable,
    arguments: [
      "--no-pager",
      "--literal-pathspecs",
      ...argumentsList,
    ],
    workingDirectory,
    environment: {
      ...configuration.environment,
    },
    timeoutMs: configuration.timeoutMs,
    maxStdoutBytes:
      configuration.maxStdoutBytes,
    maxStderrBytes:
      configuration.maxStderrBytes,
  });

  if (processFailure(result)) {
    throw new Error(
      `fixture_git_failed:${argumentsList[0]}`,
    );
  }

  return result;
}

function normalizeExpectedChangedPaths(value) {
  const expectedPathsValid =
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((path) =>
      typeof path === "string" &&
      path.length > 0) &&
    new Set(value).size === value.length;

  if (!expectedPathsValid) {
    throw new Error(
      "invalid_expected_changed_paths",
    );
  }

  return [...value].sort();
}

async function createDeterministicFixtureRepository(
  paths,
  workspace,
  expectedChangedPaths,
) {
  const validation = validateStateCInputs(paths);

  if (!validation.ok) {
    throw new Error(validation.errors.join(","));
  }

  const repository = join(workspace, "repository");
  await mkdir(join(repository, "src"), {
    recursive: true,
  });
  await mkdir(join(repository, "test"), {
    recursive: true,
  });

  await copyFile(
    paths.basePackage,
    join(repository, "package.json"),
  );
  await copyFile(
    paths.baseImplementation,
    join(repository, SOURCE_PATH),
  );
  await copyFile(
    paths.baseTest,
    join(repository, SELECTED_TEST_PATH),
  );

  await runFixtureGit(
    ["init", "-b", "main"],
    repository,
  );
  await runFixtureGit(
    ["config", "user.name", "Change Proof Fixture"],
    repository,
  );
  await runFixtureGit(
    [
      "config",
      "user.email",
      "fixture@change-proof.invalid",
    ],
    repository,
  );
  await runFixtureGit(
    ["add", "package.json", "src", "test"],
    repository,
  );
  await runFixtureGit(
    [
      "commit",
      "-m",
      "fixture: establish defective baseline",
    ],
    repository,
  );

  const configuration = processConfiguration();
  const primitives =
    createGitRepositoryPrimitives(configuration);
  const baseSha =
    await primitives.resolveCommit(
      repository,
      "HEAD",
    );

  await copyFile(
    paths.headImplementation,
    join(repository, SOURCE_PATH),
  );
  await copyFile(
    paths.headTest,
    join(repository, SELECTED_TEST_PATH),
  );
  await runFixtureGit(
    ["add", "src", "test"],
    repository,
  );
  await runFixtureGit(
    [
      "commit",
      "-m",
      "fixture: fix threshold and add regression test",
    ],
    repository,
  );

  const headSha =
    await primitives.resolveCommit(
      repository,
      "HEAD",
    );
  const headParent =
    await primitives.resolveCommit(
      repository,
      `${headSha}^`,
    );
  const changedPaths =
    await primitives.listChangedPaths(
      repository,
      baseSha,
      headSha,
    );
  const normalizedExpectedPaths =
    normalizeExpectedChangedPaths(
      expectedChangedPaths,
    );

  if (
    JSON.stringify(changedPaths) !==
    JSON.stringify(normalizedExpectedPaths)
  ) {
    throw new Error(
      "unexpected_head_paths:" +
      `actual=${changedPaths.join(",")}:` +
      `expected=${normalizedExpectedPaths.join(",")}`,
    );
  }

  if (headParent !== baseSha) {
    throw new Error(
      "head_parent_does_not_match_base",
    );
  }

  if (
    !await primitives.isWorktreeClean(
      repository,
    )
  ) {
    throw new Error(
      "generated_repository_not_clean",
    );
  }

  const remotes = await runFixtureGit(
    ["remote"],
    repository,
  );

  if (remotes.stdout !== "") {
    throw new Error(
      "generated_repository_has_remotes",
    );
  }

  return {
    repository,
    baseSha,
    headSha,
    changedPaths,
    expectedChangedPaths:
      normalizedExpectedPaths,
  };
}

async function executeNodeTest(
  directory,
  expectedTestCount,
  expectedFailure = null,
) {
  const executionResult =
    await runBoundedCommand({
      executable: process.execPath,
      arguments: [
        "--test",
        "--test-reporter=tap",
      ],
      workingDirectory: directory,
      environment: explicitEnvironment(),
      timeoutMs: COMMAND_TIMEOUT_MS,
      maxStdoutBytes: OUTPUT_LIMIT_BYTES,
      maxStderrBytes: OUTPUT_LIMIT_BYTES,
    });

  return expectedFailure === null
    ? classifyNodeTestExecution({
        executionResult,
        expectedTestCount,
      })
    : classifyExpectedNodeTestRegression({
        executionResult,
        expectedTestCount,
        expectedFailure,
      });
}

function notRunState(reason) {
  return {
    outcome: "NOT_RUN",
    invalidFailure: false,
    reason,
  };
}

function emptyBoundary() {
  return {
    stateCBasedOnBase: false,
    implementationMatchesBase: false,
    testMatchesHead: false,
    changedPaths: [],
  };
}

function legacyBoundary(boundary) {
  return {
    stateCBasedOnBase:
      boundary.basedOnBase,
    implementationMatchesBase:
      boundary.unchangedPathsMatchBase,
    testMatchesHead:
      boundary.selectedPathsMatchHead,
    changedPaths: [
      ...boundary.resultingChangedPaths,
    ],
  };
}

function wasRemoved(
  createdPath,
  cleanup,
) {
  return (
    createdPath === null ||
    (
      cleanup.worktreesRemoved
        .includes(createdPath) &&
      !cleanup.resourcesNotRemoved
        .includes(createdPath)
    )
  );
}

async function runStateCExperiment(input) {
  const {
    scenarioName,
    paths,
    expectedChangedPaths,
    stateATestCount,
    stateBTestCount,
    stateCExpectedFailure,
  } = input;

  if (
    typeof scenarioName !== "string" ||
    scenarioName.length === 0
  ) {
    throw new Error("invalid_scenario_name");
  }

  const validation = validateStateCInputs(paths);

  if (!validation.ok) {
    throw new Error(validation.errors.join(","));
  }

  for (const [name, value] of Object.entries({
    stateATestCount,
    stateBTestCount,
  })) {
    if (
      !Number.isInteger(value) ||
      value < 1
    ) {
      throw new Error(
        `invalid_experiment_test_count:${name}:${value}`,
      );
    }
  }

  const fixtureWorkspace = await mkdtemp(
    join(tmpdir(), WORKSPACE_PREFIX),
  );
  let completed;

  try {
    const generated =
      await createDeterministicFixtureRepository(
        paths,
        fixtureWorkspace,
        expectedChangedPaths,
      );
    const configuration = processConfiguration();
    const lifecycle =
      createOwnedWorkspaceLifecycle({
        ...configuration,
        temporaryParentDirectory:
          fixtureWorkspace,
        workspacePrefix: "owned-states-",
        repositoryRoot: generated.repository,
      });
    const materializer =
      createExplicitEnvelopeMaterializer(
        configuration,
      );
    let stateAPath = null;
    let stateBPath = null;
    let stateCPath = null;

    const lifecycleResult =
      await lifecycle.withOwnedWorkspace(
        async (invocation) => {
          const stateAWorktree =
            await invocation
              .createDetachedWorktree({
                name: "state-a",
                commitId: generated.baseSha,
              });
          stateAPath = stateAWorktree.path;
          const stateA = await executeNodeTest(
            stateAPath,
            stateATestCount,
          );

          if (
            stateA.outcome !== "PASS" ||
            stateA.invalidFailure === true
          ) {
            const stateB = notRunState(
              "STATE_A_DID_NOT_PASS",
            );
            const stateC = notRunState(
              "STATE_A_DID_NOT_PASS",
            );
            const aggregate = evaluateEvidence({
              stateA,
              stateB,
              stateC,
              boundary: { valid: false },
            });

            return {
              generated,
              stateA,
              stateB,
              stateC,
              stateCSha: null,
              boundary: emptyBoundary(),
              boundaryValid: false,
              aggregate,
              stateCCreated: false,
            };
          }

          const stateBWorktree =
            await invocation
              .createDetachedWorktree({
                name: "state-b",
                commitId: generated.headSha,
              });
          stateBPath = stateBWorktree.path;
          const stateB = await executeNodeTest(
            stateBPath,
            stateBTestCount,
          );

          if (
            stateB.outcome !== "PASS" ||
            stateB.invalidFailure === true
          ) {
            const stateC = notRunState(
              "STATE_B_DID_NOT_PASS",
            );
            const aggregate = evaluateEvidence({
              stateA,
              stateB,
              stateC,
              boundary: { valid: false },
            });

            return {
              generated,
              stateA,
              stateB,
              stateC,
              stateCSha: null,
              boundary: emptyBoundary(),
              boundaryValid: false,
              aggregate,
              stateCCreated: false,
            };
          }

          const materialized =
            await materializer
              .materializeExplicitEnvelope(
                invocation,
                {
                  repositoryRoot:
                    generated.repository,
                  baseCommitId:
                    generated.baseSha,
                  headCommitId:
                    generated.headSha,
                  includedPaths: [
                    SELECTED_TEST_PATH,
                  ],
                },
              );
          stateCPath =
            materialized.stateCWorktreePath;
          const stateC = await executeNodeTest(
            stateCPath,
            stateBTestCount,
            stateCExpectedFailure,
          );
          const aggregate = evaluateEvidence({
            stateA,
            stateB,
            stateC,
            boundary: {
              valid:
                materialized.boundary
                  .boundaryValid,
            },
          });

          return {
            generated,
            stateA,
            stateB,
            stateC,
            stateCSha:
              materialized.evidence
                .stateCBaseCommitId,
            boundary: legacyBoundary(
              materialized.boundary,
            ),
            boundaryValid:
              materialized.boundary
                .boundaryValid,
            aggregate,
            stateCCreated: true,
          };
        },
      );

    const evidence = lifecycleResult.value;
    const cleanupEvidence =
      lifecycleResult.cleanup;
    const cleanup = {
      workspaceRemoved:
        cleanupEvidence.workspaceRemoved,
      stateARemoved:
        wasRemoved(
          stateAPath,
          cleanupEvidence,
        ),
      stateBRemoved:
        wasRemoved(
          stateBPath,
          cleanupEvidence,
        ),
      stateCCreated:
        evidence.stateCCreated,
      stateCRemoved:
        wasRemoved(
          stateCPath,
          cleanupEvidence,
        ),
    };

    completed = {
      schemaVersion: "0.1",
      experiment: "m1-controlled-fixture",
      scenario: scenarioName,
      repository: {
        baseSha: evidence.generated.baseSha,
        headSha: evidence.generated.headSha,
        changedPaths:
          evidence.generated.changedPaths,
        expectedChangedPaths:
          evidence.generated.expectedChangedPaths,
      },
      states: {
        stateA: {
          sha: evidence.generated.baseSha,
          execution: evidence.stateA,
        },
        stateB: {
          sha: evidence.generated.headSha,
          execution: evidence.stateB,
        },
        stateC: {
          sha: evidence.stateCSha,
          execution: evidence.stateC,
        },
      },
      boundary: evidence.boundary,
      productionBoundaryValid:
        evidence.boundaryValid,
      verdict: evidence.aggregate.verdict,
      reason: evidence.aggregate.reason,
      cleanup,
    };
  } finally {
    await rm(fixtureWorkspace, {
      recursive: true,
      force: false,
    });
  }

  if (existsSync(fixtureWorkspace)) {
    throw new Error(
      "fixture_workspace_cleanup_failed",
    );
  }

  return completed;
}

function fixturePaths(
  fixtureRoot,
  baseName,
  headName,
) {
  const baseRoot = join(fixtureRoot, baseName);
  const headRoot = join(fixtureRoot, headName);

  return {
    basePackage: join(baseRoot, "package.json"),
    baseImplementation:
      join(baseRoot, SOURCE_PATH),
    baseTest:
      join(baseRoot, SELECTED_TEST_PATH),
    headPackage: join(headRoot, "package.json"),
    headImplementation:
      join(headRoot, SOURCE_PATH),
    headTest:
      join(headRoot, SELECTED_TEST_PATH),
  };
}

function scenarioMatrix(fixtureRoot) {
  return [
    {
      name: "positive",
      input: {
        scenarioName: "positive",
        paths: fixturePaths(
          fixtureRoot,
          "base",
          "head",
        ),
        expectedChangedPaths: [
          SOURCE_PATH,
          SELECTED_TEST_PATH,
        ],
        stateATestCount: 2,
        stateBTestCount: 3,
        stateCExpectedFailure: {
          testName:
            "allows free shipping at the exact threshold",
          outputIncludes: [
            "code: 'ERR_ASSERTION'",
            "false !== true",
          ],
        },
      },
      expected: {
        verdict:
          "OBSERVED_TEST_DISCRIMINATION",
        outcomes: [
          "PASS",
          "PASS",
          "TEST_ASSERTION_FAILURE",
        ],
        stateCCreated: true,
        boundaryValid: true,
      },
    },
    {
      name: "non_discriminating",
      input: {
        scenarioName: "non_discriminating",
        paths: fixturePaths(
          fixtureRoot,
          "base",
          "non-discriminating",
        ),
        expectedChangedPaths: [
          SOURCE_PATH,
          SELECTED_TEST_PATH,
        ],
        stateATestCount: 2,
        stateBTestCount: 3,
        stateCExpectedFailure: null,
      },
      expected: {
        verdict:
          "NON_DISCRIMINATING_TESTS",
        outcomes: ["PASS", "PASS", "PASS"],
        stateCCreated: true,
        boundaryValid: true,
      },
    },
    {
      name: "head_failed",
      input: {
        scenarioName: "head_failed",
        paths: fixturePaths(
          fixtureRoot,
          "base",
          "head-failed",
        ),
        expectedChangedPaths: [
          SELECTED_TEST_PATH,
        ],
        stateATestCount: 2,
        stateBTestCount: 3,
        stateCExpectedFailure: null,
      },
      expected: {
        verdict: "HEAD_FAILED",
        outcomes: [
          "PASS",
          "INCONCLUSIVE",
          "NOT_RUN",
        ],
        stateCCreated: false,
        boundaryValid: false,
      },
    },
    {
      name: "base_failed",
      input: {
        scenarioName: "base_failed",
        paths: fixturePaths(
          fixtureRoot,
          "base-failed",
          "head",
        ),
        expectedChangedPaths: [SOURCE_PATH],
        stateATestCount: 3,
        stateBTestCount: 3,
        stateCExpectedFailure: null,
      },
      expected: {
        verdict: "BASE_FAILED",
        outcomes: [
          "INCONCLUSIVE",
          "NOT_RUN",
          "NOT_RUN",
        ],
        stateCCreated: false,
        boundaryValid: false,
      },
    },
  ];
}

function cleanupIsValid(cleanup) {
  return (
    cleanup.workspaceRemoved === true &&
    cleanup.stateARemoved === true &&
    cleanup.stateBRemoved === true &&
    cleanup.stateCRemoved === true
  );
}

export async function runControlledFixtureMatrix(
  fixtureRoot,
) {
  if (
    typeof fixtureRoot !== "string" ||
    fixtureRoot.length === 0
  ) {
    throw new Error("invalid_fixture_root");
  }

  const scenarios = scenarioMatrix(fixtureRoot);
  const fixtureFiles = new Set(
    scenarios.flatMap(({ input }) =>
      Object.values(input.paths)),
  );
  const missingFixtureFiles =
    [...fixtureFiles].filter(
      (path) => !existsSync(path),
    );

  if (missingFixtureFiles.length > 0) {
    return {
      exitCode: 2,
      preflightPassed: false,
      summary: [],
      errors: missingFixtureFiles.map(
        (path) => `missing_fixture_file=${path}`,
      ),
      terminalMarker:
        "M1_RUNNER_PREFLIGHT_FAILED",
      manifest: {
        schemaVersion: "0.1",
        experiment: "m1-controlled-fixture",
        selectedTestPath: SELECTED_TEST_PATH,
        scenarioCount: scenarios.length,
        completedScenarioCount: 0,
        status: "PREFLIGHT_FAILED",
        scenarios: [],
      },
    };
  }

  const results = [];
  const summary = [];
  const errors = [];
  let operationalError = false;
  let verificationFailed = false;

  for (const scenario of scenarios) {
    try {
      const actual =
        await runStateCExperiment(
          scenario.input,
        );
      const outcomes = [
        actual.states.stateA.execution.outcome,
        actual.states.stateB.execution.outcome,
        actual.states.stateC.execution.outcome,
      ];
      const checks = {
        identity:
          actual.schemaVersion === "0.1" &&
          actual.experiment ===
            "m1-controlled-fixture" &&
          actual.scenario === scenario.name,
        verdict:
          actual.verdict ===
            scenario.expected.verdict,
        outcomes:
          JSON.stringify(outcomes) ===
          JSON.stringify(
            scenario.expected.outcomes,
          ),
        stateCCreation:
          actual.cleanup.stateCCreated ===
          scenario.expected.stateCCreated,
        boundary:
          actual.productionBoundaryValid ===
          scenario.expected.boundaryValid,
        stateShas:
          actual.states.stateA.sha ===
            actual.repository.baseSha &&
          actual.states.stateB.sha ===
            actual.repository.headSha &&
          (
            scenario.expected.stateCCreated
              ? actual.states.stateC.sha ===
                actual.repository.baseSha
              : actual.states.stateC.sha === null
          ),
        cleanup: cleanupIsValid(actual.cleanup),
      };
      const passed =
        Object.values(checks).every(Boolean);

      if (!passed) {
        verificationFailed = true;
      }

      summary.push({
        scenario: scenario.name,
        verdict: actual.verdict,
        outcomes,
        passed,
      });
      results.push({
        scenario: scenario.name,
        expectedVerdict:
          scenario.expected.verdict,
        verdict: actual.verdict,
        reason: actual.reason,
        repository: actual.repository,
        states: {
          stateA: {
            sha: actual.states.stateA.sha,
            outcome: outcomes[0],
          },
          stateB: {
            sha: actual.states.stateB.sha,
            outcome: outcomes[1],
          },
          stateC: {
            sha: actual.states.stateC.sha,
            outcome: outcomes[2],
          },
        },
        boundary: actual.boundary,
        cleanup: actual.cleanup,
        checks,
        passed,
      });
    } catch (error) {
      operationalError = true;
      const message = error instanceof Error
        ? error.message
        : String(error);
      const aggregate = evaluateEvidence({
        stateA: {
          outcome: "NOT_AVAILABLE",
          invalidFailure: true,
        },
        stateB: notRunState(
          "SCENARIO_OPERATIONAL_ERROR",
        ),
        stateC: notRunState(
          "SCENARIO_OPERATIONAL_ERROR",
        ),
        boundary: { valid: false },
      });

      errors.push(
        `scenario_error=${scenario.name}:${message}`,
      );
      summary.push({
        scenario: scenario.name,
        verdict: aggregate.verdict,
        outcomes: [
          "NOT_AVAILABLE",
          "NOT_AVAILABLE",
          "NOT_AVAILABLE",
        ],
        passed: false,
      });
      results.push({
        scenario: scenario.name,
        expectedVerdict:
          scenario.expected.verdict,
        verdict: aggregate.verdict,
        reason: message,
        passed: false,
      });
    }
  }

  const status = operationalError
    ? "OPERATIONAL_ERROR"
    : verificationFailed
      ? "VERIFICATION_FAILED"
      : "VERIFIED";
  const exitCode = operationalError
    ? 3
    : verificationFailed
      ? 1
      : 0;
  const terminalMarker = operationalError
    ? "M1_RUNNER_OPERATIONAL_ERROR"
    : verificationFailed
      ? "M1_RUNNER_VERIFICATION_FAILED"
      : "M1_RUNNER_VERIFIED";

  return {
    exitCode,
    preflightPassed: true,
    summary,
    errors,
    terminalMarker,
    manifest: {
      schemaVersion: "0.1",
      experiment: "m1-controlled-fixture",
      selectedTestPath: SELECTED_TEST_PATH,
      scenarioCount: scenarios.length,
      completedScenarioCount: results.length,
      status,
      scenarios: results,
    },
  };
}
