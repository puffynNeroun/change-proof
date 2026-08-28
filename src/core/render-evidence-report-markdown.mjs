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

function invalidReport(field) {
  throw new Error(`invalid_evidence_report:${field}`);
}

function requireRecord(field, value) {
  if (!isRecord(value)) {
    invalidReport(field);
  }
}

function requireString(field, value) {
  if (
    typeof value !== "string" ||
    value.length === 0
  ) {
    invalidReport(field);
  }
}

function requireStringArray(field, value) {
  if (
    !Array.isArray(value) ||
    value.some((item) => typeof item !== "string")
  ) {
    invalidReport(field);
  }
}

function rejectRawOutputFields(
  value,
  path = "report",
  ancestors = new Set(),
) {
  if (value === null || typeof value !== "object") {
    return;
  }

  if (ancestors.has(value)) {
    invalidReport(`${path}.cycle`);
  }

  ancestors.add(value);

  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      rejectRawOutputFields(
        item,
        `${path}[${index}]`,
        ancestors,
      ));
    ancestors.delete(value);
    return;
  }

  const prototype = Object.getPrototypeOf(value);

  if (
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    invalidReport(path);
  }

  for (const [key, item] of Object.entries(value)) {
    if (RAW_OUTPUT_KEYS.has(key)) {
      invalidReport(`${path}.${key}`);
    }

    rejectRawOutputFields(
      item,
      `${path}.${key}`,
      ancestors,
    );
  }

  ancestors.delete(value);
}

function validateState(name, state) {
  requireRecord(`states.${name}`, state);
  requireString(`states.${name}.outcome`, state.outcome);

  if (
    state.commitId !== null &&
    typeof state.commitId !== "string"
  ) {
    invalidReport(`states.${name}.commitId`);
  }

  if (
    state.reasonCode !== null &&
    typeof state.reasonCode !== "string"
  ) {
    invalidReport(`states.${name}.reasonCode`);
  }

  if (state.summary !== null) {
    requireRecord(`states.${name}.summary`, state.summary);

    for (const field of [
      "tests",
      "pass",
      "fail",
      "cancelled",
      "skipped",
      "todo",
    ]) {
      if (
        state.summary[field] !== null &&
        !Number.isSafeInteger(state.summary[field])
      ) {
        invalidReport(`states.${name}.summary.${field}`);
      }
    }
  }
}

function validateExpectationProvenance(value) {
  if (value === null) {
    return;
  }

  requireRecord(
    "expectationProvenance",
    value,
  );

  for (const field of [
    "source",
    "candidateSha256",
    "candidateContractVersion",
    "prepareToolVersion",
    "prepareConfigSha256",
    "repositoryContextSha256",
    "executionContractSha256",
    "envelopeSha256",
    "failureSetSha256",
  ]) {
    requireString(
      `expectationProvenance.${field}`,
      value[field],
    );
  }

  requireRecord(
    "expectationProvenance.resolvedCommits",
    value.resolvedCommits,
  );

  requireString(
    "expectationProvenance.resolvedCommits.base",
    value.resolvedCommits.base,
  );

  requireString(
    "expectationProvenance.resolvedCommits.head",
    value.resolvedCommits.head,
  );

  if (value.runtimeVerified !== true) {
    invalidReport(
      "expectationProvenance.runtimeVerified",
    );
  }
}

