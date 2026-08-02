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
