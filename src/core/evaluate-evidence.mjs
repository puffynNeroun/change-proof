export const VERDICTS = Object.freeze({
  OPERATIONAL_ERROR: "OPERATIONAL_ERROR",
  BASE_FAILED: "BASE_FAILED",
  HEAD_FAILED: "HEAD_FAILED",
  INVALID_TEST_ENVELOPE: "INVALID_TEST_ENVELOPE",
  OBSERVED_TEST_DISCRIMINATION:
    "OBSERVED_TEST_DISCRIMINATION",
  NON_DISCRIMINATING_TESTS:
    "NON_DISCRIMINATING_TESTS",
  INCONCLUSIVE: "INCONCLUSIVE",
});

const REASONS = Object.freeze({
  OPERATIONAL_ERROR:
    "A state encountered an execution or environment failure.",

  BASE_FAILED:
    "The exact base state did not pass its baseline tests.",

  HEAD_FAILED:
    "The exact head state did not pass its complete tests.",

  INVALID_TEST_ENVELOPE:
    "The State C commit or transferred test boundary is invalid.",

  OBSERVED_TEST_DISCRIMINATION:
    "The selected head test failed at the expected assertion against the exact base implementation.",

  NON_DISCRIMINATING_TESTS:
    "The selected head test also passed against the exact base implementation.",

  INCONCLUSIVE:
    "The evidence did not satisfy a supported discrimination or non-discrimination outcome.",
});

function requireEvidenceObject(name, value) {
  if (!value || typeof value !== "object") {
    throw new Error(`missing_evidence_input:${name}`);
  }
}

function result(verdict) {
  return {
    verdict,
    reason: REASONS[verdict],
  };
}

/**
 * Deterministically evaluates already-classified three-state evidence.
 *
 * This function is intentionally pure:
 *
 * - it performs no filesystem operations;
 * - it performs no Git operations;
 * - it executes no processes;
 * - it reads no environment variables;
 * - it has no knowledge of fixture paths;
 * - it does not mutate its inputs.
 */
export function evaluateEvidence(input = {}) {
  const {
    stateA,
    stateB,
    stateC,
    boundary,
  } = input;

  const requiredInputs = {
    stateA,
    stateB,
    stateC,
    boundary,
  };

  for (const [name, value] of Object.entries(requiredInputs)) {
    requireEvidenceObject(name, value);
  }

  const operationalFailure =
    stateA.invalidFailure === true ||
    stateB.invalidFailure === true ||
    stateC.invalidFailure === true;

  if (operationalFailure) {
    return result(VERDICTS.OPERATIONAL_ERROR);
  }

  if (stateA.outcome !== "PASS") {
    return result(VERDICTS.BASE_FAILED);
  }

  if (stateB.outcome !== "PASS") {
    return result(VERDICTS.HEAD_FAILED);
  }

  if (boundary.valid !== true) {
    return result(VERDICTS.INVALID_TEST_ENVELOPE);
  }

  if (stateC.outcome === "TEST_ASSERTION_FAILURE") {
    return result(
      VERDICTS.OBSERVED_TEST_DISCRIMINATION,
    );
  }

  if (stateC.outcome === "PASS") {
    return result(
      VERDICTS.NON_DISCRIMINATING_TESTS,
    );
  }

  return result(VERDICTS.INCONCLUSIVE);
}