function validateReport(report) {
  requireRecord("report", report);
  rejectRawOutputFields(report);
  requireString("schemaVersion", report.schemaVersion);
  requireString("toolVersion", report.toolVersion);

  if (
    !Object.hasOwn(
      report,
      "expectationProvenance",
    )
  ) {
    invalidReport(
      "expectationProvenance",
    );
  }

  validateExpectationProvenance(
    report.expectationProvenance,
  );

  requireString("verdict", report.verdict);
  requireStringArray("reasons", report.reasons);
  requireStringArray("limitations", report.limitations);
  requireStringArray("warnings", report.warnings);

  requireRecord("repository", report.repository);
  requireString(
    "repository.baseCommitId",
    report.repository.baseCommitId,
  );
  requireString(
    "repository.headCommitId",
    report.repository.headCommitId,
  );
  requireStringArray(
    "repository.changedPaths",
    report.repository.changedPaths,
  );

  requireRecord("command", report.command);
  requireString("command.executable", report.command.executable);
  requireString(
    "command.workingDirectory",
    report.command.workingDirectory,
  );
  requireStringArray("command.arguments", report.command.arguments);

  requireRecord("envelope", report.envelope);
  requireStringArray(
    "envelope.requestedIncludedPaths",
    report.envelope.requestedIncludedPaths,
  );
  requireStringArray(
    "envelope.excludedChangedPaths",
    report.envelope.excludedChangedPaths,
  );

  requireRecord("states", report.states);
  validateState("stateA", report.states.stateA);
  validateState("stateB", report.states.stateB);
  validateState("stateC", report.states.stateC);

  requireRecord("boundary", report.boundary);
  for (const field of [
    "valid",
    "basedOnBase",
    "selectedPathsMatchHead",
    "unchangedPathsMatchBase",
  ]) {
    if (typeof report.boundary[field] !== "boolean") {
      invalidReport(`boundary.${field}`);
    }
  }

  requireRecord("workspace", report.workspace);
  if (
    typeof report.workspace.cleanupCompleted !== "boolean" ||
    typeof report.workspace.workspaceRemoved !== "boolean"
  ) {
    invalidReport("workspace");
  }

  for (const field of [
    "worktreesCreated",
    "worktreesRemoved",
  ]) {
    if (
      !Number.isSafeInteger(report.workspace[field]) ||
      report.workspace[field] < 0
    ) {
      invalidReport(`workspace.${field}`);
    }
  }
}

function inlineCode(value) {
  const text = JSON.stringify(value);
  const runs = text.match(/`+/g) ?? [];
  const fence = "`".repeat(
    Math.max(1, ...runs.map((run) => run.length + 1)),
  );

  return `${fence}${text}${fence}`;
}

function fencedJson(value) {
  const json = JSON.stringify(value, null, 2);
  const runs = json.match(/`+/g) ?? [];
  const fence = "`".repeat(
    Math.max(3, ...runs.map((run) => run.length + 1)),
  );

  return [fence + "json", json, fence];
}

function appendStringList(lines, values) {
  if (values.length === 0) {
    lines.push("- None.");
    return;
  }

  for (const value of values) {
    lines.push(`- ${value}`);
  }
}

function appendPathList(lines, values) {
  if (values.length === 0) {
    lines.push("- None.");
    return;
  }

  for (const value of values) {
    lines.push(`- ${inlineCode(value)}`);
  }
}

function appendState(lines, label, state) {
  lines.push(`### ${label}`, "");
  lines.push(`- Outcome: ${inlineCode(state.outcome)}`);
  lines.push(
    state.commitId === null
      ? "- Commit: not created."
      : `- Commit: ${inlineCode(state.commitId)}`,
  );

  if (state.reasonCode !== null) {
    lines.push(
      `- Classifier reason: ${inlineCode(state.reasonCode)}`,
    );
  }

  if (state.summary === null) {
    lines.push("- Summary: not available.");
  } else {
    const display = (value) =>
      value === null ? "unknown" : value;
    lines.push(
      "- Summary: " +
      [
        `tests=${display(state.summary.tests)}`,
        `pass=${display(state.summary.pass)}`,
        `fail=${display(state.summary.fail)}`,
        `cancelled=${display(state.summary.cancelled)}`,
        `skipped=${display(state.summary.skipped)}`,
        `todo=${display(state.summary.todo)}`,
      ].join(", ") +
      ".",
    );
  }

  lines.push("");
}

/**
 * Renders a deterministic human-readable projection of an EvidenceReport.
 */
