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

function parseNodeTestResults(output) {
  const lines = output.split(/\r?\n/);
  const results = [];
  const topLevelScope = {
    indentation: 0,
    results: [],
    plans: [],
  };
  const scopes = [topLevelScope];
  const pendingSubtests = new Map();
  let structureValid = true;
  let nestedTapPresent = false;

  function scopeAt(indentation) {
    if (indentation === 0) {
      return topLevelScope;
    }

    const parent =
      pendingSubtests.get(
        indentation - 4,
      );

    if (parent === undefined) {
      return null;
    }

    if (parent.childScope === null) {
      parent.childScope = {
        indentation,
        results: [],
        plans: [],
      };

      scopes.push(parent.childScope);
    }

    return parent.childScope;
  }

  function validateIndentation(
    indentation,
  ) {
    if (indentation % 4 !== 0) {
      structureValid = false;
      return false;
    }

    if (indentation === 0) {
      return true;
    }

    nestedTapPresent = true;

    const parent =
      pendingSubtests.get(
        indentation - 4,
      );

    if (parent === undefined) {
      structureValid = false;
      return false;
    }

    parent.hasNestedScope = true;
    return true;
  }

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    const line = lines[lineIndex];

    if (
      /^[ \t]+(?:# Subtest:|(?:not )?ok [0-9]+ - |1\.\.)/
        .test(line) &&
      /^ */.exec(line)[0].length !==
        /^[ \t]*/.exec(line)[0].length
    ) {
      structureValid = false;
      continue;
    }

    const subtestMatch =
      /^( *)# Subtest: (.+)$/
        .exec(line);

    if (subtestMatch !== null) {
      const indentation =
        subtestMatch[1].length;

      validateIndentation(indentation);

      if (
        pendingSubtests.has(
          indentation,
        )
      ) {
        structureValid = false;
      }

      pendingSubtests.set(
        indentation,
        {
          testName:
            subtestMatch[2].trim(),
          lineIndex,
          indentation,
          hasNestedScope: false,
          childScope: null,
        },
      );

      const scope =
        scopeAt(indentation);

      if (
        scope !== null &&
        scope.plans.length > 0
      ) {
        structureValid = false;
      }

      continue;
    }

    const resultMatch =
      /^( *)(not )?ok ([0-9]+) - (.+)$/
        .exec(line);

    if (resultMatch !== null) {
      const indentation =
        resultMatch[1].length;

      validateIndentation(indentation);

      const pendingSubtest =
        pendingSubtests.get(
          indentation,
        ) ?? null;

      const testName =
        resultMatch[4].trim();

      const declarationMatched =
        pendingSubtest !== null &&
        pendingSubtest.testName ===
          testName;

      const result = {
        failed:
          resultMatch[2] === "not ",
        testNumber:
          Number(resultMatch[3]),
        testName,
        indentation,
        resultLineIndex: lineIndex,
        declarationLineIndex:
          declarationMatched
            ? pendingSubtest.lineIndex
            : null,
        declarationMatched,
        hasNestedScope:
          pendingSubtest
            ?.hasNestedScope === true,
      };

      results.push(result);
      const scope =
        scopeAt(indentation);

      if (scope === null) {
        structureValid = false;
      } else {
        if (scope.plans.length > 0) {
          structureValid = false;
        }

        scope.results.push(result);
      }

      if (!declarationMatched) {
        structureValid = false;
      }

      pendingSubtests.delete(
        indentation,
      );

      continue;
    }

    const planMatch =
      /^( *)1\.\.([0-9]+)$/
        .exec(line);

    if (planMatch !== null) {
      const indentation =
        planMatch[1].length;

      validateIndentation(indentation);

      const scope =
        scopeAt(indentation);

      if (scope === null) {
        structureValid = false;
      } else {
        scope.plans.push({
          count: Number(planMatch[2]),
          lineIndex,
        });
      }

      if (
        indentation > 0 &&
        pendingSubtests.has(
          indentation,
        )
      ) {
        structureValid = false;
      }
    }
  }

  if (pendingSubtests.size > 0) {
    structureValid = false;
  }

  for (const scope of scopes) {
    const testNumbers = scope.results.map(
      (result) => result.testNumber,
    );

    if (
      new Set(testNumbers).size !==
      testNumbers.length
    ) {
      structureValid = false;
    }

    if (
      scope.indentation === 0 &&
      !nestedTapPresent
    ) {
      continue;
    }

    if (scope.plans.length !== 1) {
      structureValid = false;
      continue;
    }

    const planCount =
      scope.plans[0].count;

    if (
      planCount !== scope.results.length ||
      testNumbers.some(
        (testNumber, index) =>
          testNumber !== index + 1,
      )
    ) {
      structureValid = false;
    }
  }

  const attachedDiagnosticLines =
    new Set();

  const resultsWithBlocks = results.map(
    (result) => {
      let blockEndLineIndex =
        lines.length;

      for (
        let lineIndex =
          result.resultLineIndex + 1;
        lineIndex < lines.length;
        lineIndex += 1
      ) {
        const structuralMatch =
          /^( *)(?:# Subtest:|(?:not )?ok [0-9]+ - |1\.\.)/
            .exec(lines[lineIndex]);

        if (
          structuralMatch !== null &&
          structuralMatch[1].length <=
            result.indentation
        ) {
          blockEndLineIndex =
            lineIndex;
          break;
        }

        if (
          result.indentation === 0 &&
          /^# tests [0-9]+$/
            .test(lines[lineIndex])
        ) {
          blockEndLineIndex =
            lineIndex;
          break;
        }
      }

      const diagnosticLines = lines.slice(
        result.resultLineIndex + 1,
        blockEndLineIndex,
      );

      for (
        let lineIndex =
          result.resultLineIndex + 1;
        lineIndex < blockEndLineIndex;
        lineIndex += 1
      ) {
        attachedDiagnosticLines.add(
          lineIndex,
        );
      }

      const markerIndexes = [];

      for (
        let index = 0;
        index < diagnosticLines.length;
        index += 1
      ) {
        const markerMatch =
          /^( *)(---|\.\.\.)$/
            .exec(diagnosticLines[index]);

        if (markerMatch !== null) {
          markerIndexes.push({
            indentation:
              markerMatch[1].length,
            marker: markerMatch[2],
            index,
          });
        }
      }

      if (
        nestedTapPresent &&
        markerIndexes.length !== 0 &&
        (
          markerIndexes.length !== 2 ||
          markerIndexes[0].marker !==
            "---" ||
          markerIndexes[1].marker !==
            "..." ||
          markerIndexes[0].indentation !==
            result.indentation + 2 ||
          markerIndexes[1].indentation !==
            result.indentation + 2
        )
      ) {
        structureValid = false;
      }

      const blockLines = [
        ...(result.declarationLineIndex ===
        null
          ? []
          : [
              lines[
                result
                  .declarationLineIndex
              ],
            ]),
        ...lines.slice(
          result.resultLineIndex,
          blockEndLineIndex,
        ),
      ];

      return {
        ...result,
        block: blockLines
          .map((line) =>
            line.startsWith(
              " ".repeat(
                result.indentation,
              ),
            )
              ? line.slice(
                  result.indentation,
                )
              : line,
          )
          .join("\n"),
      };
    },
  );

  for (
    let lineIndex = 0;
    lineIndex < lines.length;
    lineIndex += 1
  ) {
    if (
      nestedTapPresent &&
      /^(?: *)(?:---|\.\.\.)$/
        .test(lines[lineIndex]) &&
      !attachedDiagnosticLines.has(
        lineIndex,
      )
    ) {
      structureValid = false;
    }
  }

  return {
    results: resultsWithBlocks,
    nestedTapPresent,
    structureValid,
  };
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

  const parsedTestResults =
    parseNodeTestResults(output);

  const testResults =
    parsedTestResults.results;

  const topLevelSubtestCount =
    (
      output.match(
        /^# Subtest: .+$/gm,
      ) ?? []
    ).length;

  const topLevelTestResults =
    testResults.filter(
      (result) =>
        result.indentation === 0,
    );

  const uniqueTestNumbers =
    new Set(
      topLevelTestResults.map(
        (result) =>
          result.testNumber,
      ),
    );

  const tapResultStructureValid =
    parsedTestResults.structureValid &&
    topLevelSubtestCount ===
      topLevelTestResults.length &&
    uniqueTestNumbers.size ===
      topLevelTestResults.length &&
    testResults.every(
      (result) =>
        result.declarationMatched,
    );

  const leafTestResults =
    testResults.filter(
      (result) =>
        !result.hasNestedScope &&
        singleDiagnosticValue(
          result.block,
          "type",
        ) !== "suite" &&
        singleDiagnosticValue(
          result.block,
          "failureType",
        ) !== "subtestsFailed",
    );

  const failedTestResults =
    leafTestResults.filter(
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
    leafTestResults,
    failedSubtests,
    failedTestResults,
    nestedTapPresent:
      parsedTestResults
        .nestedTapPresent,
    tapResultStructureValid:
      tapResultStructureValid &&
      (
        !parsedTestResults
          .nestedTapPresent ||
        (
          summary.tests ===
            leafTestResults.length &&
          summary.fail ===
            failedTestResults.length &&
          summary.pass ===
            leafTestResults.length -
              failedTestResults.length
        )
      ),
    assertionObserved,
    loadFailureObserved,
    hasCompleteSummary,
    testDiscovered,
    testExecuted,
  };
}


function containsUnsafeFailureSpecificContent(
  value,
) {
  return (
    /(?:^|[\s("'`])(?:file:\/\/\/|\/[^\s"'`]+|[A-Za-z]:[\\/][^\s"'`]+)/
      .test(value) ||
    /:\d+:\d+(?:$|[\s)])/u
      .test(value)
  );
}

function failureSpecificMessageFor(
  block,
) {
  const lines =
    block.split("\n");

  const errorHeaderIndexes = [];

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    if (
      /^  error:/.test(
        lines[index],
      )
    ) {
      errorHeaderIndexes.push(index);
    }
  }

  if (
    errorHeaderIndexes.length !== 1
  ) {
    return null;
  }

  const headerIndex =
    errorHeaderIndexes[0];

  const header =
    lines[headerIndex];

  const quotedMatch =
    /^  error: ['"]([^'"]+)['"]$/
      .exec(header);

  if (quotedMatch !== null) {
    return quotedMatch[1];
  }

  if (header !== "  error: |-") {
    return null;
  }

  const scalarLines = [];

  for (
    let index = headerIndex + 1;
    index < lines.length;
    index += 1
  ) {
    const line = lines[index];

    if (
      /^  [A-Za-z][A-Za-z0-9_]*:/
        .test(line) ||
      line === "  ..."
    ) {
      break;
    }

    if (!line.startsWith("    ")) {
      return null;
    }

    scalarLines.push(
      line.slice(4),
    );
  }

  if (scalarLines.length === 0) {
    return null;
  }

  const message =
    scalarLines
      .join("\n")
      .replace(/\n+$/u, "");

  return message.length === 0
    ? null
    : message;
}

function normalizeAssertionFailureMessage(
  message,
  code,
  block,
) {
  if (code !== "ERR_ASSERTION") {
    return message;
  }

  /*
   * Node 24 TAP separates a custom assert.* message from its
   * reporter-generated comparison text with an empty scalar
   * line. The same diagnostic block also carries explicit
   * actual: and expected: fields.
   *
   * Example:
   *
   *   error: |-
   *     semantic message
   *
   *     'actual' !== 'expected'
   *
   *   expected: 'expected'
   *   actual: 'actual'
   *
   * The comparison rendering is not stable preregistration
   * evidence. Keep only the semantic prefix before the separator.
   *
   * Requiring both actual and expected fields avoids changing
   * ordinary multiline assertion messages that merely contain
   * a blank line.
   */
  const hasActual =
    /^  actual:/m.test(block);

  const hasExpected =
    /^  expected:/m.test(block);

  if (!hasActual || !hasExpected) {
    return message;
  }

  const lines =
    message.split("\n");

  const separatorIndex =
    lines.findIndex(
      (line, index) =>
        index > 0 &&
        line === "",
    );

  if (
    separatorIndex === -1 ||
    separatorIndex ===
      lines.length - 1
  ) {
    return message;
  }

  const semantic =
    lines
      .slice(
        0,
        separatorIndex,
      )
      .join("\n")
      .replace(/\n+$/u, "");

  return semantic.length === 0
    ? null
    : semantic;
}


function failureSpecificFragmentsFor(
  failedTestResult,
) {
  const failureType =
    singleDiagnosticValue(
      failedTestResult.block,
      "failureType",
    );

  if (
    failureType !==
      "testCodeFailure"
  ) {
    return [];
  }

  const message =
    failureSpecificMessageFor(
      failedTestResult.block,
    );

  const code =
    singleDiagnosticValue(
      failedTestResult.block,
      "code",
    );

  const normalizedMessage =
    message === null
      ? null
      : normalizeAssertionFailureMessage(
          message,
          code,
          failedTestResult.block,
        );

  if (
    normalizedMessage === null ||
    normalizedMessage ===
      "test failed" ||
    containsUnsafeFailureSpecificContent(
      normalizedMessage,
    )
  ) {
    return [];
  }

  return [normalizedMessage];
}

function inspectionStructuralStatus(
  executionResult,
  evidence,
) {
  if (executionResult.timedOut) {
    return "EXECUTION_TIMEOUT";
  }

  if (
    executionResult.processErrorCode !==
      null
  ) {
    return "PROCESS_ERROR";
  }

  if (executionResult.signal !== null) {
    return "PROCESS_SIGNAL";
  }

  if (
    executionResult.stdoutTruncated ||
    executionResult.stderrTruncated
  ) {
    return "OUTPUT_TRUNCATED";
  }

  if (evidence.loadFailureObserved) {
    return "LOAD_FAILURE";
  }

  if (!evidence.tapVersionPresent) {
    return "TAP_VERSION_MISSING";
  }

  if (!evidence.hasCompleteSummary) {
    return "TAP_SUMMARY_INCOMPLETE";
  }

  if (!evidence.tapResultStructureValid) {
    return "TAP_STRUCTURE_INVALID";
  }

  return "COMPLETE";
}

function projectFailedLeaf(
  failedTestResult,
) {
  return {
    testName:
      failedTestResult.testName,

    failureType:
      singleDiagnosticValue(
        failedTestResult.block,
        "failureType",
      ),

    code:
      singleDiagnosticValue(
        failedTestResult.block,
        "code",
      ),

    operator:
      singleDiagnosticValue(
        failedTestResult.block,
        "operator",
      ),

    failureSpecificFragments:
      failureSpecificFragmentsFor(
        failedTestResult,
      ),
  };
}

/**
 * Read-only projection over the same structural node:test evidence
 * consumed by the production classifiers.
 *
 * No expected count, expected-failure matching, production outcome,
 * or Change Proof verdict is applied here.
 */
export function inspectNodeTestEvidence(
  executionResult,
) {
  validateExecutionResult(
    executionResult,
  );

  const evidence =
    collectNodeTestEvidence(
      executionResult,
    );

  const structuralStatus =
    inspectionStructuralStatus(
      executionResult,
      evidence,
    );

  return {
    framework: "node:test",

    structuralStatus,

    observedTestCount:
      Number.isSafeInteger(
        evidence.summary.tests,
      )
        ? evidence.summary.tests
        : null,

    summary: {
      tests: evidence.summary.tests,
      pass: evidence.summary.pass,
      fail: evidence.summary.fail,
      cancelled:
        evidence.summary.cancelled,
      skipped:
        evidence.summary.skipped,
      todo: evidence.summary.todo,
    },

    failedLeaves:
      structuralStatus === "COMPLETE"
        ? evidence.failedTestResults.map(
            projectFailedLeaf,
          )
        : [],
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

  return classifyNodeTestExecutionFromEvidence({
    executionResult,
    expectedTestCount,
    evidence,
  });
}

function classifyNodeTestExecutionFromEvidence({
  executionResult,
  expectedTestCount,
  evidence,
}) {
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
    !evidence.assertionObserved &&
    (
      !evidence.nestedTapPresent ||
      evidence.tapResultStructureValid
    );

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

  const classification =
    classifyNodeTestExecutionFromEvidence({
      executionResult,
      expectedTestCount,
      evidence,
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
