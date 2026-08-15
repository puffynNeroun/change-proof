import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalSerialize,
  computeCandidateFailureId,
  computeCandidateSha256,
  computeEnvelopeSha256,
  computeExecutionContractSha256,
  computeFailureSetSha256,
  computeRepositoryContextSha256,
  sha256Hex,
} from "../../src/core/provenance-digests.mjs";

function executionContract() {
  return {
    executable: "/usr/bin/node",
    arguments: [
      "--test",
      "--test-reporter=tap",
      "test/example.test.mjs",
    ],
    workingDirectory: ".",
    environment: {
      LANG: "C",
      LC_ALL: "C",
      PATH: "/usr/bin:/bin",
    },
    timeoutMs: 30_000,
    maxStdoutBytes: 4_194_304,
    maxStderrBytes: 4_194_304,
  };
}

function candidateIdentity() {
  return {
    candidateContractVersion: "0.1",

    repositoryContextSha256:
      computeRepositoryContextSha256({
        repositoryRootRealpath:
          "/home/example/project",
        gitCommonDirRealpath:
          "/home/example/project/.git",
      }),

    repository: {
      baseCommitId:
        "a".repeat(40),
      headCommitId:
        "b".repeat(40),
    },

    executionContractSha256:
      computeExecutionContractSha256(
        executionContract(),
      ),

    envelopeSha256:
      computeEnvelopeSha256({
        includedPaths: [
          "test/example.test.mjs",
        ],
      }),

    observations: {
      stateA: {
        tests: 10,
        pass: 10,
        fail: 0,
      },

      stateB: {
        tests: 11,
        pass: 11,
        fail: 0,
      },

      stateC: {
        tests: 11,
        pass: 10,
        fail: 1,
      },
    },
  };
}

test(
  "canonical serialization recursively orders object keys",
  () => {
    const left = {
      z: 1,
      a: {
        y: 2,
        b: 3,
      },
    };

    const right = {
      a: {
        b: 3,
        y: 2,
      },
      z: 1,
    };

    assert.equal(
      canonicalSerialize(left),
      canonicalSerialize(right),
    );

    assert.equal(
      canonicalSerialize(left),
      '{"a":{"b":3,"y":2},"z":1}',
    );
  },
);

test(
  "canonical serialization preserves array order",
  () => {
    assert.notEqual(
      canonicalSerialize({
        values: ["a", "b"],
      }),
      canonicalSerialize({
        values: ["b", "a"],
      }),
    );
  },
);

test(
  "canonical serialization uses Unicode code-point key order",
  () => {
    const value = {
      "\u{10000}": 1,
      "\uE000": 2,
    };

    assert.equal(
      canonicalSerialize(value),
      '{"":2,"𐀀":1}',
    );
  },
);

test(
  "sha256 primitive hashes UTF-8 text deterministically",
  () => {
    assert.equal(
      sha256Hex("abc"),
      "ba7816bf8f01cfea414140de5dae2223" +
      "b00361a396177a9cb410ff61f20015ad",
    );
  },
);

test(
  "execution digest ignores environment key insertion order",
  () => {
    const left =
      executionContract();

    const right =
      executionContract();

    right.environment = {
      PATH: "/usr/bin:/bin",
      LC_ALL: "C",
      LANG: "C",
    };

    assert.equal(
      computeExecutionContractSha256(left),
      computeExecutionContractSha256(right),
    );
  },
);

test(
  "execution digest is sensitive to argument order",
  () => {
    const left =
      executionContract();

    const right =
      executionContract();

    right.arguments = [
      "--test-reporter=tap",
      "--test",
      "test/example.test.mjs",
    ];

    assert.notEqual(
      computeExecutionContractSha256(left),
      computeExecutionContractSha256(right),
    );
  },
);

test(
  "execution digest accepts an empty argument string",
  () => {
    const contract =
      executionContract();

    contract.arguments = [
      "--test",
      "",
    ];

    assert.doesNotThrow(
      () =>
        computeExecutionContractSha256(
          contract,
        ),
    );
  },
);

test(
  "execution digest accepts an empty environment value",
  () => {
    const contract =
      executionContract();

    contract.environment = {
      ...contract.environment,
      EMPTY: "",
    };

    assert.doesNotThrow(
      () =>
        computeExecutionContractSha256(
          contract,
        ),
    );
  },
);

test(
  "execution digest is sensitive to environment values",
  () => {
    const left =
      executionContract();

    const right =
      executionContract();

    right.environment = {
      ...right.environment,
      LANG: "en_US.UTF-8",
    };

    assert.notEqual(
      computeExecutionContractSha256(left),
      computeExecutionContractSha256(right),
    );
  },
);

