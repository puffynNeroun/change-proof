import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  evaluateBoundary,
} from "../../src/core/evaluate-boundary.mjs";

import {
  buildPrepareCandidate,
} from "../../src/core/prepare-candidate.mjs";

import {
  loadPrepareCandidate,
} from "../../src/cli/load-prepare-candidate.mjs";

function prepareConfig() {
  return {
    schemaVersion: "0.1",
    repositoryRoot: "/repo",
    baseRef: "base",
    headRef: "head",

    command: {
      executable: "node",

      arguments: [
        "--test",
        "test/example.test.mjs",
      ],

      workingDirectory: ".",

      environment: {
        ONLY: "explicit",
      },

      timeoutMs: 30000,
      maxStdoutBytes: 4194304,
      maxStderrBytes: 4194304,
    },

    envelope: {
      includedPaths: [
        "test/example.test.mjs",
      ],
    },

    temporaryParentDirectory: "/tmp",
    workspacePrefix: "change-proof-prepare-",
  };
}

function inspection({
  tests,
  pass,
  fail,
  failedLeaves = [],
}) {
  return {
    framework: "node:test",
    structuralStatus: "COMPLETE",
    observedTestCount: tests,

    summary: {
      tests,
      pass,
      fail,
      cancelled: 0,
      skipped: 0,
      todo: 0,
    },

    failedLeaves,
  };
}

function observed(testOutcome, value) {
  return {
    status: "OBSERVED",
    testOutcome,
    inspection: value,
  };
}

function candidate() {
  const selected =
    "test/example.test.mjs";

  const excluded =
    "src/value.mjs";

  const boundary =
    evaluateBoundary({
      baseSha:
        "base-object",

      stateCBaseSha:
        "base-object",

      includedPaths: [
        selected,
      ],

      headChangedPaths: [
        selected,
        excluded,
      ],

      materializedPaths: [
        selected,
      ],

      resultingChangedPaths: [
        selected,
      ],

      baseBlobIds: {
        [selected]:
          "base-test",

        [excluded]:
          "base-source",
      },

      headBlobIds: {
        [selected]:
          "head-test",

        [excluded]:
          "head-source",
      },

      stateCBlobIds: {
        [selected]:
          "head-test",

        [excluded]:
          "base-source",
      },
    });

  return buildPrepareCandidate({
    prepareConfig:
      prepareConfig(),

    prepareToolVersion:
      "0.1.0-beta.1",

    repositoryContextSha256:
      "ab".repeat(32),

    resolvedCommits: {
      base:
        "resolved-base",

      head:
        "resolved-head",
    },

    cleanupVerified:
      true,

    states: {
      stateA:
        observed(
          "PASS",
          inspection({
            tests: 1,
            pass: 1,
            fail: 0,
          }),
        ),

      stateB:
        observed(
          "PASS",
          inspection({
            tests: 2,
            pass: 2,
            fail: 0,
          }),
        ),

      stateC:
        observed(
          "FAIL",
          inspection({
            tests: 2,
            pass: 1,
            fail: 1,

            failedLeaves: [
              {
                testName:
                  "changed behavior is covered",

                failureType:
                  "testCodeFailure",

                code:
                  "ERR_ASSERTION",

                operator:
                  "strictEqual",

                failureSpecificFragments: [
                  "expected mismatch",
                ],
              },
            ],
          }),
        ),
    },

    boundary: {
      status: "OBSERVED",
      ...boundary,
    },

    metadata: {
      createdAt:
        "2026-08-30T00:00:00.000Z",
    },
  });
}

async function fixture() {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "change-proof-candidate-loader-",
      ),
    );

  const artifactDirectory =
    join(
      root,
      "artifacts",
    );

  await mkdir(
    artifactDirectory,
  );

  return {
    root,
    artifactDirectory,

    candidatePath:
      join(
        artifactDirectory,
        "candidate.json",
      ),
  };
}

test(
  "loads and normalizes a real prepare candidate artifact",
  async () => {
    const item =
      await fixture();

    const sourceCandidate =
      candidate();

    await writeFile(
      item.candidatePath,
      JSON.stringify(
        sourceCandidate,
        null,
        2,
      ) + "\n",
      "utf8",
    );

    const loaded =
      await loadPrepareCandidate(
        item.candidatePath,
      );

    assert.equal(
      loaded.candidatePath,
      item.candidatePath,
    );

    assert.deepEqual(
      loaded.candidate,
      sourceCandidate,
    );

    assert.equal(
      loaded.candidate
        .identity
        .promotionEligible,
      true,
    );
  },
);

test(
  "rejects a candidate symlink",
  async () => {
    const item =
      await fixture();

    const realPath =
      join(
        item.artifactDirectory,
        "real.json",
      );

    await writeFile(
      realPath,
      JSON.stringify(
        candidate(),
      ),
      "utf8",
    );

    await symlink(
      realPath,
      item.candidatePath,
    );

    await assert.rejects(
      () =>
        loadPrepareCandidate(
          item.candidatePath,
        ),
      {
        code:
          "PREPARE_CANDIDATE_FILE_SYMLINK",
      },
    );
  },
);

test(
  "rejects invalid JSON",
  async () => {
    const item =
      await fixture();

    await writeFile(
      item.candidatePath,
      "{not-json",
      "utf8",
    );

    await assert.rejects(
      () =>
        loadPrepareCandidate(
          item.candidatePath,
        ),
      {
        code:
          "PREPARE_CANDIDATE_JSON_INVALID",
      },
    );
  },
);

test(
  "rejects JSON that is not a valid prepare candidate contract",
  async () => {
    const item =
      await fixture();

    await writeFile(
      item.candidatePath,
      JSON.stringify({
        schemaVersion:
          "0.1",

        artifactType:
          "not-a-candidate",
      }),
      "utf8",
    );

    await assert.rejects(
      () =>
        loadPrepareCandidate(
          item.candidatePath,
        ),
      {
        code:
          "PREPARE_CANDIDATE_CONTRACT_INVALID",
      },
    );
  },
);

test(
  "does not mutate the candidate artifact bytes",
  async () => {
    const item =
      await fixture();

    const bytes =
      JSON.stringify(
        candidate(),
        null,
        2,
      ) + "\n";

    await writeFile(
      item.candidatePath,
      bytes,
      "utf8",
    );

    await loadPrepareCandidate(
      item.candidatePath,
    );

    assert.equal(
      await readFile(
        item.candidatePath,
        "utf8",
      ),
      bytes,
    );
  },
);
