import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredPathNames = [
  "basePackage",
  "baseImplementation",
  "baseTest",
  "headPackage",
  "headImplementation",
  "headTest",
];

export function validateStateCInputs(paths) {
  const errors = [];

  for (const name of requiredPathNames) {
    const path = paths?.[name];

    if (typeof path !== "string" || path.length === 0) {
      errors.push(`missing_path_value:${name}`);
      continue;
    }

    if (!existsSync(path)) {
      errors.push(`fixture_path_not_found:${name}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

const workspacePrefix = join(tmpdir(), "change-proof-m1-state-c-");
const markerName = ".change-proof-owned";
const markerValue = "change-proof-m1-state-c-owned\n";

export function withOwnedStateCWorkspace(callback) {
  const workspace = mkdtempSync(workspacePrefix);
  const markerPath = join(workspace, markerName);

  writeFileSync(markerPath, markerValue, { flag: "wx" });

  try {
    if (!workspace.startsWith(workspacePrefix)) {
      throw new Error("workspace_prefix_invalid");
    }

    return callback(workspace);
  } finally {
    const markerValid =
      existsSync(markerPath) &&
      readFileSync(markerPath, "utf8") === markerValue;

    if (!workspace.startsWith(workspacePrefix) || !markerValid) {
      throw new Error(`workspace_cleanup_refused:${workspace}`);
    }

    rmSync(workspace, { recursive: true });

    if (existsSync(workspace)) {
      throw new Error(`workspace_cleanup_failed:${workspace}`);
    }
  }
}

const fixedGitEnvironment = {
  ...process.env,
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
};

function runGit(args, cwd) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    env: fixedGitEnvironment,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr.trim()}`,
    );
  }

  return result.stdout.trim();
}

export function createDeterministicFixtureRepository(
  paths,
  workspace,
  options = {},
) {
  const validation = validateStateCInputs(paths);

  if (!validation.ok) {
    throw new Error(validation.errors.join(","));
  }

  const repository = join(workspace, "repository");

  mkdirSync(join(repository, "src"), { recursive: true });
  mkdirSync(join(repository, "test"), { recursive: true });

  copyFileSync(paths.basePackage, join(repository, "package.json"));
  copyFileSync(
    paths.baseImplementation,
    join(repository, "src", "qualifies-for-free-shipping.js"),
  );
  copyFileSync(
    paths.baseTest,
    join(repository, "test", "qualifies-for-free-shipping.test.js"),
  );

  runGit(["init", "-b", "main"], repository);
  runGit(["config", "user.name", "Change Proof Fixture"], repository);
  runGit(
    ["config", "user.email", "fixture@change-proof.invalid"],
    repository,
  );
  runGit(["add", "package.json", "src", "test"], repository);
  runGit(
    ["commit", "-m", "fixture: establish defective baseline"],
    repository,
  );

  const baseSha = runGit(["rev-parse", "HEAD"], repository);

  copyFileSync(
    paths.headImplementation,
    join(repository, "src", "qualifies-for-free-shipping.js"),
  );
  copyFileSync(
    paths.headTest,
    join(repository, "test", "qualifies-for-free-shipping.test.js"),
  );

  const changedPaths = runGit(["diff", "--name-only"], repository)
    .split("\n")
    .filter(Boolean)
    .sort();

  const defaultExpectedChangedPaths = [
    "src/qualifies-for-free-shipping.js",
    "test/qualifies-for-free-shipping.test.js",
  ];

  const expectedChangedPaths =
    options.expectedChangedPaths ??
    defaultExpectedChangedPaths;

  const expectedPathsValid =
    Array.isArray(expectedChangedPaths) &&
    expectedChangedPaths.length > 0 &&
    expectedChangedPaths.every(
      (path) =>
        typeof path === "string" &&
        path.length > 0,
    ) &&
    new Set(expectedChangedPaths).size ===
      expectedChangedPaths.length;

  if (!expectedPathsValid) {
    throw new Error("invalid_expected_changed_paths");
  }

  const normalizedExpectedPaths =
    [...expectedChangedPaths].sort();

  if (
    JSON.stringify(changedPaths) !==
    JSON.stringify(normalizedExpectedPaths)
  ) {
    throw new Error(
      `unexpected_head_paths:` +
      `actual=${changedPaths.join(",")}:` +
      `expected=${normalizedExpectedPaths.join(",")}`,
    );
  }

  runGit(["diff", "--quiet", "--", "package.json"], repository);
  runGit(["add", "src", "test"], repository);
  runGit(
    [
      "commit",
      "-m",
      "fixture: fix threshold and add regression test",
    ],
    repository,
  );

  const headSha = runGit(["rev-parse", "HEAD"], repository);
  const headParent = runGit(["rev-parse", "HEAD^"], repository);
  const status = runGit(["status", "--porcelain"], repository);
  const remotes = runGit(["remote"], repository);

  if (headParent !== baseSha) {
    throw new Error("head_parent_does_not_match_base");
  }

  if (status !== "") {
    throw new Error(`generated_repository_not_clean:${status}`);
  }

  if (remotes !== "") {
    throw new Error(`generated_repository_has_remotes:${remotes}`);
  }

  return {
    repository,
    baseSha,
    headSha,
    changedPaths,
    expectedChangedPaths: normalizedExpectedPaths,
  };
}

export function createStateCHybrid(generated, workspace) {
  const testPath =
    "test/qualifies-for-free-shipping.test.js";
  const implementationPath =
    "src/qualifies-for-free-shipping.js";
  const stateC = join(workspace, "state-c");

  runGit(
    [
      "worktree",
      "add",
      "--detach",
      stateC,
      generated.baseSha,
    ],
    generated.repository,
  );

  runGit(
    [
      "restore",
      "--source",
      generated.headSha,
      "--worktree",
      "--",
      testPath,
    ],
    stateC,
  );

  const stateCSha = runGit(["rev-parse", "HEAD"], stateC);

  const changedPaths = runGit(["diff", "--name-only"], stateC)
    .split("\n")
    .filter(Boolean)
    .sort();

  if (
    stateCSha !== generated.baseSha ||
    changedPaths.length !== 1 ||
    changedPaths[0] !== testPath
  ) {
    throw new Error(
      `state_c_boundary_invalid:${stateCSha}:${changedPaths.join(",")}`,
    );
  }

  runGit(
    ["diff", "--quiet", "--", implementationPath],
    stateC,
  );
  runGit(["diff", "--quiet", "--", "package.json"], stateC);

  const baseImplementationBlob = runGit(
    [
      "rev-parse",
      `${generated.baseSha}:${implementationPath}`,
    ],
    generated.repository,
  );

  const stateCImplementationBlob = runGit(
    ["hash-object", implementationPath],
    stateC,
  );

  const headTestBlob = runGit(
    ["rev-parse", `${generated.headSha}:${testPath}`],
    generated.repository,
  );

  const stateCTestBlob = runGit(
    ["hash-object", testPath],
    stateC,
  );

  if (baseImplementationBlob !== stateCImplementationBlob) {
    throw new Error("state_c_implementation_not_from_base");
  }

  if (headTestBlob !== stateCTestBlob) {
    throw new Error("state_c_test_not_from_head");
  }

  return {
    stateC,
    stateCSha,
    testPath,
    implementationPath,
    changedPaths,
    baseImplementationBlob,
    stateCImplementationBlob,
    headTestBlob,
    stateCTestBlob,
  };
}

export function createPassingStates(
  generated,
  workspace,
) {
  const stateA = join(workspace, "state-a");
  const stateB = generated.repository;

  runGit(
    [
      "worktree",
      "add",
      "--detach",
      stateA,
      generated.baseSha,
    ],
    generated.repository,
  );

  const stateASha =
    runGit(["rev-parse", "HEAD"], stateA);

  const stateBSha =
    runGit(["rev-parse", "HEAD"], stateB);

  const stateAStatus =
    runGit(["status", "--porcelain"], stateA);

  const stateBStatus =
    runGit(["status", "--porcelain"], stateB);

  if (stateASha !== generated.baseSha) {
    throw new Error(
      `state_a_sha_mismatch:${stateASha}`,
    );
  }

  if (stateBSha !== generated.headSha) {
    throw new Error(
      `state_b_sha_mismatch:${stateBSha}`,
    );
  }

  if (stateAStatus !== "") {
    throw new Error(
      `state_a_not_clean:${stateAStatus}`,
    );
  }

  if (stateBStatus !== "") {
    throw new Error(
      `state_b_not_clean:${stateBStatus}`,
    );
  }

  return {
    stateA,
    stateB,
    stateASha,
    stateBSha,
    stateAStatus,
    stateBStatus,
  };
}

export function executePassingState(
  directory,
  expectedTestCount,
) {
  if (
    !Number.isInteger(expectedTestCount) ||
    expectedTestCount < 1
  ) {
    throw new Error(
      `invalid_expected_test_count:${expectedTestCount}`,
    );
  }

  const startedAt = Date.now();

  const execution = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap"],
    {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
      },
    },
  );

  const durationMs = Date.now() - startedAt;
  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const output = `${stdout}${stderr}`;

  const tapVersionPresent =
    /^TAP version 13$/m.test(output);

  const testCountMatches =
    new RegExp(
      `^# tests ${expectedTestCount}$`,
      "m",
    ).test(output);

  const passCountMatches =
    new RegExp(
      `^# pass ${expectedTestCount}$`,
      "m",
    ).test(output);

  const failCountMatches =
    /^# fail 0$/m.test(output);

  const cancelledCountMatches =
    /^# cancelled 0$/m.test(output);

  const skippedCountMatches =
    /^# skipped 0$/m.test(output);

  const todoCountMatches =
    /^# todo 0$/m.test(output);

  const failedSubtestPresent =
    /^not ok [0-9]+ - /m.test(output);

  const invalidFailurePattern =
    /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNKNOWN_FILE_EXTENSION|timed out|timeout exceeded/i;

  const processErrorCode =
    execution.error?.code ?? null;

  const timedOut =
    processErrorCode === "ETIMEDOUT";

  const invalidFailure =
    processErrorCode !== null ||
    execution.signal !== null ||
    invalidFailurePattern.test(output);

  const outcome =
    execution.status === 0 &&
    execution.signal === null &&
    tapVersionPresent &&
    testCountMatches &&
    passCountMatches &&
    failCountMatches &&
    cancelledCountMatches &&
    skippedCountMatches &&
    todoCountMatches &&
    !failedSubtestPresent &&
    !invalidFailure
      ? "PASS"
      : "INCONCLUSIVE";

  return {
    command: `${process.execPath} --test --test-reporter=tap`,
    expectedTestCount,
    exitCode: execution.status,
    signal: execution.signal,
    durationMs,
    processErrorCode,
    timedOut,
    tapVersionPresent,
    testCountMatches,
    passCountMatches,
    failCountMatches,
    cancelledCountMatches,
    skippedCountMatches,
    todoCountMatches,
    failedSubtestPresent,
    invalidFailure,
    outcome,
    output,
  };
}

