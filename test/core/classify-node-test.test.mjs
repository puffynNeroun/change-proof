import assert from "node:assert/strict";
import test from "node:test";

import {
  NODE_TEST_OUTCOMES,
  NODE_TEST_REASON_CODES,
  classifyExpectedNodeTestRegression,
  classifyNodeTestExecution,
} from "../../src/core/classify-node-test.mjs";

function execution(overrides = {}) {
  return {
    exitCode: 0,
    signal: null,
    timedOut: false,
    processErrorCode: null,

    stdout: "",
    stderr: "",

    stdoutTruncated: false,
    stderrTruncated: false,

    durationMs: 10,

    ...overrides,
  };
}

function passTap(count = 3) {
  return [
    "TAP version 13",
    `# tests ${count}`,
    `# pass ${count}`,
    "# fail 0",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "",
  ].join("\n");
}

function assertionTap({
  testName =
    "allows free shipping at the exact threshold",

  actualLine =
    "    false !== true",

  testCount = 3,
  passCount = 2,
  failCount = 1,
} = {}) {
  return [
    "TAP version 13",
    `# Subtest: ${testName}`,
    `not ok 2 - ${testName}`,
    actualLine,
    "  failureType: 'testCodeFailure'",
    "  code: 'ERR_ASSERTION'",
    `# tests ${testCount}`,
    `# pass ${passCount}`,
    `# fail ${failCount}`,
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "",
  ].join("\n");
}

function failureSetTap({
  failures,
  passCount = 0,
  cancelled = 0,
  skipped = 0,
  todo = 0,
}) {
  const lines = [
    "TAP version 13",
  ];

  let testNumber = 1;

  for (
    let index = 0;
    index < passCount;
    index += 1
  ) {
    const testName =
      `passing test ${index + 1}`;

    lines.push(
      `# Subtest: ${testName}`,
      `ok ${testNumber} - ${testName}`,
      "  ---",
      "  duration_ms: 1",
      "  type: 'test'",
      "  ...",
    );

    testNumber += 1;
  }

  for (const failure of failures) {
    lines.push(
      `# Subtest: ${failure.testName}`,
      `not ok ${testNumber} - ${failure.testName}`,
      "  ---",
      "  duration_ms: 1",
      "  type: 'test'",
      "  location: '/tmp/test.mjs:1:1'",
      `  failureType: '${failure.failureType ?? "testCodeFailure"}'`,
      `  error: '${failure.error ?? "expected failure"}'`,
      ...(failure.diagnosticLines ?? []),
      `  code: '${failure.code ?? "ERR_ASSERTION"}'`,
      ...(failure.extraLines ?? []),
      "  ...",
    );

    testNumber += 1;
  }

  const testCount =
    passCount + failures.length;

  lines.push(
    `1..${testCount}`,
    `# tests ${testCount}`,
    `# pass ${passCount}`,
    `# fail ${failures.length}`,
    `# cancelled ${cancelled}`,
    `# skipped ${skipped}`,
    `# todo ${todo}`,
    "",
  );

  return lines.join("\n");
}

function nestedSuiteLines({
  suiteName,
  suiteNumber,
  leaves,
}) {
  const lines = [
    `# Subtest: ${suiteName}`,
  ];

  for (
    let index = 0;
    index < leaves.length;
    index += 1
  ) {
    const leaf = leaves[index];
    const failed = leaf.failed === true;

    lines.push(
      `    # Subtest: ${leaf.testName}`,
      `    ${failed ? "not " : ""}ok ${index + 1} - ${leaf.testName}`,
      "      ---",
      "      duration_ms: 1",
      "      type: 'test'",
      ...(failed
        ? [
            "      failureType: 'testCodeFailure'",
            `      error: '${leaf.error ?? "expected failure"}'`,
            ...(leaf.diagnosticLines ?? []),
            `      code: '${leaf.code ?? "ERR_ASSERTION"}'`,
            ...(leaf.extraLines ?? []),
          ]
        : []),
      "      ...",
    );
  }

  const failedLeaves = leaves.filter(
    (leaf) => leaf.failed === true,
  );

  lines.push(
    `    1..${leaves.length}`,
    `${failedLeaves.length > 0 ? "not " : ""}ok ${suiteNumber} - ${suiteName}`,
    "  ---",
    "  duration_ms: 1",
    "  type: 'suite'",
    ...(failedLeaves.length > 0
      ? [
          "  failureType: 'subtestsFailed'",
          `  error: '${failedLeaves.length} subtests failed'`,
          "  code: 'ERR_TEST_FAILURE'",
        ]
      : []),
    "  ...",
  );

  return lines;
}

function nestedSuitesTap(suites) {
  const leaves = suites.flatMap(
    (suite) => suite.leaves,
  );
  const failedLeaves = leaves.filter(
    (leaf) => leaf.failed === true,
  );

  return [
    "TAP version 13",
    ...suites.flatMap(
      (suite, index) =>
        nestedSuiteLines({
          ...suite,
          suiteNumber: index + 1,
        }),
    ),
    `1..${suites.length}`,
    `# tests ${leaves.length}`,
    `# suites ${suites.length}`,
    `# pass ${leaves.length - failedLeaves.length}`,
    `# fail ${failedLeaves.length}`,
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "",
  ].join("\n");
}

function specificationFor(
  failure,
) {
  return {
    testName: failure.testName,
    outputIncludes:
      failure.outputIncludes ?? [
        `code: '${failure.code ?? "ERR_ASSERTION"}'`,
        failure.error ??
          "expected failure",
      ],
  };
}

