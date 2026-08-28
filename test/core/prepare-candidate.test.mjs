import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

import {
  BOUNDARY_REASON_CODES,
  evaluateBoundary,
} from "../../src/core/evaluate-boundary.mjs";

import {
  buildPrepareCandidate,
  normalizePrepareCandidate,
} from "../../src/core/prepare-candidate.mjs";

const REPOSITORY_CONTEXT =
  "ab".repeat(32);

function prepareConfig() {
  return {
    schemaVersion: "0.1",

    repositoryRoot:
      "/repo",

    baseRef:
      "base",

    headRef:
      "head",

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

      maxStdoutBytes:
        4_194_304,

      maxStderrBytes:
        4_194_304,
    },

    envelope: {
      includedPaths: [
        "test/example.test.mjs",
      ],
    },

    temporaryParentDirectory:
      "/tmp",

    workspacePrefix:
      "change-proof-prepare-",
  };
}

function summary({
  tests,
  pass,
  fail,
  cancelled = 0,
  skipped = 0,
  todo = 0,
}) {
  return {
    tests,
    pass,
    fail,
    cancelled,
    skipped,
    todo,
  };
}

function inspection({
  structuralStatus =
    "COMPLETE",

  tests = 2,

  pass = 2,

  fail = 0,

  cancelled = 0,

  skipped = 0,

  todo = 0,

  failedLeaves = [],

  observedTestCount =
    tests,
} = {}) {
  if (
    structuralStatus !==
      "COMPLETE"
  ) {
    return {
      framework: "node:test",

      structuralStatus,

      observedTestCount:
        null,

      summary: {
        tests: null,
        pass: null,
        fail: null,
        cancelled: null,
        skipped: null,
        todo: null,
      },

      failedLeaves: [],
    };
  }

  return {
    framework: "node:test",

    structuralStatus:
      "COMPLETE",

    observedTestCount,

    summary:
      summary({
        tests,
        pass,
        fail,
        cancelled,
        skipped,
        todo,
      }),

    failedLeaves,
  };
}

function assertion(
  testName,
  fragments = [
    "semantic mismatch",
  ],
) {
  return {
    testName,

    failureType:
      "testCodeFailure",

    code:
      "ERR_ASSERTION",

    operator:
      "strictEqual",

    failureSpecificFragments: [
      ...fragments,
    ],
  };
}

function nonAssertion(
  testName,
) {
  return {
    testName,

    failureType:
      "testCodeFailure",

    code:
      "ERR_TEST_FAILURE",

    operator:
      null,

    failureSpecificFragments: [
      "non assertion failure",
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

    inspection:
      value,
  };
}

function notRun() {
  return {
    status: "NOT_RUN",
  };
}

function boundaryNotEvaluated() {
  return {
    status:
      "NOT_EVALUATED",
  };
}

function productionBoundaryInput() {
  const selected =
    "test/example.test.mjs";

  const excluded =
    "src/excluded-change.mjs";

  return {
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
        "base-selected",

      [excluded]:
        "base-excluded",
    },

    headBlobIds: {
      [selected]:
        "head-selected",

      [excluded]:
        "head-excluded",
    },

    stateCBlobIds: {
      [selected]:
        "head-selected",

      [excluded]:
        "base-excluded",
    },
  };
}

function boundary(
  valid = true,
) {
  const input =
    productionBoundaryInput();

  if (!valid) {
    input.stateCBaseSha =
      "wrong-base-object";
  }

  const evidence =
    evaluateBoundary(input);

  assert.equal(
    evidence.boundaryValid,
    valid,
  );

  return {
    status:
      "OBSERVED",

    ...evidence,
  };
}

function multiplyInvalidBoundary() {
  const input =
    productionBoundaryInput();

  input.stateCBaseSha =
    "wrong-base-object";

  input.stateCBlobIds = {
    "test/example.test.mjs":
      "wrong-state-c-blob",
  };

  const evidence =
    evaluateBoundary(input);

  assert.equal(
    evidence.boundaryValid,
    false,
  );

  assert.ok(
    evidence.reasonCodes.length >=
      2,
  );

  return {
    status:
      "OBSERVED",

    ...evidence,
  };
}

