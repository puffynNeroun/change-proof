export const NODE_TEST_OUTCOMES =
  Object.freeze({
    PASS: "PASS",

    TEST_ASSERTION_FAILURE:
      "TEST_ASSERTION_FAILURE",

    EXPECTED_TEST_FAILURE:
      "EXPECTED_TEST_FAILURE",

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

    EXPECTED_TEST_FAILURE_SET_OBSERVED:
      "EXPECTED_TEST_FAILURE_SET_OBSERVED",

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

function parseTopLevelTestResults(output) {
  const lines = output.split(/\r?\n/);
  const results = [];
  let pendingSubtest = null;

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const line = lines[lineIndex];
    const subtestMatch =
      /^# Subtest: (.+)$/
        .exec(line);

    if (subtestMatch !== null) {
      pendingSubtest = {
        testName:
          subtestMatch[1].trim(),
        lineIndex,
      };

      continue;
    }

    const resultMatch =
      /^(not )?ok ([0-9]+) - (.+)$/
        .exec(line);

    if (resultMatch === null) {
      continue;
    }

    const testName =
      resultMatch[3].trim();

    const declarationMatched =
      pendingSubtest !== null &&
      pendingSubtest.testName ===
        testName;

    results.push({
      failed:
        resultMatch[1] === "not ",
      testNumber:
        Number(resultMatch[2]),
      testName,
      resultLineIndex: lineIndex,
      blockStartLineIndex:
        declarationMatched
          ? pendingSubtest.lineIndex
          : lineIndex,
      declarationMatched,
    });

    pendingSubtest = null;
  }

  return results.map(
    (result, index) => {
      const nextResult =
        results[index + 1];

      let blockEndLineIndex =
        nextResult === undefined
          ? lines.length
          : nextResult
              .blockStartLineIndex;

      for (
        let lineIndex =
          result.resultLineIndex + 1;
        lineIndex <
          blockEndLineIndex;
        lineIndex += 1
      ) {
        if (
          /^1\.\.[0-9]+$/
            .test(lines[lineIndex]) ||
          /^# tests [0-9]+$/
            .test(lines[lineIndex])
        ) {
          blockEndLineIndex =
            lineIndex;
          break;
        }
      }

      return {
        ...result,
        block: lines
          .slice(
            result.blockStartLineIndex,
            blockEndLineIndex,
          )
          .join("\n"),
      };
    },
  );
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

  const testResults =
    parseTopLevelTestResults(output);

  const topLevelSubtestCount =
    (
      output.match(
        /^# Subtest: .+$/gm,
      ) ?? []
    ).length;

  const uniqueTestNumbers =
    new Set(
      testResults.map(
        (result) =>
          result.testNumber,
      ),
    );

  const tapResultStructureValid =
    topLevelSubtestCount ===
      testResults.length &&
    uniqueTestNumbers.size ===
      testResults.length &&
    testResults.every(
      (result) =>
        result.declarationMatched,
    );

  const failedTestResults =
    testResults.filter(
      (result) => result.failed,
    );

  const failedSubtests =
    failedTestResults.map(
      (result) => result.testName,
    );

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
    failedTestResults,
    tapResultStructureValid,
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
    value.testName.trim() !==
      value.testName ||
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
    ) ||
    value.outputIncludes.length === 0
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

function normalizeExpectedFailures(input) {
  const hasExpectedFailure =
    Object.hasOwn(
      input,
      "expectedFailure",
    );

  const hasExpectedFailures =
    Object.hasOwn(
      input,
      "expectedFailures",
    );

  if (
    hasExpectedFailure ===
    hasExpectedFailures
  ) {
    throw new Error(
      hasExpectedFailure
        ? "conflicting_expected_failure_inputs"
        : "missing_expected_failure_input",
    );
  }

  if (hasExpectedFailure) {
    validateExpectedFailure(
      input.expectedFailure,
    );

    return [
      {
        testName:
          input.expectedFailure
            .testName,
        outputIncludes: [
          ...input.expectedFailure
            .outputIncludes,
        ],
      },
    ];
  }

  if (
    !Array.isArray(
      input.expectedFailures,
    )
  ) {
    throw new Error(
      "invalid_expected_failures",
    );
  }

  if (
    input.expectedFailures.length === 0
  ) {
    throw new Error(
      "empty_expected_failures",
    );
  }

  const seenTestNames = new Set();

  return input.expectedFailures.map(
    (expectedFailure) => {
      validateExpectedFailure(
        expectedFailure,
      );

      if (
        seenTestNames.has(
          expectedFailure.testName,
        )
      ) {
        throw new Error(
          "duplicate_expected_failure_test_name",
        );
      }

      seenTestNames.add(
        expectedFailure.testName,
      );

      return {
        testName:
          expectedFailure.testName,
        outputIncludes: [
          ...expectedFailure
            .outputIncludes,
        ],
      };
    },
  );
}

function singleDiagnosticValue(
  block,
  key,
) {
  const pattern = new RegExp(
    `^  ${key}: ['\"]([^'\"]+)['\"]$`,
    "gm",
  );

  const values = [];
  let match;

  while (
    (
      match = pattern.exec(block)
    ) !== null
  ) {
    values.push(match[1]);
  }

  return values.length === 1
    ? values[0]
    : null;
}

function classifyExpectedFailureBlock(
  failedTestResult,
) {
  if (
    !failedTestResult
      .declarationMatched
  ) {
    return null;
  }

  const failureType =
    singleDiagnosticValue(
      failedTestResult.block,
      "failureType",
    );

  const code = singleDiagnosticValue(
    failedTestResult.block,
    "code",
  );

  const runnerFailure =
    /^  exitCode: /m.test(
      failedTestResult.block,
    ) ||
    /^  signal: /m.test(
      failedTestResult.block,
    ) ||
    /^  error: ['\"]test failed['\"]$/m
      .test(failedTestResult.block);

  if (
    failureType !==
      "testCodeFailure" ||
    code === null ||
    runnerFailure
  ) {
    return null;
  }

  return code === "ERR_ASSERTION"
    ? "assertion"
    : "test";
}

/**
 * Promotes only an exact, explicitly matched failure set.
 *
 * A generic or partially matched failure remains INCONCLUSIVE.
 */
export function classifyExpectedNodeTestRegression(
  input = {},
) {
  const {
    executionResult,
    expectedTestCount,
  } = input;

  const expectedFailures =
    normalizeExpectedFailures(input);

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
      .ASSERTION_REQUIRES_EXPECTATION &&
    classification.reasonCode !==
    NODE_TEST_REASON_CODES
      .UNSUPPORTED_TEST_FAILURE
  ) {
    return classification;
  }

  const evidence =
    collectNodeTestEvidence(
      executionResult,
    );

  const actualFailures =
    evidence.failedTestResults;

  const actualTestNames =
    actualFailures.map(
      (failure) => failure.testName,
    );

  const uniqueActualTestNames =
    new Set(actualTestNames);

  const expectedByTestName =
    new Map(
      expectedFailures.map(
        (expectedFailure) => [
          expectedFailure.testName,
          expectedFailure,
        ],
      ),
    );

  const expectedCountsObserved =
    executionResult.exitCode === 1 &&
    classification.summary.tests ===
      expectedTestCount &&
    classification.summary.pass ===
      expectedTestCount -
        expectedFailures.length &&
    classification.summary.fail ===
      expectedFailures.length &&
    classification.summary.cancelled ===
      0 &&
    classification.summary.skipped ===
      0 &&
    classification.summary.todo === 0;

  const exactFailureSetObserved =
    evidence.tapResultStructureValid &&
    actualFailures.length ===
      expectedFailures.length &&
    uniqueActualTestNames.size ===
      actualFailures.length &&
    actualFailures.every(
      (failure) =>
        expectedByTestName.has(
          failure.testName,
        ),
    );

  const matchedFailureKinds =
    exactFailureSetObserved
      ? actualFailures.map(
          (failure) => {
            const expectedFailure =
              expectedByTestName.get(
                failure.testName,
              );

            const fragmentsObserved =
              expectedFailure
                .outputIncludes
                .every(
                  (fragment) =>
                    failure.block
                      .includes(
                        fragment,
                      ),
                );

            if (!fragmentsObserved) {
              return null;
            }

            return classifyExpectedFailureBlock(
              failure,
            );
          },
        )
      : [];

  const everyFailureMatched =
    matchedFailureKinds.length ===
      expectedFailures.length &&
    matchedFailureKinds.every(
      (kind) => kind !== null,
    );

  if (
    expectedCountsObserved &&
    exactFailureSetObserved &&
    everyFailureMatched
  ) {
    const assertionsOnly =
      matchedFailureKinds.every(
        (kind) =>
          kind === "assertion",
      );

    return {
      ...classification,

      outcome:
        assertionsOnly
          ? NODE_TEST_OUTCOMES
              .TEST_ASSERTION_FAILURE
          : NODE_TEST_OUTCOMES
              .EXPECTED_TEST_FAILURE,

      reasonCode:
        assertionsOnly
          ? NODE_TEST_REASON_CODES
              .EXPECTED_ASSERTION_FAILURE_OBSERVED
          : NODE_TEST_REASON_CODES
              .EXPECTED_TEST_FAILURE_SET_OBSERVED,
    };
  }

  return {
    ...classification,

    reasonCode:
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
  };
}