function expectedFailure(
  overrides = {},
) {
  return {
    testName:
      "allows free shipping at the exact threshold",

    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "false !== true",
    ],

    ...overrides,
  };
}

test(
  "classifies a complete passing Node TAP execution",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: passTap(3),
          }),

        expectedTestCount: 3,
      });

    assert.deepEqual(
      result,
      {
        framework: "node:test",

        outcome:
          NODE_TEST_OUTCOMES.PASS,

        reasonCode:
          NODE_TEST_REASON_CODES.PASS,

        testDiscovered: true,
        testExecuted: true,
        assertionObserved: false,
        invalidFailure: false,

        tapVersionPresent: true,

        summary: {
          tests: 3,
          pass: 3,
          fail: 0,
          cancelled: 0,
          skipped: 0,
          todo: 0,
        },

        failedSubtests: [],
      },
    );
  },
);

test(
  "combines stdout and stderr for TAP classification",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout:
              "TAP version 13\n",

            stderr: [
              "# tests 1",
              "# pass 1",
              "# fail 0",
              "# cancelled 0",
              "# skipped 0",
              "# todo 0",
              "",
            ].join("\n"),
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.PASS,
    );
  },
);

test(
  "keeps a generic assertion failure inconclusive",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,
            stdout: assertionTap(),
          }),

        expectedTestCount: 3,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .ASSERTION_REQUIRES_EXPECTATION,
    );

    assert.equal(
      result.assertionObserved,
      true,
    );

    assert.equal(
      result.invalidFailure,
      false,
    );
  },
);

test(
  "classifies an exactly matched expected regression assertion",
  () => {
    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: assertionTap(),
          }),

        expectedTestCount: 3,
        expectedFailure:
          expectedFailure(),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .TEST_ASSERTION_FAILURE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_OBSERVED,
    );

    assert.equal(
      result.invalidFailure,
      false,
    );
  },
);

test(
  "rejects an assertion with the wrong failed test name",
  () => {
    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: assertionTap(),
          }),

        expectedTestCount: 3,

        expectedFailure:
          expectedFailure({
            testName:
              "different regression test",
          }),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
    );
  },
);

test(
  "rejects an assertion missing an expected output fragment",
  () => {
    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: assertionTap(),
          }),

        expectedTestCount: 3,

        expectedFailure:
          expectedFailure({
            outputIncludes: [
              "code: 'ERR_ASSERTION'",
              "unexpected fragment",
            ],
          }),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
    );
  },
);

test(
  "preserves PASS through expected-regression classification",
  () => {
    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            stdout: passTap(3),
          }),

        expectedTestCount: 3,
        expectedFailure:
          expectedFailure(),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.PASS,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES.PASS,
    );
  },
);

test(
  "classifies a syntax error as a load failure",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stdout: [
              "TAP version 13",
              "# SyntaxError: Unexpected token '}'",
              "# tests 1",
              "# pass 0",
              "# fail 1",
              "# cancelled 0",
              "# skipped 0",
              "# todo 0",
              "",
            ].join("\n"),
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .LOAD_FAILURE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .LOAD_FAILURE,
    );

    assert.equal(
      result.testDiscovered,
      false,
    );

    assert.equal(
      result.testExecuted,
      false,
    );

    assert.equal(
      result.invalidFailure,
      true,
    );
  },
);

test(
  "classifies a missing module as a load failure",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stderr:
              "Error [ERR_MODULE_NOT_FOUND]: Cannot find module",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .LOAD_FAILURE,
    );

    assert.equal(
      result.invalidFailure,
      true,
    );
  },
);

test(
  "gives timeout precedence over incomplete TAP",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,
            timedOut: true,

            stdout:
              "TAP version 13\n",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.TIMEOUT,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXECUTION_TIMEOUT,
    );

    assert.equal(
      result.invalidFailure,
      true,
    );
  },
);

test(
  "classifies a spawn error as process failure",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: null,

            processErrorCode:
              "ENOENT",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .PROCESS_FAILURE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .PROCESS_ERROR,
    );
  },
);

test(
  "classifies an unexpected process signal",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: null,
            signal: "SIGTERM",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .PROCESS_FAILURE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .PROCESS_SIGNAL,
    );
  },
);

test(
  "rejects truncated stdout as operationally incomplete",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: passTap(1),
            stdoutTruncated: true,
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .OPERATIONAL_ERROR,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .OUTPUT_TRUNCATED,
    );

    assert.equal(
      result.invalidFailure,
      true,
    );
  },
);

test(
  "rejects truncated stderr as operationally incomplete",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: passTap(1),
            stderrTruncated: true,
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .OPERATIONAL_ERROR,
    );
  },
);

test(
  "classifies output without TAP version as discovery failure",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stdout:
              "ordinary process output",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .TEST_DISCOVERY_FAILURE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .TAP_VERSION_MISSING,
    );
  },
);

test(
  "classifies an incomplete TAP summary as inconclusive",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stdout:
              "TAP version 13\n",
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .TAP_SUMMARY_INCOMPLETE,
    );

    assert.equal(
      result.invalidFailure,
      true,
    );
  },
);

test(
  "rejects an unexpected test count",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: passTap(2),
          }),

        expectedTestCount: 3,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .TEST_COUNT_MISMATCH,
    );
  },
);

test(
  "classifies a non-assertion non-zero test result as unsupported",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stdout: [
              "TAP version 13",
              "not ok 1 - ordinary failure",
              "# tests 1",
              "# pass 0",
              "# fail 1",
              "# cancelled 0",
              "# skipped 0",
              "# todo 0",
              "",
            ].join("\n"),
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .UNSUPPORTED_TEST_FAILURE,
    );
  },
);