export function executeStateC(stateC) {
  const startedAt = Date.now();

  const execution = spawnSync(
    process.execPath,
    ["--test", "--test-reporter=tap"],
    {
      cwd: stateC,
      encoding: "utf8",
      timeout: 10_000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
      },
    },
  );

  const durationMs = Date.now() - startedAt;
  const stdout = execution.stdout ?? "";
  const stderr = execution.stderr ?? "";
  const output = `${stdout}${stderr}`;

  const namedRegressionFailure =
    /^not ok [0-9]+ - allows free shipping at the exact threshold$/m
      .test(output);

  const assertionFailure =
    output.includes("code: 'ERR_ASSERTION'");

  const observedValues =
    output.includes("false !== true");

  const passCountMatches =
    /^# pass 2$/m.test(output);

  const failCountMatches =
    /^# fail 1$/m.test(output);

  const passingTestCountMatches =
    /^# tests 3$/m.test(output);

  const passingPassCountMatches =
    /^# pass 3$/m.test(output);

  const passingFailCountMatches =
    /^# fail 0$/m.test(output);

  const cancelledCountMatches =
    /^# cancelled 0$/m.test(output);

  const skippedCountMatches =
    /^# skipped 0$/m.test(output);

  const todoCountMatches =
    /^# todo 0$/m.test(output);

  const failedSubtestPresent =
    /^not ok [0-9]+ - /m.test(output);

  const tapVersionPresent =
    /^TAP version 13$/m.test(output);

  const invalidFailurePattern =
    /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNKNOWN_FILE_EXTENSION|timed out|timeout exceeded/i;

  const processErrorCode =
    execution.error?.code ?? null;

  const timedOut =
    processErrorCode === "ETIMEDOUT";

  const invalidFailure =
    processErrorCode !== null ||
    execution.signal !== null ||
    invalidFailurePattern.test(output);

  const assertionOutcome =
    execution.status === 1 &&
    execution.signal === null &&
    namedRegressionFailure &&
    assertionFailure &&
    observedValues &&
    passCountMatches &&
    failCountMatches &&
    !invalidFailure;

  const passingOutcome =
    execution.status === 0 &&
    execution.signal === null &&
    tapVersionPresent &&
    passingTestCountMatches &&
    passingPassCountMatches &&
    passingFailCountMatches &&
    cancelledCountMatches &&
    skippedCountMatches &&
    todoCountMatches &&
    !failedSubtestPresent &&
    !invalidFailure;

  const outcome =
    assertionOutcome
      ? "TEST_ASSERTION_FAILURE"
      : passingOutcome
        ? "PASS"
        : "INCONCLUSIVE";

  return {
    command: `${process.execPath} --test --test-reporter=tap`,
    exitCode: execution.status,
    signal: execution.signal,
    durationMs,
    processErrorCode,
    timedOut,
    namedRegressionFailure,
    assertionFailure,
    observedValues,
    passCountMatches,
    failCountMatches,
    tapVersionPresent,
    passingTestCountMatches,
    passingPassCountMatches,
    passingFailCountMatches,
    cancelledCountMatches,
    skippedCountMatches,
    todoCountMatches,
    failedSubtestPresent,
    invalidFailure,
    outcome,
    output,
  };
}

