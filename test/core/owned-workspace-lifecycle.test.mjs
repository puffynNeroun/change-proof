import assert from "node:assert/strict";
import {
  after,
  before,
  test,
} from "node:test";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  OWNED_WORKSPACE_ERROR_CODES,
  OWNED_WORKSPACE_MARKER,
  OwnedWorkspaceLifecycleError,
  createOwnedWorkspaceLifecycle,
} from "../../src/core/owned-workspace-lifecycle.mjs";

const gitExecutable =
  process.env.CHANGE_PROOF_GIT ?? "git";

const gitEnvironment = {
  ...process.env,
  LC_ALL: "C",
  LANG: "C",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_AUTHOR_NAME: "Change Proof M2.7",
  GIT_AUTHOR_EMAIL: "m2.7@example.invalid",
  GIT_COMMITTER_NAME: "Change Proof M2.7",
  GIT_COMMITTER_EMAIL: "m2.7@example.invalid",
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
};

let temporaryRoot;
let temporaryParent;
let repository;
let nonRepository;
let wrapperPath;
let baseSha;
let headSha;

function runGit(argumentsList, cwd = repository) {
  const result = spawnSync(
    gitExecutable,
    argumentsList,
    {
      cwd,
      encoding: "utf8",
      env: gitEnvironment,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(
    result.status,
    0,
    `${argumentsList.join(" ")}\n${result.stderr}`,
  );

  return result.stdout.trim();
}

function configuration(overrides = {}) {
  return {
    gitExecutable,
    environment: {
      ...gitEnvironment,
    },
    timeoutMs: 5_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    temporaryParentDirectory:
      temporaryParent,
    workspacePrefix:
      "change proof m27 workspace-",
    repositoryRoot: repository,
    ...overrides,
  };
}

function wrapperConfiguration(
  mode,
  overrides = {},
) {
  return configuration({
    gitExecutable: wrapperPath,
    environment: {
      ...gitEnvironment,
      CHANGE_PROOF_REAL_GIT:
        gitExecutable,
      CHANGE_PROOF_SHIM_MODE: mode,
    },
    ...overrides,
  });
}

function worktreePaths() {
  return runGit([
    "worktree",
    "list",
    "--porcelain",
  ])
    .split("\n")
    .filter((line) =>
      line.startsWith("worktree "))
    .map((line) =>
      line.slice("worktree ".length));
}

function refsSnapshot() {
  return runGit([
    "for-each-ref",
    "--format=%(refname) %(objectname)",
  ]);
}

async function expectLifecycleError(
  operation,
  code,
) {
  await assert.rejects(
    operation,
    (error) => {
      assert.equal(
        error instanceof
          OwnedWorkspaceLifecycleError,
        true,
      );
      assert.equal(error.code, code);
      return true;
    },
  );
}

function forciblyCleanLeakedWorkspace(path) {
  if (!path) {
    return;
  }

  if (worktreePaths().includes(path)) {
    runGit([
      "worktree",
      "remove",
      "--force",
      path,
    ]);
  }

  rmSync(path, {
    recursive: true,
    force: true,
  });
}

before(() => {
  temporaryRoot = mkdtempSync(
    join(tmpdir(), "change-proof-m27-tests-"),
  );
  temporaryParent = join(
    temporaryRoot,
    "temporary parent with spaces",
  );
  repository = join(
    temporaryRoot,
    "repository with spaces",
  );
  nonRepository = join(
    temporaryRoot,
    "not a repository",
  );

  mkdirSync(temporaryParent);
  mkdirSync(repository);
  mkdirSync(nonRepository);

  runGit(["init", "-b", "main"]);
  writeFileSync(
    join(repository, "value.txt"),
    "base\n",
  );
  runGit(["add", "--", "value.txt"]);
  runGit(["commit", "-m", "base"]);
  baseSha = runGit(["rev-parse", "HEAD"]);

  writeFileSync(
    join(repository, "value.txt"),
    "head\n",
  );
  writeFileSync(
    join(repository, "head-only.txt"),
    "head only\n",
  );
  runGit(["add", "--", "."]);
  runGit(["commit", "-m", "head"]);
  headSha = runGit(["rev-parse", "HEAD"]);

  wrapperPath = join(
    temporaryRoot,
    "git failure shim.mjs",
  );

  writeFileSync(
    wrapperPath,
    [
      `#!${process.execPath}`,
      'import { mkdirSync, writeFileSync } from "node:fs";',
      'import { spawnSync } from "node:child_process";',
      "const args = process.argv.slice(2);",
      "const mode = process.env.CHANGE_PROOF_SHIM_MODE;",
      "const has = (...items) => items.every((item) => args.includes(item));",
      "if (mode === 'timeout' && has('worktree', 'add')) { setInterval(() => {}, 1000); await new Promise(() => {}); }",
      "if (mode === 'signal' && has('worktree', 'add')) { process.kill(process.pid, 'SIGTERM'); }",
      "if (mode === 'stdout-truncated' && has('worktree', 'add')) { process.stdout.write('x'.repeat(4096)); process.exit(0); }",
      "if (mode === 'stderr-truncated' && has('worktree', 'add')) { process.stderr.write('x'.repeat(4096)); process.exit(2); }",
      "if (mode === 'partial-add' && has('worktree', 'add')) { const target = args.at(-2); mkdirSync(target); process.exit(3); }",
      "if (mode === 'fail-remove' && has('worktree', 'remove')) { process.stderr.write('private raw cleanup output'); process.exit(17); }",
      "if (mode === 'mismatch-head' && has('rev-parse', 'HEAD') && process.cwd() !== process.env.CHANGE_PROOF_REPOSITORY) { process.stdout.write('0'.repeat(40) + '\\n'); process.exit(0); }",
      "if (mode === 'attached-head' && has('symbolic-ref', 'HEAD')) { process.stdout.write('refs/heads/main\\n'); process.exit(0); }",
      "if (mode === 'dirty-status' && has('status', '--porcelain=v1')) { writeFileSync(new URL('injected.txt', 'file://' + process.cwd() + '/'), 'dirty'); }",
      "const result = spawnSync(process.env.CHANGE_PROOF_REAL_GIT, args, { encoding: 'utf8', env: process.env });",
      "if (result.error) { process.stderr.write(result.error.message); process.exit(126); }",
      "process.stdout.write(result.stdout ?? '');",
      "process.stderr.write(result.stderr ?? '');",
      "if (result.signal) { process.kill(process.pid, result.signal); }",
      "process.exit(result.status ?? 125);",
      "",
    ].join("\n"),
  );
  chmodSync(wrapperPath, 0o700);
});

after(() => {
  rmSync(temporaryRoot, {
    recursive: true,
    force: true,
  });
});

test(
  "creates unique owned workspaces with exclusive invocation markers",
  async () => {
    const lifecycle =
      createOwnedWorkspaceLifecycle(
        configuration(),
      );
    const observations = [];

    const run = () =>
      lifecycle.withOwnedWorkspace(
        async (context) => {
          assert.equal(
            Object.isFrozen(context),
            true,
          );
          assert.equal(
            existsSync(context.workspacePath),
            true,
          );
          assert.equal(
            context.markerPath,
            join(
              context.workspacePath,
              OWNED_WORKSPACE_MARKER,
            ),
          );
          assert.equal(
            readFileSync(
              context.markerPath,
              "utf8",
            ),
            `change-proof-owned:${context.ownershipToken}\n`,
          );
          assert.throws(
            () => writeFileSync(
              context.markerPath,
              "replacement",
              { flag: "wx" },
            ),
            { code: "EEXIST" },
          );
          observations.push({
            path: context.workspacePath,
            token: context.ownershipToken,
          });
          await new Promise((resolvePromise) =>
            setImmediate(resolvePromise));
          return "callback value";
        },
      );

    const results = await Promise.all([
      run(),
      run(),
    ]);

    assert.equal(
      new Set(observations.map(({ path }) => path))
        .size,
      2,
    );
    assert.equal(
      new Set(observations.map(({ token }) => token))
        .size,
      2,
    );
    assert.deepEqual(
      results.map(({ value }) => value),
      ["callback value", "callback value"],
    );
    assert.equal(
      observations.every(({ path }) =>
        !existsSync(path)),
      true,
    );
  },
);

test(
  "returns deterministic JSON cleanup evidence after callback success",
  async () => {
    let workspacePath;
    const result = await
      createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        return Object.freeze({ answer: 42 });
      });

    assert.deepEqual(result, {
      value: { answer: 42 },
      cleanup: {
        workspacePath,
        ownershipValidated: true,
        resourcesRegistered: [],
        worktreesCreated: [],
        worktreesRemoved: [],
        workspaceRemoved: true,
        cleanupCompleted: true,
        cleanupFailureCodes: [],
        resourcesNotRemoved: [],
      },
    });
    assert.deepEqual(
      JSON.parse(JSON.stringify(result.cleanup)),
      result.cleanup,
    );
  },
);

