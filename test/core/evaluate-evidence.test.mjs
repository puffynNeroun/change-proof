import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateEvidence,
  VERDICTS,
} from "../../src/core/evaluate-evidence.mjs";

const state = (
  outcome = "PASS",
  invalidFailure = false,
) => ({
  outcome,
  invalidFailure,
});

const evidence = ({
  stateA = state(),
  stateB = state(),
  stateC = state("TEST_ASSERTION_FAILURE"),
  boundary = { valid: true },
} = {}) => ({
  stateA,
  stateB,
  stateC,
  boundary,
});

const scenarios = [
  {
    name:
      "operational error overrides every lower-precedence condition",

    input: evidence({
      stateA: state("FAIL", true),
      stateB: state("FAIL"),
      stateC: state("PASS"),
      boundary: { valid: false },
    }),

    expected: VERDICTS.OPERATIONAL_ERROR,
  },
  {
    name:
      "operational error in State B overrides a base failure",

    input: evidence({
      stateA: state("FAIL"),
      stateB: state("NOT_RUN", true),
      stateC: state("NOT_RUN"),
      boundary: { valid: false },
    }),

    expected: VERDICTS.OPERATIONAL_ERROR,
  },
  {
    name:
      "operational error in State C overrides positive evidence",

    input: evidence({
      stateC: state(
        "TEST_ASSERTION_FAILURE",
        true,
      ),
    }),

    expected: VERDICTS.OPERATIONAL_ERROR,
  },
  {
    name:
      "operational error overrides an exact expected test-failure set",

    input: evidence({
      stateC: state(
        "EXPECTED_TEST_FAILURE",
        true,
      ),
    }),

    expected: VERDICTS.OPERATIONAL_ERROR,
  },
  {
    name:
      "base failure overrides head, boundary, and State C evidence",

    input: evidence({
      stateA: state("FAIL"),
      stateB: state("FAIL"),
      stateC: state("TEST_ASSERTION_FAILURE"),
      boundary: { valid: false },
    }),

    expected: VERDICTS.BASE_FAILED,
  },
  {
    name:
      "head failure overrides boundary and State C evidence",

    input: evidence({
      stateA: state("PASS"),
      stateB: state("FAIL"),
      stateC: state("TEST_ASSERTION_FAILURE"),
      boundary: { valid: false },
    }),

    expected: VERDICTS.HEAD_FAILED,
  },
  {
    name:
      "invalid envelope overrides State C assertion evidence",

    input: evidence({
      stateC: state("TEST_ASSERTION_FAILURE"),
      boundary: { valid: false },
    }),

    expected: VERDICTS.INVALID_TEST_ENVELOPE,
  },
  {
    name:
      "invalid envelope overrides an exact expected test-failure set",

    input: evidence({
      stateC: state(
        "EXPECTED_TEST_FAILURE",
      ),
      boundary: { valid: false },
    }),

    expected: VERDICTS.INVALID_TEST_ENVELOPE,
  },
  {
    name:
      "expected assertion failure demonstrates discrimination",

    input: evidence({
      stateC: state("TEST_ASSERTION_FAILURE"),
      boundary: { valid: true },
    }),

    expected:
      VERDICTS.OBSERVED_TEST_DISCRIMINATION,
  },
  {
    name:
      "exact expected test-failure set demonstrates discrimination",

    input: evidence({
      stateC: state(
        "EXPECTED_TEST_FAILURE",
      ),
      boundary: { valid: true },
    }),

    expected:
      VERDICTS.OBSERVED_TEST_DISCRIMINATION,
  },
  {
    name:
      "State C pass demonstrates non-discriminating tests",

    input: evidence({
      stateC: state("PASS"),
      boundary: { valid: true },
    }),

    expected:
      VERDICTS.NON_DISCRIMINATING_TESTS,
  },
  {
    name:
      "unsupported State C outcome is inconclusive",

    input: evidence({
      stateC: state("INCONCLUSIVE"),
      boundary: { valid: true },
    }),

    expected: VERDICTS.INCONCLUSIVE,
  },
];

for (const scenario of scenarios) {
  test(scenario.name, () => {
    const actual = evaluateEvidence(
      scenario.input,
    );

    assert.equal(
      actual.verdict,
      scenario.expected,
    );

    assert.equal(typeof actual.reason, "string");
    assert.ok(actual.reason.length > 0);
  });
}

test(
  "all required evidence inputs are validated",
  () => {
    for (const name of [
      "stateA",
      "stateB",
      "stateC",
      "boundary",
    ]) {
      const input = evidence();

      input[name] = undefined;

      assert.throws(
        () => evaluateEvidence(input),
        {
          message:
            `missing_evidence_input:${name}`,
        },
      );
    }
  },
);

test(
  "the exact expected test-failure verdict has a non-assertion-specific reason",
  () => {
    const actual = evaluateEvidence(
      evidence({
        stateC: state(
          "EXPECTED_TEST_FAILURE",
        ),
      }),
    );

    assert.equal(
      actual.verdict,
      VERDICTS
        .OBSERVED_TEST_DISCRIMINATION,
    );
    assert.equal(
      actual.reason,
      "The selected head test produced the exact expected failure set against the exact base implementation.",
    );
  },
);

test(
  "missing top-level argument produces the stable validation error",
  () => {
    assert.throws(
      () => evaluateEvidence(),
      {
        message:
          "missing_evidence_input:stateA",
      },
    );
  },
);

test(
  "the evaluator does not mutate frozen evidence",
  () => {
    const input = evidence({
      stateA: Object.freeze(state()),
      stateB: Object.freeze(state()),
      stateC: Object.freeze(
        state("TEST_ASSERTION_FAILURE"),
      ),
      boundary: Object.freeze({
        valid: true,
        reasons: Object.freeze([]),
      }),
    });

    Object.freeze(input);

    const before = JSON.stringify(input);

    const actual = evaluateEvidence(input);

    assert.equal(
      actual.verdict,
      VERDICTS.OBSERVED_TEST_DISCRIMINATION,
    );

    assert.equal(
      JSON.stringify(input),
      before,
    );
  },
);

test(
  "identical evidence always produces identical output",
  () => {
    const input = evidence({
      stateC: state("PASS"),
    });

    const expected = evaluateEvidence(input);

    for (let index = 0; index < 100; index += 1) {
      assert.deepEqual(
        evaluateEvidence(input),
        expected,
      );
    }
  },
);

test(
  "result objects are independent between evaluations",
  () => {
    const first = evaluateEvidence(
      evidence({
        stateC: state("PASS"),
      }),
    );

    const second = evaluateEvidence(
      evidence({
        stateC: state("PASS"),
      }),
    );

    assert.notEqual(first, second);
    assert.deepEqual(first, second);
  },
);
