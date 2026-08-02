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
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  EXPLICIT_ENVELOPE_ERROR_CODES,
  ExplicitEnvelopeMaterializationError,
  createExplicitEnvelopeMaterializer,
} from "../../src/core/materialize-explicit-envelope.mjs";
import {
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
  GIT_AUTHOR_NAME: "Change Proof M2.8",
  GIT_AUTHOR_EMAIL: "m2.8@example.invalid",
  GIT_COMMITTER_NAME: "Change Proof M2.8",
  GIT_COMMITTER_EMAIL: "m2.8@example.invalid",
  GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
  GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
};

let temporaryRoot;
let temporaryParent;
let repository;
let nonRepository;
let shimPath;
let baseSha;
let headSha;

const paths = Object.freeze({
  modified: "modified.txt",
  added: "added.txt",
  deleted: "deleted.txt",
  excludedModified: "excluded-modified.txt",
  excludedAdded: "excluded-added.txt",
  excludedDeleted: "excluded-deleted.txt",
  renameOld: "rename-old.txt",
  renameNew: "rename-new.txt",
  spaced: "space name.txt",
  unicode: "unicodé.txt",
  leadingHyphen: "-leading.txt",
  tab: "tab\tname.txt",
  newline: "line\nname.txt",
  executable: "executable.sh",
});

function runGit(
  argumentsList,
  cwd = repository,
  { allowFailure = false } = {},
) {
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

  if (!allowFailure) {
    assert.equal(
      result.status,
      0,
      `${argumentsList.join(" ")}\n${result.stderr}`,
    );
  }

  return result;
}

function outputGit(argumentsList, cwd = repository) {
  return runGit(argumentsList, cwd).stdout.trim();
}

function writeRepositoryFile(path, content, mode) {
  const fullPath = join(repository, path);
  mkdirSync(join(fullPath, ".."), {
    recursive: true,
  });
  writeFileSync(fullPath, content);

  if (mode !== undefined) {
    chmodSync(fullPath, mode);
  }
}

function processConfiguration(overrides = {}) {
  return {
    gitExecutable,
    environment: { ...gitEnvironment },
    timeoutMs: 5_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    ...overrides,
  };
}

function lifecycleConfiguration(overrides = {}) {
  return {
    ...processConfiguration(),
    temporaryParentDirectory: temporaryParent,
    workspacePrefix:
      "change proof m28 workspace-",
    repositoryRoot: repository,
    ...overrides,
  };
}

function materializerConfiguration(
  mode = null,
  overrides = {},
) {
  if (mode === null) {
    return processConfiguration(overrides);
  }

  return processConfiguration({
    gitExecutable: shimPath,
    environment: {
      ...gitEnvironment,
      CHANGE_PROOF_REAL_GIT: gitExecutable,
      CHANGE_PROOF_SHIM_MODE: mode,
    },
    ...overrides,
  });
}

function specification(includedPaths, overrides = {}) {
  return {
    repositoryRoot: repository,
    baseCommitId: baseSha,
    headCommitId: headSha,
    includedPaths,
    ...overrides,
  };
}

async function runEnvelope(
  includedPaths,
  {
    mode = null,
    materializerOverrides = {},
    specOverrides = {},
    inspect = (result) => result,
  } = {},
) {
  const lifecycle =
    createOwnedWorkspaceLifecycle(
      lifecycleConfiguration(),
    );
  const materializer =
    createExplicitEnvelopeMaterializer(
      materializerConfiguration(
        mode,
        materializerOverrides,
      ),
    );

  return await lifecycle.withOwnedWorkspace(
    async (invocation) => {
      const result = await materializer
        .materializeExplicitEnvelope(
          invocation,
          specification(
            includedPaths,
            specOverrides,
          ),
        );

      return await inspect(result, invocation);
    },
  );
}

async function expectMaterializationError(
  operation,
  code,
) {
  await assert.rejects(
    operation,
    (error) => {
      assert.equal(
        error instanceof
          ExplicitEnvelopeMaterializationError,
        true,
      );
      assert.equal(error.code, code);
      assert.equal(
        Object.hasOwn(error, "stdout"),
        false,
      );
      assert.equal(
        Object.hasOwn(error, "stderr"),
        false,
      );
      return true;
    },
  );
}

function worktreePaths(cwd = repository) {
  return outputGit([
    "worktree",
    "list",
    "--porcelain",
  ], cwd)
    .split("\n")
    .filter((line) =>
      line.startsWith("worktree "))
    .map((line) =>
      line.slice("worktree ".length));
}

