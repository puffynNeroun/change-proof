export const EVIDENCE_REPORT_SCHEMA_VERSION = "0.1";

const RAW_OUTPUT_KEYS = new Set([
  "output",
  "rawOutput",
  "raw_output",
  "stdout",
  "stderr",
]);

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireRecord(name, value) {
  if (!isRecord(value)) {
    throw new Error(
      `missing_report_input:${name}`,
    );
  }
}

function requireNonEmptyString(name, value) {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    throw new Error(
      `invalid_report_string:${name}`,
    );
  }
}

function requireStringArray(name, value) {
  if (!Array.isArray(value)) {
    throw new Error(
      `invalid_report_string_array:${name}`,
    );
  }

  for (const item of value) {
    if (typeof item !== "string") {
      throw new Error(
        `invalid_report_string_array:${name}`,
      );
    }
  }
}

function assertJsonValue(
  value,
  path,
  ancestors = new Set(),
) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(
        `non_json_value:${path}`,
      );
    }

    return;
  }

  if (
    typeof value !== "object" ||
    value === null
  ) {
    throw new Error(
      `non_json_value:${path}`,
    );
  }

  if (ancestors.has(value)) {
    throw new Error(
      `cyclic_json_value:${path}`,
    );
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      assertJsonValue(
        value[index],
        `${path}[${index}]`,
        ancestors,
      );
    }

    ancestors.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    ancestors.delete(value);

    throw new Error(
      `non_json_value:${path}`,
    );
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    if (RAW_OUTPUT_KEYS.has(key)) {
      ancestors.delete(value);

      throw new Error(
        `raw_output_field_forbidden:${path}.${key}`,
      );
    }

    assertJsonValue(
      nestedValue,
      `${path}.${key}`,
      ancestors,
    );
  }

  ancestors.delete(value);
}

function canonicalizeJsonValue(value) {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(
      (item) => canonicalizeJsonValue(item),
    );
  }

  const output = {};

  for (const key of Object.keys(value).sort()) {
    output[key] =
      canonicalizeJsonValue(value[key]);
  }

  return output;
}

function cloneReportSection(name, value) {
  requireRecord(name, value);
  assertJsonValue(value, `$.${name}`);

  return canonicalizeJsonValue(value);
}

function validateStates(states) {
  requireRecord("states", states);

  for (const stateName of [
    "stateA",
    "stateB",
    "stateC",
  ]) {
    requireRecord(
      `states.${stateName}`,
      states[stateName],
    );
  }
}

function validateTiming(timing) {
  requireRecord("timing", timing);

  requireNonEmptyString(
    "timing.startedAt",
    timing.startedAt,
  );

  if (
    typeof timing.durationMs !== "number" ||
    !Number.isFinite(timing.durationMs) ||
    timing.durationMs < 0
  ) {
    throw new Error(
      "invalid_report_duration:timing.durationMs",
    );
  }
}

/**
 * Builds the authoritative machine-readable evidence report.
 *
 * The caller supplies all runtime-derived values. This builder does not
 * read clocks, files, Git state, process output, or environment variables.
 */
export function buildEvidenceReport(input = {}) {
  const {
    schemaVersion =
      EVIDENCE_REPORT_SCHEMA_VERSION,

    toolVersion,
    expectationProvenance = null,
    repository,
    command,
    envelope,
    states,
    boundary,
    workspace,
    timing,
    verdict,
    reasons,
    limitations = [],
    warnings = [],
  } = input;

  requireNonEmptyString(
    "schemaVersion",
    schemaVersion,
  );

  requireNonEmptyString(
    "toolVersion",
    toolVersion,
  );

  requireNonEmptyString(
    "verdict",
    verdict,
  );

  requireStringArray("reasons", reasons);
  requireStringArray(
    "limitations",
    limitations,
  );
  requireStringArray("warnings", warnings);

  validateStates(states);
  validateTiming(timing);

  const report = {
    schemaVersion,
    toolVersion,

    expectationProvenance:
      expectationProvenance === null
        ? null
        : cloneReportSection(
            "expectationProvenance",
            expectationProvenance,
          ),

    repository:
      cloneReportSection(
        "repository",
        repository,
      ),

    command:
      cloneReportSection(
        "command",
        command,
      ),

    envelope:
      cloneReportSection(
        "envelope",
        envelope,
      ),

    timing:
      cloneReportSection(
        "timing",
        timing,
      ),

    states:
      cloneReportSection(
        "states",
        states,
      ),

    boundary:
      cloneReportSection(
        "boundary",
        boundary,
      ),

    workspace:
      cloneReportSection(
        "workspace",
        workspace,
      ),

    verdict,
    reasons: [...reasons],
    limitations: [...limitations],
    warnings: [...warnings],
  };

  assertJsonValue(report, "$");

  return report;
}

/**
 * Serializes a report into deterministic canonical JSON.
 */
export function serializeEvidenceReport(
  report,
  {
    space = 2,
  } = {},
) {
  requireRecord("report", report);

  if (
    !Number.isInteger(space) ||
    space < 0 ||
    space > 10
  ) {
    throw new Error(
      "invalid_report_json_space",
    );
  }

  assertJsonValue(report, "$");

  return (
    JSON.stringify(
      canonicalizeJsonValue(report),
      null,
      space,
    ) + "\n"
  );
}
