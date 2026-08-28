import assert from "node:assert/strict";
import test from "node:test";

import {
  computeEnvelopeSha256,
  computeExecutionContractSha256,
  computeFailureSetSha256,
  computeRepositoryContextSha256,
} from "../../src/core/provenance-digests.mjs";

import {
  verifyExpectationProvenance,
} from "../../src/core/verify-expectation-provenance.mjs";

function runtime() {
  const command = {
    executable: "node",

    arguments: [
      "--test",
      "test/example.test.mjs",
    ],

    workingDirectory: ".",

    environment: {
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
    },

    timeoutMs: 30_000,
    maxStdoutBytes: 4_194_304,
    maxStderrBytes: 4_194_304,
  };

  const envelope = {
    includedPaths: [
      "test/example.test.mjs",
    ],
  };

  const expectedFailures = [
    {
      testName:
        "changed behavior",

      outputIncludes: [
        "semantic mismatch",
      ],
    },
  ];

  const repositoryRootRealpath =
    "/canonical/repository";

  const gitCommonDirRealpath =
    "/canonical/repository/.git";

  const resolvedCommits = {
    base:
      "a".repeat(40),

    head:
      "b".repeat(40),
  };

  const expectationProvenance = {
    source:
      "change-proof.prepare-candidate",

    candidateSha256:
      "11".repeat(32),

    candidateContractVersion:
      "0.1",

    prepareToolVersion:
      "0.1.0-beta.1",

    prepareConfigSha256:
      "22".repeat(32),

    repositoryContextSha256:
      computeRepositoryContextSha256({
        repositoryRootRealpath,
        gitCommonDirRealpath,
      }),

    resolvedCommits: {
      ...resolvedCommits,
    },

    executionContractSha256:
      computeExecutionContractSha256(
        command,
      ),

    envelopeSha256:
      computeEnvelopeSha256({
        includedPaths:
          envelope.includedPaths,
      }),

    failureSetSha256:
      computeFailureSetSha256(
        expectedFailures,
      ),
  };

  return {
    expectationProvenance,
    repositoryRootRealpath,
    gitCommonDirRealpath,
    resolvedCommits,
    command,
    envelope,
    expectedFailures,
  };
}

test(
  "schema 0.1 path requires no provenance preflight",
  () => {
    assert.deepEqual(
      verifyExpectationProvenance({
        expectationProvenance: null,
      }),
      {
        required: false,
        verified: false,
      },
    );
  },
);

test(
  "accepts runtime facts matching promoted provenance",
  () => {
    const result =
      verifyExpectationProvenance(
        runtime(),
      );

    assert.equal(
      result.required,
      true,
    );

    assert.equal(
      result.verified,
      true,
    );

    assert.equal(
      result.candidateSha256,
      "11".repeat(32),
    );
  },
);

for (
  const {
    name,
    field,
    mutate,
  }
  of [
    {
      name:
        "base commit mismatch",

      field:
        "resolvedCommits.base",

      mutate(value) {
        value.resolvedCommits.base =
          "c".repeat(40);
      },
    },

    {
      name:
        "head commit mismatch",

      field:
        "resolvedCommits.head",

      mutate(value) {
        value.resolvedCommits.head =
          "c".repeat(40);
      },
    },

    {
      name:
        "repository context mismatch",

      field:
        "repositoryContextSha256",

      mutate(value) {
        value.repositoryRootRealpath =
          "/different/repository";
      },
    },

    {
      name:
        "execution contract mismatch",

      field:
        "executionContractSha256",

      mutate(value) {
        value.command.arguments.push(
          "--changed",
        );
      },
    },

    {
      name:
        "envelope mismatch",

      field:
        "envelopeSha256",

      mutate(value) {
        value.envelope.includedPaths = [
          "test/different.test.mjs",
        ];
      },
    },

    {
      name:
        "failure set mismatch",

      field:
        "failureSetSha256",

      mutate(value) {
        value.expectedFailures[0]
          .outputIncludes = [
            "different mismatch",
          ];
      },
    },
  ]
) {
  test(name, () => {
    const value = runtime();

    mutate(value);

    assert.throws(
      () =>
        verifyExpectationProvenance(
          value,
        ),
      (error) => {
        assert.equal(
          error?.code,
          "EXPECTATION_PROVENANCE_MISMATCH",
        );

        assert.equal(
          error?.field,
          field,
        );

        return true;
      },
    );
  });
}

test(
  "rejects malformed provenance before verification",
  () => {
    const value = runtime();

    value.expectationProvenance
      .failureSetSha256 =
      "not-a-sha";

    assert.throws(
      () =>
        verifyExpectationProvenance(
          value,
        ),
      {
        code:
          "EXPECTATION_PROVENANCE_INVALID",
      },
    );
  },
);