test(
  "rejects inconsistent zero-exit TAP counts",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 0,

            stdout: [
              "TAP version 13",
              "# tests 1",
              "# pass 0",
              "# fail 1",
              "# cancelled 0",
              "# skipped 0",
              "# todo 0",
              "",
            ].join("\n"),
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .INCONCLUSIVE,
    );

    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .UNSUPPORTED_TAP_RESULT,
    );
  },
);

test(
  "uses the final TAP summary when multiple summaries appear",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: [
              passTap(1),
              passTap(3),
            ].join("\n"),
          }),

        expectedTestCount: 3,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.PASS,
    );

    assert.equal(
      result.summary.tests,
      3,
    );
  },
);

test(
  "collects failed subtest names in output order",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,

            stdout: [
              "TAP version 13",
              "not ok 1 - first failure",
              "not ok 2 - second failure",
              "  code: 'ERR_ASSERTION'",
              "# tests 2",
              "# pass 0",
              "# fail 2",
              "# cancelled 0",
              "# skipped 0",
              "# todo 0",
              "",
            ].join("\n"),
          }),

        expectedTestCount: 2,
      });

    assert.deepEqual(
      result.failedSubtests,
      [
        "first failure",
        "second failure",
      ],
    );
  },
);

test(
  "accepts deeply frozen execution evidence without mutation",
  () => {
    const executionResult =
      Object.freeze(
        execution({
          stdout: passTap(1),
        }),
      );

    const input =
      Object.freeze({
        executionResult,
        expectedTestCount: 1,
      });

    const before =
      JSON.stringify(input);

    const result =
      classifyNodeTestExecution(input);

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.PASS,
    );

    assert.equal(
      JSON.stringify(input),
      before,
    );
  },
);

test(
  "is deterministic for identical execution evidence",
  () => {
    const input = {
      executionResult:
        execution({
          stdout: passTap(3),
        }),

      expectedTestCount: 3,
    };

    const expected =
      classifyNodeTestExecution(
        input,
      );

    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      assert.deepEqual(
        classifyNodeTestExecution(
          input,
        ),
        expected,
      );
    }
  },
);

test(
  "returns independent summary and failed-subtest values",
  () => {
    const input = {
      executionResult:
        execution({
          exitCode: 1,
          stdout: assertionTap(),
        }),

      expectedTestCount: 3,
    };

    const first =
      classifyNodeTestExecution(
        input,
      );

    const second =
      classifyNodeTestExecution(
        input,
      );

    assert.notEqual(first, second);

    assert.notEqual(
      first.summary,
      second.summary,
    );

    assert.notEqual(
      first.failedSubtests,
      second.failedSubtests,
    );

    assert.deepEqual(first, second);
  },
);

test(
  "validates the expected test count",
  () => {
    for (const expectedTestCount of [
      undefined,
      null,
      0,
      -1,
      1.5,
    ]) {
      assert.throws(
        () =>
          classifyNodeTestExecution({
            executionResult:
              execution(),

            expectedTestCount,
          }),

        {
          message:
            "invalid_expected_test_count",
        },
      );
    }
  },
);

test(
  "validates the execution-result object",
  () => {
    for (const executionResult of [
      undefined,
      null,
      [],
      "execution",
    ]) {
      assert.throws(
        () =>
          classifyNodeTestExecution({
            executionResult,
            expectedTestCount: 1,
          }),

        {
          message:
            "invalid_execution_result",
        },
      );
    }
  },
);

test(
  "validates every execution-result field",
  () => {
    const invalidCases = [
      [
        "exitCode",
        "zero",
      ],
      [
        "signal",
        9,
      ],
      [
        "timedOut",
        "false",
      ],
      [
        "processErrorCode",
        5,
      ],
      [
        "stdout",
        null,
      ],
      [
        "stderr",
        null,
      ],
      [
        "stdoutTruncated",
        0,
      ],
      [
        "stderrTruncated",
        0,
      ],
      [
        "durationMs",
        -1,
      ],
    ];

    for (
      const [
        name,
        value,
      ] of invalidCases
    ) {
      assert.throws(
        () =>
          classifyNodeTestExecution({
            executionResult:
              execution({
                [name]: value,
              }),

            expectedTestCount: 1,
          }),

        {
          message:
            `invalid_execution_field:${name}`,
        },
      );
    }
  },
);

test(
  "validates the expected-failure object and test name",
  () => {
    for (const value of [
      undefined,
      null,
      [],
    ]) {
      assert.throws(
        () =>
          classifyExpectedNodeTestRegression({
            executionResult:
              execution({
                stdout: passTap(1),
              }),

            expectedTestCount: 1,
            expectedFailure: value,
          }),

        {
          message:
            "invalid_expected_failure",
        },
      );
    }

    for (const testName of [
      undefined,
      "",
      "bad\0name",
      "bad\nname",
    ]) {
      assert.throws(
        () =>
          classifyExpectedNodeTestRegression({
            executionResult:
              execution({
                stdout: passTap(1),
              }),

            expectedTestCount: 1,

            expectedFailure: {
              testName,
              outputIncludes: [],
            },
          }),

        {
          message:
            "invalid_expected_failure_test_name",
        },
      );
    }
  },
);