test(
  "repository context digest is stable across object key order",
  () => {
    const left = {
      repositoryRootRealpath:
        "/srv/project",
      gitCommonDirRealpath:
        "/srv/project/.git",
    };

    const right = {
      gitCommonDirRealpath:
        "/srv/project/.git",
      repositoryRootRealpath:
        "/srv/project",
    };

    assert.equal(
      computeRepositoryContextSha256(left),
      computeRepositoryContextSha256(right),
    );
  },
);

test(
  "repository context digest is sensitive to repository root",
  () => {
    const left =
      computeRepositoryContextSha256({
        repositoryRootRealpath:
          "/srv/a/project",
        gitCommonDirRealpath:
          "/srv/a/project/.git",
      });

    const right =
      computeRepositoryContextSha256({
        repositoryRootRealpath:
          "/srv/b/project",
        gitCommonDirRealpath:
          "/srv/a/project/.git",
      });

    assert.notEqual(left, right);
  },
);

test(
  "repository context digest is sensitive to git common-dir identity",
  () => {
    const left =
      computeRepositoryContextSha256({
        repositoryRootRealpath:
          "/srv/project",
        gitCommonDirRealpath:
          "/srv/project/.git",
      });

    const right =
      computeRepositoryContextSha256({
        repositoryRootRealpath:
          "/srv/project",
        gitCommonDirRealpath:
          "/srv/git-storage/change-proof.git",
      });

    assert.notEqual(left, right);
  },
);

test(
  "envelope digest treats included paths as a set",
  () => {
    const left =
      computeEnvelopeSha256({
        includedPaths: [
          "test/z.test.mjs",
          "test/a.test.mjs",
        ],
      });

    const right =
      computeEnvelopeSha256({
        includedPaths: [
          "test/a.test.mjs",
          "test/z.test.mjs",
        ],
      });

    assert.equal(left, right);
  },
);

test(
  "envelope digest rejects duplicate paths",
  () => {
    assert.throws(
      () =>
        computeEnvelopeSha256({
          includedPaths: [
            "test/a.test.mjs",
            "test/a.test.mjs",
          ],
        }),
      /duplicate_provenance_string/,
    );
  },
);

test(
  "candidate failure ID is deterministic across fragment ordering",
  () => {
    const left =
      computeCandidateFailureId({
        testName:
          "valid(1): example",
        failureSpecificFragments: [
          "Valid case should not have errors.",
          "ruleId: no-constant-assertion",
        ],
        supplementaryFragments: [
          "operator: 'deepStrictEqual'",
          "code: 'ERR_ASSERTION'",
        ],
      });

    const right =
      computeCandidateFailureId({
        testName:
          "valid(1): example",
        failureSpecificFragments: [
          "ruleId: no-constant-assertion",
          "Valid case should not have errors.",
        ],
        supplementaryFragments: [
          "code: 'ERR_ASSERTION'",
          "operator: 'deepStrictEqual'",
        ],
      });

    assert.equal(left, right);
    assert.match(
      left,
      /^cpf_[0-9a-f]{64}$/,
    );
  },
);

test(
  "candidate failure ID depends on exact output evidence, not fragment role labels",
  () => {
    const left =
      computeCandidateFailureId({
        testName: "leaf",
        failureSpecificFragments: [
          "primary semantic message",
        ],
        supplementaryFragments: [
          "secondary semantic detail",
          "code: 'ERR_ASSERTION'",
        ],
      });

    const right =
      computeCandidateFailureId({
        testName: "leaf",
        failureSpecificFragments: [
          "primary semantic message",
          "secondary semantic detail",
        ],
        supplementaryFragments: [
          "code: 'ERR_ASSERTION'",
        ],
      });

    assert.equal(left, right);
  },
);

test(
  "candidate failure ID changes when failure-specific evidence changes",
  () => {
    const left =
      computeCandidateFailureId({
        testName: "leaf",
        failureSpecificFragments: [
          "first semantic failure",
        ],
        supplementaryFragments: [
          "code: 'ERR_ASSERTION'",
        ],
      });

    const right =
      computeCandidateFailureId({
        testName: "leaf",
        failureSpecificFragments: [
          "different semantic failure",
        ],
        supplementaryFragments: [
          "code: 'ERR_ASSERTION'",
        ],
      });

    assert.notEqual(left, right);
  },
);