function productionBoundaryReasonCases() {
  const selected =
    "test/example.test.mjs";

  const excluded =
    "src/excluded-change.mjs";

  return [
    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .STATE_C_NOT_BASED_ON_BASE,

      mutate(input) {
        input.stateCBaseSha =
          "wrong-base";
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,

      mutate(input) {
        input.headChangedPaths = [
          excluded,
        ];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .MATERIALIZED_PATHS_MISMATCH,

      mutate(input) {
        input.materializedPaths = [];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .RESULTING_CHANGED_PATHS_MISMATCH,

      mutate(input) {
        input.resultingChangedPaths = [];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_HEAD_BLOB,

      mutate(input) {
        delete input
          .headBlobIds[selected];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_MISSING_STATE_C_BLOB,

      mutate(input) {
        delete input
          .stateCBlobIds[selected];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .SELECTED_PATH_NOT_MATCH_HEAD,

      mutate(input) {
        input.stateCBlobIds[selected] =
          "wrong-selected";
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_BASE_BLOB,

      mutate(input) {
        delete input
          .baseBlobIds[excluded];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_MISSING_STATE_C_BLOB,

      mutate(input) {
        delete input
          .stateCBlobIds[excluded];
      },
    },

    {
      reasonCode:
        BOUNDARY_REASON_CODES
          .UNCHANGED_PATH_NOT_MATCH_BASE,

      mutate(input) {
        input.stateCBlobIds[excluded] =
          "wrong-excluded";
      },
    },
  ];
}

function productionBoundaryForReason(
  reasonCase,
) {
  const input =
    productionBoundaryInput();

  reasonCase.mutate(input);

  const evidence =
    evaluateBoundary(input);

  assert.equal(
    evidence.boundaryValid,
    false,
  );

  assert.deepEqual(
    evidence.reasonCodes,
    [
      reasonCase.reasonCode,
    ],
  );

  return {
    status:
      "OBSERVED",

    ...evidence,
  };
}

function productionMultiReasonBoundary() {
  const input =
    productionBoundaryInput();

  input.stateCBaseSha =
    "wrong-base";

  input.headChangedPaths = [
    "src/excluded-change.mjs",
  ];

  input.materializedPaths = [];

  input.resultingChangedPaths = [];

  input.stateCBlobIds[
    "test/example.test.mjs"
  ] =
    "wrong-selected";

  input.stateCBlobIds[
    "src/excluded-change.mjs"
  ] =
    "wrong-excluded";

  const evidence =
    evaluateBoundary(input);

  assert.equal(
    evidence.boundaryValid,
    false,
  );

  assert.ok(
    evidence.reasonCodes.length >
      1,
  );

  return {
    status:
      "OBSERVED",

    ...evidence,
  };
}

function candidateInput({
  stateA =
    observed(
      "PASS",
      inspection(),
    ),

  stateB =
    observed(
      "PASS",
      inspection(),
    ),

  stateC =
    observed(
      "FAIL",
      inspection({
        tests: 2,
        pass: 0,
        fail: 2,
        failedLeaves: [
          assertion(
            "first assertion",
            [
              "first mismatch",
            ],
          ),

          assertion(
            "second assertion",
            [
              "second mismatch",
            ],
          ),
        ],
      }),
    ),

  boundaryValue =
    boundary(true),

  cleanupVerified = true,

  metadata = {
    createdAt:
      "2026-08-16T00:00:00.000Z",
  },
} = {}) {
  return {
    prepareConfig:
      prepareConfig(),

    prepareToolVersion:
      "0.2.0-beta.2",

    repositoryContextSha256:
      REPOSITORY_CONTEXT,

    resolvedCommits: {
      base:
        "upstream-resolved-base-object-id",

      head:
        "upstream-resolved-head-object-id",
    },

    cleanupVerified,

    states: {
      stateA,
      stateB,
      stateC,
    },

    boundary:
      boundaryValue,

    metadata,
  };
}

function build(overrides = {}) {
  return buildPrepareCandidate(
    candidateInput(
      overrides,
    ),
  );
}

test(
  "builds a complete non-authoritative assertion candidate",
  () => {
    const candidate =
      build();

    assert.equal(
      candidate.artifactType,
      "change-proof.prepare-candidate",
    );

    assert.equal(
      candidate.authoritative,
      false,
    );

    assert.equal(
      "verdict" in candidate,
      false,
    );

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "ASSERTION_CANDIDATE_OBSERVED",
    );

    assert.equal(
      candidate.identity
        .promotionEligible,
      true,
    );

    assert.equal(
      candidate.identity
        .candidateFailures
        .length,
      2,
    );

    assert.deepEqual(
      normalizePrepareCandidate(
        candidate,
      ),
      candidate,
    );
  },
);

test(
  "BASE failure produces B/C NOT_RUN and boundary NOT_EVALUATED",
  () => {
    const candidate =
      build({
        stateA:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "base failure",
                ),
              ],
            }),
          ),

        stateB:
          notRun(),

        stateC:
          notRun(),

        boundaryValue:
          boundaryNotEvaluated(),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "BASE_TESTS_DID_NOT_PASS",
    );

    assert.deepEqual(
      candidate.identity
        .states.stateB,
      {
        status:
          "NOT_RUN",
      },
    );

    assert.deepEqual(
      candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );

    assert.deepEqual(
      candidate.identity
        .boundary,
      {
        status:
          "NOT_EVALUATED",
      },
    );

    assert.equal(
      candidate.identity
        .failureSetSha256,
      null,
    );
  },
);

test(
  "HEAD failure produces C NOT_RUN and boundary NOT_EVALUATED",
  () => {
    const candidate =
      build({
        stateB:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "head failure",
                ),
              ],
            }),
          ),

        stateC:
          notRun(),

        boundaryValue:
          boundaryNotEvaluated(),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "HEAD_TESTS_DID_NOT_PASS",
    );

    assert.deepEqual(
      candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );

    assert.deepEqual(
      candidate.identity
        .boundary,
      {
        status:
          "NOT_EVALUATED",
      },
    );
  },
);

