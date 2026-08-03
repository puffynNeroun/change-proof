import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  dirname,
  join,
  relative,
} from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  runBoundedCommand,
} from "../../src/core/run-bounded-command.mjs";
import {
  runControlledFixtureMatrix,
} from "../../experiments/m1-controlled-fixture/state-c-experiment.mjs";

const repositoryRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const experimentRoot = join(
  repositoryRoot,
  "experiments",
  "m1-controlled-fixture",
);
const fixtureRoot = join(
  experimentRoot,
  "fixture",
);
const runnerPath = join(
  experimentRoot,
  "run.mjs",
);
const experimentSourcePath = join(
  experimentRoot,
  "state-c-experiment.mjs",
);
const expectedOutputHash =
  "60fcbf33e334231f025fe3a4a7c2eeb9ee1ded3e62fb4f5b79c96083ec4f7ae1";
const expectedReasons = Object.freeze([
  "The selected head test failed at the expected assertion against the exact base implementation.",
  "The selected head test also passed against the exact base implementation.",
  "The exact head state did not pass its complete tests.",
  "The exact base state did not pass its baseline tests.",
]);
const expectedScenarios = Object.freeze([
  {
    name: "positive",
    verdict: "OBSERVED_TEST_DISCRIMINATION",
    outcomes: [
      "PASS",
      "PASS",
      "TEST_ASSERTION_FAILURE",
    ],
    stateCCreated: true,
  },
  {
    name: "non_discriminating",
    verdict: "NON_DISCRIMINATING_TESTS",
    outcomes: ["PASS", "PASS", "PASS"],
    stateCCreated: true,
  },
  {
    name: "head_failed",
    verdict: "HEAD_FAILED",
    outcomes: [
      "PASS",
      "INCONCLUSIVE",
      "NOT_RUN",
    ],
    stateCCreated: false,
  },
  {
    name: "base_failed",
    verdict: "BASE_FAILED",
    outcomes: [
      "INCONCLUSIVE",
      "NOT_RUN",
      "NOT_RUN",
    ],
    stateCCreated: false,
  },
]);

function explicitEnvironment(overrides = {}) {
  const environment = {
    LC_ALL: "C",
    LANG: "C",
    ...overrides,
  };

  if (
    typeof process.env.PATH === "string" &&
    process.env.PATH.length > 0
  ) {
    environment.PATH = process.env.PATH;
  }

  return environment;
}

function hash(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

async function runCommand(
  executable,
  argumentsList,
  environment = explicitEnvironment(),
) {
  return await runBoundedCommand({
    executable,
    arguments: argumentsList,
    workingDirectory: repositoryRoot,
    environment,
    timeoutMs: 30_000,
    maxStdoutBytes: 2 * 1024 * 1024,
    maxStderrBytes: 2 * 1024 * 1024,
  });
}

async function runRunner() {
  const result = await runCommand(
    process.execPath,
    [runnerPath],
  );

  return {
    ...result,
    output: `${result.stdout}${result.stderr}`,
  };
}

async function runGit(argumentsList) {
  const result = await runCommand(
    "git",
    ["--no-pager", ...argumentsList],
  );

  assert.equal(
    result.exitCode,
    0,
    result.stderr,
  );
  assert.equal(result.processErrorCode, null);
  assert.equal(result.timedOut, false);
  assert.equal(result.signal, null);
  assert.equal(result.stdoutTruncated, false);
  assert.equal(result.stderrTruncated, false);
  return result.stdout;
}

async function repositorySnapshot() {
  return {
    head: await runGit(["rev-parse", "HEAD"]),
    status: await runGit([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]),
    refs: await runGit([
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    worktrees: await runGit([
      "worktree",
      "list",
      "--porcelain",
      "-z",
    ]),
  };
}

async function listFiles(root, directory = root) {
  const entries = await readdir(directory, {
    withFileTypes: true,
  });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await listFiles(root, path));
    } else {
      files.push(relative(root, path));
    }
  }

  return files.sort();
}

async function fixtureSnapshot(root = fixtureRoot) {
  const result = {};

  for (const path of await listFiles(root)) {
    result[path] = hash(
      await readFile(join(root, path)),
    );
  }

  return result;
}

async function temporaryFixtureArtifacts() {
  return (await readdir(tmpdir()))
    .filter((name) =>
      name.startsWith(
        "change-proof-m1-state-c-",
      ))
    .sort();
}

