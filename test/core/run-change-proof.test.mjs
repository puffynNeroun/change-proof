import assert from "node:assert/strict";
import {
  accessSync,
  chmodSync,
  constants,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import {
  delimiter,
  isAbsolute,
  join,
} from "node:path";
import { spawnSync } from "node:child_process";
import {
  after,
  before,
  test,
} from "node:test";

import {
  renderEvidenceReportMarkdown,
} from "../../src/core/render-evidence-report-markdown.mjs";
import {
  runChangeProof,
} from "../../src/core/run-change-proof.mjs";

const sourcePath = "src/value.mjs";
const testPath = "test/value.test.mjs";

let temporaryRoot;
let temporaryParent;
let realGit;
let shimDirectory;

function findGitExecutable() {
  const configured = process.env.CHANGE_PROOF_GIT;

  if (
    typeof configured === "string" &&
    configured.length > 0 &&
    isAbsolute(configured)
  ) {
    return realpathSync(configured);
  }

  for (const directory of
    (process.env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) {
      continue;
    }

    const candidate = join(directory, "git");

    try {
      accessSync(candidate, constants.X_OK);
      return realpathSync(candidate);
    } catch {
      // Continue searching the explicit PATH entries.
    }
  }

  throw new Error("git executable not found");
}

function explicitEnvironment(overrides = {}) {
  return {
    PATH: process.env.PATH ?? "",
    LC_ALL: "C",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_AUTHOR_NAME: "Change Proof M2.10",
    GIT_AUTHOR_EMAIL: "m2.10@example.invalid",
    GIT_COMMITTER_NAME: "Change Proof M2.10",
    GIT_COMMITTER_EMAIL: "m2.10@example.invalid",
    GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
    GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
    ...overrides,
  };
}

function runGit(repository, argumentsList) {
  const result = spawnSync(
    realGit,
    argumentsList,
    {
      cwd: repository,
      encoding: "utf8",
      env: explicitEnvironment(),
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(
    result.status,
    0,
    `${argumentsList.join(" ")}\n${result.stderr}`,
  );

  return result.stdout.trim();
}

function writeRepositoryFile(repository, path, content) {
  const destination = join(repository, path);
  mkdirSync(join(destination, ".."), {
    recursive: true,
  });
  writeFileSync(destination, content);
}

function basePassingTest() {
  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    'import { value } from "../src/value.mjs";',
    'test("base behavior", () => {',
    '  assert.equal(["base", "head"].includes(value), true);',
    "});",
    "",
  ].join("\n");
}

function singleFailureHeadTest() {
  return [
    basePassingTest().trimEnd(),
    'test("head behavior", () => {',
    '  assert.equal(value, "head");',
    "});",
    "",
  ].join("\n");
}

function multiFailureHeadTest() {
  return [
    basePassingTest().trimEnd(),
    'test("head behavior one", () => {',
    '  assert.equal(value, "head");',
    "});",
    'test("head behavior two", () => {',
    '  if (value !== "head") {',
    '    throw new Error("head implementation required");',
    "  }",
    "});",
    "",
  ].join("\n");
}

function nonDiscriminatingHeadTest() {
  return [
    basePassingTest().trimEnd(),
    'test("portable behavior", () => {',
    '  assert.equal(typeof value, "string");',
    "});",
    "",
  ].join("\n");
}

function failingTest(name, expectedValue) {
  return [
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    'import { value } from "../src/value.mjs";',
    `test(${JSON.stringify(name)}, () => {`,
    `  assert.equal(value, ${JSON.stringify(expectedValue)});`,
    "});",
    "",
  ].join("\n");
}

function createRepository(
  name,
  {
    baseTest = basePassingTest(),
    headTest = singleFailureHeadTest(),
  } = {},
) {
  const repository = join(temporaryRoot, name);
  mkdirSync(repository);
  runGit(repository, ["init", "-b", "main"]);
  writeRepositoryFile(
    repository,
    sourcePath,
    'export const value = "base";\n',
  );
  writeRepositoryFile(repository, testPath, baseTest);
  runGit(repository, ["add", "-A"]);
  runGit(repository, ["commit", "-m", "base"]);
  const base = runGit(repository, ["rev-parse", "HEAD"]);

  writeRepositoryFile(
    repository,
    sourcePath,
    'export const value = "head";\n',
  );
  writeRepositoryFile(repository, testPath, headTest);
  runGit(repository, ["add", "-A"]);
  runGit(repository, ["commit", "-m", "head"]);
  const head = runGit(repository, ["rev-parse", "HEAD"]);

  return { repository, base, head };
}

function expectedFailure(testName) {
  return {
    testName,
    outputIncludes: ["code: 'ERR_ASSERTION'"],
  };
}

function inputFor(
  scenario,
  {
    stateACount = 1,
    stateBCount = 2,
    stateCCount = stateBCount,
    expectedFailures = [
      expectedFailure("head behavior"),
    ],
    environment = explicitEnvironment(),
    executable = process.execPath,
    argumentsList = [
      "--test",
      "--test-reporter=tap",
      testPath,
    ],
    timeoutMs = 10_000,
    maxStdoutBytes = 1024 * 1024,
    maxStderrBytes = 1024 * 1024,
    baseRef = scenario.base.slice(0, 12),
    headRef = scenario.head.slice(0, 12),
    workingDirectory = ".",
  } = {},
) {
  return {
    repositoryRoot: scenario.repository,
    baseRef,
    headRef,
    command: {
      executable,
      arguments: [...argumentsList],
      workingDirectory,
      environment: { ...environment },
      timeoutMs,
      maxStdoutBytes,
      maxStderrBytes,
    },
    envelope: {
      includedPaths: [testPath],
    },
    classification: {
      stateA: { expectedTestCount: stateACount },
      stateB: { expectedTestCount: stateBCount },
      stateC: {
        expectedTestCount: stateCCount,
        expectedFailures: expectedFailures.map(
          (failure) => ({
            testName: failure.testName,
            outputIncludes: [
              ...failure.outputIncludes,
            ],
          }),
        ),
      },
    },
    toolVersion: "test-m2.10",
    temporaryParentDirectory: temporaryParent,
    workspacePrefix: "owned change proof states-",
  };
}

function snapshot(repository) {
  return {
    head: runGit(repository, ["rev-parse", "HEAD"]),
    branch: runGit(repository, ["branch", "--show-current"]),
    status: runGit(repository, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
    refs: runGit(repository, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    worktrees: runGit(repository, [
      "worktree",
      "list",
      "--porcelain",
    ]),
  };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
  }

  return value;
}

function collectKeys(value, keys = []) {
  if (value === null || typeof value !== "object") {
    return keys;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, keys);
    }
    return keys;
  }

  for (const [key, item] of Object.entries(value)) {
    keys.push(key);
    collectKeys(item, keys);
  }

  return keys;
}

function normalizedReport(report) {
  const normalized = structuredClone(report);
  normalized.timing.startedAt = "<timing>";
  normalized.timing.durationMs = 0;

  for (const state of Object.values(normalized.states)) {
    if (state.execution !== null) {
      state.execution.durationMs = 0;
    }
  }

  return normalized;
}

function shimEnvironment(mode) {
  return explicitEnvironment({
    PATH: `${shimDirectory}${delimiter}${process.env.PATH ?? ""}`,
    CHANGE_PROOF_REAL_GIT: realGit,
    CHANGE_PROOF_GIT_SHIM_MODE: mode,
  });
}

function removeLeakedWorktrees(repository) {
  const worktrees = runGit(repository, [
    "worktree",
    "list",
    "--porcelain",
  ])
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));

  for (const worktree of worktrees) {
    if (worktree !== repository) {
      runGit(repository, [
        "worktree",
        "remove",
        "--force",
        worktree,
      ]);
    }
  }
}