test(
  "validates expected-failure fragments",
  () => {
    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              stdout: passTap(1),
            }),

          expectedTestCount: 1,

          expectedFailure: {
            testName: "test",
            outputIncludes: null,
          },
        }),

      {
        message:
          "invalid_expected_failure_fragments",
      },
    );

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              stdout: passTap(1),
            }),

          expectedTestCount: 1,

          expectedFailure: {
            testName: "test",
            outputIncludes: [],
          },
        }),

      {
        message:
          "invalid_expected_failure_fragments",
      },
    );

    for (const fragment of [
      null,
      "",
      "bad\0fragment",
    ]) {
      assert.throws(
        () =>
          classifyExpectedNodeTestRegression({
            executionResult:
              execution({
                stdout: passTap(1),
              }),

            expectedTestCount: 1,

            expectedFailure: {
              testName: "test",

              outputIncludes: [
                fragment,
              ],
            },
          }),

        {
          message:
            "invalid_expected_failure_fragment",
        },
      );
    }

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              stdout: passTap(1),
            }),

          expectedTestCount: 1,

          expectedFailure: {
            testName: "test",

            outputIncludes: [
              "same",
              "same",
            ],
          },
        }),

      {
        message:
          "duplicate_expected_failure_fragment",
      },
    );
  },
);

test(
  "classifies an exact two-assertion failure set",
  () => {
    const failures = [
      {
        testName: "first assertion",
        diagnosticLines: [
          "    first actual value",
        ],
      },
      {
        testName: "second assertion",
        diagnosticLines: [
          "    second actual value",
        ],
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
              passCount: 2,
            }),
          }),
        expectedTestCount: 4,
        expectedFailures:
          failures.map(
            specificationFor,
          ),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .TEST_ASSERTION_FAILURE,
    );
    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_OBSERVED,
    );
  },
);

test(
  "classifies an exact mixed failure set",
  () => {
    const failures = [
      {
        testName: "assertion regression",
        diagnosticLines: [
          "    actual differs",
        ],
      },
      {
        testName: "expected thrown test failure",
        code: "ERR_TEST_FAILURE",
        error:
          "Unexpected command: pr checks 89 --watch",
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
              passCount: 1,
            }),
          }),
        expectedTestCount: 3,
        expectedFailures:
          failures.map(
            specificationFor,
          ),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .EXPECTED_TEST_FAILURE,
    );
    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_TEST_FAILURE_SET_OBSERVED,
    );
    assert.equal(
      result.invalidFailure,
      false,
    );
  },
);

test(
  "classifies the exact eight-failure pilot-shaped set",
  () => {
    const failures = [
      {
        testName:
          "collectPrWatchStatus handles immediately registered passing checks",
        diagnosticLines: [
          "    - 'passed'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "- 'passed'",
        ],
      },
      {
        testName:
          "collectPrWatchStatus reports persistent missing checks without starting watch",
        diagnosticLines: [
          "    + 'missing'",
          "    - 'not_registered'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "+ 'missing'",
          "- 'not_registered'",
        ],
      },
      {
        testName:
          "collectPrWatchStatus preserves failing final checks",
        diagnosticLines: [
          "    - 'failed'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "- 'failed'",
        ],
      },
      {
        testName:
          "collectPrWatchStatus preserves pending final checks",
        diagnosticLines: [
          "    - 'pending'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "- 'pending'",
        ],
      },
      {
        testName:
          "collectPrWatchStatus times out a bounded watch",
        diagnosticLines: [
          "    - 1234",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "- 1234",
        ],
      },
      {
        testName:
          "collectPrWatchStatus rejects a head change before watch",
        code: "ERR_TEST_FAILURE",
        error:
          "Unexpected command: pr checks 89 --watch",
        outputIncludes: [
          "code: 'ERR_TEST_FAILURE'",
          "Unexpected command: pr checks 89 --watch",
        ],
      },
      {
        testName:
          "collectPrWatchStatus rejects a head change after watch",
        diagnosticLines: [
          "    + 'passing'",
          "    - 'head_changed'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "+ 'passing'",
          "- 'head_changed'",
        ],
      },
      {
        testName:
          "collectPrWatchStatus classifies cancelled checks as failed",
        diagnosticLines: [
          "    - 'failed'",
        ],
        outputIncludes: [
          "code: 'ERR_ASSERTION'",
          "- 'failed'",
        ],
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
              passCount: 16,
            }),
          }),
        expectedTestCount: 24,
        expectedFailures:
          failures.map(
            specificationFor,
          ),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .EXPECTED_TEST_FAILURE,
    );
    assert.deepEqual(
      result.summary,
      {
        tests: 24,
        pass: 16,
        fail: 8,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      },
    );
  },
);

test(
  "rejects an expected failure count larger than the actual set",
  () => {
    const actual = {
      testName: "only actual failure",
    };

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures: [actual],
            }),
          }),
        expectedTestCount: 1,
        expectedFailures: [
          specificationFor(actual),
          specificationFor({
            testName: "missing failure",
          }),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects an unexpected extra failed test",
  () => {
    const failures = [
      { testName: "expected failure" },
      { testName: "unexpected failure" },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
            }),
          }),
        expectedTestCount: 2,
        expectedFailures: [
          specificationFor(failures[0]),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects a missing expected failed test",
  () => {
    const actualFailures = [
      { testName: "expected failure" },
      { testName: "different actual failure" },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures: actualFailures,
            }),
          }),
        expectedTestCount: 2,
        expectedFailures: [
          specificationFor(
            actualFailures[0],
          ),
          specificationFor({
            testName: "missing expected failure",
          }),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects duplicate expected test names",
  () => {
    const specification =
      specificationFor({
        testName: "duplicate",
      });

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              stdout: passTap(1),
            }),
          expectedTestCount: 1,
          expectedFailures: [
            specification,
            { ...specification },
          ],
        }),
      {
        message:
          "duplicate_expected_failure_test_name",
      },
    );
  },
);

