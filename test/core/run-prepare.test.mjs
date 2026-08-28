import assert
  from "node:assert/strict";

import {
  after,
  before,
  test,
} from "node:test";

import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import {
  spawnSync,
} from "node:child_process";

import {
  writeFile,
} from "node:fs/promises";

import {
  join,
  resolve,
} from "node:path";

import {
  tmpdir,
} from "node:os";

import {
  evaluateBoundary,
} from "../../src/core/evaluate-boundary.mjs";

import {
  buildPrepareCandidate,
} from "../../src/core/prepare-candidate.mjs";

import {
  runBoundedCommand,
} from "../../src/core/run-bounded-command.mjs";

import {
  resolveStateWorkingDirectory,
} from "../../src/core/resolve-state-working-directory.mjs";

import {
  PREPARE_RUN_ERROR_CODES,
  createPrepareRunner,
} from "../../src/core/run-prepare.mjs";

const root =
  mkdtempSync(
    join(
      tmpdir(),
      "change-proof-run-prepare-",
    ),
  );

after(
  () => {
    rmSync(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  },
);

const environment =
  Object.fromEntries(
    Object.entries(process.env)
      .filter(
        ([key, value]) =>
          key !==
            "NODE_TEST_CONTEXT" &&
          typeof value === "string",
      ),
  );

async function fixture(
  name,
  source,
) {
  const directory =
    join(
      root,
      "fixtures",
    );

  mkdirSync(
    directory,
    {
      recursive: true,
    },
  );

  const file =
    join(
      directory,
      `${name}.test.mjs`,
    );

  writeFileSync(
    file,
    source,
  );

  return runBoundedCommand({
    executable:
      process.execPath,

    arguments: [
      "--test",
      "--test-reporter=tap",
      file,
    ],

    workingDirectory:
      directory,

    environment,

    timeoutMs:
      10_000,

    maxStdoutBytes:
      1024 * 1024,

    maxStderrBytes:
      1024 * 1024,
  });
}

let executions;

before(
  async () => {
    executions = {
      pass:
        await fixture(
          "pass",
          `
import test from "node:test";
import assert from "node:assert/strict";

test("pass leaf", () => {
  assert.equal(1, 1);
});
`,
        ),

      assertion:
        await fixture(
          "assertion",
          `
import test from "node:test";
import assert from "node:assert/strict";

test("assertion leaf", () => {
  assert.equal(
    1,
    2,
    "specific assertion evidence",
  );
});
`,
        ),

      incomplete: {
        exitCode:
          1,

        signal:
          null,

        timedOut:
          false,

        processErrorCode:
          null,

        stdout: [
          "TAP version 13",
          "# Subtest: generic assertion leaf",
          "not ok 1 - generic assertion leaf",
          "  ---",
          "  failureType: 'testCodeFailure'",
          "  code: 'ERR_ASSERTION'",
          "  ...",
          "1..1",
          "# tests 1",
          "# suites 0",
          "# pass 0",
          "# fail 1",
          "# cancelled 0",
          "# skipped 0",
          "# todo 0",
          "",
        ].join("\n"),

        stderr:
          "",

        stdoutTruncated:
          false,

        stderrTruncated:
          false,

        durationMs:
          1,
      },

      nonAssertion:
        await fixture(
          "nonassertion",
          `
import test from "node:test";

test("nonassertion leaf", () => {
  throw new Error(
    "specific nonassertion evidence",
  );
});
`,
        ),

      duplicate:
        await fixture(
          "duplicate",
          `
import test from "node:test";
import assert from "node:assert/strict";

test("duplicate leaf", () => {
  assert.equal(
    1,
    2,
    "first duplicate evidence",
  );
});

test("duplicate leaf", () => {
  assert.equal(
    1,
    3,
    "second duplicate evidence",
  );
});
`,
        ),

      unclassifiable: {
        ...(await fixture(
          "pass-copy",
          `
import test from "node:test";
test("pass copy", () => {});
`,
        )),

        stdout:
          "completed non-TAP output\n",
      },
    };
  },
);

function validBoundary() {
  return evaluateBoundary({
    baseSha:
      "a".repeat(40),

    stateCBaseSha:
      "a".repeat(40),

    includedPaths: [
      "test.mjs",
    ],

    headChangedPaths: [
      "test.mjs",
    ],

    materializedPaths: [
      "test.mjs",
    ],

    resultingChangedPaths: [
      "test.mjs",
    ],

    baseBlobIds: {
      "test.mjs":
        "1".repeat(40),
    },

    headBlobIds: {
      "test.mjs":
        "2".repeat(40),
    },

    stateCBlobIds: {
      "test.mjs":
        "2".repeat(40),
    },
  });
}

function invalidBoundary() {
  return evaluateBoundary({
    baseSha:
      "a".repeat(40),

    stateCBaseSha:
      "a".repeat(40),

    includedPaths: [
      "test.mjs",
    ],

    headChangedPaths: [
      "test.mjs",
    ],

    materializedPaths: [
      "test.mjs",
    ],

    resultingChangedPaths: [],

    baseBlobIds: {
      "test.mjs":
        "1".repeat(40),
    },

    headBlobIds: {
      "test.mjs":
        "2".repeat(40),
    },

    stateCBlobIds: {
      "test.mjs":
        "2".repeat(40),
    },
  });
}

let id = 0;

function createHarness({
  queue,
  boundary =
    validBoundary(),
  cleanupFailure =
    false,
} = {}) {
  id += 1;

  const base =
    join(
      root,
      `harness-${id}`,
    );

  const repository =
    join(
      base,
      "repository",
    );

  const gitCommonDir =
    join(
      repository,
      ".git",
    );

  const workspace =
    join(
      base,
      "workspace",
    );

  const temporary =
    join(
      base,
      "temporary",
    );

  const artifacts =
    join(
      base,
      "artifacts",
    );

  for (const path of [
    gitCommonDir,
    workspace,
    temporary,
    artifacts,
  ]) {
    mkdirSync(
      path,
      {
        recursive: true,
      },
    );
  }

  const remaining = [
    ...queue,
  ];

  const calls = {
    executions: 0,
    materializer: 0,
    builder: 0,
    writer: 0,
    cleanupFinished:
      false,
    resolver: 0,
  };

  const dependencies = {
    createGitRepositoryPrimitives() {
      return {
        async resolveRepositoryRoot() {
          return repository;
        },

        async resolveGitCommonDir() {
          return gitCommonDir;
        },

        async resolveCommit(
          _root,
          ref,
        ) {
          return ref === "base-ref"
            ? "a".repeat(40)
            : "b".repeat(40);
        },
      };
    },

    createOwnedWorkspaceLifecycle() {
      return {
        async withOwnedWorkspace(
          callback,
        ) {
          const invocation = {
            async createDetachedWorktree({
              name,
              commitId,
            }) {
              const path =
                join(
                  workspace,
                  name,
                );

              mkdirSync(
                path,
                {
                  recursive: true,
                },
              );

              return {
                name,
                path,
                commitId,
                detached: true,
                clean: true,
              };
            },
          };

          let value;

          try {
            value =
              await callback(
                invocation,
              );
          } catch (error) {
            calls.cleanupFinished =
              true;

            throw error;
          }

          if (cleanupFailure) {
            throw new Error(
              "injected cleanup failure",
            );
          }

          calls.cleanupFinished =
            true;

          return {
            value,

            cleanup: {
              cleanupCompleted:
                true,
              workspaceRemoved:
                true,
              ownershipValidated:
                true,
              resourcesRegistered: [],
              worktreesCreated: [],
              worktreesRemoved: [],
              cleanupFailureCodes: [],
              resourcesNotRemoved: [],
              workspacePath:
                workspace,
            },
          };
        },
      };
    },

    createExplicitEnvelopeMaterializer() {
      return {
        async materializeExplicitEnvelope() {
          calls.materializer +=
            1;

          const stateC =
            join(
              workspace,
              "state-c",
            );

          mkdirSync(
            stateC,
            {
              recursive: true,
            },
          );

          return {
            stateCWorktreePath:
              stateC,
            boundary,
            evidence: {},
          };
        },
      };
    },

    async resolveStateWorkingDirectory(
      worktree,
      relativeDirectory,
    ) {
      calls.resolver += 1;

      return resolveStateWorkingDirectory(
        worktree,
        relativeDirectory,
      );
    },

    async runBoundedCommand() {
      calls.executions += 1;

      if (remaining.length === 0) {
        throw new Error(
          "unexpected execution",
        );
      }

      return remaining.shift();
    },

    buildPrepareCandidate(
      input,
    ) {
      calls.builder += 1;

      assert.equal(
        calls.cleanupFinished,
        true,
      );

      return buildPrepareCandidate(
        input,
      );
    },

    async writeExclusiveArtifact({
      targetPath,
      content,
    }) {
      calls.writer += 1;

      await writeFile(
        targetPath,
        content,
        {
          flag: "wx",
          mode: 0o600,
        },
      );

      return {
        targetPath:
          resolve(
            targetPath,
          ),
      };
    },
  };

  const runner =
    createPrepareRunner(
      dependencies,
    );

  const input = {
    prepareConfig: {
      schemaVersion:
        "0.1",

      repositoryRoot:
        repository,

      baseRef:
        "base-ref",

      headRef:
        "head-ref",

      command: {
        executable:
          process.execPath,

        arguments: [],

        workingDirectory:
          ".",

        environment: {},

        timeoutMs:
          30_000,

        maxStdoutBytes:
          1024 * 1024,

        maxStderrBytes:
          1024 * 1024,
      },

      envelope: {
        includedPaths: [
          "test.mjs",
        ],
      },

      temporaryParentDirectory:
        temporary,

      workspacePrefix:
        "task5-",
    },

    prepareToolVersion:
      "0.2.0-beta.2",

    candidatePath:
      join(
        artifacts,
        "candidate.json",
      ),
  };

  return {
    calls,
    input,
    repository,
    runner,
  };
}

test(
  "A PASS executes B and valid boundary executes C",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
          executions.pass,
          executions.pass,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      3,
    );

    assert.equal(
      subject.calls.materializer,
      1,
    );

    assert.equal(
      subject.calls.resolver,
      3,
    );

    assert.equal(
      result.candidate.identity
        .states.stateA.testOutcome,
      "PASS",
    );

    assert.equal(
      result.candidate.identity
        .states.stateB.testOutcome,
      "PASS",
    );

    assert.equal(
      result.candidate.identity
        .states.stateC.testOutcome,
      "PASS",
    );
  },
);