async function createGitShim(mode) {
  const root = await mkdtemp(
    join(tmpdir(), `change-proof-m29-${mode}-`),
  );
  const path = join(root, "git-shim.mjs");
  const source = [
    `#!${process.execPath}`,
    'import { spawnSync } from "node:child_process";',
    "const args = process.argv.slice(2);",
    "const has = (...values) => values.every((value) => args.includes(value));",
    `const mode = ${JSON.stringify(mode)};`,
    "if (mode === 'cleanup-failure' && has('worktree', 'remove')) { process.stderr.write('injected cleanup failure'); process.exit(17); }",
    "const result = spawnSync('git', args, { cwd: process.cwd(), env: process.env, encoding: 'utf8' });",
    "if (result.error) { process.stderr.write(result.error.message); process.exit(126); }",
    "if (mode === 'invalid-boundary' && result.status === 0 && has('restore', '--staged', '--worktree')) {",
    "  const sourceArgument = args.find((value) => value.startsWith('--source='));",
    "  const injected = spawnSync('git', ['--no-pager', '--literal-pathspecs', 'restore', sourceArgument, '--staged', '--worktree', '--', 'src/qualifies-for-free-shipping.js'], { cwd: process.cwd(), env: process.env, encoding: 'utf8' });",
    "  if (injected.status !== 0) { process.stderr.write(injected.stderr ?? ''); process.exit(injected.status ?? 125); }",
    "}",
    "process.stdout.write(result.stdout ?? '');",
    "process.stderr.write(result.stderr ?? '');",
    "if (result.signal) { process.kill(process.pid, result.signal); }",
    "process.exit(result.status ?? 125);",
    "",
  ].join("\n");

  await writeFile(path, source);
  await chmod(path, 0o700);
  return { root, path };
}

async function withConfiguredGit(
  executable,
  callback,
) {
  const original =
    process.env.CHANGE_PROOF_GIT;
  process.env.CHANGE_PROOF_GIT = executable;

  try {
    return await callback();
  } finally {
    if (original === undefined) {
      delete process.env.CHANGE_PROOF_GIT;
    } else {
      process.env.CHANGE_PROOF_GIT = original;
    }
  }
}

function occurrenceCount(source, value) {
  return source.split(value).length - 1;
}

function parseManifest(output) {
  const begin =
    "===== M1 JSON MANIFEST BEGIN =====\n";
  const end =
    "\n===== M1 JSON MANIFEST END =====";
  const startIndex = output.indexOf(begin);
  const endIndex = output.indexOf(
    end,
    startIndex + begin.length,
  );

  assert.notEqual(startIndex, -1);
  assert.notEqual(endIndex, -1);

  return JSON.parse(
    output.slice(
      startIndex + begin.length,
      endIndex,
    ),
  );
}

test(
  "the public runner preserves its exact deterministic output contract",
  async () => {
    const repositoryBefore =
      await repositorySnapshot();
    const fixturesBefore =
      await fixtureSnapshot();
    const temporaryArtifactsBefore =
      await temporaryFixtureArtifacts();
    const first = await runRunner();
    const second = await runRunner();

    for (const result of [first, second]) {
      assert.equal(result.exitCode, 0);
      assert.equal(result.processErrorCode, null);
      assert.equal(result.timedOut, false);
      assert.equal(result.signal, null);
      assert.equal(result.stdoutTruncated, false);
      assert.equal(result.stderrTruncated, false);
      assert.equal(result.stderr, "");
      assert.equal(
        result.output.split("\n").length - 1,
        239,
      );
      assert.equal(hash(result.output), expectedOutputHash);
    }

    assert.equal(first.output, second.output);
    assert.deepEqual(
      await repositorySnapshot(),
      repositoryBefore,
    );
    assert.deepEqual(
      await fixtureSnapshot(),
      fixturesBefore,
    );
    assert.deepEqual(
      await temporaryFixtureArtifacts(),
      temporaryArtifactsBefore,
    );
  },
);