test(
  "cleans after synchronous throw and preserves the exact primary error",
  async () => {
    const primary = new Error("primary failure");
    let workspacePath;

    await assert.rejects(
      () => createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        throw primary;
      }),
      (error) => {
        assert.equal(error, primary);
        assert.equal(
          error.cleanup.cleanupCompleted,
          true,
        );
        assert.equal(
          Object.keys(error).includes("cleanup"),
          false,
        );
        return true;
      },
    );

    assert.equal(existsSync(workspacePath), false);
  },
);

test(
  "cleans after asynchronous callback rejection",
  async () => {
    let workspacePath;

    await assert.rejects(
      () => createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        await Promise.resolve();
        throw new Error("async primary");
      }),
      { message: "async primary" },
    );

    assert.equal(existsSync(workspacePath), false);
  },
);

test(
  "does not mask a frozen primary error while cleaning successfully",
  async () => {
    const primary = Object.freeze(
      new Error("frozen primary"),
    );
    let workspacePath;

    await assert.rejects(
      () => createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        throw primary;
      }),
      (error) => error === primary,
    );

    assert.equal(existsSync(workspacePath), false);
  },
);

test(
  "refuses cleanup when the ownership marker value is wrong",
  async () => {
    let workspacePath;

    try {
      await createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        writeFileSync(
          context.markerPath,
          "wrong marker\n",
        );
      });
      assert.fail("expected cleanup failure");
    } catch (error) {
      assert.equal(
        error.code,
        OWNED_WORKSPACE_ERROR_CODES
          .INCOMPLETE_CLEANUP,
      );
      assert.deepEqual(
        error.cleanup.cleanupFailureCodes,
        [
          OWNED_WORKSPACE_ERROR_CODES
            .MARKER_MISMATCH,
        ],
      );
      assert.equal(existsSync(workspacePath), true);
    } finally {
      rmSync(workspacePath, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "refuses cleanup when the ownership marker is missing",
  async () => {
    let workspacePath;

    try {
      await createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        unlinkSync(context.markerPath);
      });
      assert.fail("expected cleanup failure");
    } catch (error) {
      assert.deepEqual(
        error.cleanup.cleanupFailureCodes,
        [
          OWNED_WORKSPACE_ERROR_CODES
            .MARKER_MISSING,
        ],
      );
      assert.equal(existsSync(workspacePath), true);
    } finally {
      rmSync(workspacePath, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "refuses marker replacement even when the replacement has the exact value",
  async () => {
    let workspacePath;

    try {
      await createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace((context) => {
        workspacePath = context.workspacePath;
        const value = readFileSync(
          context.markerPath,
          "utf8",
        );
        unlinkSync(context.markerPath);
        writeFileSync(context.markerPath, value);
      });
      assert.fail("expected cleanup failure");
    } catch (error) {
      assert.deepEqual(
        error.cleanup.cleanupFailureCodes,
        [
          OWNED_WORKSPACE_ERROR_CODES
            .OWNERSHIP_VALIDATION_FAILED,
        ],
      );
    } finally {
      rmSync(workspacePath, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "refuses workspace path replacement and does not delete a sibling, parent, or repository",
  async (suite) => {
    for (const [label, target] of [
      ["sibling", nonRepository],
      ["parent", temporaryParent],
      ["repository", repository],
    ]) {
      await suite.test(label, async () => {
        let workspacePath;
        let movedPath;

        try {
          await createOwnedWorkspaceLifecycle(
            configuration(),
          ).withOwnedWorkspace((context) => {
            workspacePath = context.workspacePath;
            movedPath = `${workspacePath}-moved`;
            renameSync(workspacePath, movedPath);
            symlinkSync(target, workspacePath);
          });
          assert.fail("expected cleanup failure");
        } catch (error) {
          assert.equal(
            error.cleanup.cleanupCompleted,
            false,
          );
          assert.equal(existsSync(target), true);
          assert.equal(existsSync(movedPath), true);
        } finally {
          if (workspacePath && existsSync(workspacePath)) {
            unlinkSync(workspacePath);
          }
          rmSync(movedPath, {
            recursive: true,
            force: true,
          });
        }
      });
    }
  },
);

test(
  "creates exact detached clean base and head worktrees and removes registrations",
  async () => {
    const beforeHead = runGit(["rev-parse", "HEAD"]);
    const beforeStatus = runGit([
      "status",
      "--porcelain=v1",
    ]);
    const beforeRefs = refsSnapshot();
    const beforeWorktrees = worktreePaths();
    let workspacePath;
    let basePath;
    let headPath;

    const result = await
      createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        const base = await
          context.createDetachedWorktree({
            name: "state-a",
            commitId: baseSha,
          });
        const head = await
          context.createDetachedWorktree({
            name: "state-b",
            commitId: headSha,
          });
        basePath = base.path;
        headPath = head.path;

        assert.deepEqual(base, {
          name: "state-a",
          path: join(workspacePath, "state-a"),
          commitId: baseSha,
          detached: true,
          clean: true,
        });
        assert.equal(runGit(["rev-parse", "HEAD"], base.path), baseSha);
        assert.equal(runGit(["rev-parse", "HEAD"], head.path), headSha);
        assert.equal(
          spawnSync(
            gitExecutable,
            ["symbolic-ref", "--quiet", "HEAD"],
            { cwd: base.path, env: gitEnvironment },
          ).status,
          1,
        );
        assert.equal(runGit(["status", "--porcelain"], base.path), "");
        assert.equal(runGit(["status", "--porcelain"], head.path), "");
        return "created";
      });

    assert.equal(result.value, "created");
    assert.deepEqual(
      result.cleanup.resourcesRegistered,
      [basePath, headPath],
    );
    assert.deepEqual(
      result.cleanup.worktreesCreated,
      [basePath, headPath],
    );
    assert.deepEqual(
      result.cleanup.worktreesRemoved,
      [headPath, basePath],
    );
    assert.equal(existsSync(workspacePath), false);
    assert.deepEqual(worktreePaths(), beforeWorktrees);
    assert.equal(runGit(["rev-parse", "HEAD"]), beforeHead);
    assert.equal(runGit(["status", "--porcelain=v1"]), beforeStatus);
    assert.equal(refsSnapshot(), beforeRefs);
  },
);

test(
  "cleans a created worktree after callback failure",
  async () => {
    const primary = new Error("after creation");
    const beforeWorktrees = worktreePaths();
    let statePath;

    await assert.rejects(
      () => createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        statePath = (
          await context.createDetachedWorktree({
            name: "state-a",
            commitId: baseSha,
          })
        ).path;
        throw primary;
      }),
      (error) => error === primary,
    );

    assert.equal(existsSync(statePath), false);
    assert.deepEqual(worktreePaths(), beforeWorktrees);
  },
);

test(
  "a later creation failure cleans all earlier registered resources",
  async () => {
    let workspacePath;
    let firstPath;

    await expectLifecycleError(
      () => createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        firstPath = (
          await context.createDetachedWorktree({
            name: "first",
            commitId: baseSha,
          })
        ).path;
        await context.createDetachedWorktree({
          name: "second",
          commitId: "f".repeat(40),
        });
      }),
      OWNED_WORKSPACE_ERROR_CODES
        .COMMIT_UNRESOLVED,
    );

    assert.equal(existsSync(firstPath), false);
    assert.equal(existsSync(workspacePath), false);
    assert.equal(
      worktreePaths().includes(firstPath),
      false,
    );
  },
);