test(
  "rejects empty, conflicting, and missing expected failure inputs",
  () => {
    const common = {
      executionResult:
        execution({
          stdout: passTap(1),
        }),
      expectedTestCount: 1,
    };

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          ...common,
          expectedFailures: [],
        }),
      { message: "empty_expected_failures" },
    );

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression({
          ...common,
          expectedFailure:
            expectedFailure(),
          expectedFailures: [
            expectedFailure(),
          ],
        }),
      {
        message:
          "conflicting_expected_failure_inputs",
      },
    );

    assert.throws(
      () =>
        classifyExpectedNodeTestRegression(
          common,
        ),
      {
        message:
          "missing_expected_failure_input",
      },
    );
  },
);

test(
  "does not match fragments from another failure block",
  () => {
    const failures = [
      {
        testName: "first failure",
        diagnosticLines: [
          "    fragment-for-second",
        ],
      },
      {
        testName: "second failure",
        diagnosticLines: [
          "    fragment-for-first",
        ],
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
            }),
          }),
        expectedTestCount: 2,
        expectedFailures: [
          {
            testName: "first failure",
            outputIncludes: [
              "fragment-for-first",
            ],
          },
          {
            testName: "second failure",
            outputIncludes: [
              "fragment-for-second",
            ],
          },
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects duplicate actual failed-test identities",
  () => {
    const failures = [
      { testName: "duplicate actual" },
      { testName: "duplicate actual" },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
            }),
          }),
        expectedTestCount: 2,
        expectedFailures: [
          specificationFor(failures[0]),
          specificationFor({
            testName: "other expected",
          }),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects orphan and ambiguous top-level TAP records",
  () => {
    const failure = {
      testName: "expected failure",
    };

    const validTap = failureSetTap({
      failures: [failure],
    });

    const orphanTap = validTap.replace(
      "1..1",
      [
        "# Subtest: orphan record",
        "    expected failure",
        "1..1",
      ].join("\n"),
    );

    const duplicateNumberTap =
      failureSetTap({
        failures: [
          failure,
          { testName: "other failure" },
        ],
      }).replace(
        "not ok 2 - other failure",
        "not ok 1 - other failure",
      );

    const cases = [
      {
        stdout: orphanTap,
        expectedTestCount: 1,
        expectedFailures: [
          specificationFor(failure),
        ],
      },
      {
        stdout: duplicateNumberTap,
        expectedTestCount: 2,
        expectedFailures: [
          specificationFor(failure),
          specificationFor({
            testName: "other failure",
          }),
        ],
      },
    ];

    for (const scenario of cases) {
      const result =
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              exitCode: 1,
              stdout: scenario.stdout,
            }),
          expectedTestCount:
            scenario.expectedTestCount,
          expectedFailures:
            scenario.expectedFailures,
        });

      assert.equal(
        result.outcome,
        NODE_TEST_OUTCOMES.INCONCLUSIVE,
      );
    }
  },
);

test(
  "rejects an exact-looking top-level runner failure",
  () => {
    const failure = {
      testName: "test/example.test.mjs",
      code: "ERR_TEST_FAILURE",
      error: "test failed",
      extraLines: [
        "  exitCode: 1",
        "  signal: ~",
      ],
    };

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures: [failure],
            }),
          }),
        expectedTestCount: 1,
        expectedFailures: [
          specificationFor(failure),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "rejects an exact-looking hook failure",
  () => {
    const failure = {
      testName: "test with failed hook",
      code: "ERR_TEST_FAILURE",
      failureType: "hookFailed",
      error: "beforeEach hook failed",
    };

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures: [failure],
            }),
          }),
        expectedTestCount: 1,
        expectedFailures: [
          specificationFor(failure),
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "keeps module, timeout, and truncation failures operational",
  () => {
    const expectedFailures = [
      specificationFor({
        testName: "operational failure",
      }),
    ];

    const cases = [
      execution({
        exitCode: 1,
        stderr:
          "Error [ERR_MODULE_NOT_FOUND]: Cannot find module",
      }),
      execution({
        exitCode: 1,
        timedOut: true,
        stdout: "TAP version 13\n",
      }),
      execution({
        exitCode: 1,
        stdout: failureSetTap({
          failures: [
            {
              testName:
                "operational failure",
            },
          ],
        }),
        stdoutTruncated: true,
      }),
    ];

    for (const executionResult of cases) {
      const result =
        classifyExpectedNodeTestRegression({
          executionResult,
          expectedTestCount: 1,
          expectedFailures,
        });

      assert.equal(
        result.invalidFailure,
        true,
      );
      assert.notEqual(
        result.outcome,
        NODE_TEST_OUTCOMES
          .EXPECTED_TEST_FAILURE,
      );
    }
  },
);

test(
  "rejects cancelled, skipped, and todo summary counts",
  () => {
    const failure = {
      testName: "expected failure",
    };

    for (const summaryKey of [
      "cancelled",
      "skipped",
      "todo",
    ]) {
      const result =
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              exitCode: 1,
              stdout: failureSetTap({
                failures: [failure],
                [summaryKey]: 1,
              }),
            }),
          expectedTestCount: 1,
          expectedFailures: [
            specificationFor(failure),
          ],
        });

      assert.equal(
        result.outcome,
        NODE_TEST_OUTCOMES.INCONCLUSIVE,
      );
    }
  },
);