export function evaluateThreeStateEvidence({
  stateA,
  stateB,
  stateC,
  boundary,
}) {
  const requiredInputs = {
    stateA,
    stateB,
    stateC,
    boundary,
  };

  for (const [name, value] of Object.entries(requiredInputs)) {
    if (!value || typeof value !== "object") {
      throw new Error(`missing_evidence_input:${name}`);
    }
  }

  const operationalFailure =
    stateA.invalidFailure === true ||
    stateB.invalidFailure === true ||
    stateC.invalidFailure === true;

  if (operationalFailure) {
    return {
      verdict: "OPERATIONAL_ERROR",
      reason: "A state encountered an execution or environment failure.",
    };
  }

  if (stateA.outcome !== "PASS") {
    return {
      verdict: "BASE_FAILED",
      reason: "The exact base state did not pass its baseline tests.",
    };
  }

  if (stateB.outcome !== "PASS") {
    return {
      verdict: "HEAD_FAILED",
      reason: "The exact head state did not pass its complete tests.",
    };
  }

  const boundaryValid =
    boundary.stateCBasedOnBase === true &&
    boundary.implementationMatchesBase === true &&
    boundary.testMatchesHead === true &&
    Array.isArray(boundary.changedPaths) &&
    boundary.changedPaths.length === 1 &&
    boundary.changedPaths[0] ===
      "test/qualifies-for-free-shipping.test.js";

  if (!boundaryValid) {
    return {
      verdict: "INVALID_TEST_ENVELOPE",
      reason: "The State C commit or transferred test boundary is invalid.",
    };
  }

  if (stateC.outcome === "TEST_ASSERTION_FAILURE") {
    return {
      verdict: "OBSERVED_TEST_DISCRIMINATION",
      reason:
        "The selected head test failed at the expected assertion against the exact base implementation.",
    };
  }

  if (stateC.outcome === "PASS") {
    return {
      verdict: "NON_DISCRIMINATING_TESTS",
      reason:
        "The selected head test also passed against the exact base implementation.",
    };
  }

  return {
    verdict: "INCONCLUSIVE",
    reason:
      "The evidence did not satisfy a supported discrimination or non-discrimination outcome.",
  };
}

