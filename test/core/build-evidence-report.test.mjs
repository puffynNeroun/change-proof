import assert from "node:assert/strict";
import test from "node:test";

import {
  buildEvidenceReport,
  EVIDENCE_REPORT_SCHEMA_VERSION,
  serializeEvidenceReport,
} from "../../src/core/build-evidence-report.mjs";

function createInput() {
  return {
    schemaVersion:
      EVIDENCE_REPORT_SCHEMA_VERSION,

    toolVersion: "0.0.0-dev",
    expectationProvenance: null,

    repository: {
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      identity: {
        kind: "local-git",
        name: "example",
      },
    },

    command: {
      argv: [
        "node",
        "--test",
      ],
      cwd: ".",
      timeoutMs: 30_000,
    },

    envelope: {
      includedPaths: [
        "test/example.test.js",
      ],
      excludedPaths: [],
    },

    timing: {
      startedAt:
        "2026-08-01T00:00:00.000Z",
      durationMs: 123,
    },

    states: {
      stateA: {
        sha: "a".repeat(40),
        outcome: "PASS",
        execution: {
          exitCode: 0,
          timedOut: false,
          outputDigest: "sha256:state-a",
        },
      },

      stateB: {
        sha: "b".repeat(40),
        outcome: "PASS",
        execution: {
          exitCode: 0,
          timedOut: false,
          outputDigest: "sha256:state-b",
        },
      },

      stateC: {
        sha: "a".repeat(40),
        outcome:
          "TEST_ASSERTION_FAILURE",
        execution: {
          exitCode: 1,
          timedOut: false,
          outputDigest: "sha256:state-c",
        },
      },
    },

    boundary: {
      valid: true,
      reasons: [],
    },

    workspace: {
      owned: true,
      cleanup: {
        attempted: true,
        succeeded: true,
      },
    },

    verdict:
      "OBSERVED_TEST_DISCRIMINATION",

    reasons: [
      "The selected head test failed against the base implementation.",
    ],

    limitations: [
      "Node test adapter only.",
    ],

    warnings: [],
  };
}

test(
  "builds the complete EvidenceReport schema",
  () => {
    const report =
      buildEvidenceReport(createInput());

    assert.equal(
      report.schemaVersion,
      "0.1",
    );

    assert.equal(
      report.toolVersion,
      "0.0.0-dev",
    );

    assert.equal(
      report.verdict,
      "OBSERVED_TEST_DISCRIMINATION",
    );

    assert.deepEqual(
      Object.keys(report),
      [
        "schemaVersion",
        "toolVersion",
        "expectationProvenance",
        "repository",
        "command",
        "envelope",
        "timing",
        "states",
        "boundary",
        "workspace",
        "verdict",
        "reasons",
        "limitations",
        "warnings",
      ],
    );
  },
);

test(
  "uses the default report schema version",
  () => {
    const input = createInput();

    delete input.schemaVersion;

    const report =
      buildEvidenceReport(input);

    assert.equal(
      report.schemaVersion,
      EVIDENCE_REPORT_SCHEMA_VERSION,
    );
  },
);

test(
  "accepts deeply frozen input evidence",
  () => {
    const input = createInput();

    Object.freeze(input.repository.identity);
    Object.freeze(input.repository);
    Object.freeze(input.command.argv);
    Object.freeze(input.command);
    Object.freeze(input.envelope.includedPaths);
    Object.freeze(input.envelope.excludedPaths);
    Object.freeze(input.envelope);
    Object.freeze(input.timing);

    for (
      const state of Object.values(input.states)
    ) {
      Object.freeze(state.execution);
      Object.freeze(state);
    }

    Object.freeze(input.states);
    Object.freeze(input.boundary.reasons);
    Object.freeze(input.boundary);
    Object.freeze(input.workspace.cleanup);
    Object.freeze(input.workspace);
    Object.freeze(input.reasons);
    Object.freeze(input.limitations);
    Object.freeze(input.warnings);
    Object.freeze(input);

    assert.doesNotThrow(
      () => buildEvidenceReport(input),
    );
  },
);