test(
  "keeps a generic eight-test failure inconclusive",
  () => {
    const failures = Array.from(
      { length: 8 },
      (_, index) => ({
        testName:
          `generic failure ${index + 1}`,
      }),
    );

    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            exitCode: 1,
            stdout: failureSetTap({
              failures,
              passCount: 16,
            }),
          }),
        expectedTestCount: 24,
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .ASSERTION_REQUIRES_EXPECTATION,
    );
  },
);

test(
  "does not mutate frozen multi-failure input",
  () => {
    const failures = [
      { testName: "first failure" },
      {
        testName: "second failure",
        code: "ERR_TEST_FAILURE",
      },
    ];

    const executionResult =
      Object.freeze(
        execution({
          exitCode: 1,
          stdout: failureSetTap({
            failures,
          }),
        }),
      );

    const expectedFailures =
      Object.freeze(
        failures.map((failure) =>
          Object.freeze({
            ...specificationFor(
              failure,
            ),
            outputIncludes:
              Object.freeze([
                ...specificationFor(
                  failure,
                ).outputIncludes,
              ]),
          }),
        ),
      );

    const input = Object.freeze({
      executionResult,
      expectedTestCount: 2,
      expectedFailures,
    });

    const before = JSON.stringify(input);
    const result =
      classifyExpectedNodeTestRegression(
        input,
      );

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .EXPECTED_TEST_FAILURE,
    );
    assert.equal(
      JSON.stringify(input),
      before,
    );
  },
);

test(
  "classifies equivalent multi-failure inputs deterministically",
  () => {
    const failures = [
      { testName: "first failure" },
      { testName: "second failure" },
    ];

    const input = {
      executionResult:
        execution({
          exitCode: 1,
          stdout: failureSetTap({
            failures,
          }),
        }),
      expectedTestCount: 2,
      expectedFailures:
        failures.map(
          specificationFor,
        ),
    };

    const expected =
      classifyExpectedNodeTestRegression(
        input,
      );

    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      assert.deepEqual(
        classifyExpectedNodeTestRegression(
          input,
        ),
        expected,
      );
    }
  },
);

test(
  "classifies exact failing leaves in one nested suite and excludes its aggregate",
  () => {
    const leaves = [
      {
        testName: "passing leaf",
      },
      {
        testName: "first failing leaf",
        failed: true,
        error: "first mismatch",
        diagnosticLines: [
          "        first leaf output",
        ],
      },
      {
        testName: "second failing leaf",
        failed: true,
        code: "ERR_TEST_FAILURE",
        error: "second expected failure",
        diagnosticLines: [
          "        second leaf output",
        ],
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: nestedSuitesTap([
              {
                suiteName: "parent suite",
                leaves,
              },
            ]),
          }),
        expectedTestCount: 3,
        expectedFailures: [
          {
            testName: "first failing leaf",
            outputIncludes: [
              "first leaf output",
              "code: 'ERR_ASSERTION'",
            ],
          },
          {
            testName: "second failing leaf",
            outputIncludes: [
              "second leaf output",
              "code: 'ERR_TEST_FAILURE'",
            ],
          },
        ],
      });

    assert.deepEqual(result, {
      framework: "node:test",
      outcome:
        NODE_TEST_OUTCOMES
          .EXPECTED_TEST_FAILURE,
      reasonCode:
        NODE_TEST_REASON_CODES
          .EXPECTED_TEST_FAILURE_SET_OBSERVED,
      testDiscovered: true,
      testExecuted: true,
      assertionObserved: true,
      invalidFailure: false,
      tapVersionPresent: true,
      summary: {
        tests: 3,
        pass: 1,
        fail: 2,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      },
      failedSubtests: [
        "first failing leaf",
        "second failing leaf",
      ],
    });
  },
);

test(
  "classifies the exact four project-forge CLI leaves",
  () => {
    const leaves = [
      {
        testName:
          "prints version with --version",
        failed: true,
        error: "long version mismatch",
      },
      {
        testName:
          "prints version with -V",
        failed: true,
        error: "short version mismatch",
      },
      {
        testName:
          "rejects --version with an extra argument",
        failed: true,
        code: "ERR_TEST_FAILURE",
        error: "extra argument was accepted",
      },
      {
        testName:
          "rejects --version on the new command",
        failed: true,
        error: "new command accepted version",
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: nestedSuitesTap([
              {
                suiteName:
                  "project-forge CLI",
                leaves,
              },
            ]),
          }),
        expectedTestCount: 4,
        expectedFailures:
          leaves.map(
            specificationFor,
          ),
      });

    assert.deepEqual(result, {
      framework: "node:test",
      outcome:
        NODE_TEST_OUTCOMES
          .EXPECTED_TEST_FAILURE,
      reasonCode:
        NODE_TEST_REASON_CODES
          .EXPECTED_TEST_FAILURE_SET_OBSERVED,
      testDiscovered: true,
      testExecuted: true,
      assertionObserved: true,
      invalidFailure: false,
      tapVersionPresent: true,
      summary: {
        tests: 4,
        pass: 0,
        fail: 4,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      },
      failedSubtests: leaves.map(
        (leaf) => leaf.testName,
      ),
    });
  },
);

test(
  "rejects an aggregate nested suite configured as the expected failure",
  () => {
    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: nestedSuitesTap([
              {
                suiteName: "parent suite",
                leaves: [
                  {
                    testName: "actual leaf",
                    failed: true,
                  },
                ],
              },
            ]),
          }),
        expectedTestCount: 1,
        expectedFailures: [
          {
            testName: "parent suite",
            outputIncludes: [
              "subtestsFailed",
            ],
          },
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
    );
    assert.deepEqual(
      result.failedSubtests,
      ["actual leaf"],
    );
  },
);