export function runStateCExperiment({
  scenarioName,
  paths,
  expectedChangedPaths,
  stateATestCount,
  stateBTestCount,
}) {
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
    if (!Number.isInteger(value) || value < 1) {
      throw new Error(
        `invalid_experiment_test_count:${name}:${value}`,
      );
    }
  }

  let workspacePath;
  let stateAPath;
  let stateBPath;
  let stateCPath;
  let stateCCreated = false;

  const notRunState = (reason) => ({
    outcome: "NOT_RUN",
    invalidFailure: false,
    reason,
  });

  const emptyBoundary = {
    stateCBasedOnBase: false,
    implementationMatchesBase: false,
    testMatchesHead: false,
    changedPaths: [],
  };

  const evidence = withOwnedStateCWorkspace(
    (workspace) => {
      workspacePath = workspace;

      const generated =
        createDeterministicFixtureRepository(
          paths,
          workspace,
          expectedChangedPaths
            ? { expectedChangedPaths }
            : {},
        );

      const passingStates =
        createPassingStates(generated, workspace);

      stateAPath = passingStates.stateA;
      stateBPath = passingStates.stateB;

      const stateA =
        executePassingState(
          passingStates.stateA,
          stateATestCount,
        );

      if (
        stateA.outcome !== "PASS" ||
        stateA.invalidFailure === true
      ) {
        const stateB =
          notRunState("STATE_A_DID_NOT_PASS");

        const stateC =
          notRunState("STATE_A_DID_NOT_PASS");

        const aggregate =
          evaluateThreeStateEvidence({
            stateA,
            stateB,
            stateC,
            boundary: emptyBoundary,
          });

        return {
          repository: {
            baseSha: generated.baseSha,
            headSha: generated.headSha,
            changedPaths: generated.changedPaths,
            expectedChangedPaths:
              generated.expectedChangedPaths,
          },
          states: {
            stateA: {
              sha: passingStates.stateASha,
              execution: stateA,
            },
            stateB: {
              sha: passingStates.stateBSha,
              execution: stateB,
            },
            stateC: {
              sha: null,
              execution: stateC,
            },
          },
          boundary: emptyBoundary,
          verdict: aggregate.verdict,
          reason: aggregate.reason,
        };
      }

      const stateB =
        executePassingState(
          passingStates.stateB,
          stateBTestCount,
        );

      if (
        stateB.outcome !== "PASS" ||
        stateB.invalidFailure === true
      ) {
        const stateC =
          notRunState("STATE_B_DID_NOT_PASS");

        const aggregate =
          evaluateThreeStateEvidence({
            stateA,
            stateB,
            stateC,
            boundary: emptyBoundary,
          });

        return {
          repository: {
            baseSha: generated.baseSha,
            headSha: generated.headSha,
            changedPaths: generated.changedPaths,
            expectedChangedPaths:
              generated.expectedChangedPaths,
          },
          states: {
            stateA: {
              sha: passingStates.stateASha,
              execution: stateA,
            },
            stateB: {
              sha: passingStates.stateBSha,
              execution: stateB,
            },
            stateC: {
              sha: null,
              execution: stateC,
            },
          },
          boundary: emptyBoundary,
          verdict: aggregate.verdict,
          reason: aggregate.reason,
        };
      }

      const hybrid =
        createStateCHybrid(generated, workspace);

      stateCPath = hybrid.stateC;
      stateCCreated = true;

      const stateC =
        executeStateC(hybrid.stateC);

      const boundary = {
        stateCBasedOnBase:
          hybrid.stateCSha === generated.baseSha,
        implementationMatchesBase:
          hybrid.baseImplementationBlob ===
          hybrid.stateCImplementationBlob,
        testMatchesHead:
          hybrid.headTestBlob ===
          hybrid.stateCTestBlob,
        changedPaths: hybrid.changedPaths,
      };

      const aggregate =
        evaluateThreeStateEvidence({
          stateA,
          stateB,
          stateC,
          boundary,
        });

      return {
        repository: {
          baseSha: generated.baseSha,
          headSha: generated.headSha,
          changedPaths: generated.changedPaths,
          expectedChangedPaths:
            generated.expectedChangedPaths,
        },
        states: {
          stateA: {
            sha: passingStates.stateASha,
            execution: stateA,
          },
          stateB: {
            sha: passingStates.stateBSha,
            execution: stateB,
          },
          stateC: {
            sha: hybrid.stateCSha,
            execution: stateC,
          },
        },
        boundary,
        verdict: aggregate.verdict,
        reason: aggregate.reason,
      };
    },
  );

  const cleanup = {
    workspaceRemoved:
      Boolean(workspacePath) &&
      !existsSync(workspacePath),

    stateARemoved:
      Boolean(stateAPath) &&
      !existsSync(stateAPath),

    stateBRemoved:
      Boolean(stateBPath) &&
      !existsSync(stateBPath),

    stateCCreated,

    stateCRemoved:
      stateCCreated
        ? Boolean(stateCPath) &&
          !existsSync(stateCPath)
        : true,
  };

  return {
    schemaVersion: "0.1",
    experiment: "m1-controlled-fixture",
    scenario: scenarioName,
    ...evidence,
    cleanup,
  };
}