test(
  "rejects an existing target without reusing or deleting caller content",
  async () => {
    let existingPath;

    const result = await
      createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        existingPath = join(
          context.workspacePath,
          "state-a",
        );
        mkdirSync(existingPath);
        writeFileSync(
          join(existingPath, "caller.txt"),
          "caller owned",
        );

        await expectLifecycleError(
          () => context.createDetachedWorktree({
            name: "state-a",
            commitId: baseSha,
          }),
          OWNED_WORKSPACE_ERROR_CODES
            .TARGET_EXISTS,
        );

        assert.equal(
          readFileSync(
            join(existingPath, "caller.txt"),
            "utf8",
          ),
          "caller owned",
        );
      });

    assert.deepEqual(
      result.cleanup.resourcesRegistered,
      [],
    );
    assert.equal(existsSync(existingPath), false);
  },
);

test(
  "rejects traversal and absolute arbitrary worktree targets",
  async () => {
    const result = await
      createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        for (const name of [
          "../sibling",
          "/absolute",
          "nested/path",
          "nested\\path",
          ".",
          "..",
        ]) {
          await expectLifecycleError(
            () => context.createDetachedWorktree({
              name,
              commitId: baseSha,
            }),
            OWNED_WORKSPACE_ERROR_CODES
              .CONTAINMENT_FAILED,
          );
        }
      });

    assert.deepEqual(
      result.cleanup.resourcesRegistered,
      [],
    );
  },
);