test(
  "unclassifiable A follows chronological prefix",
  () => {
    const candidate =
      build({
        stateA:
          observed(
            "UNCLASSIFIABLE",
            inspection({
              structuralStatus:
                "TAP_SUMMARY_INCOMPLETE",
            }),
          ),

        stateB:
          notRun(),

        stateC:
          notRun(),

        boundaryValue:
          boundaryNotEvaluated(),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "TEST_OUTPUT_UNCLASSIFIABLE",
    );
  },
);

test(
  "accepts a COMPLETE UNCLASSIFIABLE observation that does not contradict PASS or FAIL facts",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "UNCLASSIFIABLE",
            inspection({
              tests: 1,
              pass: 0,
              fail: 0,
              skipped: 1,
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "TEST_OUTPUT_UNCLASSIFIABLE",
    );
  },
);

test(
  "rejects COMPLETE UNCLASSIFIABLE that is internally a PASS observation",
  () => {
    assert.throws(
      () =>
        build({
          stateC:
            observed(
              "UNCLASSIFIABLE",
              inspection({
                tests: 1,
                pass: 1,
                fail: 0,
              }),
            ),
        }),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_STATE_INVALID",
    );
  },
);

test(
  "rejects a COMPLETE observation whose observedTestCount disagrees with Task 3 summary.tests",
  () => {
    assert.throws(
      () =>
        build({
          stateC:
            observed(
              "UNCLASSIFIABLE",
              inspection({
                tests: 1,
                pass: 0,
                fail: 0,
                skipped: 1,
                observedTestCount: 2,
              }),
            ),
        }),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_STATE_INVALID",
    );
  },
);

test(
  "non-COMPLETE observation cannot fabricate failed-leaf evidence",
  () => {
    const malformed = {
      framework:
        "node:test",

      structuralStatus:
        "TAP_STRUCTURE_INVALID",

      observedTestCount:
        null,

      summary: {
        tests: null,
        pass: null,
        fail: null,
        cancelled: null,
        skipped: null,
        todo: null,
      },

      failedLeaves: [
        assertion(
          "fabricated leaf",
        ),
      ],
    };

    assert.throws(
      () =>
        build({
          stateC:
            observed(
              "UNCLASSIFIABLE",
              malformed,
            ),
        }),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_STATE_INVALID",
    );
  },
);

test(
  "invalid evaluated boundary prevents C execution",
  () => {
    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          boundary(false),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "SELECTED_BOUNDARY_NOT_VALID",
    );

    assert.equal(
      candidate.identity
        .boundary.status,
      "OBSERVED",
    );

    assert.equal(
      candidate.identity
        .boundary.boundaryValid,
      false,
    );

    assert.deepEqual(
      candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );
  },
);

