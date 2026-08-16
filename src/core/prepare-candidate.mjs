import {
  canonicalSerialize,
  computeCandidateFailureId,
  computeCandidateSha256,
  computeEnvelopeSha256,
  computeExecutionContractSha256,
  computeFailureSetSha256,
  sha256Hex,
} from "./provenance-digests.mjs";

import {
  BOUNDARY_REASON_CODES,
} from "./evaluate-boundary.mjs";

export const PREPARE_OUTCOMES =
  Object.freeze([
    "BASE_TESTS_DID_NOT_PASS",
    "HEAD_TESTS_DID_NOT_PASS",
    "STATE_C_PASS_OBSERVED",
    "STATE_C_NON_ASSERTION_FAILURE_OBSERVED",
    "TEST_OUTPUT_UNCLASSIFIABLE",
    "ASSERTION_CANDIDATE_INCOMPLETE",
    "AMBIGUOUS_FAILED_LEAF_IDENTITY",
    "SELECTED_BOUNDARY_NOT_VALID",
    "ASSERTION_CANDIDATE_OBSERVED",
  ]);

const PREPARE_OUTCOME_SET =
  new Set(
    PREPARE_OUTCOMES,
  );

const TEST_OUTCOMES =
  new Set([
    "PASS",
    "FAIL",
    "UNCLASSIFIABLE",
  ]);

const STRUCTURAL_STATUSES =
  new Set([
    "EXECUTION_TIMEOUT",
    "PROCESS_ERROR",
    "PROCESS_SIGNAL",
    "OUTPUT_TRUNCATED",
    "LOAD_FAILURE",
    "TAP_VERSION_MISSING",
    "TAP_SUMMARY_INCOMPLETE",
    "TAP_STRUCTURE_INVALID",
    "COMPLETE",
  ]);

const SHA256_PATTERN =
  /^[0-9a-f]{64}$/u;

const CANDIDATE_FAILURE_ID_PATTERN =
  /^cpf_[0-9a-f]{64}$/u;

const BOUNDARY_EVIDENCE_KEYS =
  Object.freeze(
    [
    "basedOnBase",
    "selectedPathsMatchHead",
    "unchangedPathsMatchBase",
    "resultingChangedPaths",
    "boundaryValid",
    "reasonCodes"
]
  );

const BOUNDARY_BOOLEAN_KEYS =
  Object.freeze(
    [
    "basedOnBase",
    "selectedPathsMatchHead",
    "unchangedPathsMatchBase",
    "boundaryValid"
]
  );

const BOUNDARY_STRING_ARRAY_KEYS =
  Object.freeze(
    [
    "resultingChangedPaths",
    "reasonCodes"
]
  );

const BOUNDARY_REASON_CODE_SET =
  new Set(
    Object.values(
      BOUNDARY_REASON_CODES,
    ),
  );

const SELECTED_PATH_BOUNDARY_REASON_CODE_SET =
  new Set([
    BOUNDARY_REASON_CODES
      .SELECTED_PATH_MISSING_HEAD_BLOB,

    BOUNDARY_REASON_CODES
      .SELECTED_PATH_MISSING_STATE_C_BLOB,

    BOUNDARY_REASON_CODES
      .SELECTED_PATH_NOT_MATCH_HEAD,
  ]);

const UNCHANGED_PATH_BOUNDARY_REASON_CODE_SET =
  new Set([
    BOUNDARY_REASON_CODES
      .UNCHANGED_PATH_MISSING_BASE_BLOB,

    BOUNDARY_REASON_CODES
      .UNCHANGED_PATH_MISSING_STATE_C_BLOB,

    BOUNDARY_REASON_CODES
      .UNCHANGED_PATH_NOT_MATCH_BASE,
  ]);

const BOUNDARY_REASON_PHASE =
  new Map([
    [
      BOUNDARY_REASON_CODES
        .STATE_C_NOT_BASED_ON_BASE,
      0,
    ],

    [
      BOUNDARY_REASON_CODES
        .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,
      1,
    ],

    [
      BOUNDARY_REASON_CODES
        .MATERIALIZED_PATHS_MISMATCH,
      2,
    ],

    [
      BOUNDARY_REASON_CODES
        .RESULTING_CHANGED_PATHS_MISMATCH,
      3,
    ],

    [
      BOUNDARY_REASON_CODES
        .SELECTED_PATH_MISSING_HEAD_BLOB,
      4,
    ],

    [
      BOUNDARY_REASON_CODES
        .SELECTED_PATH_MISSING_STATE_C_BLOB,
      4,
    ],

    [
      BOUNDARY_REASON_CODES
        .SELECTED_PATH_NOT_MATCH_HEAD,
      4,
    ],

    [
      BOUNDARY_REASON_CODES
        .UNCHANGED_PATH_MISSING_BASE_BLOB,
      5,
    ],

    [
      BOUNDARY_REASON_CODES
        .UNCHANGED_PATH_MISSING_STATE_C_BLOB,
      5,
    ],

    [
      BOUNDARY_REASON_CODES
        .UNCHANGED_PATH_NOT_MATCH_BASE,
      5,
    ],
  ]);

function fail(code) {
  const error =
    new TypeError(code);

  error.code = code;

  throw error;
}

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  );
}