test(
  "rejects invalid and unresolved immutable commit IDs explicitly",
  async () => {
    const result = await
      createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        for (const commitId of [
          "HEAD",
          "abc",
          `${baseSha}^{tree}`,
          "-".repeat(40),
        ]) {
          await expectLifecycleError(
            () => context.createDetachedWorktree({
              name: `invalid-${commitId.length}`,
              commitId,
            }),
            OWNED_WORKSPACE_ERROR_CODES
              .COMMIT_INVALID,
          );
        }

        await expectLifecycleError(
          () => context.createDetachedWorktree({
            name: "unresolved",
            commitId: "a".repeat(40),
          }),
          OWNED_WORKSPACE_ERROR_CODES
            .COMMIT_UNRESOLVED,
        );
      });

    assert.equal(
      result.cleanup.resourcesRegistered.length,
      1,
    );
    assert.deepEqual(
      result.cleanup.worktreesCreated,
      [],
    );
    assert.deepEqual(
      result.cleanup.worktreesRemoved,
      [],
    );
    assert.equal(
      result.cleanup.resourcesNotRemoved.length,
      0,
    );
  },
);

test(
  "rejects an invalid repository root before workspace creation",
  async () => {
    await expectLifecycleError(
      () => createOwnedWorkspaceLifecycle(
        configuration({
          repositoryRoot: nonRepository,
        }),
      ).withOwnedWorkspace(() => {}),
      OWNED_WORKSPACE_ERROR_CODES
        .REPOSITORY_INVALID,
    );
  },
);