test(
  "rejects missing and additional nested failing leaves",
  () => {
    const leaves = [
      {
        testName: "expected leaf",
        failed: true,
      },
      {
        testName: "additional leaf",
        failed: true,
      },
    ];
    const common = {
      executionResult:
        execution({
          exitCode: 1,
          stdout: nestedSuitesTap([
            {
              suiteName: "parent suite",
              leaves,
            },
          ]),
        }),
      expectedTestCount: 2,
    };

    const cases = [
      [specificationFor(leaves[0])],
      [
        specificationFor(leaves[0]),
        specificationFor({
          testName: "missing leaf",
        }),
      ],
    ];

    for (const expectedFailures of cases) {
      const result =
        classifyExpectedNodeTestRegression({
          ...common,
          expectedFailures,
        });

      assert.equal(
        result.outcome,
        NODE_TEST_OUTCOMES.INCONCLUSIVE,
      );
      assert.equal(
        result.reasonCode,
        NODE_TEST_REASON_CODES
          .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
      );
    }
  },
);

test(
  "does not match a nested leaf fragment from its sibling",
  () => {
    const leaves = [
      {
        testName: "first leaf",
        failed: true,
        diagnosticLines: [
          "        fragment-for-second",
        ],
      },
      {
        testName: "second leaf",
        failed: true,
        diagnosticLines: [
          "        fragment-for-first",
        ],
      },
    ];

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout: nestedSuitesTap([
              {
                suiteName: "parent suite",
                leaves,
              },
            ]),
          }),
        expectedTestCount: 2,
        expectedFailures: [
          {
            testName: "first leaf",
            outputIncludes: [
              "fragment-for-first",
            ],
          },
          {
            testName: "second leaf",
            outputIncludes: [
              "fragment-for-second",
            ],
          },
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
  },
);

test(
  "preserves deterministic failed-leaf order across two nested suites",
  () => {
    const suites = [
      {
        suiteName: "first suite",
        leaves: [
          {
            testName: "first suite leaf",
            failed: true,
          },
        ],
      },
      {
        suiteName: "second suite",
        leaves: [
          {
            testName: "passing sibling",
          },
          {
            testName: "second suite leaf",
            failed: true,
          },
        ],
      },
    ];
    const failures = suites.flatMap(
      (suite) =>
        suite.leaves.filter(
          (leaf) => leaf.failed === true,
        ),
    );

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout:
              nestedSuitesTap(suites),
          }),
        expectedTestCount: 3,
        expectedFailures:
          failures.map(
            specificationFor,
          ),
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .TEST_ASSERTION_FAILURE,
    );
    assert.deepEqual(
      result.failedSubtests,
      [
        "first suite leaf",
        "second suite leaf",
      ],
    );
  },
);

test(
  "classifies only the terminal failure in a deeper nested suite",
  () => {
    const stdout = [
      "TAP version 13",
      "# Subtest: outer suite",
      "    # Subtest: inner suite",
      "        # Subtest: deep failing leaf",
      "        not ok 1 - deep failing leaf",
      "          ---",
      "          type: 'test'",
      "          failureType: 'testCodeFailure'",
      "          error: 'deep mismatch'",
      "          code: 'ERR_ASSERTION'",
      "          ...",
      "        1..1",
      "    not ok 1 - inner suite",
      "      ---",
      "      type: 'suite'",
      "      failureType: 'subtestsFailed'",
      "      error: '1 subtest failed'",
      "      code: 'ERR_TEST_FAILURE'",
      "      ...",
      "    1..1",
      "not ok 1 - outer suite",
      "  ---",
      "  type: 'suite'",
      "  failureType: 'subtestsFailed'",
      "  error: '1 subtest failed'",
      "  code: 'ERR_TEST_FAILURE'",
      "  ...",
      "1..1",
      "# tests 1",
      "# suites 2",
      "# pass 0",
      "# fail 1",
      "# cancelled 0",
      "# skipped 0",
      "# todo 0",
      "",
    ].join("\n");

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout,
          }),
        expectedTestCount: 1,
        expectedFailures: [
          {
            testName:
              "deep failing leaf",
            outputIncludes: [
              "deep mismatch",
            ],
          },
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES
        .TEST_ASSERTION_FAILURE,
    );
    assert.deepEqual(
      result.failedSubtests,
      ["deep failing leaf"],
    );
  },
);

test(
  "rejects duplicate identities and nested hook or runner failures",
  () => {
    const duplicateTap = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves: [
          {
            testName: "duplicate leaf",
            failed: true,
          },
          {
            testName: "duplicate leaf",
            failed: true,
          },
        ],
      },
    ]);
    const hookTap = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves: [
          {
            testName: "hooked leaf",
            failed: true,
            code: "ERR_TEST_FAILURE",
            error: "beforeEach hook failed",
          },
        ],
      },
    ]).replace(
      "failureType: 'testCodeFailure'",
      "failureType: 'hookFailed'",
    );
    const runnerTap = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves: [
          {
            testName: "test/example.test.mjs",
            failed: true,
            code: "ERR_TEST_FAILURE",
            error: "test failed",
            extraLines: [
              "      exitCode: 1",
              "      signal: ~",
            ],
          },
        ],
      },
    ]);
    const cases = [
      {
        stdout: duplicateTap,
        expectedTestCount: 2,
        expectedFailures: [
          specificationFor({
            testName: "duplicate leaf",
          }),
          specificationFor({
            testName: "other leaf",
          }),
        ],
      },
      {
        stdout: hookTap,
        expectedTestCount: 1,
        expectedFailures: [
          {
            testName: "hooked leaf",
            outputIncludes: [
              "beforeEach hook failed",
            ],
          },
        ],
      },
      {
        stdout: runnerTap,
        expectedTestCount: 1,
        expectedFailures: [
          {
            testName:
              "test/example.test.mjs",
            outputIncludes: [
              "error: 'test failed'",
            ],
          },
        ],
      },
    ];

    for (const scenario of cases) {
      const result =
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              exitCode: 1,
              stdout: scenario.stdout,
            }),
          expectedTestCount:
            scenario.expectedTestCount,
          expectedFailures:
            scenario.expectedFailures,
        });

      assert.equal(
        result.outcome,
        NODE_TEST_OUTCOMES.INCONCLUSIVE,
      );
    }
  },
);