test(
  "does not mutate the supplied input",
  () => {
    const input = createInput();
    const before = JSON.stringify(input);

    buildEvidenceReport(input);

    assert.equal(
      JSON.stringify(input),
      before,
    );
  },
);

test(
  "deep-clones every report section",
  () => {
    const input = createInput();
    const report =
      buildEvidenceReport(input);

    input.repository.identity.name =
      "mutated";

    input.states.stateA.outcome =
      "mutated";

    input.reasons.push("mutated");

    assert.equal(
      report.repository.identity.name,
      "example",
    );

    assert.equal(
      report.states.stateA.outcome,
      "PASS",
    );

    assert.equal(
      report.reasons.length,
      1,
    );
  },
);

test(
  "returns independent reports for repeated builds",
  () => {
    const input = createInput();

    const first =
      buildEvidenceReport(input);

    const second =
      buildEvidenceReport(input);

    assert.notEqual(first, second);
    assert.notEqual(
      first.repository,
      second.repository,
    );

    assert.deepEqual(first, second);
  },
);

test(
  "is deterministic for identical input",
  () => {
    const input = createInput();

    const expected =
      buildEvidenceReport(input);

    for (
      let index = 0;
      index < 100;
      index += 1
    ) {
      assert.deepEqual(
        buildEvidenceReport(input),
        expected,
      );
    }
  },
);

test(
  "canonicalizes nested object key ordering",
  () => {
    const input = createInput();

    input.repository = {
      zeta: true,
      alpha: true,
      nested: {
        zeta: true,
        alpha: true,
      },
    };

    const report =
      buildEvidenceReport(input);

    assert.deepEqual(
      Object.keys(report.repository),
      [
        "alpha",
        "nested",
        "zeta",
      ],
    );

    assert.deepEqual(
      Object.keys(
        report.repository.nested,
      ),
      [
        "alpha",
        "zeta",
      ],
    );
  },
);

test(
  "serializes equivalent key orders into identical bytes",
  () => {
    const first =
      buildEvidenceReport(createInput());

    const secondInput = createInput();

    secondInput.repository = {
      identity:
        secondInput.repository.identity,
      headSha:
        secondInput.repository.headSha,
      baseSha:
        secondInput.repository.baseSha,
    };

    const second =
      buildEvidenceReport(secondInput);

    assert.equal(
      serializeEvidenceReport(first),
      serializeEvidenceReport(second),
    );
  },
);

test(
  "serialized JSON has a trailing newline",
  () => {
    const serialized =
      serializeEvidenceReport(
        buildEvidenceReport(
          createInput(),
        ),
      );

    assert.equal(
      serialized.endsWith("\n"),
      true,
    );

    assert.deepEqual(
      JSON.parse(serialized),
      JSON.parse(
        serializeEvidenceReport(
          buildEvidenceReport(
            createInput(),
          ),
        ),
      ),
    );
  },
);

test(
  "validates JSON indentation",
  () => {
    const report =
      buildEvidenceReport(createInput());

    for (const invalidSpace of [
      -1,
      11,
      1.5,
      "2",
    ]) {
      assert.throws(
        () =>
          serializeEvidenceReport(
            report,
            {
              space: invalidSpace,
            },
          ),
        {
          message:
            "invalid_report_json_space",
        },
      );
    }
  },
);

test(
  "validates all required object sections",
  () => {
    for (const name of [
      "repository",
      "command",
      "envelope",
      "states",
      "boundary",
      "workspace",
      "timing",
    ]) {
      const input = createInput();

      input[name] = undefined;

      assert.throws(
        () =>
          buildEvidenceReport(input),
        {
          message:
            `missing_report_input:${name}`,
        },
      );
    }
  },
);

test(
  "validates State A, State B, and State C",
  () => {
    for (const stateName of [
      "stateA",
      "stateB",
      "stateC",
    ]) {
      const input = createInput();

      input.states[stateName] =
        undefined;

      assert.throws(
        () =>
          buildEvidenceReport(input),
        {
          message:
            "missing_report_input:" +
            `states.${stateName}`,
        },
      );
    }
  },
);