export function runControlledFixtureMatrix(
  fixtureRoot,
) {
  if (
    typeof fixtureRoot !== "string" ||
    fixtureRoot.length === 0
  ) {
    throw new Error("invalid_fixture_root");
  }

  const selectedTestPath =
    "test/qualifies-for-free-shipping.test.js";

  const sourcePath =
    "src/qualifies-for-free-shipping.js";

  const fixturePaths = (baseName, headName) => {
    const baseRoot = join(fixtureRoot, baseName);
    const headRoot = join(fixtureRoot, headName);

    return {
      basePackage:
        join(baseRoot, "package.json"),

      baseImplementation:
        join(baseRoot, sourcePath),

      baseTest:
        join(baseRoot, selectedTestPath),

      headPackage:
        join(headRoot, "package.json"),

      headImplementation:
        join(headRoot, sourcePath),

      headTest:
        join(headRoot, selectedTestPath),
    };
  };

  const scenarios = [
    {
      name: "positive",

      input: {
        scenarioName: "positive",

        paths:
          fixturePaths("base", "head"),

        stateATestCount: 2,
        stateBTestCount: 3,
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
        scenarioName:
          "non_discriminating",

        paths:
          fixturePaths(
            "base",
            "non-discriminating",
          ),

        stateATestCount: 2,
        stateBTestCount: 3,
      },

      expected: {
        verdict:
          "NON_DISCRIMINATING_TESTS",

        outcomes: [
          "PASS",
          "PASS",
          "PASS",
        ],

        stateCCreated: true,
        boundaryValid: true,
      },
    },

    {
      name: "head_failed",

      input: {
        scenarioName:
          "head_failed",

        paths:
          fixturePaths(
            "base",
            "head-failed",
          ),

        expectedChangedPaths: [
          selectedTestPath,
        ],

        stateATestCount: 2,
        stateBTestCount: 3,
      },

      expected: {
        verdict:
          "HEAD_FAILED",

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
        scenarioName:
          "base_failed",

        paths:
          fixturePaths(
            "base-failed",
            "head",
          ),

        expectedChangedPaths: [
          sourcePath,
        ],

        stateATestCount: 3,
        stateBTestCount: 3,
      },

      expected: {
        verdict:
          "BASE_FAILED",

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

  const fixtureFiles = new Set(
    scenarios.flatMap(
      ({ input }) =>
        Object.values(input.paths),
    ),
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

      errors:
        missingFixtureFiles.map(
          (path) =>
            `missing_fixture_file=${path}`,
        ),

      terminalMarker:
        "M1_RUNNER_PREFLIGHT_FAILED",

      manifest: {
        schemaVersion: "0.1",

        experiment:
          "m1-controlled-fixture",

        selectedTestPath,

        scenarioCount:
          scenarios.length,

        completedScenarioCount: 0,

        status:
          "PREFLIGHT_FAILED",

        scenarios: [],
      },
    };
  }

  const boundaryIsValid = (boundary) => (
    boundary.stateCBasedOnBase === true &&
    boundary.implementationMatchesBase === true &&
    boundary.testMatchesHead === true &&
    Array.isArray(boundary.changedPaths) &&
    boundary.changedPaths.length === 1 &&
    boundary.changedPaths[0] ===
      selectedTestPath
  );

  const cleanupIsValid = (cleanup) => (
    cleanup.workspaceRemoved === true &&
    cleanup.stateARemoved === true &&
    cleanup.stateBRemoved === true &&
    cleanup.stateCRemoved === true
  );

  const results = [];
  const summary = [];
  const errors = [];

  let operationalError = false;
  let verificationFailed = false;

  for (const scenario of scenarios) {
    try {
      const actual =
        runStateCExperiment(
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
          actual.scenario ===
            scenario.name,

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
          boundaryIsValid(actual.boundary) ===
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
              : actual.states.stateC.sha ===
                null
          ),

        cleanup:
          cleanupIsValid(actual.cleanup),
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
        scenario:
          scenario.name,

        expectedVerdict:
          scenario.expected.verdict,

        verdict:
          actual.verdict,

        reason:
          actual.reason,

        repository:
          actual.repository,

        states: {
          stateA: {
            sha:
              actual.states.stateA.sha,

            outcome:
              outcomes[0],
          },

          stateB: {
            sha:
              actual.states.stateB.sha,

            outcome:
              outcomes[1],
          },

          stateC: {
            sha:
              actual.states.stateC.sha,

            outcome:
              outcomes[2],
          },
        },

        boundary:
          actual.boundary,

        cleanup:
          actual.cleanup,

        checks,
        passed,
      });
    } catch (error) {
      operationalError = true;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      errors.push(
        `scenario_error=${scenario.name}:` +
        message,
      );

      summary.push({
        scenario:
          scenario.name,

        verdict:
          "OPERATIONAL_ERROR",

        outcomes: [
          "NOT_AVAILABLE",
          "NOT_AVAILABLE",
          "NOT_AVAILABLE",
        ],

        passed: false,
      });

      results.push({
        scenario:
          scenario.name,

        expectedVerdict:
          scenario.expected.verdict,

        verdict:
          "OPERATIONAL_ERROR",

        reason:
          message,

        passed: false,
      });
    }
  }

  const status =
    operationalError
      ? "OPERATIONAL_ERROR"
      : verificationFailed
        ? "VERIFICATION_FAILED"
        : "VERIFIED";

  const exitCode =
    operationalError
      ? 3
      : verificationFailed
        ? 1
        : 0;

  const terminalMarker =
    operationalError
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

      experiment:
        "m1-controlled-fixture",

      selectedTestPath,

      scenarioCount:
        scenarios.length,

      completedScenarioCount:
        results.length,

      status,
      scenarios: results,
    },
  };
}