test(
  "A semantic FAIL short-circuits B and C",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.assertion,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      1,
    );

    assert.equal(
      subject.calls.materializer,
      0,
    );

    assert.equal(
      result.candidate.identity
        .states.stateA.testOutcome,
      "FAIL",
    );

    assert.deepEqual(
      result.candidate.identity
        .states.stateB,
      {
        status:
          "NOT_RUN",
      },
    );
  },
);

test(
  "A completed UNCLASSIFIABLE short-circuits B and C",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.unclassifiable,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      1,
    );

    assert.equal(
      result.candidate.identity
        .states.stateA.testOutcome,
      "UNCLASSIFIABLE",
    );
  },
);

test(
  "B FAIL short-circuits C",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
          executions.assertion,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      2,
    );

    assert.equal(
      subject.calls.materializer,
      0,
    );

    assert.deepEqual(
      result.candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );
  },
);

test(
  "execution operational failures throw and never build a candidate",
  async (suite) => {
    const cases = [
      [
        "process error",
        {
          ...executions.pass,
          processErrorCode:
            "ENOENT",
        },
      ],
      [
        "timeout",
        {
          ...executions.pass,
          timedOut:
            true,
        },
      ],
      [
        "signal",
        {
          ...executions.pass,
          signal:
            "SIGTERM",
        },
      ],
      [
        "stdout truncation",
        {
          ...executions.pass,
          stdoutTruncated:
            true,
        },
      ],
      [
        "stderr truncation",
        {
          ...executions.pass,
          stderrTruncated:
            true,
        },
      ],
    ];

    for (const [
      name,
      execution,
    ] of cases) {
      await suite.test(
        name,
        async () => {
          const subject =
            createHarness({
              queue: [
                execution,
              ],
            });

          await assert.rejects(
            () =>
              subject.runner
                .runPrepare(
                  subject.input,
                  {},
                ),
            (error) =>
              error?.code ===
                PREPARE_RUN_ERROR_CODES
                  .EXECUTION_OPERATIONAL_FAILURE,
          );

          assert.equal(
            subject.calls.executions,
            1,
          );

          assert.equal(
            subject.calls.materializer,
            0,
          );

          assert.equal(
            subject.calls.builder,
            0,
          );

          assert.equal(
            subject.calls.writer,
            0,
          );

          assert.equal(
            subject.calls.cleanupFinished,
            true,
          );
        },
      );
    }
  },
);