function exactObject(
  value,
  requiredKeys,
  {
    optionalKeys = [],
    code =
      "PREPARE_CANDIDATE_INVALID",
  } = {},
) {
  if (!isPlainObject(value)) {
    fail(code);
  }

  const allowed =
    new Set([
      ...requiredKeys,
      ...optionalKeys,
    ]);

  for (
    const key
    of requiredKeys
  ) {
    if (
      !Object.hasOwn(
        value,
        key,
      )
    ) {
      fail(code);
    }
  }

  for (
    const key
    of Object.keys(value)
  ) {
    if (!allowed.has(key)) {
      fail(code);
    }
  }

  return value;
}

function requireString(
  value,
  {
    allowEmpty = false,
    code =
      "PREPARE_CANDIDATE_INVALID",
  } = {},
) {
  if (
    typeof value !== "string" ||
    (
      !allowEmpty &&
      value.length === 0
    ) ||
    value.includes("\0")
  ) {
    fail(code);
  }

  return value;
}

function nullableString(
  value,
  code,
) {
  if (value === null) {
    return null;
  }

  return requireString(
    value,
    {
      code,
    },
  );
}

function requireSha256(value) {
  if (
    typeof value !== "string" ||
    !SHA256_PATTERN.test(value)
  ) {
    fail(
      "PREPARE_CANDIDATE_DIGEST_INVALID",
    );
  }

  return value;
}

function requireFailureId(value) {
  if (
    typeof value !== "string" ||
    !CANDIDATE_FAILURE_ID_PATTERN
      .test(value)
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_ID_INVALID",
    );
  }

  return value;
}

function compareUnicodeCodePoints(
  left,
  right,
) {
  const leftPoints =
    Array.from(left);

  const rightPoints =
    Array.from(right);

  const length =
    Math.min(
      leftPoints.length,
      rightPoints.length,
    );

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const difference =
      leftPoints[index]
        .codePointAt(0) -
      rightPoints[index]
        .codePointAt(0);

    if (difference !== 0) {
      return difference;
    }
  }

  return (
    leftPoints.length -
    rightPoints.length
  );
}

function normalizeStringArray(
  value,
  {
    nonEmpty = false,
    unique = true,
    sort = false,
    code =
      "PREPARE_CANDIDATE_INVALID",
  } = {},
) {
  if (
    !Array.isArray(value) ||
    (
      nonEmpty &&
      value.length === 0
    )
  ) {
    fail(code);
  }

  const normalized =
    value.map(
      (item) =>
        requireString(
          item,
          {
            code,
          },
        ),
    );

  if (
    unique &&
    new Set(normalized).size !==
      normalized.length
  ) {
    fail(code);
  }

  if (sort) {
    normalized.sort(
      compareUnicodeCodePoints,
    );
  }

  return normalized;
}

function normalizeEnvironment(value) {
  if (!isPlainObject(value)) {
    fail(
      "PREPARE_CANDIDATE_CONFIG_INVALID",
    );
  }

  const normalized = {};

  for (
    const [key, item]
    of Object.entries(value)
  ) {
    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0")
    ) {
      fail(
        "PREPARE_CANDIDATE_CONFIG_INVALID",
      );
    }

    normalized[key] =
      requireString(
        item,
        {
          allowEmpty: true,
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      );
  }

  return normalized;
}