test(
  "preserves a valid production-shaped boundary without lossy conversion",
  () => {
    const production =
      boundary(true);

    const candidate =
      build({
        boundaryValue:
          production,
      });

    assert.deepEqual(
      candidate.identity
        .boundary,
      production,
    );
  },
);

test(
  "rejects unknown production boundary reason codes",
  () => {
    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          boundary(false),
      });

    candidate.identity
      .boundary.reasonCodes[0] =
      "NOT_A_PRODUCTION_BOUNDARY_REASON";

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects a production boundary missing a required evidence fact",
  () => {
    const candidate =
      build();

    delete candidate.identity
      .boundary
      .selectedPathsMatchHead;

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects boundaryValid true with production reason codes",
  () => {
    const candidate =
      build();

    candidate.identity
      .boundary.reasonCodes = [
        BOUNDARY_REASON_CODES
          .STATE_C_NOT_BASED_ON_BASE,
      ];

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "preserves production boundary reason-code order",
  () => {
    const production =
      multiplyInvalidBoundary();

    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          production,
      });

    assert.deepEqual(
      candidate.identity
        .boundary.reasonCodes,
      production.reasonCodes,
    );
  },
);

test(
  "semantic boundary evidence changes candidate identity",
  () => {
    const first =
      build({
        stateC:
          notRun(),

        boundaryValue:
          boundary(false),
      });

    const second =
      build({
        stateC:
          notRun(),

        boundaryValue:
          multiplyInvalidBoundary(),
      });

    assert.notEqual(
      first.candidateSha256,
      second.candidateSha256,
    );
  },
);

test(
  "accepts every isolated invalid boundary reason emitted by the production evaluator",
  async (t) => {
    for (
      const reasonCase
      of productionBoundaryReasonCases()
    ) {
      await t.test(
        reasonCase.reasonCode,
        () => {
          const candidate =
            build({
              stateC:
                notRun(),

              boundaryValue:
                productionBoundaryForReason(
                  reasonCase,
                ),
            });

          assert.equal(
            candidate.identity
              .prepareOutcome,
            "SELECTED_BOUNDARY_NOT_VALID",
          );

          assert.deepEqual(
            candidate.identity
              .boundary
              .reasonCodes,
            [
              reasonCase.reasonCode,
            ],
          );
        },
      );
    }
  },
);