before(() => {
  temporaryRoot = mkdtempSync(
    join(tmpdir(), "change-proof-m210-core-"),
  );
  temporaryParent = join(temporaryRoot, "owned workspaces");
  shimDirectory = join(temporaryRoot, "git shim");
  mkdirSync(temporaryParent);
  mkdirSync(shimDirectory);
  realGit = findGitExecutable();
  const shimPath = join(shimDirectory, "git");

  writeFileSync(
    shimPath,
    [
      `#!${process.execPath}`,
      'import { writeFileSync } from "node:fs";',
      'import { spawnSync } from "node:child_process";',
      "const args = process.argv.slice(2);",
      "const realGit = process.env.CHANGE_PROOF_REAL_GIT;",
      "const mode = process.env.CHANGE_PROOF_GIT_SHIM_MODE;",
      "const command = args.find((item) => ['ls-tree','restore','worktree'].includes(item));",
      "if (mode === 'malformed-tree' && command === 'ls-tree' && args.includes('--full-tree')) { process.stdout.write('malformed'); process.exit(0); }",
      "if (mode === 'cleanup-fail' && command === 'worktree' && args.includes('remove')) { process.stderr.write('cleanup denied'); process.exit(9); }",
      "const result = spawnSync(realGit, args, { cwd: process.cwd(), encoding: 'utf8', env: process.env });",
      "if (result.error) { process.stderr.write(result.error.message); process.exit(126); }",
      "if (mode === 'invalid-boundary' && command === 'restore' && result.status === 0 && args.some((item) => item.startsWith('--source='))) { const source = args.find((item) => item.startsWith('--source=')); const extra = spawnSync(realGit, ['--no-pager','--literal-pathspecs','restore',source,'--staged','--worktree','--','src/value.mjs'], { cwd: process.cwd(), encoding: 'utf8', env: process.env }); if (extra.status !== 0) { writeFileSync(2, extra.stderr ?? 'extra restore failed'); process.exit(extra.status ?? 125); } }",
      "process.stdout.write(result.stdout ?? '');",
      "process.stderr.write(result.stderr ?? '');",
      "if (result.signal) { process.kill(process.pid, result.signal); }",
      "process.exit(result.status ?? 125);",
      "",
    ].join("\n"),
  );
  chmodSync(shimPath, 0o700);
});

