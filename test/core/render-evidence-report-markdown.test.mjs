import assert from "node:assert/strict";
import test from "node:test";

import {
  renderEvidenceReportMarkdown,
} from "../../src/core/render-evidence-report-markdown.mjs";

const baseCommitId = "a".repeat(40);
const headCommitId = "b".repeat(40);

function state(commitId, outcome, summary) {
  return {
    commitId,
    framework: "node:test",
    outcome,
    reasonCode: outcome === "PASS"
      ? "COMPLETE_PASS"
      : "EXPECTED_TEST_FAILURE_SET_OBSERVED",
    invalidFailure: false,
    summary,
    execution: {
      exitCode: outcome === "PASS" ? 0 : 1,
      durationMs: 12,
    },
  };
}

function sampleReport() {
  return {
    schemaVersion: "0.1",
    toolVersion: "test-version",
expectationProvenance: null,
    repository: {
      baseCommitId,
      headCommitId,
      changedPaths: ["src/value.mjs", "test/value.test.mjs"],
    },
    command: {
      executable: "/usr/bin/node",
      arguments: [
        "--test",
        "--test-reporter=tap",
        "test/value.test.mjs",
      ],
      workingDirectory: ".",
    },
    envelope: {
      requestedIncludedPaths: ["test/value.test.mjs"],
      excludedChangedPaths: ["src/value.mjs"],
    },
    states: {
      stateA: state(baseCommitId, "PASS", {
        tests: 1,
        pass: 1,
        fail: 0,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      }),
      stateB: state(headCommitId, "PASS", {
        tests: 2,
        pass: 2,
        fail: 0,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      }),
      stateC: state(
        baseCommitId,
        "EXPECTED_TEST_FAILURE",
        {
          tests: 2,
          pass: 1,
          fail: 1,
          cancelled: 0,
          skipped: 0,
          todo: 0,
        },
      ),
    },
    boundary: {
      valid: true,
      basedOnBase: true,
      selectedPathsMatchHead: true,
      unchangedPathsMatchBase: true,
    },
    workspace: {
      cleanupCompleted: true,
      workspaceRemoved: true,
      worktreesCreated: 3,
      worktreesRemoved: 3,
    },
    verdict: "OBSERVED_TEST_DISCRIMINATION",
    reasons: ["Exact expected failure observed."],
    limitations: [
      "The result does not prove implementation correctness.",
      "Worktrees are not a security sandbox.",
    ],
    warnings: ["Trusted local code was executed."],
  };
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const item of Object.values(value)) {
      deepFreeze(item);
    }
  }

  return value;
}

test("renders deterministically with exactly one final LF", () => {
  const report = sampleReport();
  const first = renderEvidenceReportMarkdown(report);
  const second = renderEvidenceReportMarkdown(report);

  assert.equal(first, second);
  assert.equal(first.endsWith("\n"), true);
  assert.equal(first.endsWith("\n\n"), false);
});

test("projects verdict, identities, command, envelope, and states", () => {
  const markdown = renderEvidenceReportMarkdown(sampleReport());

  for (const expected of [
    "# Change Proof Evidence Report",
    "OBSERVED_TEST_DISCRIMINATION",
    "Exact expected failure observed.",
    baseCommitId,
    headCommitId,
    "/usr/bin/node",
    "--test-reporter=tap",
    "test/value.test.mjs",
    "src/value.mjs",
    "### State A",
    "### State B",
    "### State C",
    "EXPECTED_TEST_FAILURE",
    "tests=2, pass=1, fail=1",
  ]) {
    assert.equal(markdown.includes(expected), true, expected);
  }
});

test("projects boundary, cleanup, limitations, and warnings", () => {
  const markdown = renderEvidenceReportMarkdown(sampleReport());

  for (const expected of [
    "Result: VALID.",
    "Based on exact base: yes.",
    "Selected paths match head: yes.",
    "Unchanged paths match base: yes.",
    "Result: VERIFIED.",
    "Workspace removed: yes.",
    "Worktrees created: 3.",
    "Worktrees removed: 3.",
    "The result does not prove implementation correctness.",
    "Trusted local code was executed.",
  ]) {
    assert.equal(markdown.includes(expected), true, expected);
  }
});

test("does not expose raw output, temporary paths, or overclaims", () => {
  const report = {
    ...sampleReport(),
    ignoredSecret: "RAW_STDOUT_SECRET",
    ignoredOwnedPath:
      "/tmp/change-proof-owned/state-c",
  };
  const markdown = renderEvidenceReportMarkdown(report);

  for (const forbidden of [
    "RAW_STDOUT_SECRET",
    "/tmp/change-proof-owned/state-c",
    "proves implementation correctness",
    "proves complete-change correctness",
    "complete test relevance is proven",
    "AI proof",
    "general causality is proven",
    "production sufficiency is proven",
  ]) {
    assert.equal(markdown.includes(forbidden), false, forbidden);
  }

  assert.equal(
    markdown.includes(
      "The explicitly selected head tests observed a behavioral difference against the exact base implementation.",
    ),
    true,
  );
});