test(
  "markers, summaries, manifest ordering, reasons, cleanup, and checks remain exact",
  async () => {
    const { output } = await runRunner();
    const markers = [
      "M1_RUNNER_PREFLIGHT_VERIFIED",
      "===== M1 SCENARIO SUMMARY =====",
      "===== M1 JSON MANIFEST BEGIN =====",
      "===== M1 JSON MANIFEST END =====",
      "M1_RUNNER_VERIFIED",
    ];
    let previousIndex = -1;

    for (const marker of markers) {
      assert.equal(occurrenceCount(output, marker), 1);
      const index = output.indexOf(marker);
      assert.equal(index > previousIndex, true);
      previousIndex = index;
    }

    const summaryLines = output
      .split("\n")
      .filter((line) =>
        line.startsWith("scenario="));

    assert.deepEqual(
      summaryLines,
      expectedScenarios.map((scenario) =>
        `scenario=${scenario.name} ` +
        `verdict=${scenario.verdict} ` +
        `stateA=${scenario.outcomes[0]} ` +
        `stateB=${scenario.outcomes[1]} ` +
        `stateC=${scenario.outcomes[2]} ` +
        "passed=yes"),
    );
    assert.equal(
      output.endsWith("M1_RUNNER_VERIFIED\n"),
      true,
    );

    const manifest = parseManifest(output);
    assert.equal(manifest.status, "VERIFIED");
    assert.equal(manifest.scenarioCount, 4);
    assert.equal(manifest.completedScenarioCount, 4);
    assert.deepEqual(
      manifest.scenarios.map(({ scenario }) => scenario),
      expectedScenarios.map(({ name }) => name),
    );
    assert.deepEqual(
      manifest.scenarios.map(({ verdict }) => verdict),
      expectedScenarios.map(({ verdict }) => verdict),
    );
    assert.deepEqual(
      manifest.scenarios.map(({ reason }) => reason),
      expectedReasons,
    );

    for (const [index, scenario] of
      manifest.scenarios.entries()) {
      const expected = expectedScenarios[index];
      assert.deepEqual(
        [
          scenario.states.stateA.outcome,
          scenario.states.stateB.outcome,
          scenario.states.stateC.outcome,
        ],
        expected.outcomes,
      );
      assert.deepEqual(scenario.cleanup, {
        workspaceRemoved: true,
        stateARemoved: true,
        stateBRemoved: true,
        stateCCreated:
          expected.stateCCreated,
        stateCRemoved: true,
      });
      assert.deepEqual(scenario.checks, {
        identity: true,
        verdict: true,
        outcomes: true,
        stateCCreation: true,
        boundary: true,
        stateShas: true,
        cleanup: true,
      });
      assert.equal(scenario.passed, true);
    }
  },
);

