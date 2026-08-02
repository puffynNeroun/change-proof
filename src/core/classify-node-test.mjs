export const NODE_TEST_OUTCOMES =
  Object.freeze({
    PASS: "PASS",

    TEST_ASSERTION_FAILURE:
      "TEST_ASSERTION_FAILURE",

    TEST_DISCOVERY_FAILURE:
      "TEST_DISCOVERY_FAILURE",

    LOAD_FAILURE:
      "LOAD_FAILURE",

    TIMEOUT:
      "TIMEOUT",

    PROCESS_FAILURE:
      "PROCESS_FAILURE",

    OPERATIONAL_ERROR:
      "OPERATIONAL_ERROR",

    INCONCLUSIVE:
      "INCONCLUSIVE",
  });

export const NODE_TEST_REASON_CODES =
  Object.freeze({
    PASS:
      "NODE_TEST_PASS",

    EXPECTED_ASSERTION_FAILURE_OBSERVED:
      "EXPECTED_ASSERTION_FAILURE_OBSERVED",

    EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED:
      "EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED",

    ASSERTION_REQUIRES_EXPECTATION:
      "ASSERTION_REQUIRES_EXPECTATION",

    PROCESS_ERROR:
      "PROCESS_ERROR",

    PROCESS_SIGNAL:
      "PROCESS_SIGNAL",

    EXECUTION_TIMEOUT:
      "EXECUTION_TIMEOUT",

    OUTPUT_TRUNCATED:
      "OUTPUT_TRUNCATED",

    LOAD_FAILURE:
      "LOAD_FAILURE",

    TAP_VERSION_MISSING:
      "TAP_VERSION_MISSING",

    TAP_SUMMARY_INCOMPLETE:
      "TAP_SUMMARY_INCOMPLETE",

    TEST_COUNT_MISMATCH:
      "TEST_COUNT_MISMATCH",

    UNSUPPORTED_TEST_FAILURE:
      "UNSUPPORTED_TEST_FAILURE",

    UNSUPPORTED_TAP_RESULT:
      "UNSUPPORTED_TAP_RESULT",
  });

const SUMMARY_KEYS = Object.freeze([
  "tests",
  "pass",
  "fail",
  "cancelled",
  "skipped",
  "todo",
]);

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireExpectedTestCount(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1
  ) {
    throw new Error(
      "invalid_expected_test_count",
    );
  }
}

function requireNullableInteger(
  name,
  value,
) {
  if (
    value !== null &&
    !Number.isSafeInteger(value)
  ) {
    throw new Error(
      `invalid_execution_field:${name}`,
    );
  }
}

function requireNullableString(
  name,
  value,
) {
  if (
    value !== null &&
    (
      typeof value !== "string" ||
      value.length === 0
    )
  ) {
    throw new Error(
      `invalid_execution_field:${name}`,
    );
  }
}

function requireBoolean(
  name,
  value,
) {
  if (typeof value !== "boolean") {
    throw new Error(
      `invalid_execution_field:${name}`,
    );
  }
}

function requireString(
  name,
  value,
) {
  if (typeof value !== "string") {
    throw new Error(
      `invalid_execution_field:${name}`,
    );
  }
}

function validateExecutionResult(value) {
  if (!isRecord(value)) {
    throw new Error(
      "invalid_execution_result",
    );
  }

  requireNullableInteger(
    "exitCode",
    value.exitCode,
  );

  requireNullableString(
    "signal",
    value.signal,
  );

  requireBoolean(
    "timedOut",
    value.timedOut,
  );

  requireNullableString(
    "processErrorCode",
    value.processErrorCode,
  );

  requireString(
    "stdout",
    value.stdout,
  );

  requireString(
    "stderr",
    value.stderr,
  );

  requireBoolean(
    "stdoutTruncated",
    value.stdoutTruncated,
  );

  requireBoolean(
    "stderrTruncated",
    value.stderrTruncated,
  );

  if (
    !Number.isSafeInteger(
      value.durationMs,
    ) ||
    value.durationMs < 0
  ) {
    throw new Error(
      "invalid_execution_field:durationMs",
    );
  }
}

function lastSummaryCount(
  output,
  key,
) {
  const pattern = new RegExp(
    `^# ${key} ([0-9]+)$`,
    "gm",
  );

  let match;
  let value = null;

  while (
    (
      match =
        pattern.exec(output)
    ) !== null
  ) {
    value = Number(match[1]);
  }

  return value;
}

function parseSummary(output) {
  const summary = {};

  for (const key of SUMMARY_KEYS) {
    summary[key] =
      lastSummaryCount(
        output,
        key,
      );
  }

  return summary;
}

function summaryComplete(summary) {
  return SUMMARY_KEYS.every(
    (key) =>
      Number.isSafeInteger(
        summary[key],
      ),
  );
}

