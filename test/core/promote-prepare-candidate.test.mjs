import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateBoundary,
} from "../../src/core/evaluate-boundary.mjs";

import {
  buildPrepareCandidate,
} from "../../src/core/prepare-candidate.mjs";

import {
  promotePrepareCandidate,
} from "../../src/core/promote-prepare-candidate.mjs";

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
      timeoutMs: 30_000,
      maxStdoutBytes: 4_194_304,
      maxStderrBytes: 4_194_304,
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
  tests = 2,
  pass = 2,
  fail = 0,
  failedLeaves = [],
} = {}) {
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

function assertion(
  testName,
  fragment,
) {
  return {
    testName,
    failureType: "testCodeFailure",
    code: "ERR_ASSERTION",
    operator: "strictEqual",
    failureSpecificFragments: [
      fragment,
    ],
  };
}

function observed(
  testOutcome,
  value,
) {
  return {
    status: "OBSERVED",
    testOutcome,
    inspection: value,
  };
}

function validBoundary() {
  const selected =
    "test/example.test.mjs";

  const excluded =
    "src/excluded-change.mjs";

  return {
    status: "OBSERVED",

    ...evaluateBoundary({
      baseSha: "base-object",
      stateCBaseSha: "base-object",

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
        [selected]: "base-selected",
        [excluded]: "base-excluded",
      },

      headBlobIds: {
        [selected]: "head-selected",
        [excluded]: "head-excluded",
      },

      stateCBlobIds: {
        [selected]: "head-selected",
        [excluded]: "base-excluded",
      },
    }),
  };
}

function candidate({
  stateA = observed(
    "PASS",
    inspection({
      tests: 3,
      pass: 3,
    }),
  ),

  stateB = observed(
    "PASS",
    inspection({
      tests: 4,
      pass: 4,
    }),
  ),

  stateC = observed(
    "FAIL",
    inspection({
      tests: 4,
      pass: 2,
      fail: 2,

      failedLeaves: [
        assertion(
          "first assertion",
          "first mismatch",
        ),

        assertion(
          "second assertion",
          "second mismatch",
        ),
      ],
    }),
  ),
} = {}) {
  return buildPrepareCandidate({
    prepareConfig:
      prepareConfig(),

    prepareToolVersion:
      "0.2.0-beta.2",

    repositoryContextSha256:
      "ab".repeat(32),

    resolvedCommits: {
      base:
        "resolved-base-object-id",

      head:
        "resolved-head-object-id",
    },

    cleanupVerified: true,

    states: {
      stateA,
      stateB,
      stateC,
    },

    boundary:
      validBoundary(),

    metadata: {
      createdAt:
        "2026-08-29T00:00:00.000Z",
    },
  });
}

test(
  "promotes the complete candidate and complete failure set into schema 0.2",
  () => {
    const sourceConfig =
      prepareConfig();

    const sourceCandidate =
      candidate();

    const promoted =
      promotePrepareCandidate({
        prepareConfig:
          sourceConfig,

        candidate:
          sourceCandidate,

        outputDirectory:
          "/reports",
      });

    assert.equal(
      promoted.schemaVersion,
      "0.2",
    );

    assert.deepEqual(
      promoted.classification,
      {
        stateA: {
          expectedTestCount: 3,
        },

        stateB: {
          expectedTestCount: 4,
        },

        stateC: {
          expectedTestCount: 4,

          expectedFailures:
            sourceCandidate
              .identity
              .candidateFailures
              .map((failure) => ({
                testName:
                  failure.testName,

                outputIncludes: [
                  ...failure
                    .outputIncludes,
                ],
              })),
        },
      },
    );

    assert.equal(
      promoted
        .expectationProvenance
        .candidateSha256,
      sourceCandidate
        .candidateSha256,
    );

    assert.equal(
      promoted
        .expectationProvenance
        .failureSetSha256,
      sourceCandidate
        .identity
        .failureSetSha256,
    );

    assert.deepEqual(
      promoted
        .expectationProvenance
        .resolvedCommits,
      sourceCandidate
        .identity
        .resolvedCommits,
    );
  },
);

test(
  "promotion is deterministic and does not mutate its inputs",
  () => {
    const sourceConfig =
      prepareConfig();

    const sourceCandidate =
      candidate();

    const beforeConfig =
      JSON.stringify(sourceConfig);

    const beforeCandidate =
      JSON.stringify(sourceCandidate);

    const first =
      promotePrepareCandidate({
        prepareConfig:
          sourceConfig,

        candidate:
          sourceCandidate,

        outputDirectory:
          "/reports",
      });

    const second =
      promotePrepareCandidate({
        prepareConfig:
          sourceConfig,

        candidate:
          sourceCandidate,

        outputDirectory:
          "/reports",
      });

    assert.deepEqual(first, second);

    assert.equal(
      JSON.stringify(sourceConfig),
      beforeConfig,
    );

    assert.equal(
      JSON.stringify(sourceCandidate),
      beforeCandidate,
    );
  },
);

test(
  "promotion rejects a different prepare configuration",
  () => {
    const sourceConfig =
      prepareConfig();

    sourceConfig.command.arguments = [
      "--test",
      "test/different.test.mjs",
    ];

    assert.throws(
      () =>
        promotePrepareCandidate({
          prepareConfig:
            sourceConfig,

          candidate:
            candidate(),

          outputDirectory:
            "/reports",
        }),
      {
        code:
          "PREPARE_PROMOTION_CONFIG_DIGEST_MISMATCH",
      },
    );
  },
);

test(
  "promotion rejects a non-promotable candidate",
  () => {
    const sourceCandidate =
      candidate({
        stateC:
          observed(
            "PASS",
            inspection({
              tests: 4,
              pass: 4,
            }),
          ),
      });

    assert.equal(
      sourceCandidate
        .identity
        .promotionEligible,
      false,
    );

    assert.throws(
      () =>
        promotePrepareCandidate({
          prepareConfig:
            prepareConfig(),

          candidate:
            sourceCandidate,

          outputDirectory:
            "/reports",
        }),
      {
        code:
          "PREPARE_PROMOTION_NOT_ELIGIBLE",
      },
    );
  },
);

test(
  "promotion cannot selectively accept only part of the candidate failure set",
  () => {
    const sourceCandidate =
      candidate();

    const promoted =
      promotePrepareCandidate({
        prepareConfig:
          prepareConfig(),

        candidate:
          sourceCandidate,

        outputDirectory:
          "/reports",
      });

    assert.equal(
      sourceCandidate
        .identity
        .candidateFailures
        .length,
      2,
    );

    assert.equal(
      promoted
        .classification
        .stateC
        .expectedFailures
        .length,
      2,
    );

    assert.deepEqual(
      promoted
        .classification
        .stateC
        .expectedFailures
        .map((failure) =>
          failure.testName),
      sourceCandidate
        .identity
        .candidateFailures
        .map((failure) =>
          failure.testName),
    );
  },
);