test(
  "validates report identity strings",
  () => {
    for (const [name, mutate] of [
      [
        "schemaVersion",
        (input) => {
          input.schemaVersion = "";
        },
      ],
      [
        "toolVersion",
        (input) => {
          input.toolVersion = "";
        },
      ],
      [
        "verdict",
        (input) => {
          input.verdict = "";
        },
      ],
    ]) {
      const input = createInput();

      mutate(input);

      assert.throws(
        () =>
          buildEvidenceReport(input),
        {
          message:
            `invalid_report_string:${name}`,
        },
      );
    }
  },
);

test(
  "validates reasons as strings",
  () => {
    const input = createInput();

    input.reasons = [
      "valid",
      42,
    ];

    assert.throws(
      () => buildEvidenceReport(input),
      {
        message:
          "invalid_report_string_array:reasons",
      },
    );
  },
);

test(
  "validates limitations and warnings as string arrays",
  () => {
    for (const name of [
      "limitations",
      "warnings",
    ]) {
      const input = createInput();

      input[name] = [
        null,
      ];

      assert.throws(
        () =>
          buildEvidenceReport(input),
        {
          message:
            "invalid_report_string_array:" +
            name,
        },
      );
    }
  },
);

test(
  "validates timing without reading the clock",
  () => {
    const missingStart =
      createInput();

    missingStart.timing.startedAt = "";

    assert.throws(
      () =>
        buildEvidenceReport(
          missingStart,
        ),
      {
        message:
          "invalid_report_string:" +
          "timing.startedAt",
      },
    );

    for (const durationMs of [
      -1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      "123",
    ]) {
      const input = createInput();

      input.timing.durationMs =
        durationMs;

      assert.throws(
        () =>
          buildEvidenceReport(input),
        {
          message:
            "invalid_report_duration:" +
            "timing.durationMs",
        },
      );
    }
  },
);

test(
  "rejects non-JSON, cyclic, and raw-output evidence",
  () => {
    const nonJsonInput =
      createInput();

    nonJsonInput.repository.createdAt =
      new Date();

    assert.throws(
      () =>
        buildEvidenceReport(
          nonJsonInput,
        ),
      {
        message:
          "non_json_value:" +
          "$.repository.createdAt",
      },
    );

    const cyclicInput =
      createInput();

    cyclicInput.repository.self =
      cyclicInput.repository;

    assert.throws(
      () =>
        buildEvidenceReport(
          cyclicInput,
        ),
      {
        message:
          "cyclic_json_value:" +
          "$.repository.self",
      },
    );

    for (const field of [
      "output",
      "rawOutput",
      "raw_output",
      "stdout",
      "stderr",
    ]) {
      const rawInput =
        createInput();

      rawInput.states.stateA.execution[
        field
      ] = "unbounded output";

      assert.throws(
        () =>
          buildEvidenceReport(
            rawInput,
          ),
        {
          message:
            "raw_output_field_forbidden:" +
            "$.states.stateA.execution." +
            field,
        },
      );
    }
  },
);

test(
  "projects expectation provenance without changing report schema version",
  () => {
    const input = createInput();

    input.expectationProvenance = {
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

    const report =
      buildEvidenceReport(input);

    assert.equal(
      report.schemaVersion,
      EVIDENCE_REPORT_SCHEMA_VERSION,
    );

    assert.deepEqual(
      report.expectationProvenance,
      input.expectationProvenance,
    );

    assert.notEqual(
      report.expectationProvenance,
      input.expectationProvenance,
    );

    assert.notEqual(
      report.expectationProvenance
        .resolvedCommits,
      input.expectationProvenance
        .resolvedCommits,
    );
  },
);

test(
  "manual report provenance is explicitly null",
  () => {
    const report =
      buildEvidenceReport(
        createInput(),
      );

    assert.equal(
      report.expectationProvenance,
      null,
    );
  },
);