function parseFailedSubtests(output) {
  const pattern =
    /^not ok [0-9]+ - (.+)$/gm;

  const failedSubtests = [];
  let match;

  while (
    (
      match =
        pattern.exec(output)
    ) !== null
  ) {
    failedSubtests.push(
      match[1].trim(),
    );
  }

  return failedSubtests;
}

function createClassification({
  outcome,
  reasonCode,

  testDiscovered,
  testExecuted,
  assertionObserved,
  invalidFailure,

  tapVersionPresent,
  summary,
  failedSubtests,
}) {
  return {
    framework: "node:test",

    outcome,
    reasonCode,

    testDiscovered,
    testExecuted,
    assertionObserved,
    invalidFailure,

    tapVersionPresent,

    summary: {
      tests: summary.tests,
      pass: summary.pass,
      fail: summary.fail,
      cancelled:
        summary.cancelled,
      skipped:
        summary.skipped,
      todo: summary.todo,
    },

    failedSubtests: [
      ...failedSubtests,
    ],
  };
}

function collectNodeTestEvidence(
  executionResult,
) {
  const output =
    `${executionResult.stdout}` +
    `${executionResult.stderr}`;

  const tapVersionPresent =
    /^TAP version 13$/m.test(
      output,
    );

  const summary =
    parseSummary(output);

  const failedSubtests =
    parseFailedSubtests(output);

  const assertionObserved =
    /code:\s*['"]ERR_ASSERTION['"]/m
      .test(output);

  const loadFailureObserved =
    /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module|ERR_UNKNOWN_FILE_EXTENSION/m
      .test(output);

  const hasCompleteSummary =
    summaryComplete(summary);

  const testDiscovered =
    tapVersionPresent &&
    Number.isSafeInteger(
      summary.tests,
    ) &&
    summary.tests > 0;

  const testExecuted =
    testDiscovered &&
    !loadFailureObserved &&
    Number.isSafeInteger(
      summary.pass,
    ) &&
    Number.isSafeInteger(
      summary.fail,
    ) &&
    (
      summary.pass +
      summary.fail
    ) > 0;

  return {
    output,
    tapVersionPresent,
    summary,
    failedSubtests,
    assertionObserved,
    loadFailureObserved,
    hasCompleteSummary,
    testDiscovered,
    testExecuted,
  };
}

/**
 * Classifies node:test TAP evidence without interpreting a failure as
 * a Change Proof regression.
 *
 * Expected assertion matching is intentionally handled by
 * classifyExpectedNodeTestRegression().
 */
export function classifyNodeTestExecution(
  input = {},
) {
  const {
    executionResult,
    expectedTestCount,
  } = input;

  validateExecutionResult(
    executionResult,
  );

  requireExpectedTestCount(
    expectedTestCount,
  );

  const evidence =
    collectNodeTestEvidence(
      executionResult,
    );

  const common = {
    tapVersionPresent:
      evidence.tapVersionPresent,

    summary:
      evidence.summary,

    failedSubtests:
      evidence.failedSubtests,

    assertionObserved:
      evidence.assertionObserved,
  };

  if (executionResult.timedOut) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES.TIMEOUT,

      reasonCode:
        NODE_TEST_REASON_CODES
          .EXECUTION_TIMEOUT,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: true,
    });
  }

  if (
    executionResult.processErrorCode !==
    null
  ) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .PROCESS_FAILURE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .PROCESS_ERROR,

      testDiscovered: false,
      testExecuted: false,
      invalidFailure: true,
    });
  }

  if (executionResult.signal !== null) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .PROCESS_FAILURE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .PROCESS_SIGNAL,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: true,
    });
  }

  if (
    executionResult.stdoutTruncated ||
    executionResult.stderrTruncated
  ) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .OPERATIONAL_ERROR,

      reasonCode:
        NODE_TEST_REASON_CODES
          .OUTPUT_TRUNCATED,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: true,
    });
  }

  if (evidence.loadFailureObserved) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .LOAD_FAILURE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .LOAD_FAILURE,

      testDiscovered: false,
      testExecuted: false,
      invalidFailure: true,
    });
  }

  if (!evidence.tapVersionPresent) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .TEST_DISCOVERY_FAILURE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .TAP_VERSION_MISSING,

      testDiscovered: false,
      testExecuted: false,
      invalidFailure: true,
    });
  }

  if (!evidence.hasCompleteSummary) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .INCONCLUSIVE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .TAP_SUMMARY_INCOMPLETE,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: true,
    });
  }

  if (
    evidence.summary.tests !==
    expectedTestCount
  ) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .INCONCLUSIVE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .TEST_COUNT_MISMATCH,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: false,
    });
  }

  const passingOutcome =
    executionResult.exitCode === 0 &&
    evidence.summary.tests ===
      expectedTestCount &&
    evidence.summary.pass ===
      expectedTestCount &&
    evidence.summary.fail === 0 &&
    evidence.summary.cancelled === 0 &&
    evidence.summary.skipped === 0 &&
    evidence.summary.todo === 0 &&
    evidence.failedSubtests.length === 0 &&
    !evidence.assertionObserved;

  if (passingOutcome) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES.PASS,

      reasonCode:
        NODE_TEST_REASON_CODES.PASS,

      testDiscovered: true,
      testExecuted: true,
      invalidFailure: false,
    });
  }

  const assertionFailureCandidate =
    executionResult.exitCode === 1 &&
    evidence.summary.fail > 0 &&
    evidence.failedSubtests.length > 0 &&
    evidence.assertionObserved;

  if (assertionFailureCandidate) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .INCONCLUSIVE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .ASSERTION_REQUIRES_EXPECTATION,

      testDiscovered: true,
      testExecuted: true,
      invalidFailure: false,
    });
  }

  if (
    executionResult.exitCode !== 0
  ) {
    return createClassification({
      ...common,

      outcome:
        NODE_TEST_OUTCOMES
          .INCONCLUSIVE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .UNSUPPORTED_TEST_FAILURE,

      testDiscovered:
        evidence.testDiscovered,

      testExecuted:
        evidence.testExecuted,

      invalidFailure: false,
    });
  }

  return createClassification({
    ...common,

    outcome:
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,

    reasonCode:
      NODE_TEST_REASON_CODES
        .UNSUPPORTED_TAP_RESULT,

    testDiscovered:
      evidence.testDiscovered,

    testExecuted:
      evidence.testExecuted,

    invalidFailure: false,
  });
}

