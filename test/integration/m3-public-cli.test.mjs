import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const configuredRepository =
  process.env.CHANGE_PROOF_M3_PILOT_REPOSITORY;
const skipReason =
  "M3 public CLI pilot repository is not configured";
const changeProofRoot = resolve(".");
const binaryPath = resolve("bin/change-proof.mjs");
const baseCommitId =
  "2a47fb6b5b28579c30ef5cd52f11c13f594e71f9";
const headCommitId =
  "d9ba86e32e991bdc1385d487f26f74c36dba122a";
const sourcePath = "tools/forge-validator/src/pr-watch.mjs";
const selectedTestPath =
  "tools/forge-validator/test/pr-watch.test.mjs";

const expectedFailures = [
  {
    testName:
      "collectPrWatchStatus handles immediately registered passing checks",
    outputIncludes: ["code: 'ERR_ASSERTION'", "- 'passed'"],
  },
  {
    testName:
      "collectPrWatchStatus reports persistent missing checks without starting watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "+ 'missing'",
      "- 'not_registered'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus preserves failing final checks",
    outputIncludes: ["code: 'ERR_ASSERTION'", "- 'failed'"],
  },
  {
    testName:
      "collectPrWatchStatus preserves pending final checks",
    outputIncludes: ["code: 'ERR_ASSERTION'", "- 'pending'"],
  },
  {
    testName: "collectPrWatchStatus times out a bounded watch",
    outputIncludes: ["code: 'ERR_ASSERTION'", "- 1234"],
  },
  {
    testName:
      "collectPrWatchStatus rejects a head change before watch",
    outputIncludes: [
      "code: 'ERR_TEST_FAILURE'",
      "Unexpected command: pr checks 89 --watch",
    ],
  },
  {
    testName:
      "collectPrWatchStatus rejects a head change after watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "+ 'passing'",
      "- 'head_changed'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus classifies cancelled checks as failed",
    outputIncludes: ["code: 'ERR_ASSERTION'", "- 'failed'"],
  },
];

function explicitEnvironment() {
  const environment = {
    LC_ALL: "C",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };
  if (
    typeof process.env.PATH === "string" &&
    process.env.PATH.length > 0
  ) {
    environment.PATH = process.env.PATH;
  }
  return environment;
}

