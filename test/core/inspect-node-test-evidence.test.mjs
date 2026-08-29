import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectNodeTestEvidence,
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

function flatAssertionTap({
  testName =
    "generic assertion leaf",
  error,
  extraLines = [],
} = {}) {
  return [
    "TAP version 13",
    `# Subtest: ${testName}`,
    `not ok 1 - ${testName}`,
    ...(error === undefined
      ? []
      : [
          `  error: '${error}'`,
        ]),
    "  failureType: 'testCodeFailure'",
    ...extraLines,
    "  code: 'ERR_ASSERTION'",
    "# tests 1",
    "# pass 0",
    "# fail 1",
    "# cancelled 0",
    "# skipped 0",
    "# todo 0",
    "",
  ].join("\n");
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

    const failed =
      leaf.failed === true;

    lines.push(
      `    # Subtest: ${leaf.testName}`,
      `    ${failed ? "not " : ""}ok ${index + 1} - ${leaf.testName}`,
      "      ---",
      "      duration_ms: 1",
      "      type: 'test'",
      ...(failed
        ? [
            `      failureType: '${leaf.failureType ?? "testCodeFailure"}'`,
            ...(leaf.error === undefined
              ? []
              : [
                  `      error: '${leaf.error}'`,
                ]),
            ...(leaf.diagnosticLines ?? []),
            `      code: '${leaf.code ?? "ERR_ASSERTION"}'`,
            ...(leaf.extraLines ?? []),
          ]
        : []),
      "      ...",
    );
  }

  const failedLeaves =
    leaves.filter(
      (leaf) =>
        leaf.failed === true,
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
  const leaves =
    suites.flatMap(
      (suite) =>
        suite.leaves,
    );

  const failedLeaves =
    leaves.filter(
      (leaf) =>
        leaf.failed === true,
    );

  return [
    "TAP version 13",
    ...suites.flatMap(
      (suite, index) =>
        nestedSuiteLines({
          ...suite,
          suiteNumber:
            index + 1,
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

test(
  "observes test count without expectedTestCount",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          stdout: passTap(7),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.equal(
      result.observedTestCount,
      7,
    );

    assert.deepEqual(
      result.summary,
      {
        tests: 7,
        pass: 7,
        fail: 0,
        cancelled: 0,
        skipped: 0,
        todo: 0,
      },
    );

    assert.deepEqual(
      result.failedLeaves,
      [],
    );
  },
);

test(
  "projects exact terminal nested leaves and excludes aggregate suites",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "parent suite",
                leaves: [
                  {
                    testName:
                      "passing leaf",
                  },
                  {
                    testName:
                      "first failing leaf",
                    failed: true,
                    error:
                      "first semantic mismatch",
                  },
                  {
                    testName:
                      "second failing leaf",
                    failed: true,
                    code:
                      "ERR_TEST_FAILURE",
                    error:
                      "second semantic mismatch",
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.equal(
      result.observedTestCount,
      3,
    );

    assert.deepEqual(
      result.failedLeaves.map(
        (failure) =>
          failure.testName,
      ),
      [
        "first failing leaf",
        "second failing leaf",
      ],
    );

    assert.equal(
      result.failedLeaves.some(
        (failure) =>
          failure.testName ===
            "parent suite",
      ),
      false,
    );

    assert.deepEqual(
      result.failedLeaves.map(
        (failure) =>
          failure.failureSpecificFragments,
      ),
      [
        ["first semantic mismatch"],
        ["second semantic mismatch"],
      ],
    );
  },
);

test(
  "never borrows specific evidence from a sibling leaf",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "sibling isolation",
                leaves: [
                  {
                    testName:
                      "first leaf",
                    failed: true,
                    error:
                      "first own message",
                    diagnosticLines: [
                      "      second-leaf-only-fragment",
                    ],
                  },
                  {
                    testName:
                      "second leaf",
                    failed: true,
                    error:
                      "second own message",
                    diagnosticLines: [
                      "      first-leaf-only-fragment",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [
        {
          testName:
            "first leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments: [
            "first own message",
          ],
        },
        {
          testName:
            "second leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments: [
            "second own message",
          ],
        },
      ],
    );
  },
);

test(
  "preserves only the terminal identity in deeper nesting",
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
      "          error: 'deep semantic mismatch'",
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
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout,
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [
        {
          testName:
            "deep failing leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments: [
            "deep semantic mismatch",
          ],
        },
      ],
    );
  },
);

test(
  "malformed nested TAP exposes no partial failure set",
  () => {
    const valid =
      nestedSuitesTap([
        {
          suiteName:
            "malformed suite",
          leaves: [
            {
              testName:
                "first failure",
              failed: true,
              error:
                "first mismatch",
            },
            {
              testName:
                "second failure",
              failed: true,
              error:
                "second mismatch",
            },
          ],
        },
      ]);

    const malformed =
      valid.replace(
        "    1..2",
        "    1..3",
      );

    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout: malformed,
        }),
      );

    assert.equal(
      result.structuralStatus,
      "TAP_STRUCTURE_INVALID",
    );

    assert.deepEqual(
      result.failedLeaves,
      [],
    );
  },
);