test(
  "rejects boundaryValid true when a mandatory retained production fact is false",
  () => {
    const candidate =
      build();

    candidate.identity
      .boundary.basedOnBase =
      false;

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects a false production fact when its required reason code is missing",
  () => {
    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          productionBoundaryForReason(
            productionBoundaryReasonCases()[0],
          ),
      });

    candidate.identity
      .boundary.reasonCodes = [
      BOUNDARY_REASON_CODES
        .MATERIALIZED_PATHS_MISMATCH,
    ];

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects a production reason code when its corresponding retained failure fact is absent",
  () => {
    const candidate =
      build();

    candidate.identity
      .boundary.boundaryValid =
      false;

    candidate.identity
      .boundary.reasonCodes = [
      BOUNDARY_REASON_CODES
        .STATE_C_NOT_BASED_ON_BASE,
    ];

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects resultingChangedPaths mismatch without its production reason",
  () => {
    const candidate =
      build();

    candidate.identity
      .boundary
      .resultingChangedPaths = [];

    candidate.identity
      .boundary.boundaryValid =
      false;

    candidate.identity
      .boundary.reasonCodes = [
      BOUNDARY_REASON_CODES
        .MATERIALIZED_PATHS_MISMATCH,
    ];

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects RESULTING_CHANGED_PATHS_MISMATCH when resulting paths still match the explicit envelope",
  () => {
    const candidate =
      build();

    candidate.identity
      .boundary.boundaryValid =
      false;

    candidate.identity
      .boundary.reasonCodes = [
      BOUNDARY_REASON_CODES
        .RESULTING_CHANGED_PATHS_MISMATCH,
    ];

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "rejects production reason codes in an impossible evaluator phase order",
  () => {
    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          productionMultiReasonBoundary(),
      });

    candidate.identity
      .boundary.reasonCodes = [
      ...candidate.identity
        .boundary.reasonCodes,
    ].reverse();

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "accepts the actual multi-reason order emitted by evaluateBoundary",
  () => {
    const production =
      productionMultiReasonBoundary();

    const candidate =
      build({
        stateC:
          notRun(),

        boundaryValue:
          production,
      });

    assert.deepEqual(
      candidate.identity
        .boundary.reasonCodes,
      production.reasonCodes,
    );
  },
);

test(
  "preserves production-normalized resultingChangedPaths order",
  () => {
    const selectedPaths = [
      "test/z.test.mjs",
      "test/a.test.mjs",
    ];

    const evidence =
      evaluateBoundary({
        baseSha:
          "base-object",

        stateCBaseSha:
          "base-object",

        includedPaths:
          selectedPaths,

        headChangedPaths:
          selectedPaths,

        materializedPaths:
          selectedPaths,

        resultingChangedPaths:
          selectedPaths,

        baseBlobIds: {
          "test/z.test.mjs":
            "base-z",

          "test/a.test.mjs":
            "base-a",
        },

        headBlobIds: {
          "test/z.test.mjs":
            "head-z",

          "test/a.test.mjs":
            "head-a",
        },

        stateCBlobIds: {
          "test/z.test.mjs":
            "head-z",

          "test/a.test.mjs":
            "head-a",
        },
      });

    assert.deepEqual(
      evidence.resultingChangedPaths,
      [
        "test/a.test.mjs",
        "test/z.test.mjs",
      ],
    );

    const value =
      candidateInput();

    value.prepareConfig
      .envelope
      .includedPaths = [
        ...selectedPaths,
      ];

    value.boundary = {
      status:
        "OBSERVED",

      ...evidence,
    };

    const candidate =
      buildPrepareCandidate(
        value,
      );

    assert.deepEqual(
      candidate.identity
        .boundary
        .resultingChangedPaths,
      evidence.resultingChangedPaths,
    );
  },
);

test(
  "rejects reordered resultingChangedPaths that production evaluateBoundary would not emit",
  () => {
    const selectedPaths = [
      "test/z.test.mjs",
      "test/a.test.mjs",
    ];

    const evidence =
      evaluateBoundary({
        baseSha:
          "base-object",

        stateCBaseSha:
          "base-object",

        includedPaths:
          selectedPaths,

        headChangedPaths:
          selectedPaths,

        materializedPaths:
          selectedPaths,

        resultingChangedPaths:
          selectedPaths,

        baseBlobIds: {
          "test/z.test.mjs":
            "base-z",

          "test/a.test.mjs":
            "base-a",
        },

        headBlobIds: {
          "test/z.test.mjs":
            "head-z",

          "test/a.test.mjs":
            "head-a",
        },

        stateCBlobIds: {
          "test/z.test.mjs":
            "head-z",

          "test/a.test.mjs":
            "head-a",
        },
      });

    const value =
      candidateInput();

    value.prepareConfig
      .envelope
      .includedPaths = [
        ...selectedPaths,
      ];

    value.boundary = {
      status:
        "OBSERVED",

      ...evidence,
    };

    const candidate =
      buildPrepareCandidate(
        value,
      );

    candidate.identity
      .boundary
      .resultingChangedPaths = [
      ...candidate.identity
        .boundary
        .resultingChangedPaths,
    ].reverse();

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  },
);

test(
  "NOT_EVALUATED remains independent of production boundary consistency validation",
  () => {
    const candidate =
      build({
        stateA:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "base failure",
                ),
              ],
            }),
          ),

        stateB:
          notRun(),

        stateC:
          notRun(),

        boundaryValue:
          boundaryNotEvaluated(),
      });

    assert.deepEqual(
      candidate.identity
        .boundary,
      {
        status:
          "NOT_EVALUATED",
      },
    );
  },
);

test(
  "classifies observed C PASS",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "PASS",
            inspection(),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "STATE_C_PASS_OBSERVED",
    );

    assert.equal(
      candidate.identity
        .promotionEligible,
      false,
    );
  },
);

test(
  "classifies C non-assertion failure",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                nonAssertion(
                  "non assertion",
                ),
              ],
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "STATE_C_NON_ASSERTION_FAILURE_OBSERVED",
    );
  },
);

test(
  "classifies incomplete assertion evidence",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "generic assertion",
                  [],
                ),
              ],
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "ASSERTION_CANDIDATE_INCOMPLETE",
    );

    assert.deepEqual(
      candidate.identity
        .candidateFailures,
      [],
    );

    assert.equal(
      candidate.identity
        .failureSetSha256,
      null,
    );
  },
);