async function runFile(executable, argumentsList, cwd) {
  try {
    const result = await executeFile(executable, argumentsList, {
      cwd,
      encoding: "utf8",
      env: { ...process.env },
      maxBuffer: 16 * 1024 * 1024,
    });
    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      exitCode: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

async function git(repositoryRoot, argumentsList) {
  const result = await runFile(
    "git",
    ["--no-pager", ...argumentsList],
    repositoryRoot,
  );
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout;
}

async function snapshot(repositoryRoot) {
  return {
    head: (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim(),
    branch: (await git(
      repositoryRoot,
      ["branch", "--show-current"],
    )).trim(),
    status: await git(repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
    refs: await git(repositoryRoot, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    worktrees: await git(repositoryRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]),
  };
}

function config(repositoryRoot, temporaryParent, outputDirectory) {
  return {
    schemaVersion: "0.1",
    repositoryRoot,
    baseRef: baseCommitId,
    headRef: headCommitId,
    command: {
      executable: process.execPath,
      arguments: [
        "--test",
        "--test-reporter=tap",
        selectedTestPath,
      ],
      workingDirectory: ".",
      environment: explicitEnvironment(),
      timeoutMs: 30_000,
      maxStdoutBytes: 4 * 1024 * 1024,
      maxStderrBytes: 4 * 1024 * 1024,
    },
    envelope: {
      includedPaths: [selectedTestPath],
    },
    classification: {
      stateA: { expectedTestCount: 20 },
      stateB: { expectedTestCount: 24 },
      stateC: {
        expectedTestCount: 24,
        expectedFailures: expectedFailures.map((failure) => ({
          testName: failure.testName,
          outputIncludes: [...failure.outputIncludes],
        })),
      },
    },
    temporaryParentDirectory: temporaryParent,
    workspacePrefix: "change-proof-m3-integration-",
    outputDirectory,
  };
}

async function writeConfig(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function invoke(configPath, extraArguments = []) {
  return runFile(
    process.execPath,
    [
      binaryPath,
      "run",
      "--config",
      configPath,
      ...extraArguments,
    ],
    changeProofRoot,
  );
}

function expectedSummary(report, outputDirectory, rejected = false) {
  const lines = [
    "Change Proof",
    `base=${report.repository.baseCommitId}`,
    `head=${report.repository.headCommitId}`,
    `state_a=${report.states.stateA.outcome}`,
    `state_b=${report.states.stateB.outcome}`,
    `state_c=${report.states.stateC.outcome}`,
    `boundary=${report.boundary.valid ? "VALID" : "INVALID"}`,
    `verdict=${report.verdict}`,
    `report_json=${join(outputDirectory, "report.json")}`,
    `report_markdown=${join(outputDirectory, "report.md")}`,
    "cleanup=VERIFIED",
  ];
  if (rejected) {
    lines.push("policy=REJECTED");
  }
  return `${lines.join("\n")}\n`;
}

function assertNoRawFields(value) {
  if (value === null || typeof value !== "object") {
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assert.equal(
      ["stdout", "stderr", "output", "rawOutput"].includes(key),
      false,
      key,
    );
    assertNoRawFields(item);
  }
}

function withoutTiming(report) {
  const normalized = structuredClone(report);
  delete normalized.timing.startedAt;
  delete normalized.timing.durationMs;
  for (const state of Object.values(normalized.states)) {
    if (state.execution !== null) {
      delete state.execution.durationMs;
    }
  }
  return normalized;
}

test("the package binary exists and is executable", async () => {
  await access(binaryPath);
  const metadata = await stat(binaryPath);
  assert.equal(metadata.isFile(), true);
  assert.notEqual(metadata.mode & 0o111, 0);
  assert.equal(
    (await readFile(binaryPath, "utf8")).startsWith(
      "#!/usr/bin/env node\n",
    ),
    true,
  );
});

test(
  "runs the configured non-synthetic M3 public CLI pilot",
  {
    skip: (
      typeof configuredRepository !== "string" ||
      configuredRepository.length === 0
    )
      ? skipReason
      : false,
  },
  async (t) => {
    const repositoryRoot = resolve(configuredRepository);
    const root = await mkdtemp(join(
      tmpdir(),
      "change-proof-m3-public-cli-",
    ));
    t.after(() => rm(root, { recursive: true, force: true }));

    const pilotBefore = await snapshot(repositoryRoot);
    const changeProofBefore = await snapshot(changeProofRoot);

    const successOutput = join(root, "success-output");
    const successConfigPath = join(root, "success.json");
    await writeConfig(
      successConfigPath,
      config(repositoryRoot, root, successOutput),
    );
    assert.deepEqual(
      JSON.parse(await readFile(successConfigPath, "utf8")),
      config(repositoryRoot, root, successOutput),
    );

    const success = await invoke(successConfigPath);
    assert.equal(success.exitCode, 0, success.stderr);
    assert.equal(success.stderr, "");
    const jsonPath = join(successOutput, "report.json");
    const markdownPath = join(successOutput, "report.md");
    const json = await readFile(jsonPath, "utf8");
    const markdown = await readFile(markdownPath, "utf8");
    const report = JSON.parse(json);
    assert.equal(success.stdout, expectedSummary(report, successOutput));

    assert.equal(report.repository.baseCommitId, baseCommitId);
    assert.equal(report.repository.headCommitId, headCommitId);
    assert.deepEqual(report.repository.changedPaths, [
      sourcePath,
      selectedTestPath,
    ]);
    assert.equal(report.states.stateA.outcome, "PASS");
    assert.deepEqual(report.states.stateA.summary, {
      tests: 20,
      pass: 20,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    });
    assert.equal(report.states.stateB.outcome, "PASS");
    assert.deepEqual(report.states.stateB.summary, {
      tests: 24,
      pass: 24,
      fail: 0,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    });
    assert.equal(
      report.states.stateC.outcome,
      "EXPECTED_TEST_FAILURE",
    );
    assert.equal(
      report.states.stateC.reasonCode,
      "EXPECTED_TEST_FAILURE_SET_OBSERVED",
    );
    assert.equal(report.states.stateC.invalidFailure, false);
    assert.deepEqual(report.states.stateC.summary, {
      tests: 24,
      pass: 16,
      fail: 8,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    });
    assert.equal(report.boundary.valid, true);
    assert.deepEqual(report.boundary.reasonCodes, []);
    assert.deepEqual(report.envelope.resultingChangedPaths, [
      selectedTestPath,
    ]);
    assert.equal(
      report.envelope.stateCBlobIds[selectedTestPath],
      report.envelope.headBlobIds[selectedTestPath],
    );
    assert.equal(
      report.envelope.stateCBlobIds[sourcePath],
      report.envelope.baseBlobIds[sourcePath],
    );
    assert.equal(report.verdict, "OBSERVED_TEST_DISCRIMINATION");
    assert.equal(report.workspace.cleanupCompleted, true);
    assert.equal(report.workspace.workspaceRemoved, true);
    assert.equal(report.workspace.worktreesCreated, 3);
    assert.equal(report.workspace.worktreesRemoved, 3);
    assertNoRawFields(report);
    assert.equal(json.includes("change-proof-m3-integration-"), false);

    for (const value of [
      baseCommitId,
      headCommitId,
      "EXPECTED_TEST_FAILURE",
      "OBSERVED_TEST_DISCRIMINATION",
    ]) {
      assert.equal(markdown.includes(value), true, value);
    }
    for (const overclaim of [
      "proves implementation correctness",
      "production sufficiency is proven",
      "safe execution of untrusted code",
    ]) {
      assert.equal(markdown.includes(overclaim), false, overclaim);
    }

    const failOnOutput = join(root, "fail-on-output");
    const failOnConfigPath = join(root, "fail-on.json");
    await writeConfig(
      failOnConfigPath,
      config(repositoryRoot, root, failOnOutput),
    );
    const failOn = await invoke(failOnConfigPath, [
      "--fail-on",
      "OBSERVED_TEST_DISCRIMINATION",
    ]);
    assert.equal(failOn.exitCode, 1, failOn.stderr);
    assert.equal(failOn.stderr, "");
    const failOnReport = JSON.parse(await readFile(
      join(failOnOutput, "report.json"),
      "utf8",
    ));
    await access(join(failOnOutput, "report.md"));
    assert.equal(
      failOnReport.verdict,
      "OBSERVED_TEST_DISCRIMINATION",
    );
    assert.equal(
      failOn.stdout,
      expectedSummary(failOnReport, failOnOutput, true),
    );

    const invalidConfigPath = join(root, "invalid.json");
    const invalidOutput = join(root, "invalid-output");
    await writeFile(invalidConfigPath, "{\n", "utf8");
    const invalid = await invoke(invalidConfigPath);
    assert.equal(invalid.exitCode, 2);
    assert.equal(invalid.stdout, "");
    assert.equal(
      invalid.stderr,
      "change-proof: configuration error: CONFIG_JSON_INVALID\n",
    );
    await assert.rejects(access(invalidOutput));

    const missingOutput = join(root, "missing-output");
    const missingConfigPath = join(root, "missing-repository.json");
    const missingConfig = config(
      repositoryRoot,
      root,
      missingOutput,
    );
    missingConfig.repositoryRoot = join(root, "missing-repository");
    await writeConfig(missingConfigPath, missingConfig);
    const missing = await invoke(missingConfigPath);
    assert.equal(missing.exitCode, 2);
    assert.match(
      missing.stderr,
      /^change-proof: configuration error: CONFIG_REPOSITORY_INVALID\n$/,
    );
    await assert.rejects(access(missingOutput));

    const operationalOutput = join(root, "operational-output");
    const operationalConfigPath = join(root, "operational.json");
    const operationalConfig = config(
      repositoryRoot,
      root,
      operationalOutput,
    );
    operationalConfig.baseRef = "missing-change-proof-ref";
    await writeConfig(operationalConfigPath, operationalConfig);
    const operational = await invoke(operationalConfigPath);
    assert.equal(operational.exitCode, 3);
    assert.equal(operational.stdout, "");
    assert.match(
      operational.stderr,
      /^change-proof: operational error: [A-Z0-9_]+\n$/,
    );
    await assert.rejects(access(operationalOutput));

    const existingOutput = join(root, "existing-output");
    const existingConfigPath = join(root, "existing.json");
    await mkdir(existingOutput);
    const existingJsonPath = join(existingOutput, "report.json");
    await writeFile(existingJsonPath, "user content", "utf8");
    await writeConfig(
      existingConfigPath,
      config(repositoryRoot, root, existingOutput),
    );
    const existing = await invoke(existingConfigPath);
    assert.equal(existing.exitCode, 3);
    assert.equal(
      existing.stderr,
      "change-proof: operational error: REPORT_TARGET_EXISTS\n",
    );
    assert.equal(
      await readFile(existingJsonPath, "utf8"),
      "user content",
    );
    await assert.rejects(access(join(existingOutput, "report.md")));

    const repeatOutput = join(root, "repeat-output");
    const repeatConfigPath = join(root, "repeat.json");
    await writeConfig(
      repeatConfigPath,
      config(repositoryRoot, root, repeatOutput),
    );
    const repeat = await invoke(repeatConfigPath);
    assert.equal(repeat.exitCode, 0, repeat.stderr);
    const repeatReport = JSON.parse(await readFile(
      join(repeatOutput, "report.json"),
      "utf8",
    ));
    const repeatMarkdown = await readFile(
      join(repeatOutput, "report.md"),
      "utf8",
    );
    assert.deepEqual(withoutTiming(repeatReport), withoutTiming(report));
    assert.equal(repeatMarkdown, markdown);
    assert.equal(
      repeat.stdout.replaceAll(repeatOutput, "<OUTPUT>"),
      success.stdout.replaceAll(successOutput, "<OUTPUT>"),
    );

    assert.deepEqual(await snapshot(repositoryRoot), pilotBefore);
    assert.deepEqual(await snapshot(changeProofRoot), changeProofBefore);

    const productionSources = await Promise.all([
      readFile(resolve("bin/change-proof.mjs"), "utf8"),
      readFile(resolve("src/cli/load-config.mjs"), "utf8"),
      readFile(resolve("src/cli/write-reports.mjs"), "utf8"),
      readFile(resolve("src/cli/run-cli.mjs"), "utf8"),
    ]);
    for (const forbidden of [
      "node:http",
      "node:https",
      "fetch(",
      "npm install",
      "pnpm install",
      "yarn install",
    ]) {
      assert.equal(
        productionSources.some((source) => source.includes(forbidden)),
        false,
        forbidden,
      );
    }
  },
);