test(
  "incomplete summary exposes no partial failure set",
  () => {
    const stdout =
      nestedSuitesTap([
        {
          suiteName:
            "incomplete suite",
          leaves: [
            {
              testName:
                "failure",
              failed: true,
              error:
                "semantic mismatch",
            },
          ],
        },
      ]).replace(
        "# todo 0\n",
        "",
      );

    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout,
        }),
      );

    assert.equal(
      result.structuralStatus,
      "TAP_SUMMARY_INCOMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [],
    );
  },
);

test(
  "duplicate passing names do not create inspection-only structural invalidity",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "duplicate passing names",
                leaves: [
                  {
                    testName:
                      "same passing leaf",
                  },
                  {
                    testName:
                      "same passing leaf",
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.equal(
      result.observedTestCount,
      2,
    );

    assert.deepEqual(
      result.failedLeaves,
      [],
    );
  },
);

test(
  "duplicate failed names remain observed parser facts rather than Task 3 eligibility policy",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "duplicate failed names",
                leaves: [
                  {
                    testName:
                      "same failing leaf",
                    failed: true,
                    error:
                      "first observed mismatch",
                  },
                  {
                    testName:
                      "same failing leaf",
                    failed: true,
                    error:
                      "second observed mismatch",
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [
        {
          testName:
            "same failing leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments: [
            "first observed mismatch",
          ],
        },
        {
          testName:
            "same failing leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments: [
            "second observed mismatch",
          ],
        },
      ],
    );
  },
);

test(
  "generic ERR_ASSERTION alone is never specific evidence",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            flatAssertionTap(),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [
        {
          testName:
            "generic assertion leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator: null,
          failureSpecificFragments:
            [],
        },
      ],
    );
  },
);

test(
  "specific assertion message comes only from its own failure block",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            flatAssertionTap({
              testName:
                "specific leaf",
              error:
                "exact semantic mismatch",
            }),
        }),
      );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "exact semantic mismatch",
      ],
    );
  },
);

test(
  "extracts an unambiguous failure-local strip block scalar message",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "block scalar suite",
                leaves: [
                  {
                    testName:
                      "block scalar leaf",
                    failed: true,
                    diagnosticLines: [
                      "      error: |-",
                      "        block scalar semantic mismatch",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "block scalar semantic mismatch",
      ],
    );
  },
);

test(
  "normalizes multiline strip block scalar message deterministically",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "multiline block scalar suite",
                leaves: [
                  {
                    testName:
                      "multiline block scalar leaf",
                    failed: true,
                    diagnosticLines: [
                      "      error: |-",
                      "        first semantic line",
                      "        second semantic line",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "first semantic line\nsecond semantic line",
      ],
    );
  },
);

test(
  "strips Node 24 assertion comparison framing from a custom block-scalar message",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,

          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "assertion framing suite",

                leaves: [
                  {
                    testName:
                      "assertion framing leaf",

                    failed: true,

                    diagnosticLines: [
                      "      error: |-",
                      "        CHANGE_PROOF_STABLE_MESSAGE",
                      "        ",
                      "        'base' !== 'head'",
                      "        ",
                      "      expected: 'head'",
                      "      actual: 'base'",
                      "      operator: 'strictEqual'",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "CHANGE_PROOF_STABLE_MESSAGE",
      ],
    );
  },
);

test(
  "preserves ordinary multiline block-scalar assertion messages without comparison framing",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,

          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "ordinary multiline suite",

                leaves: [
                  {
                    testName:
                      "ordinary multiline leaf",

                    failed: true,

                    diagnosticLines: [
                      "      error: |-",
                      "        first semantic line",
                      "        second semantic line",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "first semantic line\nsecond semantic line",
      ],
    );
  },
);