test(
  "maps Git spawn, timeout, signal, and bounded-output failures",
  async (suite) => {
    await suite.test("spawn", async () => {
      await expectLifecycleError(
        () => createOwnedWorkspaceLifecycle(
          configuration({
            gitExecutable: join(
              temporaryRoot,
              "missing git executable",
            ),
          }),
        ).withOwnedWorkspace(() => {}),
        OWNED_WORKSPACE_ERROR_CODES
          .GIT_PROCESS_ERROR,
      );
    });

    for (const [mode, code, limits] of [
      [
        "timeout",
        OWNED_WORKSPACE_ERROR_CODES.GIT_TIMEOUT,
        { timeoutMs: 1_000 },
      ],
      [
        "signal",
        OWNED_WORKSPACE_ERROR_CODES.GIT_SIGNAL,
        {},
      ],
      [
        "stdout-truncated",
        OWNED_WORKSPACE_ERROR_CODES
          .GIT_OUTPUT_TRUNCATED,
        { maxStdoutBytes: 16 },
      ],
      [
        "stderr-truncated",
        OWNED_WORKSPACE_ERROR_CODES
          .GIT_OUTPUT_TRUNCATED,
        { maxStderrBytes: 16 },
      ],
    ]) {
      await suite.test(mode, async () => {
        let workspacePath;
        await expectLifecycleError(
          () => createOwnedWorkspaceLifecycle(
            wrapperConfiguration(mode, limits),
          ).withOwnedWorkspace(async (context) => {
            workspacePath = context.workspacePath;
            await context.createDetachedWorktree({
              name: "state-a",
              commitId: baseSha,
            });
          }),
          code,
        );
        assert.equal(
          workspacePath === undefined ||
            !existsSync(workspacePath),
          true,
        );
      });
    }
  },
);