function validateExpectedFailure(value) {
  if (!isRecord(value)) {
    throw new Error(
      "invalid_expected_failure",
    );
  }

  if (
    typeof value.testName !== "string" ||
    value.testName.length === 0 ||
    value.testName.includes("\0") ||
    value.testName.includes("\n") ||
    value.testName.includes("\r")
  ) {
    throw new Error(
      "invalid_expected_failure_test_name",
    );
  }

  if (
    !Array.isArray(
      value.outputIncludes,
    )
  ) {
    throw new Error(
      "invalid_expected_failure_fragments",
    );
  }

  const seen = new Set();

  for (
    const fragment of
      value.outputIncludes
  ) {
    if (
      typeof fragment !== "string" ||
      fragment.length === 0 ||
      fragment.includes("\0")
    ) {
      throw new Error(
        "invalid_expected_failure_fragment",
      );
    }

    if (seen.has(fragment)) {
      throw new Error(
        "duplicate_expected_failure_fragment",
      );
    }

    seen.add(fragment);
  }
}

/**
 * Promotes only an explicitly matched assertion failure to
 * TEST_ASSERTION_FAILURE.
 *
 * A generic assertion failure remains INCONCLUSIVE.
 */
export function classifyExpectedNodeTestRegression(
  input = {},
) {
  const {
    executionResult,
    expectedTestCount,
    expectedFailure,
  } = input;

  validateExpectedFailure(
    expectedFailure,
  );

  const classification =
    classifyNodeTestExecution({
      executionResult,
      expectedTestCount,
    });

  if (
    classification.outcome ===
    NODE_TEST_OUTCOMES.PASS
  ) {
    return classification;
  }

  if (
    classification.reasonCode !==
    NODE_TEST_REASON_CODES
      .ASSERTION_REQUIRES_EXPECTATION
  ) {
    return classification;
  }

  const output =
    `${executionResult.stdout}` +
    `${executionResult.stderr}`;

  const namedFailureObserved =
    classification.failedSubtests
      .includes(
        expectedFailure.testName,
      );

  const fragmentsObserved =
    expectedFailure.outputIncludes
      .every(
        (fragment) =>
          output.includes(fragment),
      );

  const expectedCountsObserved =
    executionResult.exitCode === 1 &&
    classification.summary.tests ===
      expectedTestCount &&
    classification.summary.pass ===
      expectedTestCount - 1 &&
    classification.summary.fail === 1 &&
    classification.summary.cancelled ===
      0 &&
    classification.summary.skipped ===
      0 &&
    classification.summary.todo === 0;

  if (
    namedFailureObserved &&
    fragmentsObserved &&
    expectedCountsObserved
  ) {
    return {
      ...classification,

      outcome:
        NODE_TEST_OUTCOMES
          .TEST_ASSERTION_FAILURE,

      reasonCode:
        NODE_TEST_REASON_CODES
          .EXPECTED_ASSERTION_FAILURE_OBSERVED,
    };
  }

  return {
    ...classification,

    reasonCode:
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
  };
}