function normalizePrepareConfig(input) {
  const config =
    exactObject(
      input,
      [
        "schemaVersion",
        "repositoryRoot",
        "baseRef",
        "headRef",
        "command",
        "envelope",
        "temporaryParentDirectory",
        "workspacePrefix",
      ],
      {
        code:
          "PREPARE_CANDIDATE_CONFIG_INVALID",
      },
    );

  if (
    config.schemaVersion !==
      "0.1"
  ) {
    fail(
      "PREPARE_CANDIDATE_CONFIG_INVALID",
    );
  }

  const command =
    exactObject(
      config.command,
      [
        "executable",
        "arguments",
        "workingDirectory",
        "environment",
        "timeoutMs",
        "maxStdoutBytes",
        "maxStderrBytes",
      ],
      {
        code:
          "PREPARE_CANDIDATE_CONFIG_INVALID",
      },
    );

  const envelope =
    exactObject(
      config.envelope,
      [
        "includedPaths",
      ],
      {
        code:
          "PREPARE_CANDIDATE_CONFIG_INVALID",
      },
    );

  if (
    !Array.isArray(
      command.arguments,
    )
  ) {
    fail(
      "PREPARE_CANDIDATE_CONFIG_INVALID",
    );
  }

  const argumentsValue =
    command.arguments.map(
      (argument) =>
        requireString(
          argument,
          {
            allowEmpty: true,
            code:
              "PREPARE_CANDIDATE_CONFIG_INVALID",
          },
        ),
    );

  for (const field of [
    command.timeoutMs,
    command.maxStdoutBytes,
    command.maxStderrBytes,
  ]) {
    if (
      !Number.isSafeInteger(field) ||
      field <= 0
    ) {
      fail(
        "PREPARE_CANDIDATE_CONFIG_INVALID",
      );
    }
  }

  return {
    schemaVersion: "0.1",

    repositoryRoot:
      requireString(
        config.repositoryRoot,
        {
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      ),

    baseRef:
      requireString(
        config.baseRef,
        {
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      ),

    headRef:
      requireString(
        config.headRef,
        {
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      ),

    command: {
      executable:
        requireString(
          command.executable,
          {
            code:
              "PREPARE_CANDIDATE_CONFIG_INVALID",
          },
        ),

      arguments:
        argumentsValue,

      workingDirectory:
        requireString(
          command.workingDirectory,
          {
            code:
              "PREPARE_CANDIDATE_CONFIG_INVALID",
          },
        ),

      environment:
        normalizeEnvironment(
          command.environment,
        ),

      timeoutMs:
        command.timeoutMs,

      maxStdoutBytes:
        command.maxStdoutBytes,

      maxStderrBytes:
        command.maxStderrBytes,
    },

    envelope: {
      includedPaths:
        normalizeStringArray(
          envelope.includedPaths,
          {
            nonEmpty: true,
            code:
              "PREPARE_CANDIDATE_CONFIG_INVALID",
          },
        ),
    },

    temporaryParentDirectory:
      requireString(
        config
          .temporaryParentDirectory,
        {
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      ),

    workspacePrefix:
      requireString(
        config.workspacePrefix,
        {
          code:
            "PREPARE_CANDIDATE_CONFIG_INVALID",
        },
      ),
  };
}

function normalizeCount(value) {
  if (value === null) {
    return null;
  }

  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  return value;
}

function normalizeSummary(input) {
  const summary =
    exactObject(
      input,
      [
        "tests",
        "pass",
        "fail",
        "cancelled",
        "skipped",
        "todo",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

  return {
    tests:
      normalizeCount(
        summary.tests,
      ),

    pass:
      normalizeCount(
        summary.pass,
      ),

    fail:
      normalizeCount(
        summary.fail,
      ),

    cancelled:
      normalizeCount(
        summary.cancelled,
      ),

    skipped:
      normalizeCount(
        summary.skipped,
      ),

    todo:
      normalizeCount(
        summary.todo,
      ),
  };
}

function normalizeFailedLeaf(input) {
  const leaf =
    exactObject(
      input,
      [
        "testName",
        "failureType",
        "code",
        "operator",
        "failureSpecificFragments",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

  return {
    testName:
      requireString(
        leaf.testName,
        {
          code:
            "PREPARE_CANDIDATE_STATE_INVALID",
        },
      ),

    failureType:
      nullableString(
        leaf.failureType,
        "PREPARE_CANDIDATE_STATE_INVALID",
      ),

    code:
      nullableString(
        leaf.code,
        "PREPARE_CANDIDATE_STATE_INVALID",
      ),

    operator:
      nullableString(
        leaf.operator,
        "PREPARE_CANDIDATE_STATE_INVALID",
      ),

    failureSpecificFragments:
      normalizeStringArray(
        leaf
          .failureSpecificFragments,
        {
          code:
            "PREPARE_CANDIDATE_STATE_INVALID",
        },
      ),
  };
}

function normalizeInspection(input) {
  const inspection =
    exactObject(
      input,
      [
        "framework",
        "structuralStatus",
        "observedTestCount",
        "summary",
        "failedLeaves",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

  if (
    inspection.framework !==
      "node:test" ||
    !STRUCTURAL_STATUSES.has(
      inspection.structuralStatus,
    ) ||
    !Array.isArray(
      inspection.failedLeaves,
    )
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  const summary =
    normalizeSummary(
      inspection.summary,
    );

  const observedTestCount =
    normalizeCount(
      inspection
        .observedTestCount,
    );

  const failedLeaves =
    inspection
      .failedLeaves
      .map(
        normalizeFailedLeaf,
      );

  if (
    inspection.structuralStatus !==
      "COMPLETE"
  ) {
    if (
      failedLeaves.length !== 0
    ) {
      fail(
        "PREPARE_CANDIDATE_STATE_INVALID",
      );
    }

    return {
      framework:
        "node:test",

      structuralStatus:
        inspection
          .structuralStatus,

      observedTestCount,

      summary,

      failedLeaves: [],
    };
  }

  for (const value of [
    summary.tests,
    summary.pass,
    summary.fail,
    summary.cancelled,
    summary.skipped,
    summary.todo,
  ]) {
    if (
      !Number.isSafeInteger(value)
    ) {
      fail(
        "PREPARE_CANDIDATE_STATE_INVALID",
      );
    }
  }

  if (
    observedTestCount !==
      summary.tests
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  return {
    framework:
      "node:test",

    structuralStatus:
      "COMPLETE",

    observedTestCount,

    summary,

    failedLeaves,
  };
}

function completePassFacts(
  inspection,
) {
  const summary =
    inspection.summary;

  return (
    summary.tests > 0 &&
    summary.pass ===
      summary.tests &&
    summary.fail === 0 &&
    summary.cancelled === 0 &&
    summary.skipped === 0 &&
    summary.todo === 0 &&
    inspection
      .failedLeaves
      .length === 0
  );
}

function completeFailFacts(
  inspection,
) {
  const summary =
    inspection.summary;

  return (
    summary.tests > 0 &&
    summary.fail > 0 &&
    summary.pass +
      summary.fail ===
      summary.tests &&
    summary.cancelled === 0 &&
    summary.skipped === 0 &&
    summary.todo === 0 &&
    inspection
      .failedLeaves
      .length ===
      summary.fail
  );
}

function assertObservedOutcomeConsistency(
  testOutcome,
  inspection,
) {
  if (
    inspection
      .structuralStatus !==
      "COMPLETE"
  ) {
    if (
      testOutcome !==
        "UNCLASSIFIABLE"
    ) {
      fail(
        "PREPARE_CANDIDATE_STATE_INVALID",
      );
    }

    return;
  }

  const passFacts =
    completePassFacts(
      inspection,
    );

  const failFacts =
    completeFailFacts(
      inspection,
    );

  if (
    testOutcome ===
      "PASS"
  ) {
    if (!passFacts) {
      fail(
        "PREPARE_CANDIDATE_STATE_INVALID",
      );
    }

    return;
  }

  if (
    testOutcome ===
      "FAIL"
  ) {
    if (!failFacts) {
      fail(
        "PREPARE_CANDIDATE_STATE_INVALID",
      );
    }

    return;
  }

  if (
    testOutcome !==
      "UNCLASSIFIABLE" ||
    passFacts ||
    failFacts
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }
}

function normalizeState(input) {
  if (!isPlainObject(input)) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  if (
    input.status ===
      "NOT_RUN"
  ) {
    exactObject(
      input,
      [
        "status",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

    return {
      status:
        "NOT_RUN",
    };
  }

  if (
    input.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  const state =
    exactObject(
      input,
      [
        "status",
        "testOutcome",
        "inspection",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

  if (
    !TEST_OUTCOMES.has(
      state.testOutcome,
    )
  ) {
    fail(
      "PREPARE_CANDIDATE_STATE_INVALID",
    );
  }

  const inspection =
    normalizeInspection(
      state.inspection,
    );

  assertObservedOutcomeConsistency(
    state.testOutcome,
    inspection,
  );

  return {
    status:
      "OBSERVED",

    testOutcome:
      state.testOutcome,

    inspection,
  };
}

function normalizeStates(input) {
  const states =
    exactObject(
      input,
      [
        "stateA",
        "stateB",
        "stateC",
      ],
      {
        code:
          "PREPARE_CANDIDATE_STATE_INVALID",
      },
    );

  return {
    stateA:
      normalizeState(
        states.stateA,
      ),

    stateB:
      normalizeState(
        states.stateB,
      ),

    stateC:
      normalizeState(
        states.stateC,
      ),
  };
}

function sameStringSet(
  left,
  right,
) {
  if (
    left.length !==
      right.length
  ) {
    return false;
  }

  const rightSet =
    new Set(right);

  return left.every(
    (value) =>
      rightSet.has(value),
  );
}

function isProductionOrderedPathArray(
  value,
) {
  const expected =
    [...value].sort();

  return value.every(
    (item, index) =>
      item === expected[index],
  );
}

function boundaryHasReason(
  boundary,
  reasonCode,
) {
  return boundary
    .reasonCodes
    .includes(reasonCode);
}

function boundaryHasAnyReason(
  boundary,
  reasonCodeSet,
) {
  return boundary
    .reasonCodes
    .some(
      (reasonCode) =>
        reasonCodeSet.has(
          reasonCode,
        ),
    );
}

function assertBoundaryReasonOrder(
  boundary,
) {
  let previousPhase = -1;

  for (
    const reasonCode
    of boundary.reasonCodes
  ) {
    const phase =
      BOUNDARY_REASON_PHASE
        .get(reasonCode);

    if (
      phase === undefined ||
      phase < previousPhase
    ) {
      fail(
        "PREPARE_CANDIDATE_BOUNDARY_INVALID",
      );
    }

    previousPhase = phase;
  }
}

/**
 * Validates only relationships among facts already emitted by the
 * production boundary evaluator.
 *
 * This is not a second boundary evaluator: it does not inspect Git,
 * blobs, materialization state, headChangedPaths, or workspaces.
 */
function assertObservedBoundaryConsistency(
  boundary,
  includedPaths,
) {
  if (
    !isProductionOrderedPathArray(
      boundary.resultingChangedPaths,
    )
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const stateCNotBasedOnBase =
    boundaryHasReason(
      boundary,
      BOUNDARY_REASON_CODES
        .STATE_C_NOT_BASED_ON_BASE,
    );

  if (
    boundary.basedOnBase ===
      stateCNotBasedOnBase
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const resultingChangedPathsMatchEnvelope =
    sameStringSet(
      boundary
        .resultingChangedPaths,
      includedPaths,
    );

  const resultingChangedPathsMismatchReason =
    boundaryHasReason(
      boundary,
      BOUNDARY_REASON_CODES
        .RESULTING_CHANGED_PATHS_MISMATCH,
    );

  if (
    resultingChangedPathsMatchEnvelope ===
      resultingChangedPathsMismatchReason
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const selectedPathFailureObserved =
    boundaryHasAnyReason(
      boundary,
      SELECTED_PATH_BOUNDARY_REASON_CODE_SET,
    );

  if (
    boundary.selectedPathsMatchHead ===
      selectedPathFailureObserved
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const unchangedPathFailureObserved =
    boundaryHasAnyReason(
      boundary,
      UNCHANGED_PATH_BOUNDARY_REASON_CODE_SET,
    );

  if (
    boundary.unchangedPathsMatchBase ===
      unchangedPathFailureObserved
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const includedPathsChangedInHead =
    !boundaryHasReason(
      boundary,
      BOUNDARY_REASON_CODES
        .INCLUDED_PATH_NOT_CHANGED_IN_HEAD,
    );

  const materializedPathsMatchEnvelope =
    !boundaryHasReason(
      boundary,
      BOUNDARY_REASON_CODES
        .MATERIALIZED_PATHS_MISMATCH,
    );

  const expectedBoundaryValid =
    boundary.basedOnBase &&
    includedPathsChangedInHead &&
    materializedPathsMatchEnvelope &&
    resultingChangedPathsMatchEnvelope &&
    boundary.selectedPathsMatchHead &&
    boundary.unchangedPathsMatchBase;

  if (
    boundary.boundaryValid !==
      expectedBoundaryValid
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  assertBoundaryReasonOrder(
    boundary,
  );
}

function normalizeBoundary(
  input,
  includedPaths,
) {
  if (!isPlainObject(input)) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  if (
    input.status ===
      "NOT_EVALUATED"
  ) {
    exactObject(
      input,
      [
        "status",
      ],
      {
        code:
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
      },
    );

    return {
      status:
        "NOT_EVALUATED",
    };
  }

  if (
    input.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  const boundary =
    exactObject(
      input,
      [
        "status",
        ...BOUNDARY_EVIDENCE_KEYS,
      ],
      {
        code:
          "PREPARE_CANDIDATE_BOUNDARY_INVALID",
      },
    );

  const normalized = {
    status:
      "OBSERVED",
  };

  for (
    const key
    of BOUNDARY_BOOLEAN_KEYS
  ) {
    if (
      typeof boundary[key] !==
        "boolean"
    ) {
      fail(
        "PREPARE_CANDIDATE_BOUNDARY_INVALID",
      );
    }

    normalized[key] =
      boundary[key];
  }

  for (
    const key
    of BOUNDARY_STRING_ARRAY_KEYS
  ) {
    const values =
      normalizeStringArray(
        boundary[key],
        {
          code:
            "PREPARE_CANDIDATE_BOUNDARY_INVALID",
        },
      );

    if (
      key ===
        "reasonCodes" &&
      values.some(
        (reasonCode) =>
          !BOUNDARY_REASON_CODE_SET
            .has(reasonCode),
      )
    ) {
      fail(
        "PREPARE_CANDIDATE_BOUNDARY_INVALID",
      );
    }

    normalized[key] =
      values;
  }

  if (
    normalized.boundaryValid ===
      true &&
    normalized.reasonCodes.length !==
      0
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  if (
    normalized.boundaryValid ===
      false &&
    normalized.reasonCodes.length ===
      0
  ) {
    fail(
      "PREPARE_CANDIDATE_BOUNDARY_INVALID",
    );
  }

  assertObservedBoundaryConsistency(
    normalized,
    includedPaths,
  );

  return normalized;
}

function buildCanonicalFailure(leaf) {
  const outputIncludes = [
    ...leaf
      .failureSpecificFragments,
  ];

  const failureId =
    computeCandidateFailureId({
      testName:
        leaf.testName,

      failureSpecificFragments: [
        ...outputIncludes,
      ],
    });

  return {
    failureId,

    testName:
      leaf.testName,

    outputIncludes,
  };
}

function deriveDomain(
  states,
  boundary,
) {
  const stateA =
    states.stateA;

  if (
    stateA.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
    );
  }

  if (
    stateA.testOutcome ===
      "UNCLASSIFIABLE"
  ) {
    if (
      states.stateB.status !==
        "NOT_RUN" ||
      states.stateC.status !==
        "NOT_RUN" ||
      boundary.status !==
        "NOT_EVALUATED"
    ) {
      fail(
        "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
      );
    }

    return {
      outcome:
        "TEST_OUTPUT_UNCLASSIFIABLE",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    stateA.testOutcome ===
      "FAIL"
  ) {
    if (
      states.stateB.status !==
        "NOT_RUN" ||
      states.stateC.status !==
        "NOT_RUN" ||
      boundary.status !==
        "NOT_EVALUATED"
    ) {
      fail(
        "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
      );
    }

    return {
      outcome:
        "BASE_TESTS_DID_NOT_PASS",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    states.stateB.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
    );
  }

  const stateB =
    states.stateB;

  if (
    stateB.testOutcome ===
      "UNCLASSIFIABLE"
  ) {
    if (
      states.stateC.status !==
        "NOT_RUN" ||
      boundary.status !==
        "NOT_EVALUATED"
    ) {
      fail(
        "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
      );
    }

    return {
      outcome:
        "TEST_OUTPUT_UNCLASSIFIABLE",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    stateB.testOutcome ===
      "FAIL"
  ) {
    if (
      states.stateC.status !==
        "NOT_RUN" ||
      boundary.status !==
        "NOT_EVALUATED"
    ) {
      fail(
        "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
      );
    }

    return {
      outcome:
        "HEAD_TESTS_DID_NOT_PASS",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    boundary.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
    );
  }

  if (!boundary.boundaryValid) {
    if (
      states.stateC.status !==
        "NOT_RUN"
    ) {
      fail(
        "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
      );
    }

    return {
      outcome:
        "SELECTED_BOUNDARY_NOT_VALID",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    states.stateC.status !==
      "OBSERVED"
  ) {
    fail(
      "PREPARE_CANDIDATE_IMPOSSIBLE_HISTORY",
    );
  }

  const stateC =
    states.stateC;

  if (
    stateC.testOutcome ===
      "UNCLASSIFIABLE"
  ) {
    return {
      outcome:
        "TEST_OUTPUT_UNCLASSIFIABLE",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    stateC.testOutcome ===
      "PASS"
  ) {
    return {
      outcome:
        "STATE_C_PASS_OBSERVED",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  const leaves =
    stateC
      .inspection
      .failedLeaves;

  if (
    leaves.some(
      (leaf) =>
        leaf.failureType !==
          "testCodeFailure" ||
        leaf.code !==
          "ERR_ASSERTION",
    )
  ) {
    return {
      outcome:
        "STATE_C_NON_ASSERTION_FAILURE_OBSERVED",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  if (
    leaves.some(
      (leaf) =>
        leaf
          .failureSpecificFragments
          .length === 0,
    )
  ) {
    return {
      outcome:
        "ASSERTION_CANDIDATE_INCOMPLETE",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  const completeFailures =
    leaves.map(
      buildCanonicalFailure,
    );

  const testNames =
    completeFailures.map(
      (failure) =>
        failure.testName,
    );

  const failureIds =
    completeFailures.map(
      (failure) =>
        failure.failureId,
    );

  if (
    new Set(testNames).size !==
      testNames.length ||
    new Set(failureIds).size !==
      failureIds.length
  ) {
    return {
      outcome:
        "AMBIGUOUS_FAILED_LEAF_IDENTITY",

      candidateFailures: [],

      failureSetSha256:
        null,
    };
  }

  const candidateFailures =
    [...completeFailures]
      .sort(
        (left, right) => {
          const byName =
            compareUnicodeCodePoints(
              left.testName,
              right.testName,
            );

          if (byName !== 0) {
            return byName;
          }

          return compareUnicodeCodePoints(
            left.failureId,
            right.failureId,
          );
        },
      );

  const failureSetSha256 =
    computeFailureSetSha256(
      candidateFailures.map(
        (failure) => ({
          testName:
            failure.testName,

          outputIncludes: [
            ...failure
              .outputIncludes,
          ],
        }),
      ),
    );

  return {
    outcome:
      "ASSERTION_CANDIDATE_OBSERVED",

    candidateFailures,

    failureSetSha256,
  };
}

function computePrepareConfigSha256(
  prepareConfig,
) {
  return sha256Hex(
    canonicalSerialize(
      prepareConfig,
    ),
  );
}

function computeExecutionSha256(
  prepareConfig,
) {
  return computeExecutionContractSha256(
      prepareConfig.command,
    );
}

function computeEnvelopeDigest(
  includedPaths,
) {
  return computeEnvelopeSha256({
      includedPaths,
    });
}

function normalizeResolvedCommits(
  input,
) {
  const commits =
    exactObject(
      input,
      [
        "base",
        "head",
      ],
      {
        code:
          "PREPARE_CANDIDATE_COMMIT_INVALID",
      },
    );

  return {
    base:
      requireString(
        commits.base,
        {
          code:
            "PREPARE_CANDIDATE_COMMIT_INVALID",
        },
      ),

    head:
      requireString(
        commits.head,
        {
          code:
            "PREPARE_CANDIDATE_COMMIT_INVALID",
        },
      ),
  };
}

function normalizeMetadata(input) {
  if (input === undefined) {
    return {
      createdAt: null,
    };
  }

  const metadata =
    exactObject(
      input,
      [
        "createdAt",
      ],
      {
        code:
          "PREPARE_CANDIDATE_METADATA_INVALID",
      },
    );

  if (
    metadata.createdAt !==
      null
  ) {
    requireString(
      metadata.createdAt,
      {
        code:
          "PREPARE_CANDIDATE_METADATA_INVALID",
      },
    );
  }

  return {
    createdAt:
      metadata.createdAt,
  };
}

function buildIdentity({
  prepareConfig,
  prepareToolVersion,
  repositoryContextSha256,
  resolvedCommits,
  states,
  boundary,
}) {
  const domain =
    deriveDomain(
      states,
      boundary,
    );

  const includedPaths = [
    ...prepareConfig
      .envelope
      .includedPaths,
  ];

  includedPaths.sort(
    compareUnicodeCodePoints,
  );

  const environmentKeys =
    Object.keys(
      prepareConfig
        .command
        .environment,
    );

  environmentKeys.sort(
    compareUnicodeCodePoints,
  );

  return {
    candidateContractVersion:
      "0.1",

    prepareToolVersion,

    prepareOutcome:
      domain.outcome,

    promotionEligible:
      domain.outcome ===
        "ASSERTION_CANDIDATE_OBSERVED",

    cleanupVerified:
      true,

    prepareConfigSha256:
      computePrepareConfigSha256(
        prepareConfig,
      ),

    repositoryContextSha256,

    requestedRefs: {
      base:
        prepareConfig.baseRef,

      head:
        prepareConfig.headRef,
    },

    resolvedCommits: {
      ...resolvedCommits,
    },

    executionContractSha256:
      computeExecutionSha256(
        prepareConfig,
      ),

    environmentKeys,

    envelope: {
      includedPaths,
    },

    envelopeSha256:
      computeEnvelopeDigest(
        includedPaths,
      ),

    states,

    boundary,

    candidateFailures:
      domain.candidateFailures,

    failureSetSha256:
      domain.failureSetSha256,
  };
}

export function buildPrepareCandidate(
  input,
) {
  const value =
    exactObject(
      input,
      [
        "prepareConfig",
        "prepareToolVersion",
        "repositoryContextSha256",
        "resolvedCommits",
        "cleanupVerified",
        "states",
        "boundary",
      ],
      {
        optionalKeys: [
          "metadata",
        ],
        code:
          "PREPARE_CANDIDATE_INPUT_INVALID",
      },
    );

  if (
    value.cleanupVerified !==
      true
  ) {
    fail(
      "PREPARE_CANDIDATE_CLEANUP_NOT_VERIFIED",
    );
  }

  const prepareConfig =
    normalizePrepareConfig(
      value.prepareConfig,
    );

  const prepareToolVersion =
    requireString(
      value.prepareToolVersion,
      {
        code:
          "PREPARE_CANDIDATE_INPUT_INVALID",
      },
    );

  const repositoryContextSha256 =
    requireSha256(
      value
        .repositoryContextSha256,
    );

  const resolvedCommits =
    normalizeResolvedCommits(
      value.resolvedCommits,
    );

  const states =
    normalizeStates(
      value.states,
    );

  const boundary =
    normalizeBoundary(
      value.boundary,
      prepareConfig
        .envelope
        .includedPaths,
    );

  const metadata =
    normalizeMetadata(
      value.metadata,
    );

  const identity =
    buildIdentity({
      prepareConfig,
      prepareToolVersion,
      repositoryContextSha256,
      resolvedCommits,
      states,
      boundary,
    });

  return {
    schemaVersion:
      "0.1",

    artifactType:
      "change-proof.prepare-candidate",

    authoritative:
      false,

    candidateSha256:
      computeCandidateSha256({
        identity,
      }),

    identity,

    metadata,
  };
}

function normalizeCanonicalFailure(
  input,
) {
  const failure =
    exactObject(
      input,
      [
        "failureId",
        "testName",
        "outputIncludes",
      ],
      {
        code:
          "PREPARE_CANDIDATE_FAILURE_INVALID",
      },
    );

  return {
    failureId:
      requireFailureId(
        failure.failureId,
      ),

    testName:
      requireString(
        failure.testName,
        {
          code:
            "PREPARE_CANDIDATE_FAILURE_INVALID",
        },
      ),

    outputIncludes:
      normalizeStringArray(
        failure.outputIncludes,
        {
          nonEmpty: true,
          code:
            "PREPARE_CANDIDATE_FAILURE_INVALID",
        },
      ),
  };
}

function normalizeIdentity(input) {
  const identity =
    exactObject(
      input,
      [
        "candidateContractVersion",
        "prepareToolVersion",
        "prepareOutcome",
        "promotionEligible",
        "cleanupVerified",
        "prepareConfigSha256",
        "repositoryContextSha256",
        "requestedRefs",
        "resolvedCommits",
        "executionContractSha256",
        "environmentKeys",
        "envelope",
        "envelopeSha256",
        "states",
        "boundary",
        "candidateFailures",
        "failureSetSha256",
      ],
    );

  if (
    identity
      .candidateContractVersion !==
      "0.1" ||
    !PREPARE_OUTCOME_SET.has(
      identity.prepareOutcome,
    ) ||
    typeof identity
      .promotionEligible !==
      "boolean" ||
    identity.cleanupVerified !==
      true
  ) {
    fail(
      "PREPARE_CANDIDATE_INVALID",
    );
  }

  const requestedRefs =
    exactObject(
      identity.requestedRefs,
      [
        "base",
        "head",
      ],
    );

  const envelope =
    exactObject(
      identity.envelope,
      [
        "includedPaths",
      ],
    );

  const environmentKeys =
    normalizeStringArray(
      identity.environmentKeys,
      {
        sort: true,
      },
    );

  if (
    canonicalSerialize(
      environmentKeys,
    ) !==
      canonicalSerialize(
        identity
          .environmentKeys,
      )
  ) {
    fail(
      "PREPARE_CANDIDATE_INVALID",
    );
  }

  const includedPaths =
    normalizeStringArray(
      envelope.includedPaths,
      {
        nonEmpty: true,
        sort: true,
      },
    );

  if (
    canonicalSerialize(
      includedPaths,
    ) !==
      canonicalSerialize(
        envelope
          .includedPaths,
      )
  ) {
    fail(
      "PREPARE_CANDIDATE_INVALID",
    );
  }

  if (
    !Array.isArray(
      identity.candidateFailures,
    )
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_INVALID",
    );
  }

  const candidateFailures =
    identity
      .candidateFailures
      .map(
        normalizeCanonicalFailure,
      );

  const sortedFailures =
    [...candidateFailures]
      .sort(
        (left, right) => {
          const byName =
            compareUnicodeCodePoints(
              left.testName,
              right.testName,
            );

          if (byName !== 0) {
            return byName;
          }

          return compareUnicodeCodePoints(
            left.failureId,
            right.failureId,
          );
        },
      );

  if (
    canonicalSerialize(
      candidateFailures,
    ) !==
      canonicalSerialize(
        sortedFailures,
      )
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_INVALID",
    );
  }

  return {
    candidateContractVersion:
      "0.1",

    prepareToolVersion:
      requireString(
        identity
          .prepareToolVersion,
      ),

    prepareOutcome:
      identity.prepareOutcome,

    promotionEligible:
      identity
        .promotionEligible,

    cleanupVerified:
      true,

    prepareConfigSha256:
      requireSha256(
        identity
          .prepareConfigSha256,
      ),

    repositoryContextSha256:
      requireSha256(
        identity
          .repositoryContextSha256,
      ),

    requestedRefs: {
      base:
        requireString(
          requestedRefs.base,
        ),

      head:
        requireString(
          requestedRefs.head,
        ),
    },

    resolvedCommits:
      normalizeResolvedCommits(
        identity.resolvedCommits,
      ),

    executionContractSha256:
      requireSha256(
        identity
          .executionContractSha256,
      ),

    environmentKeys,

    envelope: {
      includedPaths,
    },

    envelopeSha256:
      requireSha256(
        identity
          .envelopeSha256,
      ),

    states:
      normalizeStates(
        identity.states,
      ),

    boundary:
      normalizeBoundary(
        identity.boundary,
        includedPaths,
      ),

    candidateFailures,

    failureSetSha256:
      identity
        .failureSetSha256 ===
        null
        ? null
        : requireSha256(
            identity
              .failureSetSha256,
          ),
  };
}

function assertCandidateConsistency(
  identity,
) {
  const expectedEnvelopeSha256 =
    computeEnvelopeDigest(
      identity
        .envelope
        .includedPaths,
    );

  if (
    identity.envelopeSha256 !==
      expectedEnvelopeSha256
  ) {
    fail(
      "PREPARE_CANDIDATE_ENVELOPE_DIGEST_MISMATCH",
    );
  }

  const domain =
    deriveDomain(
      identity.states,
      identity.boundary,
    );

  if (
    identity.prepareOutcome !==
      domain.outcome
  ) {
    fail(
      "PREPARE_CANDIDATE_OUTCOME_MISMATCH",
    );
  }

  const eligible =
    domain.outcome ===
      "ASSERTION_CANDIDATE_OBSERVED";

  if (
    identity.promotionEligible !==
      eligible
  ) {
    fail(
      "PREPARE_CANDIDATE_ELIGIBILITY_MISMATCH",
    );
  }

  if (!eligible) {
    if (
      identity
        .candidateFailures
        .length !== 0 ||
      identity
        .failureSetSha256 !==
        null
    ) {
      fail(
        "PREPARE_CANDIDATE_FAILURE_SET_INVALID",
      );
    }

    return;
  }

  const names =
    identity
      .candidateFailures
      .map(
        (failure) =>
          failure.testName,
      );

  const ids =
    identity
      .candidateFailures
      .map(
        (failure) =>
          failure.failureId,
      );

  if (
    new Set(names).size !==
      names.length ||
    new Set(ids).size !==
      ids.length
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_ID_AMBIGUOUS",
    );
  }

  if (
    canonicalSerialize(
      identity
        .candidateFailures,
    ) !==
      canonicalSerialize(
        domain
          .candidateFailures,
      )
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_ID_MISMATCH",
    );
  }

  for (
    const failure
    of identity
      .candidateFailures
  ) {
    const expectedId =
      computeCandidateFailureId({
        testName:
          failure.testName,

        failureSpecificFragments: [
          ...failure.outputIncludes,
        ],
      });

    if (
      expectedId !==
        failure.failureId
    ) {
      fail(
        "PREPARE_CANDIDATE_FAILURE_ID_MISMATCH",
      );
    }
  }

  const expectedFailureSetSha256 =
    computeFailureSetSha256(
      identity
        .candidateFailures
        .map(
          (failure) => ({
            testName:
              failure.testName,

            outputIncludes: [
              ...failure
                .outputIncludes,
            ],
          }),
        ),
    );

  if (
    identity.failureSetSha256 !==
      expectedFailureSetSha256
  ) {
    fail(
      "PREPARE_CANDIDATE_FAILURE_SET_DIGEST_MISMATCH",
    );
  }
}

export function normalizePrepareCandidate(
  input,
) {
  const candidate =
    exactObject(
      input,
      [
        "schemaVersion",
        "artifactType",
        "authoritative",
        "candidateSha256",
        "identity",
        "metadata",
      ],
    );

  if (
    candidate.schemaVersion !==
      "0.1" ||
    candidate.artifactType !==
      "change-proof.prepare-candidate" ||
    candidate.authoritative !==
      false
  ) {
    fail(
      "PREPARE_CANDIDATE_INVALID",
    );
  }

  const suppliedCandidateSha256 =
    requireSha256(
      candidate
        .candidateSha256,
    );

  const identity =
    normalizeIdentity(
      candidate.identity,
    );

  const metadata =
    normalizeMetadata(
      candidate.metadata,
    );

  assertCandidateConsistency(
    identity,
  );

  const expectedCandidateSha256 =
    computeCandidateSha256({
      identity,
    });

  if (
    suppliedCandidateSha256 !==
      expectedCandidateSha256
  ) {
    fail(
      "PREPARE_CANDIDATE_SHA_MISMATCH",
    );
  }

  return {
    schemaVersion:
      "0.1",

    artifactType:
      "change-proof.prepare-candidate",

    authoritative:
      false,

    candidateSha256:
      expectedCandidateSha256,

    identity,

    metadata,
  };
}