test(
  "registers a partial worktree target early enough for cleanup",
  async () => {
    let workspacePath;

    await expectLifecycleError(
      () => createOwnedWorkspaceLifecycle(
        wrapperConfiguration("partial-add"),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        await context.createDetachedWorktree({
          name: "partial",
          commitId: baseSha,
        });
      }),
      OWNED_WORKSPACE_ERROR_CODES
        .WORKTREE_ADD_FAILED,
    );

    assert.equal(existsSync(workspacePath), false);
    assert.equal(
      worktreePaths().some((path) =>
        path.includes("partial")),
      false,
    );
  },
);

test(
  "refuses to delete a path replacement when no resource identity was captured",
  async () => {
    let workspacePath;
    let replacementPath;

    try {
      await createOwnedWorkspaceLifecycle(
        configuration(),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        replacementPath = join(
          workspacePath,
          "unresolved",
        );

        await expectLifecycleError(
          () => context.createDetachedWorktree({
            name: "unresolved",
            commitId: "b".repeat(40),
          }),
          OWNED_WORKSPACE_ERROR_CODES
            .COMMIT_UNRESOLVED,
        );

        mkdirSync(replacementPath);
        writeFileSync(
          join(replacementPath, "foreign.txt"),
          "must remain",
        );
      });
      assert.fail("expected cleanup refusal");
    } catch (error) {
      assert.equal(
        error.code,
        OWNED_WORKSPACE_ERROR_CODES
          .INCOMPLETE_CLEANUP,
      );
      assert.deepEqual(
        error.cleanup.resourcesNotRemoved,
        [replacementPath],
      );
      assert.equal(
        readFileSync(
          join(replacementPath, "foreign.txt"),
          "utf8",
        ),
        "must remain",
      );
    } finally {
      rmSync(workspacePath, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "detects worktree identity, detached-HEAD, and clean-state verification failures",
  async (suite) => {
    for (const [mode, code] of [
      [
        "mismatch-head",
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_IDENTITY_MISMATCH,
      ],
      [
        "attached-head",
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_NOT_DETACHED,
      ],
      [
        "dirty-status",
        OWNED_WORKSPACE_ERROR_CODES
          .WORKTREE_DIRTY,
      ],
    ]) {
      await suite.test(mode, async () => {
        let workspacePath;
        const config = wrapperConfiguration(mode);
        config.environment.CHANGE_PROOF_REPOSITORY =
          repository;

        await expectLifecycleError(
          () => createOwnedWorkspaceLifecycle(
            config,
          ).withOwnedWorkspace(async (context) => {
            workspacePath = context.workspacePath;
            await context.createDetachedWorktree({
              name: "state-a",
              commitId: baseSha,
            });
          }),
          code,
        );

        assert.equal(existsSync(workspacePath), false);
        assert.equal(
          worktreePaths().includes(
            join(workspacePath, "state-a"),
          ),
          false,
        );
      });
    }
  },
);

test(
  "preserves primary and cleanup failures without exposing raw Git output",
  async () => {
    const primary = new Error("primary operation");
    let statePath;
    let workspacePath;

    try {
      await createOwnedWorkspaceLifecycle(
        wrapperConfiguration("fail-remove"),
      ).withOwnedWorkspace(async (context) => {
        workspacePath = context.workspacePath;
        statePath = (
          await context.createDetachedWorktree({
            name: "state-a",
            commitId: baseSha,
          })
        ).path;
        throw primary;
      });
      assert.fail("expected combined failure");
    } catch (error) {
      assert.equal(
        error.code,
        OWNED_WORKSPACE_ERROR_CODES
          .PRIMARY_AND_CLEANUP_FAILURE,
      );
      assert.equal(error.primaryError, primary);
      assert.equal(error.cause, primary);
      assert.equal(
        Object.keys(error).includes(
          "primaryError",
        ),
        false,
      );
      assert.deepEqual(
        error.cleanup.cleanupFailureCodes,
        [
          OWNED_WORKSPACE_ERROR_CODES
            .WORKTREE_REMOVE_FAILED,
          OWNED_WORKSPACE_ERROR_CODES
            .INCOMPLETE_CLEANUP,
        ],
      );
      assert.deepEqual(
        error.cleanup.resourcesNotRemoved,
        [statePath],
      );
      assert.equal(
        JSON.stringify(error).includes(
          "private raw cleanup output",
        ),
        false,
      );
      assert.equal(
        Object.hasOwn(error, "stdout"),
        false,
      );
      assert.equal(
        Object.hasOwn(error, "stderr"),
        false,
      );
    } finally {
      forciblyCleanLeakedWorkspace(statePath);
      rmSync(workspacePath, {
        recursive: true,
        force: true,
      });
    }
  },
);

test(
  "does not mutate caller configuration or worktree specifications",
  async () => {
    const input = configuration();
    const original = structuredClone(input);
    const specification = Object.freeze({
      name: "state-a",
      commitId: baseSha,
    });

    const result = await
      createOwnedWorkspaceLifecycle(input)
        .withOwnedWorkspace(async (context) => {
          await context.createDetachedWorktree(
            specification,
          );
        });

    assert.deepEqual(input, original);
    assert.deepEqual(specification, {
      name: "state-a",
      commitId: baseSha,
    });
    assert.equal(result.cleanup.cleanupCompleted, true);
  },
);

test(
  "validates explicit configuration and never reads an ambient environment",
  async () => {
    for (const [field, value] of [
      ["gitExecutable", ""],
      ["environment", null],
      ["timeoutMs", 0],
      ["timeoutMs", 2_147_483_648],
      ["maxStdoutBytes", 0],
      ["maxStderrBytes", -1],
      ["temporaryParentDirectory", ""],
      ["workspacePrefix", "../escape"],
      ["repositoryRoot", ""],
    ]) {
      assert.throws(
        () => createOwnedWorkspaceLifecycle(
          configuration({ [field]: value }),
        ),
        (error) => {
          assert.equal(
            error.code,
            OWNED_WORKSPACE_ERROR_CODES
              .INVALID_CONFIGURATION,
          );
          assert.equal(error.field, field);
          return true;
        },
      );
    }

    const source = readFileSync(
      join(
        process.cwd(),
        "src/core/owned-workspace-lifecycle.mjs",
      ),
      "utf8",
    );
    assert.equal(source.includes("process.env"), false);
    assert.equal(source.includes("node:child_process"), false);
    assert.equal(source.includes("shell:"), false);
  },
);

test(
  "stays within M2.7 and issues no restore, prune, branch, reset, stage, or commit command",
  () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/core/owned-workspace-lifecycle.mjs",
      ),
      "utf8",
    );

    for (const forbidden of [
      '"restore"',
      '"prune"',
      '"checkout"',
      '"branch"',
      '"reset"',
      '"add", "--"',
      '"commit"',
      "fixture/base",
      "free-shipping",
      "node:test",
      "OBSERVED_TEST_DISCRIMINATION",
    ]) {
      assert.equal(
        source.includes(forbidden),
        false,
        forbidden,
      );
    }
  },
);