test(
  "does not treat an aggregate-only nested failure as behavioral evidence",
  () => {
    const stdout = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves: [
          {
            testName: "passing leaf",
          },
        ],
      },
    ])
      .replace(
        "ok 1 - parent suite",
        "not ok 1 - parent suite",
      )
      .replace(
        "  ...\n1..1",
        [
          "  failureType: 'subtestsFailed'",
          "  error: '1 subtest failed'",
          "  code: 'ERR_TEST_FAILURE'",
          "  ...",
          "1..1",
        ].join("\n"),
      )
      .replace("# pass 1", "# pass 0")
      .replace("# fail 0", "# fail 1");

    const result =
      classifyExpectedNodeTestRegression({
        executionResult:
          execution({
            exitCode: 1,
            stdout,
          }),
        expectedTestCount: 1,
        expectedFailures: [
          {
            testName: "passing leaf",
            outputIncludes: [
              "ERR_ASSERTION",
            ],
          },
        ],
      });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
    assert.deepEqual(result.failedSubtests, []);
  },
);

test(
  "fails closed for malformed nested indentation, plans, numbering, and diagnostics",
  () => {
    const leaves = [
      {
        testName: "passing leaf",
      },
      {
        testName: "first failing leaf",
        failed: true,
      },
      {
        testName: "second failing leaf",
        failed: true,
      },
    ];
    const validTap = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves,
      },
    ]);
    const expectedFailures = leaves
      .filter((leaf) => leaf.failed)
      .map(specificationFor);
    const malformedTaps = [
      validTap.replace(
        "    # Subtest: first failing leaf",
        "  # Subtest: first failing leaf",
      ),
      validTap.replace(
        "not ok 3 - second failing leaf",
        "not ok 2 - second failing leaf",
      ),
      validTap.replace("    1..3\n", ""),
      validTap.replace(
        "    1..3",
        "    1..3\n    1..3",
      ),
      validTap.replace("    1..3", "    1..2"),
      validTap.replace(
        "# Subtest: parent suite",
        "  ---\n  ...\n# Subtest: parent suite",
      ),
    ];

    for (const stdout of malformedTaps) {
      const result =
        classifyExpectedNodeTestRegression({
          executionResult:
            execution({
              exitCode: 1,
              stdout,
            }),
          expectedTestCount: 3,
          expectedFailures,
        });

      assert.equal(
        result.outcome,
        NODE_TEST_OUTCOMES.INCONCLUSIVE,
      );
      assert.equal(
        result.reasonCode,
        NODE_TEST_REASON_CODES
          .EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED,
      );
    }
  },
);

test(
  "keeps nested classification immutable and deterministic",
  () => {
    const leaf = {
      testName: "nested failure",
      failed: true,
    };
    const executionResult = Object.freeze(
      execution({
        exitCode: 1,
        stdout: nestedSuitesTap([
          {
            suiteName: "parent suite",
            leaves: [leaf],
          },
        ]),
      }),
    );
    const expectedFailures = Object.freeze([
      Object.freeze({
        testName: leaf.testName,
        outputIncludes: Object.freeze([
          "code: 'ERR_ASSERTION'",
        ]),
      }),
    ]);
    const input = Object.freeze({
      executionResult,
      expectedTestCount: 1,
      expectedFailures,
    });
    const before = JSON.stringify(input);
    const expected =
      classifyExpectedNodeTestRegression(
        input,
      );

    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      assert.deepEqual(
        classifyExpectedNodeTestRegression(
          input,
        ),
        expected,
      );
    }

    assert.equal(JSON.stringify(input), before);
  },
);

test(
  "does not classify malformed passing nested TAP as PASS",
  () => {
    const stdout = nestedSuitesTap([
      {
        suiteName: "parent suite",
        leaves: [
          {
            testName: "passing leaf",
          },
        ],
      },
    ]).replace("    1..1\n", "");

    const result = classifyNodeTestExecution({
      executionResult: execution({ stdout }),
      expectedTestCount: 1,
    });

    assert.equal(
      result.outcome,
      NODE_TEST_OUTCOMES.INCONCLUSIVE,
    );
    assert.equal(
      result.reasonCode,
      NODE_TEST_REASON_CODES
        .UNSUPPORTED_TAP_RESULT,
    );
  },
);

test(
  "does not expose raw process output in classification evidence",
  () => {
    const result =
      classifyNodeTestExecution({
        executionResult:
          execution({
            stdout: passTap(1),
          }),

        expectedTestCount: 1,
      });

    assert.equal(
      Object.hasOwn(
        result,
        "stdout",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result,
        "stderr",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result,
        "output",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result,
        "verdict",
      ),
      false,
    );
  },
);