test(
  "B completed UNCLASSIFIABLE short-circuits C",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
          executions.unclassifiable,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      2,
    );

    assert.equal(
      subject.calls.materializer,
      0,
    );

    assert.equal(
      result.candidate.identity
        .states.stateB.testOutcome,
      "UNCLASSIFIABLE",
    );

    assert.deepEqual(
      result.candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );
  },
);

test(
  "B operational failure cleans and produces no candidate",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,

          {
            ...executions.pass,

            timedOut:
              true,
          },
        ],
      });

    await assert.rejects(
      () =>
        subject.runner
          .runPrepare(
            subject.input,
            {},
          ),
      (error) =>
        error?.code ===
          PREPARE_RUN_ERROR_CODES
            .EXECUTION_OPERATIONAL_FAILURE,
    );

    assert.equal(
      subject.calls.executions,
      2,
    );

    assert.equal(
      subject.calls.materializer,
      0,
    );

    assert.equal(
      subject.calls.builder,
      0,
    );

    assert.equal(
      subject.calls.writer,
      0,
    );

    assert.equal(
      subject.calls.cleanupFinished,
      true,
    );
  },
);

test(
  "invalid production boundary prevents C execution",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
          executions.pass,
        ],

        boundary:
          invalidBoundary(),
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.equal(
      subject.calls.executions,
      2,
    );

    assert.equal(
      subject.calls.materializer,
      1,
    );

    assert.deepEqual(
      result.candidate.identity
        .states.stateC,
      {
        status:
          "NOT_RUN",
      },
    );
  },
);