test(
  "the migration source has one export and no legacy evidence-engine fallback",
  async () => {
    const source = await readFile(
      experimentSourcePath,
      "utf8",
    );
    const runner = await readFile(
      runnerPath,
      "utf8",
    );

    for (const required of [
      "runBoundedCommand",
      "classifyNodeTestExecution",
      "classifyExpectedNodeTestRegression",
      "createGitRepositoryPrimitives",
      "createOwnedWorkspaceLifecycle",
      "createExplicitEnvelopeMaterializer",
      "evaluateEvidence",
    ]) {
      assert.equal(source.includes(required), true, required);
    }

    for (const forbidden of [
      "node:child_process",
      "spawnSync",
      "execSync",
      "withOwnedStateCWorkspace",
      "createStateCHybrid",
      "createPassingStates",
      "executePassingState",
      "executeStateC",
      "evaluateThreeStateEvidence",
      "boundaryIsValid",
      "TAP version",
      "buildEvidenceReport",
      "Atomics.wait",
      '"worktree", "add"',
      '"worktree", "remove"',
      '"restore"',
      '"hash-object"',
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }

    assert.deepEqual(
      [...source.matchAll(
        /export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g,
      )].map((match) => match[1]),
      ["runControlledFixtureMatrix"],
    );
    assert.equal(
      /await\s+runControlledFixtureMatrix\s*\(/m
        .test(runner),
      true,
    );
    assert.equal(runner.includes("spawnSync"), false);
    assert.equal(runner.includes("execSync"), false);
  },
);

test(
  "base and head failures preserve production short-circuit behavior",
  async () => {
    const before = await repositorySnapshot();
    const result =
      await runControlledFixtureMatrix(
        fixtureRoot,
      );
    const headFailed = result.manifest.scenarios[2];
    const baseFailed = result.manifest.scenarios[3];

    assert.deepEqual(
      [
        headFailed.states.stateA.outcome,
        headFailed.states.stateB.outcome,
        headFailed.states.stateC.outcome,
      ],
      ["PASS", "INCONCLUSIVE", "NOT_RUN"],
    );
    assert.equal(headFailed.verdict, "HEAD_FAILED");
    assert.equal(
      headFailed.cleanup.stateCCreated,
      false,
    );
    assert.deepEqual(
      [
        baseFailed.states.stateA.outcome,
        baseFailed.states.stateB.outcome,
        baseFailed.states.stateC.outcome,
      ],
      ["INCONCLUSIVE", "NOT_RUN", "NOT_RUN"],
    );
    assert.equal(baseFailed.verdict, "BASE_FAILED");
    assert.equal(
      baseFailed.cleanup.stateCCreated,
      false,
    );
    assert.deepEqual(
      await repositorySnapshot(),
      before,
    );
  },
);

test(
  "classifier failure remains operational and cannot become discrimination",
  async () => {
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "change-proof-m29-classifier-"),
    );
    const copiedFixture = join(
      temporaryRoot,
      "fixture",
    );

    try {
      await cp(fixtureRoot, copiedFixture, {
        recursive: true,
      });
      await writeFile(
        join(
          copiedFixture,
          "head",
          SELECTED_TEST_PATH_FOR_TEST,
        ),
        "this is not valid JavaScript }\n",
      );
      const result =
        await runControlledFixtureMatrix(
          copiedFixture,
        );
      const positive =
        result.manifest.scenarios[0];

      assert.equal(
        positive.verdict,
        "OPERATIONAL_ERROR",
      );
      assert.notEqual(
        positive.verdict,
        "OBSERVED_TEST_DISCRIMINATION",
      );
      assert.equal(
        positive.cleanup.workspaceRemoved,
        true,
      );
      assert.equal(
        positive.cleanup.stateARemoved,
        true,
      );
      assert.equal(
        positive.cleanup.stateBRemoved,
        true,
      );
      assert.equal(
        positive.cleanup.stateCCreated,
        false,
      );
    } finally {
      await rm(temporaryRoot, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "an invalid production boundary cannot produce the positive verdict",
  async () => {
    const shim = await createGitShim(
      "invalid-boundary",
    );
    const repositoryBefore =
      await repositorySnapshot();

    try {
      const result = await withConfiguredGit(
        shim.path,
        () => runControlledFixtureMatrix(
          fixtureRoot,
        ),
      );
      const positive =
        result.manifest.scenarios[0];

      assert.equal(
        positive.verdict,
        "INVALID_TEST_ENVELOPE",
      );
      assert.notEqual(
        positive.verdict,
        "OBSERVED_TEST_DISCRIMINATION",
      );
      assert.equal(
        positive.boundary.changedPaths.includes(
          "src/qualifies-for-free-shipping.js",
        ),
        true,
      );
      assert.deepEqual(positive.cleanup, {
        workspaceRemoved: true,
        stateARemoved: true,
        stateBRemoved: true,
        stateCCreated: true,
        stateCRemoved: true,
      });
      assert.deepEqual(
        await repositorySnapshot(),
        repositoryBefore,
      );
    } finally {
      await rm(shim.root, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "lifecycle cleanup failure is operational and never projected as success",
  async () => {
    const shim = await createGitShim(
      "cleanup-failure",
    );
    const repositoryBefore =
      await repositorySnapshot();

    try {
      const result = await withConfiguredGit(
        shim.path,
        () => runControlledFixtureMatrix(
          fixtureRoot,
        ),
      );

      assert.equal(result.exitCode, 3);
      assert.equal(
        result.manifest.status,
        "OPERATIONAL_ERROR",
      );
      assert.equal(
        result.manifest.scenarios.every(
          (scenario) =>
            scenario.verdict ===
              "OPERATIONAL_ERROR" &&
            !Object.hasOwn(scenario, "cleanup"),
        ),
        true,
      );
      assert.equal(
        result.errors.every((message) =>
          message.includes(
            "OWNED_WORKSPACE_INCOMPLETE_CLEANUP",
          )),
        true,
      );
      assert.deepEqual(
        await repositorySnapshot(),
        repositoryBefore,
      );
    } finally {
      await rm(shim.root, {
        recursive: true,
        force: true,
      });
    }
  },
);

const SELECTED_TEST_PATH_FOR_TEST =
  "test/qualifies-for-free-shipping.test.js";