test(
  "generic code/operator without a specific fragment is not promotable",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "generic only",
                  [],
                ),
              ],
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "ASSERTION_CANDIDATE_INCOMPLETE",
    );

    assert.equal(
      candidate.identity
        .promotionEligible,
      false,
    );
  },
);

test(
  "duplicate test names fail closed in Task 4",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 2,
              pass: 0,
              fail: 2,
              failedLeaves: [
                assertion(
                  "duplicate",
                  [
                    "first mismatch",
                  ],
                ),

                assertion(
                  "duplicate",
                  [
                    "second mismatch",
                  ],
                ),
              ],
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "AMBIGUOUS_FAILED_LEAF_IDENTITY",
    );

    assert.deepEqual(
      candidate.identity
        .candidateFailures,
      [],
    );
  },
);

test(
  "duplicate deterministic candidate failure IDs fail closed",
  () => {
    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 2,
              pass: 0,
              fail: 2,
              failedLeaves: [
                assertion(
                  "same identity",
                  [
                    "same mismatch",
                  ],
                ),

                assertion(
                  "same identity",
                  [
                    "same mismatch",
                  ],
                ),
              ],
            }),
          ),
      });

    assert.equal(
      candidate.identity
        .prepareOutcome,
      "AMBIGUOUS_FAILED_LEAF_IDENTITY",
    );

    assert.equal(
      candidate.identity
        .promotionEligible,
      false,
    );
  },
);

test(
  "canonical failure outputIncludes is the exact Task 3 specific-fragment copy",
  () => {
    const fragments = [
      "first semantic line",
      "second semantic line",
    ];

    const candidate =
      build({
        stateC:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion(
                  "exact leaf",
                  fragments,
                ),
              ],
            }),
          ),
      });

    const failure =
      candidate.identity
        .candidateFailures[0];

    assert.deepEqual(
      failure.outputIncludes,
      fragments,
    );

    assert.deepEqual(
      Object.keys(failure)
        .sort(),
      [
        "failureId",
        "outputIncludes",
        "testName",
      ],
    );

    assert.equal(
      failure.outputIncludes
        .includes(
          "ERR_ASSERTION",
        ),
      false,
    );

    assert.equal(
      failure.outputIncludes
        .includes(
          "strictEqual",
        ),
      false,
    );
  },
);

test(
  "cleanup false is rejected and no candidate exists",
  () => {
    assert.throws(
      () =>
        build({
          cleanupVerified:
            false,
        }),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_CLEANUP_NOT_VERIFIED",
    );
  },
);

test(
  "rejects impossible chronological histories",
  async (t) => {
    const cases = [
      [
        "A NOT_RUN while B observed",
        {
          stateA:
            notRun(),
        },
      ],

      [
        "A failed while B observed",
        {
          stateA:
            observed(
              "FAIL",
              inspection({
                tests: 1,
                pass: 0,
                fail: 1,
                failedLeaves: [
                  assertion("A"),
                ],
              }),
            ),

          stateB:
            observed(
              "PASS",
              inspection(),
            ),

          stateC:
            notRun(),

          boundaryValue:
            boundaryNotEvaluated(),
        },
      ],

      [
        "B failed while boundary observed",
        {
          stateB:
            observed(
              "FAIL",
              inspection({
                tests: 1,
                pass: 0,
                fail: 1,
                failedLeaves: [
                  assertion("B"),
                ],
              }),
            ),

          stateC:
            notRun(),

          boundaryValue:
            boundary(true),
        },
      ],

      [
        "invalid boundary while C observed",
        {
          boundaryValue:
            boundary(false),
        },
      ],

      [
        "C observed while boundary NOT_EVALUATED",
        {
          boundaryValue:
            boundaryNotEvaluated(),
        },
      ],
    ];

    for (
      const [name, overrides]
      of cases
    ) {
      await t.test(
        name,
        () => {
          assert.throws(
            () =>
              build(overrides),
            (error) =>
              error?.code ===
                "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
          );
        },
      );
    }
  },
);

test(
  "metadata changes do not change candidate SHA",
  () => {
    const first =
      build({
        metadata: {
          createdAt:
            "2026-08-16T00:00:00.000Z",
        },
      });

    const second =
      build({
        metadata: {
          createdAt:
            "2030-01-01T00:00:00.000Z",
        },
      });

    assert.equal(
      first.candidateSha256,
      second.candidateSha256,
    );

    assert.notDeepEqual(
      first.metadata,
      second.metadata,
    );
  },
);