function refsSnapshot(cwd = repository) {
  return outputGit([
    "for-each-ref",
    "--format=%(refname) %(objectname)",
  ], cwd);
}

function createSpecialRepository(name, setup) {
  const root = join(temporaryRoot, name);
  mkdirSync(root);
  runGit(["init", "-b", "main"], root);
  const helpers = {
    write(path, content, mode) {
      const fullPath = join(root, path);
      mkdirSync(join(fullPath, ".."), {
        recursive: true,
      });
      writeFileSync(fullPath, content);
      if (mode !== undefined) {
        chmodSync(fullPath, mode);
      }
    },
    git(args) {
      return runGit(args, root);
    },
  };
  const identities = setup(helpers);
  return { root, ...identities };
}

async function runSpecialEnvelope(
  special,
  includedPaths,
) {
  const lifecycle = createOwnedWorkspaceLifecycle({
    ...lifecycleConfiguration(),
    repositoryRoot: special.root,
  });
  const materializer =
    createExplicitEnvelopeMaterializer(
      processConfiguration(),
    );

  return await lifecycle.withOwnedWorkspace(
    (invocation) => materializer
      .materializeExplicitEnvelope(invocation, {
        repositoryRoot: special.root,
        baseCommitId: special.base,
        headCommitId: special.head,
        includedPaths,
      }),
  );
}