test(
  "does not merge stack framing into a block scalar semantic message",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "block scalar with stack",
                leaves: [
                  {
                    testName:
                      "block scalar stack leaf",
                    failed: true,
                    diagnosticLines: [
                      "      error: |-",
                      "        exact semantic mismatch",
                      "      stack: |-",
                      "        AssertionError: exact semantic mismatch",
                      "        at /tmp/change-proof-worktree/test.mjs:10:2",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [
        "exact semantic mismatch",
      ],
    );

    const fragment =
      result.failedLeaves[0]
        .failureSpecificFragments[0];

    assert.equal(
      fragment.includes("AssertionError"),
      false,
    );

    assert.equal(
      fragment.includes("/tmp/"),
      false,
    );
  },
);

test(
  "never borrows a block scalar message from a sibling leaf",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "block scalar sibling isolation",
                leaves: [
                  {
                    testName:
                      "first block leaf",
                    failed: true,
                    diagnosticLines: [
                      "      error: |-",
                      "        first block message",
                    ],
                  },
                  {
                    testName:
                      "second block leaf",
                    failed: true,
                    diagnosticLines: [
                      "      error: |-",
                      "        second block message",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.deepEqual(
      result.failedLeaves.map(
        (failure) =>
          failure.failureSpecificFragments,
      ),
      [
        ["first block message"],
        ["second block message"],
      ],
    );
  },
);

test(
  "fails closed for malformed or ambiguous failure-local block scalar framing",
  async (t) => {
    await t.test(
      "malformed scalar indentation",
      () => {
        const result =
          inspectNodeTestEvidence(
            execution({
              exitCode: 1,
              stdout:
                nestedSuitesTap([
                  {
                    suiteName:
                      "malformed scalar suite",
                    leaves: [
                      {
                        testName:
                          "malformed scalar leaf",
                        failed: true,
                        diagnosticLines: [
                          "      error: |-",
                          "        valid first line",
                          "       malformed indentation",
                        ],
                      },
                    ],
                  },
                ]),
            }),
          );

        assert.deepEqual(
          result.failedLeaves[0]
            .failureSpecificFragments,
          [],
        );
      },
    );

    await t.test(
      "ambiguous multiple error fields",
      () => {
        const result =
          inspectNodeTestEvidence(
            execution({
              exitCode: 1,
              stdout:
                nestedSuitesTap([
                  {
                    suiteName:
                      "ambiguous scalar suite",
                    leaves: [
                      {
                        testName:
                          "ambiguous scalar leaf",
                        failed: true,
                        error:
                          "quoted semantic message",
                        diagnosticLines: [
                          "      error: |-",
                          "        competing block message",
                        ],
                      },
                    ],
                  },
                ]),
            }),
          );

        assert.deepEqual(
          result.failedLeaves[0]
            .failureSpecificFragments,
          [],
        );
      },
    );
  },
);

test(
  "stack path location duration actual and expected do not leak into specific fragments",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            nestedSuitesTap([
              {
                suiteName:
                  "safe projection",
                leaves: [
                  {
                    testName:
                      "safe failing leaf",
                    failed: true,
                    error:
                      "version value mismatch",
                    diagnosticLines: [
                      "      location: '/tmp/change-proof-worktree/test.mjs:10:2'",
                      "      actual: 'beta.1'",
                      "      expected: 'beta.2'",
                      "      operator: 'strictEqual'",
                      "      stack: |-",
                      "        at /tmp/change-proof-worktree/test.mjs:10:2",
                    ],
                  },
                ],
              },
            ]),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves,
      [
        {
          testName:
            "safe failing leaf",
          failureType:
            "testCodeFailure",
          code:
            "ERR_ASSERTION",
          operator:
            "strictEqual",
          failureSpecificFragments: [
            "version value mismatch",
          ],
        },
      ],
    );

    const exported =
      JSON.stringify(
        result.failedLeaves,
      );

    for (const forbidden of [
      "/tmp/change-proof-worktree",
      "test.mjs:10:2",
      "duration_ms",
      "beta.1",
      "beta.2",
      "stack",
      "actual",
      "expected",
    ]) {
      assert.equal(
        exported.includes(forbidden),
        false,
        forbidden,
      );
    }
  },
);

test(
  "path-like error messages are not exported as semantic fragments",
  () => {
    const result =
      inspectNodeTestEvidence(
        execution({
          exitCode: 1,
          stdout:
            flatAssertionTap({
              testName:
                "unsafe path leaf",
              error:
                "/tmp/change-proof-worktree/test.mjs:4:2",
            }),
        }),
      );

    assert.equal(
      result.structuralStatus,
      "COMPLETE",
    );

    assert.deepEqual(
      result.failedLeaves[0]
        .failureSpecificFragments,
      [],
    );
  },
);