export function renderEvidenceReportMarkdown(report) {
  validateReport(report);

  const lines = [
    "# Change Proof Evidence Report",
    "",
    "## Verdict",
    "",
    `**${report.verdict}**`,
    "",
  ];

  if (
    report.verdict ===
    "OBSERVED_TEST_DISCRIMINATION"
  ) {
    lines.push(
      "The explicitly selected head tests observed a behavioral difference against the exact base implementation.",
      "",
    );
  }

  lines.push("## Reasons", "");
  appendStringList(lines, report.reasons);

  lines.push(
    "",
    "## Expectation Provenance",
    "",
  );

  if (
    report.expectationProvenance === null
  ) {
    lines.push(
      "- Mode: manual preregistration.",
      "- Runtime provenance verification: not applicable.",
    );
  } else {
    lines.push(
      "- Mode: promoted prepare candidate.",
      "- Runtime provenance verification: VERIFIED.",
      `- Source: ${inlineCode(report.expectationProvenance.source)}`,
      `- Candidate SHA-256: ${inlineCode(report.expectationProvenance.candidateSha256)}`,
      `- Prepare config SHA-256: ${inlineCode(report.expectationProvenance.prepareConfigSha256)}`,
      `- Prepare tool version: ${inlineCode(report.expectationProvenance.prepareToolVersion)}`,
      `- Candidate contract version: ${inlineCode(report.expectationProvenance.candidateContractVersion)}`,
      `- Repository context SHA-256: ${inlineCode(report.expectationProvenance.repositoryContextSha256)}`,
      `- Resolved base: ${inlineCode(report.expectationProvenance.resolvedCommits.base)}`,
      `- Resolved head: ${inlineCode(report.expectationProvenance.resolvedCommits.head)}`,
      `- Execution contract SHA-256: ${inlineCode(report.expectationProvenance.executionContractSha256)}`,
      `- Envelope SHA-256: ${inlineCode(report.expectationProvenance.envelopeSha256)}`,
      `- Failure set SHA-256: ${inlineCode(report.expectationProvenance.failureSetSha256)}`,
    );
  }

  lines.push(
    "",
    "## Immutable Repository States",
    "",
    `- Base: ${inlineCode(report.repository.baseCommitId)}`,
    `- Head: ${inlineCode(report.repository.headCommitId)}`,
    "",
    "## Command",
    "",
  );
  lines.push(...fencedJson({
    executable: report.command.executable,
    arguments: [...report.command.arguments],
    workingDirectory: report.command.workingDirectory,
  }));
  lines.push(
    "",
    "## Requested Included Paths",
    "",
  );
  appendPathList(
    lines,
    report.envelope.requestedIncludedPaths,
  );
  lines.push(
    "",
    "## Excluded Changed Paths",
    "",
  );
  appendPathList(
    lines,
    report.envelope.excludedChangedPaths,
  );
  lines.push("", "## States", "");
  appendState(lines, "State A", report.states.stateA);
  appendState(lines, "State B", report.states.stateB);
  appendState(lines, "State C", report.states.stateC);
  lines.push(
    "## Boundary",
    "",
    `- Result: ${report.boundary.valid ? "VALID" : "INVALID"}.`,
    `- Based on exact base: ${report.boundary.basedOnBase === true ? "yes" : "no"}.`,
    `- Selected paths match head: ${report.boundary.selectedPathsMatchHead === true ? "yes" : "no"}.`,
    `- Unchanged paths match base: ${report.boundary.unchangedPathsMatchBase === true ? "yes" : "no"}.`,
    "",
    "## Cleanup",
    "",
    `- Result: ${report.workspace.cleanupCompleted ? "VERIFIED" : "NOT VERIFIED"}.`,
    `- Workspace removed: ${report.workspace.workspaceRemoved ? "yes" : "no"}.`,
    `- Worktrees created: ${report.workspace.worktreesCreated}.`,
    `- Worktrees removed: ${report.workspace.worktreesRemoved}.`,
    "",
    "## Limitations",
    "",
  );
  appendStringList(lines, report.limitations);
  lines.push("", "## Warnings", "");
  appendStringList(lines, report.warnings);

  return `${lines.join("\n")}\n`;
}
