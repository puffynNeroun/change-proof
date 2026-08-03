import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  createGitRepositoryPrimitives,
} from "../../src/core/git-repository-primitives.mjs";
import {
  runBoundedCommand,
} from "../../src/core/run-bounded-command.mjs";
import {
  runChangeProof,
} from "../../src/core/run-change-proof.mjs";

const configuredRepository =
  process.env.CHANGE_PROOF_M210_PILOT_REPOSITORY;
const skipReason =
  "M2.10 pilot repository is not configured";
const baseCommitId =
  "2a47fb6b5b28579c30ef5cd52f11c13f594e71f9";
const headCommitId =
  "d9ba86e32e991bdc1385d487f26f74c36dba122a";
const sourcePath =
  "tools/forge-validator/src/pr-watch.mjs";
const selectedTestPath =
  "tools/forge-validator/test/pr-watch.test.mjs";

const expectedFailures = [
  {
    testName:
      "collectPrWatchStatus handles immediately registered passing checks",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'passed'",
    ],
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
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'failed'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus preserves pending final checks",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'pending'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus times out a bounded watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 1234",
    ],
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
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'failed'",
    ],
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

async function runGit(repositoryRoot, argumentsList) {
  const result = await runBoundedCommand({
    executable: "git",
    arguments: ["--no-pager", ...argumentsList],
    workingDirectory: repositoryRoot,
    environment: explicitEnvironment(),
    timeoutMs: 20_000,
    maxStdoutBytes: 4 * 1024 * 1024,
    maxStderrBytes: 4 * 1024 * 1024,
  });

  assert.equal(result.exitCode, 0, result.stderr);
  assert.equal(result.timedOut, false);
  assert.equal(result.stdoutTruncated, false);
  assert.equal(result.stderrTruncated, false);

  return result.stdout;
}

async function snapshot(repositoryRoot) {
  return {
    head: (await runGit(
      repositoryRoot,
      ["rev-parse", "HEAD"],
    )).trim(),
    branch: (await runGit(
      repositoryRoot,
      ["branch", "--show-current"],
    )).trim(),
    status: await runGit(repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
    refs: await runGit(repositoryRoot, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    worktrees: await runGit(repositoryRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]),
  };
}

function pilotInput(repositoryRoot) {
  return {
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
    toolVersion: "integration-m2.10",
    temporaryParentDirectory: tmpdir(),
    workspacePrefix:
      "change-proof-m210-integration-",
  };
}

test(
  "runs the configured non-synthetic M2.10 pilot",
  {
    skip: (
      typeof configuredRepository !== "string" ||
      configuredRepository.length === 0
    )
      ? skipReason
      : false,
  },
  async () => {
    const repositoryRoot = resolve(configuredRepository);
    const changeProofRoot = process.cwd();
    const configuration = {
      gitExecutable: "git",
      environment: explicitEnvironment(),
      timeoutMs: 20_000,
      maxStdoutBytes: 4 * 1024 * 1024,
      maxStderrBytes: 4 * 1024 * 1024,
    };
    const primitives =
      createGitRepositoryPrimitives(configuration);
    const resolvedBase = await primitives.resolveCommit(
      repositoryRoot,
      baseCommitId,
    );
    const resolvedHead = await primitives.resolveCommit(
      repositoryRoot,
      headCommitId,
    );
    const resolvedParent = await primitives.resolveCommit(
      repositoryRoot,
      `${headCommitId}^`,
    );
    const changedPaths = await primitives.listChangedPaths(
      repositoryRoot,
      baseCommitId,
      headCommitId,
    );

    assert.equal(
      await primitives.isWorktreeClean(repositoryRoot),
      true,
    );
    assert.equal(resolvedBase, baseCommitId);
    assert.equal(resolvedHead, headCommitId);
    assert.equal(resolvedParent, baseCommitId);
    assert.deepEqual(changedPaths, [sourcePath, selectedTestPath]);

    const pilotBefore = await snapshot(repositoryRoot);
    const changeProofBefore = await snapshot(changeProofRoot);
    const first = await runChangeProof(
      pilotInput(repositoryRoot),
    );
    const second = await runChangeProof(
      pilotInput(repositoryRoot),
    );
    const report = first.report;

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
    assert.deepEqual(
      report.envelope.resultingChangedPaths,
      [selectedTestPath],
    );
    assert.equal(
      report.envelope.stateCBlobIds[selectedTestPath],
      report.envelope.headBlobIds[selectedTestPath],
    );
    assert.equal(
      report.envelope.stateCBlobIds[sourcePath],
      report.envelope.baseBlobIds[sourcePath],
    );
    assert.equal(
      report.verdict,
      "OBSERVED_TEST_DISCRIMINATION",
    );
    assert.deepEqual(report.reasons, [
      "The selected head test produced the exact expected failure set against the exact base implementation.",
    ]);
    assert.deepEqual(JSON.parse(first.json), report);
    assert.equal(first.markdown.includes(baseCommitId), true);
    assert.equal(first.markdown.includes(headCommitId), true);
    assert.equal(
      first.markdown.includes(
        "EXPECTED_TEST_FAILURE",
      ),
      true,
    );
    assert.equal(
      first.markdown.includes(
        "The explicitly selected head tests observed a behavioral difference against the exact base implementation.",
      ),
      true,
    );

    for (const overclaim of [
      "proves implementation correctness",
      "proves complete-change correctness",
      "AI proof",
      "general causality is proven",
      "production sufficiency is proven",
    ]) {
      assert.equal(
        first.markdown.includes(overclaim),
        false,
        overclaim,
      );
    }

    for (const result of [first, second]) {
      assert.equal(
        result.report.workspace.cleanupCompleted,
        true,
      );
      assert.equal(
        result.report.workspace.workspaceRemoved,
        true,
      );
      assert.equal(
        result.report.workspace.worktreesCreated,
        3,
      );
      assert.equal(
        result.report.workspace.worktreesRemoved,
        3,
      );
      assert.equal(
        JSON.stringify(result.report).includes(
          "change-proof-m210-integration-",
        ),
        false,
      );
    }

    assert.deepEqual(await snapshot(repositoryRoot), pilotBefore);
    assert.deepEqual(await snapshot(changeProofRoot), changeProofBefore);
  },
);