test("does not mutate a deeply frozen report", () => {
  const report = deepFreeze(sampleReport());
  const before = JSON.stringify(report);

  assert.doesNotThrow(() =>
    renderEvidenceReportMarkdown(report));
  assert.equal(JSON.stringify(report), before);
});

test("rejects malformed report inputs explicitly", async (suite) => {
  for (const [name, mutate] of [
    ["missing report", () => null],
    ["missing repository", (report) => {
      report.repository = null;
      return report;
    }],
    ["missing state", (report) => {
      report.states.stateC = null;
      return report;
    }],
    ["invalid summary", (report) => {
      report.states.stateA.summary.tests = "one";
      return report;
    }],
    ["invalid boundary", (report) => {
      report.boundary.valid = "yes";
      return report;
    }],
    ["incomplete boundary", (report) => {
      delete report.boundary.basedOnBase;
      return report;
    }],
    ["invalid cleanup", (report) => {
      report.workspace.cleanupCompleted = "yes";
      return report;
    }],
    ["incomplete cleanup", (report) => {
      delete report.workspace.worktreesRemoved;
      return report;
    }],
    ["invalid reasons", (report) => {
      report.reasons = [1];
      return report;
    }],
  ]) {
    await suite.test(name, () => {
      const report = mutate(sampleReport());

      assert.throws(
        () => renderEvidenceReportMarkdown(report),
        /invalid_evidence_report:/,
      );
    });
  }
});

test("rejects cyclic and non-plain report values", async (suite) => {
  await suite.test("cyclic", () => {
    const report = sampleReport();
    report.cycle = report;

    assert.throws(
      () => renderEvidenceReportMarkdown(report),
      /invalid_evidence_report:/,
    );
  });

  await suite.test("non-plain", () => {
    const report = sampleReport();
    report.extra = new Date(0);

    assert.throws(
      () => renderEvidenceReportMarkdown(report),
      /invalid_evidence_report:/,
    );
  });
});

test("rejects raw stdout and stderr fields", async (suite) => {
  for (const field of ["stdout", "stderr", "rawOutput"]) {
    await suite.test(field, () => {
      const report = sampleReport();
      report.states.stateC.execution[field] = "secret";

      assert.throws(
        () => renderEvidenceReportMarkdown(report),
        /invalid_evidence_report:/,
      );
    });
  }
});

function promotedProvenance() {
  return {
    source:
      "change-proof.prepare-candidate",
    candidateSha256:
      "11".repeat(32),
    candidateContractVersion:
      "0.1",
    prepareToolVersion:
      "0.1.0-beta.1",
    prepareConfigSha256:
      "22".repeat(32),
    repositoryContextSha256:
      "33".repeat(32),
    resolvedCommits: {
      base: "a".repeat(40),
      head: "b".repeat(40),
    },
    executionContractSha256:
      "44".repeat(32),
    envelopeSha256:
      "55".repeat(32),
    failureSetSha256:
      "66".repeat(32),
    runtimeVerified: true,
  };
}

test(
  "renders explicit manual preregistration provenance mode",
  () => {
    const markdown =
      renderEvidenceReportMarkdown(
        sampleReport(),
      );

    assert.match(
      markdown,
      /## Expectation Provenance/u,
    );

    assert.match(
      markdown,
      /Mode: manual preregistration\./u,
    );

    assert.match(
      markdown,
      /Runtime provenance verification: not applicable\./u,
    );
  },
);

test(
  "renders verified promoted expectation provenance",
  () => {
    const report = sampleReport();

    report.expectationProvenance =
      promotedProvenance();

    const markdown =
      renderEvidenceReportMarkdown(
        report,
      );

    for (const value of [
      "Mode: promoted prepare candidate.",
      "Runtime provenance verification: VERIFIED.",
      report.expectationProvenance
        .candidateSha256,
      report.expectationProvenance
        .prepareConfigSha256,
      report.expectationProvenance
        .repositoryContextSha256,
      report.expectationProvenance
        .executionContractSha256,
      report.expectationProvenance
        .envelopeSha256,
      report.expectationProvenance
        .failureSetSha256,
    ]) {
      assert.equal(
        markdown.includes(value),
        true,
        value,
      );
    }
  },
);

test(
  "rejects unverified promoted provenance",
  () => {
    const report = sampleReport();

    report.expectationProvenance =
      promotedProvenance();

    report.expectationProvenance
      .runtimeVerified = false;

    assert.throws(
      () =>
        renderEvidenceReportMarkdown(
          report,
        ),
      /invalid_evidence_report:expectationProvenance\.runtimeVerified/u,
    );
  },
);