test(
  "candidate failure ID requires failure-specific evidence",
  () => {
    assert.throws(
      () =>
        computeCandidateFailureId({
          testName: "leaf",
          failureSpecificFragments: [],
          supplementaryFragments: [
            "code: 'ERR_ASSERTION'",
          ],
        }),
      /invalid_provenance_string_array/,
    );
  },
);

test(
  "generic assertion code cannot be mislabeled as failure-specific evidence",
  () => {
    assert.throws(
      () =>
        computeCandidateFailureId({
          testName: "leaf",
          failureSpecificFragments: [
            "code: 'ERR_ASSERTION'",
          ],
        }),
      /generic_fragment_not_failure_specific/,
    );
  },
);

test(
  "generic operator cannot be the required failure-specific evidence",
  () => {
    assert.throws(
      () =>
        computeCandidateFailureId({
          testName: "leaf",
          failureSpecificFragments: [
            "operator: 'deepStrictEqual'",
          ],
        }),
      /generic_fragment_not_failure_specific/,
    );
  },
);

test(
  "failure-set digest ignores failure and fragment ordering",
  () => {
    const left =
      computeFailureSetSha256([
        {
          testName: "failure-b",
          outputIncludes: [
            "specific-b",
            "code: 'ERR_ASSERTION'",
          ],
        },
        {
          testName: "failure-a",
          outputIncludes: [
            "specific-a",
            "operator: 'strictEqual'",
          ],
        },
      ]);

    const right =
      computeFailureSetSha256([
        {
          testName: "failure-a",
          outputIncludes: [
            "operator: 'strictEqual'",
            "specific-a",
          ],
        },
        {
          testName: "failure-b",
          outputIncludes: [
            "code: 'ERR_ASSERTION'",
            "specific-b",
          ],
        },
      ]);

    assert.equal(left, right);
  },
);

test(
  "failure-set digest changes if exact evidence changes",
  () => {
    const left =
      computeFailureSetSha256([
        {
          testName: "failure-a",
          outputIncludes: [
            "specific-a",
          ],
        },
      ]);

    const right =
      computeFailureSetSha256([
        {
          testName: "failure-a",
          outputIncludes: [
            "different-specific-a",
          ],
        },
      ]);

    assert.notEqual(left, right);
  },
);

test(
  "failure-set digest rejects duplicate test identities",
  () => {
    assert.throws(
      () =>
        computeFailureSetSha256([
          {
            testName: "same",
            outputIncludes: ["a"],
          },
          {
            testName: "same",
            outputIncludes: ["b"],
          },
        ]),
      /duplicate_failure_set_test_name/,
    );
  },
);

test(
  "candidate digest is non-self-referential",
  () => {
    const identity =
      candidateIdentity();

    const digest =
      computeCandidateSha256({
        identity,
        metadata: {
          candidateSha256:
            "f".repeat(64),
        },
      });

    const another =
      computeCandidateSha256({
        identity,
        metadata: {
          candidateSha256:
            "0".repeat(64),
        },
      });

    assert.equal(digest, another);
    assert.match(
      digest,
      /^[0-9a-f]{64}$/,
    );
  },
);

test(
  "candidate metadata timestamps and durations do not affect identity",
  () => {
    const identity =
      candidateIdentity();

    const left =
      computeCandidateSha256({
        identity,
        metadata: {
          createdAt:
            "2026-08-15T00:00:00.000Z",
          durationMs: 123,
          workspacePath:
            "/tmp/change-proof-a",
        },
      });

    const right =
      computeCandidateSha256({
        identity,
        metadata: {
          createdAt:
            "2030-01-01T00:00:00.000Z",
          durationMs: 999_999,
          workspacePath:
            "/tmp/change-proof-b",
        },
      });

    assert.equal(left, right);
  },
);

test(
  "candidate digest changes with repository execution context",
  () => {
    const leftIdentity =
      candidateIdentity();

    const rightIdentity = {
      ...candidateIdentity(),
      repositoryContextSha256:
        computeRepositoryContextSha256({
          repositoryRootRealpath:
            "/different/location/project",
          gitCommonDirRealpath:
            "/different/location/project/.git",
        }),
    };

    assert.notEqual(
      computeCandidateSha256({
        identity: leftIdentity,
      }),
      computeCandidateSha256({
        identity: rightIdentity,
      }),
    );
  },
);

test(
  "candidate identity requires repository context binding",
  () => {
    const identity =
      candidateIdentity();

    delete identity.repositoryContextSha256;

    assert.throws(
      () =>
        computeCandidateSha256({
          identity,
        }),
      /missing_candidate_repository_context/,
    );
  },
);