after(() => {
  rmSync(temporaryRoot, {
    recursive: true,
    force: true,
  });
});

test("validates and clones the explicit input contract", async (suite) => {
  const scenario = createRepository("validation repository");
  const valid = inputFor(scenario);

  for (const [name, mutate] of [
    ["missing input", () => null],
    ["absolute working directory", (input) => {
      input.command.workingDirectory = "/tmp";
      return input;
    }],
    ["escaping working directory", (input) => {
      input.command.workingDirectory = "../outside";
      return input;
    }],
    ["missing environment", (input) => {
      input.command.environment = null;
      return input;
    }],
    ["invalid timeout", (input) => {
      input.command.timeoutMs = 0;
      return input;
    }],
    ["empty envelope", (input) => {
      input.envelope.includedPaths = [];
      return input;
    }],
    ["duplicate envelope", (input) => {
      input.envelope.includedPaths = [testPath, testPath];
      return input;
    }],
    ["missing expected failures", (input) => {
      input.classification.stateC.expectedFailures = [];
      return input;
    }],
  ]) {
    await suite.test(name, async () => {
      const input = mutate(structuredClone(valid));

      await assert.rejects(
        () => runChangeProof(input),
        /invalid_change_proof_input:/,
      );
    });
  }
});

test("orchestrates exact A, B, and selected C states", async () => {
  const scenario = createRepository("single failure repository");
  const before = snapshot(scenario.repository);
  const input = deepFreeze(inputFor(scenario));
  const inputBefore = JSON.stringify(input);
  const result = await runChangeProof(input);
  const report = result.report;

  assert.equal(JSON.stringify(input), inputBefore);
  assert.equal(report.repository.baseCommitId, scenario.base);
  assert.equal(report.repository.headCommitId, scenario.head);
  assert.deepEqual(report.repository.changedPaths, [
    sourcePath,
    testPath,
  ]);
  assert.equal(report.states.stateA.commitId, scenario.base);
  assert.equal(report.states.stateB.commitId, scenario.head);
  assert.equal(report.states.stateC.commitId, scenario.base);
  assert.deepEqual(
    [
      report.states.stateA.outcome,
      report.states.stateB.outcome,
      report.states.stateC.outcome,
    ],
    ["PASS", "PASS", "TEST_ASSERTION_FAILURE"],
  );
  assert.deepEqual(report.states.stateA.summary, {
    tests: 1,
    pass: 1,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.deepEqual(report.states.stateB.summary, {
    tests: 2,
    pass: 2,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.deepEqual(report.states.stateC.summary, {
    tests: 2,
    pass: 1,
    fail: 1,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.deepEqual(
    report.envelope.requestedIncludedPaths,
    [testPath],
  );
  assert.deepEqual(report.envelope.includedPaths, [testPath]);
  assert.deepEqual(
    report.envelope.excludedChangedPaths,
    [sourcePath],
  );
  assert.deepEqual(
    report.envelope.resultingChangedPaths,
    [testPath],
  );
  assert.equal(
    report.envelope.stateCBlobIds[testPath],
    report.envelope.headBlobIds[testPath],
  );
  assert.equal(
    report.envelope.stateCBlobIds[sourcePath],
    report.envelope.baseBlobIds[sourcePath],
  );
  assert.equal(report.boundary.valid, true);
  assert.equal(report.verdict, "OBSERVED_TEST_DISCRIMINATION");
  assert.equal(report.workspace.cleanupCompleted, true);
  assert.equal(report.workspace.workspaceRemoved, true);
  assert.equal(report.workspace.worktreesCreated, 3);
  assert.equal(report.workspace.worktreesRemoved, 3);
  assert.deepEqual(snapshot(scenario.repository), before);
  assert.deepEqual(JSON.parse(result.json), report);
  assert.equal(
    result.markdown,
    renderEvidenceReportMarkdown(report),
  );
  assert.deepEqual(
    collectKeys(report).filter((key) =>
      ["stdout", "stderr", "output", "rawOutput"].includes(key)),
    [],
  );
  assert.equal(
    JSON.stringify(report).includes(temporaryParent),
    false,
  );
  assert.equal(result.markdown.includes(temporaryParent), false);
});

test("supports exact multiple-failure discrimination", async () => {
  const scenario = createRepository(
    "multiple failure repository",
    { headTest: multiFailureHeadTest() },
  );
  const result = await runChangeProof(inputFor(scenario, {
    stateBCount: 3,
    stateCCount: 3,
    expectedFailures: [
      expectedFailure("head behavior one"),
      {
        testName: "head behavior two",
        outputIncludes: [
          "code: 'ERR_TEST_FAILURE'",
          "head implementation required",
        ],
      },
    ],
  }));

  assert.equal(
    result.report.states.stateC.outcome,
    "EXPECTED_TEST_FAILURE",
  );
  assert.equal(
    result.report.states.stateC.reasonCode,
    "EXPECTED_TEST_FAILURE_SET_OBSERVED",
  );
  assert.deepEqual(result.report.states.stateC.summary, {
    tests: 3,
    pass: 1,
    fail: 2,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.equal(
    result.report.verdict,
    "OBSERVED_TEST_DISCRIMINATION",
  );
});

test("distinguishes passing and unexpected State C results", async (suite) => {
  await suite.test("passing State C", async () => {
    const scenario = createRepository(
      "passing state c repository",
      { headTest: nonDiscriminatingHeadTest() },
    );
    const result = await runChangeProof(inputFor(scenario));

    assert.equal(result.report.states.stateC.outcome, "PASS");
    assert.equal(
      result.report.verdict,
      "NON_DISCRIMINATING_TESTS",
    );
    assert.equal(result.report.boundary.valid, true);
  });

  await suite.test("unexpected State C failure", async () => {
    const scenario = createRepository(
      "unexpected state c repository",
    );
    const result = await runChangeProof(inputFor(scenario, {
      expectedFailures: [
        expectedFailure("different failure"),
      ],
    }));

    assert.equal(
      result.report.states.stateC.outcome,
      "INCONCLUSIVE",
    );
    assert.equal(result.report.verdict, "INCONCLUSIVE");
  });
});

test("short-circuits after State A and State B failures", async (suite) => {
  await suite.test("State A failure", async () => {
    const scenario = createRepository(
      "state a failure repository",
      {
        baseTest: failingTest("base failure", "head"),
      },
    );
    const result = await runChangeProof(inputFor(scenario));

    assert.notEqual(result.report.states.stateA.outcome, "PASS");
    assert.equal(result.report.states.stateB.outcome, "NOT_RUN");
    assert.equal(result.report.states.stateC.outcome, "NOT_RUN");
    assert.equal(result.report.states.stateB.commitId, null);
    assert.equal(result.report.workspace.worktreesCreated, 1);
    assert.equal(result.report.verdict, "BASE_FAILED");
  });

  await suite.test("State B failure", async () => {
    const scenario = createRepository(
      "state b failure repository",
      {
        headTest: failingTest("head failure", "base"),
      },
    );
    const result = await runChangeProof(inputFor(scenario, {
      stateBCount: 1,
      stateCCount: 1,
    }));

    assert.equal(result.report.states.stateA.outcome, "PASS");
    assert.notEqual(result.report.states.stateB.outcome, "PASS");
    assert.equal(result.report.states.stateC.outcome, "NOT_RUN");
    assert.equal(result.report.states.stateC.commitId, null);
    assert.equal(result.report.workspace.worktreesCreated, 2);
    assert.equal(result.report.verdict, "HEAD_FAILED");
  });
});

test("keeps execution failures operational", async (suite) => {
  const scenario = createRepository("operational repository");
  const scripts = join(temporaryRoot, "command scripts");
  mkdirSync(scripts);
  const timeoutScript = join(scripts, "timeout.mjs");
  const truncationScript = join(scripts, "truncation.mjs");
  writeFileSync(
    timeoutScript,
    "setInterval(() => {}, 1000); await new Promise(() => {});\n",
  );
  writeFileSync(
    truncationScript,
    'process.stdout.write("x".repeat(10_000));\n',
  );

  for (const [name, overrides, assertion] of [
    [
      "timeout",
      {
        argumentsList: [timeoutScript],
        timeoutMs: 500,
      },
      (report) => {
        assert.equal(report.states.stateA.execution.timedOut, true);
      },
    ],
    [
      "truncation",
      {
        argumentsList: [truncationScript],
        maxStdoutBytes: 512,
      },
      (report) => {
        assert.equal(
          report.states.stateA.execution.stdoutTruncated,
          true,
        );
      },
    ],
    [
      "spawn failure",
      {
        executable: join(temporaryRoot, "missing executable"),
      },
      (report) => {
        assert.notEqual(
          report.states.stateA.execution.processErrorCode,
          null,
        );
      },
    ],
  ]) {
    await suite.test(name, async () => {
      const result = await runChangeProof(
        inputFor(scenario, overrides),
      );

      assertion(result.report);
      assert.equal(
        result.report.states.stateA.invalidFailure,
        true,
      );
      assert.equal(
        result.report.states.stateB.outcome,
        "NOT_RUN",
      );
      assert.equal(
        result.report.verdict,
        "OPERATIONAL_ERROR",
      );
    });
  }
});

test("handles invalid boundaries and lifecycle failures honestly", async (suite) => {
  await suite.test("invalid boundary", async () => {
    const scenario = createRepository(
      "invalid boundary repository",
    );
    const result = await runChangeProof(inputFor(scenario, {
      environment: shimEnvironment("invalid-boundary"),
    }));

    assert.equal(result.report.boundary.valid, false);
    assert.equal(
      result.report.verdict,
      "INVALID_TEST_ENVELOPE",
    );
    assert.equal(result.report.workspace.cleanupCompleted, true);
  });

  await suite.test("callback failure still cleans", async () => {
    const scenario = createRepository(
      "callback failure repository",
    );
    const before = snapshot(scenario.repository);
    let observed;

    try {
      await runChangeProof(inputFor(scenario, {
        environment: shimEnvironment("malformed-tree"),
      }));
      assert.fail("expected materializer failure");
    } catch (error) {
      observed = error;
    }

    assert.equal(observed.cleanup.cleanupCompleted, true);
    assert.deepEqual(snapshot(scenario.repository), before);
  });

  await suite.test("cleanup failure returns no report", async () => {
    const scenario = createRepository(
      "cleanup failure repository",
    );
    let observed;

    try {
      await runChangeProof(inputFor(scenario, {
        environment: shimEnvironment("cleanup-fail"),
      }));
      assert.fail("expected cleanup failure");
    } catch (error) {
      observed = error;
    }

    assert.equal(observed.cleanup.cleanupCompleted, false);
    assert.equal(Object.hasOwn(observed, "report"), false);
    removeLeakedWorktrees(scenario.repository);
  });
});

test("equivalent runs are structurally deterministic", async () => {
  const scenario = createRepository("determinism repository");
  const first = await runChangeProof(inputFor(scenario));
  const second = await runChangeProof(inputFor(scenario));

  assert.deepEqual(
    normalizedReport(first.report),
    normalizedReport(second.report),
  );
  assert.equal(first.markdown, second.markdown);
  assert.equal(
    first.report.workspace.cleanupCompleted,
    true,
  );
  assert.equal(
    second.report.workspace.cleanupCompleted,
    true,
  );
  assert.equal(
    runGit(scenario.repository, [
      "worktree",
      "list",
      "--porcelain",
    ]).split("\n").filter((line) =>
      line.startsWith("worktree ")).length,
    1,
  );
});

test("production and runner retain the required architecture boundary", () => {
  const production = readFileSync(
    join(process.cwd(), "src/core/run-change-proof.mjs"),
    "utf8",
  );
  const runner = readFileSync(
    join(
      process.cwd(),
      "experiments/m2-non-synthetic-pilot/run.mjs",
    ),
    "utf8",
  );

  for (const forbidden of [
    "node:child_process",
    "spawnSync",
    "execSync",
    "execFileSync",
    "shell: true",
    "...process.env",
    "git worktree",
    "git restore",
    "git hash-object",
    "node:fs/promises\";\nimport { writeFile",
    "2a47fb6b5b28579c30ef5cd52f11c13f594e71f9",
    "d9ba86e32e991bdc1385d487f26f74c36dba122a",
    "m1-controlled-fixture",
    "free-shipping",
  ]) {
    assert.equal(production.includes(forbidden), false, forbidden);
  }

  for (const forbidden of [
    "classifyNodeTestExecution",
    "classifyExpectedNodeTestRegression",
    "evaluateEvidence",
    "evaluateBoundary",
    "createOwnedWorkspaceLifecycle",
    "createExplicitEnvelopeMaterializer",
    "buildEvidenceReport",
    "ls-tree",
    "worktree add",
  ]) {
    assert.equal(runner.includes(forbidden), false, forbidden);
  }
});
