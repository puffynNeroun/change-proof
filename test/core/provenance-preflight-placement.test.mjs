import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";
import test from "node:test";

test(
  "authoritative provenance preflight occurs before changed-path discovery and workspace execution",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/core/run-change-proof.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const baseResolution =
      source.indexOf(
        "await primitives.resolveCommit(",
      );

    const secondResolution =
      source.indexOf(
        "await primitives.resolveCommit(",
        baseResolution + 1,
      );

    const preflight =
      source.indexOf(
        "verifyExpectationProvenance({",
      );

    const changedPaths =
      source.indexOf(
        "await primitives.listChangedPaths(",
      );

    const lifecycle =
      source.indexOf(
        "await lifecycle.withOwnedWorkspace(",
      );

    assert.ok(baseResolution >= 0);
    assert.ok(secondResolution > baseResolution);
    assert.ok(preflight > secondResolution);
    assert.ok(changedPaths > preflight);
    assert.ok(lifecycle > changedPaths);
  },
);

test(
  "schema 0.1 does not resolve git common-dir solely for provenance",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/core/run-change-proof.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    assert.match(
      source,
      /if\s*\(\s*normalized\.expectationProvenance\s*!==\s*null\s*\)/u,
    );

    assert.match(
      source,
      /await primitives\.resolveGitCommonDir\(/u,
    );
  },
);