test(
  "semantic identity change changes candidate SHA",
  () => {
    const first =
      build();

    const value =
      candidateInput();

    value.prepareToolVersion =
      "0.2.0-beta.3";

    const second =
      buildPrepareCandidate(
        value,
      );

    assert.notEqual(
      first.candidateSha256,
      second.candidateSha256,
    );
  },
);

test(
  "candidate SHA tampering is rejected",
  () => {
    const candidate =
      build();

    candidate.candidateSha256 =
      "00".repeat(32);

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_SHA_MISMATCH",
    );
  },
);

test(
  "failure-set digest tampering is rejected before candidate SHA",
  () => {
    const candidate =
      build();

    candidate.identity
      .failureSetSha256 =
      "00".repeat(32);

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_FAILURE_SET_DIGEST_MISMATCH",
    );
  },
);

test(
  "candidate failure ID tampering is rejected",
  () => {
    const candidate =
      build();

    candidate.identity
      .candidateFailures[0]
      .failureId =
      `cpf_${"0".repeat(64)}`;

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_FAILURE_ID_MISMATCH",
    );
  },
);

test(
  "envelope digest tampering is rejected",
  () => {
    const candidate =
      build();

    candidate.identity
      .envelopeSha256 =
      "00".repeat(32);

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_ENVELOPE_DIGEST_MISMATCH",
    );
  },
);

test(
  "production verdict field is impossible in strict candidate shape",
  () => {
    const candidate =
      build();

    candidate.verdict =
      "OBSERVED_TEST_DISCRIMINATION";

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_INVALID",
    );
  },
);

test(
  "wrong artifact type and authoritative true are rejected",
  async (t) => {
    await t.test(
      "artifact type",
      () => {
        const candidate =
          build();

        candidate.artifactType =
          "change-proof.report";

        assert.throws(
          () =>
            normalizePrepareCandidate(
              candidate,
            ),
        );
      },
    );

    await t.test(
      "authoritative",
      () => {
        const candidate =
          build();

        candidate.authoritative =
          true;

        assert.throws(
          () =>
            normalizePrepareCandidate(
              candidate,
            ),
        );
      },
    );
  },
);

test(
  "NOT_RUN cannot carry fabricated state evidence",
  () => {
    const candidate =
      build({
        stateA:
          observed(
            "FAIL",
            inspection({
              tests: 1,
              pass: 0,
              fail: 1,
              failedLeaves: [
                assertion("A"),
              ],
            }),
          ),

        stateB:
          notRun(),

        stateC:
          notRun(),

        boundaryValue:
          boundaryNotEvaluated(),
      });

    candidate.identity
      .states.stateB = {
        status:
          "NOT_RUN",

        testOutcome:
          "PASS",

        inspection:
          inspection(),
      };

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_STATE_INVALID",
    );
  },
);

test(
  "outcome and promotion eligibility inconsistency are rejected",
  () => {
    const candidate =
      build();

    candidate.identity
      .promotionEligible =
      false;

    assert.throws(
      () =>
        normalizePrepareCandidate(
          candidate,
        ),
      (error) =>
        error?.code ===
          "PREPARE_CANDIDATE_ELIGIBILITY_MISMATCH",
    );
  },
);

test(
  "resolved object IDs do not invent a SHA-1-only syntax",
  () => {
    const value =
      candidateInput();

    value.resolvedCommits = {
      base:
        "upstream-object-id-format-A",

      head:
        "upstream-object-id-format-B",
    };

    const candidate =
      buildPrepareCandidate(
        value,
      );

    assert.equal(
      candidate.identity
        .resolvedCommits.base,
      "upstream-object-id-format-A",
    );
  },
);

test(
  "candidate builder remains pure and performs no orchestration",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/core/prepare-candidate.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    for (const forbidden of [
      'from "node:fs',
      'from "node:child_process',
      'from "node:process',
      "process.env",
      "Date.now",
      "new Date",
      "Math.random",
      "parseNodeTestResults",
      "inspectNodeTestEvidence(",
      "git ",
      "verdict:",
    ]) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
        forbidden,
      );
    }
  },
);
