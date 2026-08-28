import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test(
  "report provenance is projection-only and does not alter evidence evaluation",
  async () => {
    const runner =
      await readFile(
        new URL(
          "../../src/core/run-change-proof.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const builder =
      await readFile(
        new URL(
          "../../src/core/build-evidence-report.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const renderer =
      await readFile(
        new URL(
          "../../src/core/render-evidence-report-markdown.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const evaluation =
      runner.indexOf(
        "aggregate: evaluateEvidence({",
      );

    const report =
      runner.indexOf(
        "const report = buildEvidenceReport({",
      );

    assert.ok(evaluation >= 0);
    assert.ok(report > evaluation);

    assert.match(
      runner,
      /expectationProvenanceVerification[\s\S]*buildEvidenceReport/u,
    );

    assert.doesNotMatch(
      builder,
      /resolveCommit|resolveGitCommonDir|compute[A-Z].*Sha256|evaluateEvidence|runBoundedCommand/u,
    );

    assert.doesNotMatch(
      renderer,
      /resolveCommit|resolveGitCommonDir|compute[A-Z].*Sha256|evaluateEvidence|runBoundedCommand/u,
    );
  },
);