test(
  "Task 4 derives nonassertion incomplete ambiguous and promotable C outcomes",
  async (suite) => {
    const cases = [
      [
        "nonassertion",
        executions.nonAssertion,
        "STATE_C_NON_ASSERTION_FAILURE_OBSERVED",
      ],
      [
        "incomplete",
        executions.incomplete,
        "ASSERTION_CANDIDATE_INCOMPLETE",
      ],
      [
        "ambiguous",
        executions.duplicate,
        "AMBIGUOUS_FAILED_LEAF_IDENTITY",
      ],
      [
        "promotable",
        executions.assertion,
        "ASSERTION_CANDIDATE_OBSERVED",
      ],
    ];

    for (const [
      name,
      stateC,
      outcome,
    ] of cases) {
      await suite.test(
        name,
        async () => {
          const subject =
            createHarness({
              queue: [
                executions.pass,
                executions.pass,
                stateC,
              ],
            });

          const result =
            await subject.runner
              .runPrepare(
                subject.input,
                {},
              );

          assert.equal(
            result.candidate.identity
              .prepareOutcome,
            outcome,
          );
        },
      );
    }
  },
);

test(
  "cleanup failure prevents candidate build and write",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
          executions.pass,
          executions.pass,
        ],

        cleanupFailure:
          true,
      });

    await assert.rejects(
      () =>
        subject.runner
          .runPrepare(
            subject.input,
            {},
          ),
    );

    assert.equal(
      subject.calls.builder,
      0,
    );

    assert.equal(
      subject.calls.writer,
      0,
    );
  },
);

test(
  "candidate target inside repository is rejected before execution",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.pass,
        ],
      });

    await assert.rejects(
      () =>
        subject.runner
          .runPrepare(
            {
              ...subject.input,

              candidatePath:
                join(
                  subject.repository,
                  "candidate.json",
                ),
            },
            {},
          ),
      (error) =>
        error?.code ===
          PREPARE_RUN_ERROR_CODES
            .CANDIDATE_TARGET_INSIDE_REPOSITORY,
    );

    assert.equal(
      subject.calls.executions,
      0,
    );
  },
);

test(
  "resolved commits use exact Task 4 base/head shape",
  async () => {
    const subject =
      createHarness({
        queue: [
          executions.assertion,
        ],
      });

    const result =
      await subject.runner
        .runPrepare(
          subject.input,
          {},
        );

    assert.deepEqual(
      result.candidate.identity
        .resolvedCommits,
      {
        base:
          "a".repeat(40),

        head:
          "b".repeat(40),
      },
    );
  },
);

test(
  "runPrepare source contains no second evidence engine or verdict path",
  () => {
    const source =
      readFileSync(
        new URL(
          "../../src/core/run-prepare.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    for (const forbidden of [
      "evaluateEvidence",
      "classifyExpectedNodeTestRegression",
      "OBSERVED_TEST_DISCRIMINATION",
      "buildEvidenceReport",
      "renderEvidenceReportMarkdown",
      "writeReports",
    ]) {
      assert.equal(
        source.includes(
          forbidden,
        ),
        false,
        forbidden,
      );
    }

    assert.equal(
      /expectedTestCount\s*:\s*[0-9]+/
        .test(source),
      false,
    );
  },
);