before(() => {
  temporaryRoot = mkdtempSync(
    join(tmpdir(), "change-proof-m28-tests-"),
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

  for (const [path, content] of [
    [paths.modified, "base modified\n"],
    [paths.deleted, "base deleted\n"],
    [paths.excludedModified, "base excluded modified\n"],
    [paths.excludedDeleted, "base excluded deleted\n"],
    [paths.renameOld, "rename content\n"],
    [paths.spaced, "base space\n"],
    [paths.unicode, "base unicode\n"],
    [paths.leadingHyphen, "base hyphen\n"],
    [paths.tab, "base tab\n"],
    [paths.newline, "base newline\n"],
  ]) {
    writeRepositoryFile(path, content);
  }
  writeRepositoryFile(
    paths.executable,
    "#!/bin/sh\necho base\n",
    0o755,
  );
  runGit(["add", "-A"]);
  runGit(["commit", "-m", "base"]);
  baseSha = outputGit(["rev-parse", "HEAD"]);

  for (const [path, content] of [
    [paths.modified, "head modified\n"],
    [paths.added, "head added\n"],
    [paths.excludedModified, "head excluded modified\n"],
    [paths.excludedAdded, "head excluded added\n"],
    [paths.spaced, "head space\n"],
    [paths.unicode, "head unicode\n"],
    [paths.leadingHyphen, "head hyphen\n"],
    [paths.tab, "head tab\n"],
    [paths.newline, "head newline\n"],
  ]) {
    writeRepositoryFile(path, content);
  }
  writeRepositoryFile(
    paths.executable,
    "#!/bin/sh\necho head\n",
    0o755,
  );
  rmSync(join(repository, paths.deleted));
  rmSync(join(repository, paths.excludedDeleted));
  runGit([
    "mv",
    "--",
    paths.renameOld,
    paths.renameNew,
  ]);
  runGit(["add", "-A"]);
  runGit(["commit", "-m", "head"]);
  headSha = outputGit(["rev-parse", "HEAD"]);

  shimPath = join(
    temporaryRoot,
    "git materialization shim.mjs",
  );
  writeFileSync(
    shimPath,
    [
      `#!${process.execPath}`,
      'import { appendFileSync, writeFileSync } from "node:fs";',
      'import { spawnSync } from "node:child_process";',
      "const args = process.argv.slice(2);",
      "const mode = process.env.CHANGE_PROOF_SHIM_MODE;",
      "const command = args.find((item) => ['restore','diff','ls-files','ls-tree','rev-parse'].includes(item));",
      "const has = (...items) => items.every((item) => args.includes(item));",
      "if (mode === 'timeout' && command === 'restore') { setInterval(() => {}, 1000); await new Promise(() => {}); }",
      "if (mode === 'signal' && command === 'restore') { process.kill(process.pid, 'SIGTERM'); }",
      "if (mode === 'restore-fail' && command === 'restore') { process.stderr.write('bounded restore failure'); process.exit(9); }",
      "if (mode === 'stderr-truncated' && command === 'restore') { writeFileSync(2, 'x'.repeat(2 * 1024 * 1024)); process.exit(9); }",
      "if (mode === 'stdout-truncated' && command === 'diff' && has('--cached', '--name-only')) { writeFileSync(1, 'x'.repeat(2 * 1024 * 1024)); process.exit(0); }",
      "if (mode === 'malformed-nul' && command === 'diff' && has('--cached', '--name-only')) { process.stdout.write('not-nul-terminated'); process.exit(0); }",
      "if (mode === 'malformed-index' && command === 'ls-files' && has('--stage')) { process.stdout.write('bad-index\\0'); process.exit(0); }",
      "const result = spawnSync(process.env.CHANGE_PROOF_REAL_GIT, args, { cwd: process.cwd(), encoding: 'utf8', env: process.env });",
      "if (result.error) { process.stderr.write(result.error.message); process.exit(126); }",
      "if (command === 'restore' && result.status === 0 && mode === 'divergence') { appendFileSync('modified.txt', 'diverged\\n'); }",
      "if (command === 'restore' && result.status === 0 && mode === 'untracked') { writeFileSync('unexpected-untracked.txt', 'unexpected\\n'); }",
      "if (command === 'restore' && result.status === 0 && mode === 'extra-path') { writeFileSync('excluded-modified.txt', 'unexpected\\n'); spawnSync(process.env.CHANGE_PROOF_REAL_GIT, ['add', '--', 'excluded-modified.txt'], { cwd: process.cwd(), env: process.env }); }",
      "if (command === 'restore' && result.status === 0 && mode === 'missing-path') { spawnSync(process.env.CHANGE_PROOF_REAL_GIT, ['restore', '--source=HEAD', '--staged', '--worktree', '--', 'modified.txt'], { cwd: process.cwd(), env: process.env }); }",
      "if (command === 'restore' && result.status === 0 && mode === 'move-head') { spawnSync(process.env.CHANGE_PROOF_REAL_GIT, ['reset', '--hard', process.env.CHANGE_PROOF_HEAD_SHA], { cwd: process.cwd(), env: process.env }); }",
      "if (command === 'restore' && result.status === 0 && mode === 'partial-restore') { process.stdout.write(result.stdout ?? ''); process.stderr.write('partial failure'); process.exit(8); }",
      "process.stdout.write(result.stdout ?? '');",
      "process.stderr.write(result.stderr ?? '');",
      "if (result.signal) { process.kill(process.pid, result.signal); }",
      "process.exit(result.status ?? 125);",
      "",
    ].join("\n"),
  );
  chmodSync(shimPath, 0o700);
});

after(() => {
  rmSync(temporaryRoot, {
    recursive: true,
    force: true,
  });
});

test(
  "validates factory configuration explicitly",
  () => {
    for (const [field, value] of [
      ["gitExecutable", ""],
      ["environment", null],
      ["timeoutMs", 0],
      ["timeoutMs", 2_147_483_648],
      ["maxStdoutBytes", 0],
      ["maxStderrBytes", -1],
    ]) {
      assert.throws(
        () => createExplicitEnvelopeMaterializer(
          processConfiguration({ [field]: value }),
        ),
        (error) => {
          assert.equal(
            error.code,
            EXPLICIT_ENVELOPE_ERROR_CODES
              .INVALID_CONFIGURATION,
          );
          assert.equal(error.field, field);
          return true;
        },
      );
    }
  },
);

test(
  "validates exact immutable commit IDs",
  async (suite) => {
    for (const [field, code] of [
      [
        "baseCommitId",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_BASE_COMMIT,
      ],
      [
        "headCommitId",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_HEAD_COMMIT,
      ],
    ]) {
      for (const value of [
        "HEAD",
        "abc",
        "A".repeat(40),
        "-".repeat(40),
      ]) {
        await suite.test(
          `${field}:${value.length}`,
          () => expectMaterializationError(
            () => runEnvelope(
              [paths.modified],
              {
                specOverrides: {
                  [field]: value,
                },
              },
            ),
            code,
          ),
        );
      }
    }
  },
);

test(
  "rejects unresolved immutable base and head commits",
  async (suite) => {
    for (const [field, code, value] of [
      [
        "baseCommitId",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNRESOLVED_BASE_COMMIT,
        "a".repeat(40),
      ],
      [
        "headCommitId",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNRESOLVED_HEAD_COMMIT,
        "b".repeat(40),
      ],
    ]) {
      await suite.test(field, () =>
        expectMaterializationError(
          () => runEnvelope(
            [paths.modified],
            {
              specOverrides: {
                [field]: value,
              },
            },
          ),
          code,
        ));
    }
  },
);

test(
  "rejects unsafe, duplicate, and empty included paths",
  async (suite) => {
    await suite.test("empty collection", () =>
      expectMaterializationError(
        () => runEnvelope([]),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .EMPTY_ENVELOPE,
      ));
    await suite.test("not an array", () =>
      expectMaterializationError(
        () => runEnvelope(null),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_PATH_COLLECTION,
      ));
    await suite.test("duplicate", () =>
      expectMaterializationError(
        () => runEnvelope([
          paths.modified,
          paths.modified,
        ]),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .DUPLICATE_PATH,
      ));

    for (const unsafe of [
      "",
      ".",
      "..",
      "/absolute",
      "C:\\absolute",
      "../outside",
      "nested/../outside",
      "nested//file",
      "nested\\file",
      "nul\0file",
    ]) {
      await suite.test(
        `unsafe:${JSON.stringify(unsafe)}`,
        () => expectMaterializationError(
          () => runEnvelope([unsafe]),
          EXPLICIT_ENVELOPE_ERROR_CODES
            .UNSAFE_PATH,
        ),
      );
    }
  },
);

test(
  "materializes modified, added, and deleted files individually",
  async (suite) => {
    for (const [kind, path] of [
      ["modified", paths.modified],
      ["added", paths.added],
      ["deleted", paths.deleted],
    ]) {
      await suite.test(kind, async () => {
        const { value, cleanup } =
          await runEnvelope([path]);
        const evidence = value.evidence;

        assert.equal(
          evidence.boundary.boundaryValid,
          true,
        );
        assert.deepEqual(
          evidence.resultingChangedPaths,
          [path],
        );
        assert.equal(
          evidence.stateCBlobIds[path],
          evidence.headBlobIds[path],
        );

        if (kind === "added") {
          assert.equal(
            evidence.baseBlobIds[path],
            null,
          );
        }

        if (kind === "deleted") {
          assert.equal(
            evidence.headBlobIds[path],
            null,
          );
          assert.equal(
            evidence.stateCBlobIds[path],
            null,
          );
        }

        assert.equal(cleanup.cleanupCompleted, true);
      });
    }
  },
);

test(
  "materializes a deterministic mixed envelope and proves excluded paths",
  async () => {
    const selected = Object.freeze([
      paths.deleted,
      paths.added,
      paths.modified,
    ]);
    const original = JSON.stringify(selected);
    const { value } = await runEnvelope(selected);
    const { evidence, boundary } = value;

    assert.equal(JSON.stringify(selected), original);
    assert.deepEqual(evidence.includedPaths, [
      paths.added,
      paths.deleted,
      paths.modified,
    ]);
    assert.deepEqual(
      evidence.materializedPaths,
      evidence.includedPaths,
    );
    assert.deepEqual(
      evidence.resultingChangedPaths,
      evidence.includedPaths,
    );
    assert.equal(boundary.boundaryValid, true);
    assert.deepEqual(boundary, evidence.boundary);
    assert.notEqual(boundary, evidence.boundary);

    for (const path of evidence.headChangedPaths) {
      assert.equal(
        evidence.stateCModes[path],
        evidence.includedPaths.includes(path)
          ? evidence.headModes[path]
          : evidence.baseModes[path],
      );
    }

    for (const path of
      evidence.excludedChangedPaths) {
      assert.equal(
        evidence.stateCBlobIds[path],
        evidence.baseBlobIds[path],
      );
    }

    assert.equal(
      evidence.stateCBlobIds[
        paths.excludedAdded
      ],
      null,
    );
    assert.notEqual(
      evidence.stateCBlobIds[
        paths.excludedDeleted
      ],
      null,
    );
    assert.doesNotThrow(() =>
      JSON.stringify(evidence));
    assert.equal(
      JSON.stringify(evidence).includes(
        temporaryParent,
      ),
      false,
    );
  },
);

test(
  "does not mutate a deeply frozen materialization specification",
  async () => {
    const includedPaths = Object.freeze([
      paths.modified,
    ]);
    const input = Object.freeze({
      repositoryRoot: repository,
      baseCommitId: baseSha,
      headCommitId: headSha,
      includedPaths,
    });
    const before = JSON.stringify(input);
    const lifecycle = createOwnedWorkspaceLifecycle(
      lifecycleConfiguration(),
    );
    const materializer =
      createExplicitEnvelopeMaterializer(
        processConfiguration(),
      );

    const { value } = await lifecycle
      .withOwnedWorkspace((invocation) =>
        materializer.materializeExplicitEnvelope(
          invocation,
          input,
        ));

    assert.equal(JSON.stringify(input), before);
    assert.equal(value.boundary.boundaryValid, true);
  },
);

test(
  "handles literal spaces, Unicode, leading hyphens, tabs, and newlines",
  async () => {
    const selected = [
      paths.spaced,
      paths.unicode,
      paths.leadingHyphen,
      paths.tab,
      paths.newline,
    ];
    const { value } = await runEnvelope(selected);

    assert.deepEqual(
      value.evidence.includedPaths,
      [...selected].sort(),
    );
    assert.deepEqual(
      value.evidence.resultingChangedPaths,
      [...selected].sort(),
    );
    assert.equal(value.boundary.boundaryValid, true);
  },
);

test(
  "represents a rename as explicit deletion plus addition",
  async () => {
    const { value } = await runEnvelope([
      paths.renameOld,
      paths.renameNew,
    ]);
    const evidence = value.evidence;

    assert.equal(
      evidence.baseBlobIds[paths.renameNew],
      null,
    );
    assert.equal(
      evidence.headBlobIds[paths.renameOld],
      null,
    );
    assert.equal(
      evidence.stateCBlobIds[paths.renameOld],
      null,
    );
    assert.equal(
      evidence.stateCBlobIds[paths.renameNew],
      evidence.headBlobIds[paths.renameNew],
    );
    assert.equal(evidence.boundary.boundaryValid, true);
  },
);

test(
  "supports a changed regular executable when its mode is stable",
  async () => {
    const { value } = await runEnvelope([
      paths.executable,
    ]);

    assert.equal(value.boundary.boundaryValid, true);
    assert.equal(
      value.evidence.stateCBlobIds[
        paths.executable
      ],
      value.evidence.headBlobIds[
        paths.executable
      ],
    );
  },
);

test(
  "proves State C identity, index consistency, and repository safety",
  async () => {
    const beforeHead = outputGit(["rev-parse", "HEAD"]);
    const beforeStatus = outputGit([
      "status",
      "--porcelain=v1",
    ]);
    const beforeRefs = refsSnapshot();
    const beforeWorktrees = worktreePaths();
    let stateCPath;

    const { value, cleanup } = await runEnvelope(
      [paths.modified],
      {
        inspect(result) {
          stateCPath = result.stateCWorktreePath;
          assert.equal(
            outputGit(
              ["rev-parse", "HEAD"],
              stateCPath,
            ),
            baseSha,
          );
          assert.equal(
            runGit(
              ["symbolic-ref", "--quiet", "HEAD"],
              stateCPath,
              { allowFailure: true },
            ).status,
            1,
          );
          assert.equal(
            outputGit(
              ["diff", "--name-only"],
              stateCPath,
            ),
            "",
          );
          assert.equal(
            outputGit(
              ["diff", "--cached", "--name-only"],
              stateCPath,
            ),
            paths.modified,
          );
          return result;
        },
      },
    );

    assert.equal(
      value.evidence.stateCBaseCommitId,
      baseSha,
    );
    assert.equal(cleanup.cleanupCompleted, true);
    assert.equal(existsSync(stateCPath), false);
    assert.deepEqual(worktreePaths(), beforeWorktrees);
    assert.equal(outputGit(["rev-parse", "HEAD"]), beforeHead);
    assert.equal(
      outputGit(["status", "--porcelain=v1"]),
      beforeStatus,
    );
    assert.equal(refsSnapshot(), beforeRefs);
  },
);

test(
  "returns independent deterministic evidence between runs",
  async () => {
    const first = (
      await runEnvelope([
        paths.added,
        paths.modified,
      ])
    ).value;
    const second = (
      await runEnvelope([
        paths.modified,
        paths.added,
      ])
    ).value;

    assert.deepEqual(first.evidence, second.evidence);
    assert.notEqual(first.evidence, second.evidence);
    assert.notEqual(
      first.evidence.includedPaths,
      second.evidence.includedPaths,
    );
    first.evidence.includedPaths.push("mutation");
    assert.equal(
      second.evidence.includedPaths.includes(
        "mutation",
      ),
      false,
    );
  },
);

test(
  "rejects invalid repository roots, invocations, and unchanged paths",
  async (suite) => {
    const materializer =
      createExplicitEnvelopeMaterializer(
        processConfiguration(),
      );

    await suite.test("invalid invocation", () =>
      expectMaterializationError(
        () => materializer.materializeExplicitEnvelope(
          {},
          specification([paths.modified]),
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_OWNED_INVOCATION,
      ));
    await suite.test("non-repository", () =>
      expectMaterializationError(
        () => runEnvelope([paths.modified], {
          specOverrides: {
            repositoryRoot: nonRepository,
          },
        }),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_REPOSITORY_ROOT,
      ));
    await suite.test("nested root", () =>
      expectMaterializationError(
        () => runEnvelope([paths.modified], {
          specOverrides: {
            repositoryRoot: join(
              repository,
              ".git",
            ),
          },
        }),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INVALID_REPOSITORY_ROOT,
      ));
    await suite.test("unchanged path", () =>
      expectMaterializationError(
        () => runEnvelope(["unchanged.txt"]),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INCLUDED_PATH_NOT_CHANGED,
      ));
    await suite.test("directory expansion", () =>
      expectMaterializationError(
        () => runEnvelope(["some-directory"]),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INCLUDED_PATH_NOT_CHANGED,
      ));
    await suite.test("literal pathspec magic", () =>
      expectMaterializationError(
        () => runEnvelope([":(glob)*"]),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .INCLUDED_PATH_NOT_CHANGED,
      ));
  },
);

test(
  "rejects State C not based on base, attached, or initially dirty",
  async (suite) => {
    async function withFakeInvocation(kind) {
      const fakeRoot = mkdtempSync(
        join(temporaryParent, "fake invocation-"),
      );
      const statePath = join(fakeRoot, "state-c");
      const fake = {
        workspacePath: fakeRoot,
        createDetachedWorktree() {
          runGit([
            "worktree",
            "add",
            "--detach",
            statePath,
            kind === "wrong-head" ? headSha : baseSha,
          ]);

          if (kind === "dirty") {
            writeFileSync(
              join(statePath, paths.modified),
              "dirty\n",
            );
          }

          if (kind === "attached") {
            runGit([
              "branch",
              "fake-attached",
              baseSha,
            ]);
            runGit([
              "symbolic-ref",
              "HEAD",
              "refs/heads/fake-attached",
            ], statePath);
          }

          return {
            name: "state-c",
            path: statePath,
            commitId: baseSha,
            detached: true,
            clean: kind !== "dirty",
          };
        },
      };

      try {
        return await createExplicitEnvelopeMaterializer(
          processConfiguration(),
        ).materializeExplicitEnvelope(
          fake,
          specification([paths.modified]),
        );
      } finally {
        runGit([
          "worktree",
          "remove",
          "--force",
          statePath,
        ]);

        if (kind === "attached") {
          runGit([
            "branch",
            "-D",
            "fake-attached",
          ]);
        }
        rmSync(fakeRoot, {
          recursive: true,
          force: true,
        });
      }
    }

    await suite.test("wrong head", () =>
      expectMaterializationError(
        () => withFakeInvocation("wrong-head"),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .STATE_C_NOT_BASED_ON_BASE,
      ));
    await suite.test("dirty", () =>
      expectMaterializationError(
        () => withFakeInvocation("dirty"),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .STATE_C_NOT_INITIALLY_CLEAN,
      ));
    await suite.test("attached", () =>
      expectMaterializationError(
        () => withFakeInvocation("attached"),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .STATE_C_NOT_DETACHED,
      ));
  },
);

test(
  "returns invalid boundary evidence for extra or missing resulting paths",
  async (suite) => {
    for (const [mode, reason] of [
      ["extra-path", "RESULTING_CHANGED_PATHS_MISMATCH"],
      ["missing-path", "RESULTING_CHANGED_PATHS_MISMATCH"],
    ]) {
      await suite.test(mode, async () => {
        const { value } = await runEnvelope(
          [paths.modified],
          { mode },
        );

        assert.equal(value.boundary.boundaryValid, false);
        assert.equal(
          value.boundary.reasonCodes.includes(reason),
          true,
        );
      });
    }
  },
);

test(
  "detects worktree/index divergence and State C HEAD movement",
  async (suite) => {
    await suite.test("divergence", () =>
      expectMaterializationError(
        () => runEnvelope(
          [paths.modified],
          { mode: "divergence" },
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .WORKTREE_INDEX_DIVERGENCE,
      ));
    await suite.test("untracked divergence", () =>
      expectMaterializationError(
        () => runEnvelope(
          [paths.modified],
          { mode: "untracked" },
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .WORKTREE_INDEX_DIVERGENCE,
      ));
    await suite.test("head movement", () =>
      expectMaterializationError(
        () => runEnvelope(
          [paths.modified],
          {
            mode: "move-head",
            materializerOverrides: {
              environment: {
                ...gitEnvironment,
                CHANGE_PROOF_REAL_GIT:
                  gitExecutable,
                CHANGE_PROOF_SHIM_MODE:
                  "move-head",
                CHANGE_PROOF_HEAD_SHA: headSha,
              },
            },
          },
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .STATE_C_NOT_BASED_ON_BASE,
      ));
  },
);

test(
  "maps restore, partial restore, spawn, timeout, signal, truncation, and malformed output",
  async (suite) => {
    for (const [mode, code, overrides] of [
      [
        "restore-fail",
        EXPLICIT_ENVELOPE_ERROR_CODES.RESTORE_FAILED,
        {},
      ],
      [
        "partial-restore",
        EXPLICIT_ENVELOPE_ERROR_CODES.RESTORE_FAILED,
        {},
      ],
      [
        "timeout",
        EXPLICIT_ENVELOPE_ERROR_CODES.GIT_TIMEOUT,
        { timeoutMs: 250 },
      ],
      [
        "signal",
        EXPLICIT_ENVELOPE_ERROR_CODES.GIT_SIGNAL,
        {},
      ],
      [
        "stdout-truncated",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .GIT_STDOUT_TRUNCATED,
        {},
      ],
      [
        "stderr-truncated",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .GIT_STDERR_TRUNCATED,
        {},
      ],
      [
        "malformed-nul",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .MALFORMED_NUL_OUTPUT,
        {},
      ],
      [
        "malformed-index",
        EXPLICIT_ENVELOPE_ERROR_CODES
          .MALFORMED_NUL_OUTPUT,
        {},
      ],
    ]) {
      await suite.test(mode, () =>
        expectMaterializationError(
          () => runEnvelope(
            [paths.modified],
            {
              mode,
              materializerOverrides: overrides,
            },
          ),
          code,
        ));
    }

    await suite.test("spawn", () =>
      expectMaterializationError(
        () => runEnvelope(
          [paths.modified],
          {
            materializerOverrides: {
              gitExecutable: join(
                temporaryRoot,
                "missing git",
              ),
            },
          },
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .GIT_PROCESS_ERROR,
      ));
  },
);

test(
  "materialization failure leaves the primary checkout and refs unchanged",
  async () => {
    const beforeHead = outputGit(["rev-parse", "HEAD"]);
    const beforeStatus = outputGit([
      "status",
      "--porcelain=v1",
    ]);
    const beforeRefs = refsSnapshot();
    const beforeWorktrees = worktreePaths();

    await expectMaterializationError(
      () => runEnvelope(
        [paths.modified],
        { mode: "partial-restore" },
      ),
      EXPLICIT_ENVELOPE_ERROR_CODES
        .RESTORE_FAILED,
    );

    assert.equal(outputGit(["rev-parse", "HEAD"]), beforeHead);
    assert.equal(
      outputGit(["status", "--porcelain=v1"]),
      beforeStatus,
    );
    assert.equal(refsSnapshot(), beforeRefs);
    assert.deepEqual(worktreePaths(), beforeWorktrees);
  },
);

test(
  "lifecycle cleanup succeeds after materialization and callback failures",
  async () => {
    const beforeWorktrees = worktreePaths();
    let statePath;

    await assert.rejects(
      () => runEnvelope(
        [paths.modified],
        {
          inspect(result) {
            statePath = result.stateCWorktreePath;
            throw new Error("later orchestrator failure");
          },
        },
      ),
      { message: "later orchestrator failure" },
    );

    assert.equal(existsSync(statePath), false);
    assert.deepEqual(worktreePaths(), beforeWorktrees);
  },
);

test(
  "fails closed on symlinks and gitlinks",
  async (suite) => {
    const symlinkRepository = createSpecialRepository(
      "symlink repository",
      ({ write, git }) => {
        write("keep", "keep\n");
        git(["add", "-A"]);
        git(["commit", "-m", "base"]);
        const base = git([
          "rev-parse",
          "HEAD",
        ]).stdout.trim();
        git(["-c", "core.symlinks=true", "symbolic-ref", "HEAD"]);
        const linkPath = join(
          temporaryRoot,
          "symlink repository",
          "link",
        );
        const linkResult = spawnSync(
          "ln",
          ["-s", "keep", linkPath],
        );
        assert.equal(linkResult.status, 0);
        git(["add", "--", "link"]);
        git(["commit", "-m", "head"]);
        return {
          base,
          head: git(["rev-parse", "HEAD"])
            .stdout.trim(),
        };
      },
    );

    const gitlinkRepository = createSpecialRepository(
      "gitlink repository",
      ({ write, git }) => {
        write("keep", "keep\n");
        git(["add", "-A"]);
        git(["commit", "-m", "base"]);
        const base = git([
          "rev-parse",
          "HEAD",
        ]).stdout.trim();
        git([
          "update-index",
          "--add",
          "--cacheinfo",
          `160000,${base},module`,
        ]);
        git(["commit", "-m", "head"]);
        return {
          base,
          head: git(["rev-parse", "HEAD"])
            .stdout.trim(),
        };
      },
    );

    for (const [label, special, path] of [
      ["symlink", symlinkRepository, "link"],
      ["gitlink", gitlinkRepository, "module"],
    ]) {
      await suite.test(label, () =>
        expectMaterializationError(
          () => runSpecialEnvelope(special, [path]),
          EXPLICIT_ENVELOPE_ERROR_CODES
            .UNSUPPORTED_ENTRY_TYPE,
        ));
    }
  },
);

test(
  "fails closed on mode-only and file-directory transitions",
  async (suite) => {
    const modeRepository = createSpecialRepository(
      "mode repository",
      ({ write, git }) => {
        write("script.sh", "echo same\n", 0o644);
        git(["add", "-A"]);
        git(["commit", "-m", "base"]);
        const base = git(["rev-parse", "HEAD"])
          .stdout.trim();
        chmodSync(
          join(
            temporaryRoot,
            "mode repository",
            "script.sh",
          ),
          0o755,
        );
        git(["add", "-A"]);
        git(["commit", "-m", "head"]);
        return {
          base,
          head: git(["rev-parse", "HEAD"])
            .stdout.trim(),
        };
      },
    );
    const fileToDirectory = createSpecialRepository(
      "file to directory repository",
      ({ write, git }) => {
        write("shape", "file\n");
        git(["add", "-A"]);
        git(["commit", "-m", "base"]);
        const base = git(["rev-parse", "HEAD"])
          .stdout.trim();
        rmSync(join(
          temporaryRoot,
          "file to directory repository",
          "shape",
        ));
        write("shape/child", "child\n");
        git(["add", "-A"]);
        git(["commit", "-m", "head"]);
        return {
          base,
          head: git(["rev-parse", "HEAD"])
            .stdout.trim(),
        };
      },
    );
    const directoryToFile = createSpecialRepository(
      "directory to file repository",
      ({ write, git }) => {
        write("shape/child", "child\n");
        git(["add", "-A"]);
        git(["commit", "-m", "base"]);
        const base = git(["rev-parse", "HEAD"])
          .stdout.trim();
        rmSync(join(
          temporaryRoot,
          "directory to file repository",
          "shape",
        ), { recursive: true });
        write("shape", "file\n");
        git(["add", "-A"]);
        git(["commit", "-m", "head"]);
        return {
          base,
          head: git(["rev-parse", "HEAD"])
            .stdout.trim(),
        };
      },
    );

    await suite.test("mode transition", () =>
      expectMaterializationError(
        () => runSpecialEnvelope(
          modeRepository,
          ["script.sh"],
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNSUPPORTED_MODE_TRANSITION,
      ));
    await suite.test("file to directory", () =>
      expectMaterializationError(
        () => runSpecialEnvelope(
          fileToDirectory,
          ["shape"],
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNSUPPORTED_PATH_SHAPE_TRANSITION,
      ));
    await suite.test("directory to file", () =>
      expectMaterializationError(
        () => runSpecialEnvelope(
          directoryToFile,
          ["shape"],
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNSUPPORTED_PATH_SHAPE_TRANSITION,
      ));
    await suite.test("selected prefix collision", () =>
      expectMaterializationError(
        () => runSpecialEnvelope(
          fileToDirectory,
          ["shape", "shape/child"],
        ),
        EXPLICIT_ENVELOPE_ERROR_CODES
          .UNSUPPORTED_PATH_SHAPE_TRANSITION,
      ));
  },
);

test(
  "production source remains shell-free, bounded, and inside M2.8",
  () => {
    const source = readFileSync(
      join(
        process.cwd(),
        "src/core/materialize-explicit-envelope.mjs",
      ),
      "utf8",
    );

    for (const forbidden of [
      "node:child_process",
      "process.env",
      "shell:",
      '"commit"',
      '"branch"',
      '"checkout"',
      '"switch"',
      '"reset"',
      '"update-ref"',
      '"merge"',
      '"cherry-pick"',
      '"rebase"',
      '"clean"',
      '"add"',
      "OBSERVED_TEST_DISCRIMINATION",
      "node:test",
      "free-shipping",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  },
);
