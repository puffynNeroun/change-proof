import assert from "node:assert/strict";
import {
  after,
  before,
  test,
} from "node:test";

import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";

import {
  tmpdir,
} from "node:os";

import {
  join,
} from "node:path";

import {
  spawnSync,
} from "node:child_process";

import {
  GIT_PRIMITIVE_ERROR_CODES,
  GitPrimitiveError,
  createGitRepositoryPrimitives,
} from "../../src/core/git-repository-primitives.mjs";

const gitExecutable =
  process.env.CHANGE_PROOF_GIT ??
  "git";

const gitEnvironment = {
  ...process.env,

  LC_ALL: "C",
  LANG: "C",

  GIT_CONFIG_NOSYSTEM: "1",
  GIT_OPTIONAL_LOCKS: "0",

  GIT_AUTHOR_DATE:
    "2000-01-01T00:00:00Z",

  GIT_COMMITTER_DATE:
    "2000-01-01T00:00:00Z",
};

let temporaryRoot;
let repository;
let nestedDirectory;
let nonRepository;

let baseSha;
let headSha;

let primitives;

function runSetupGit(
  argumentsList,
  workingDirectory,
) {
  const result =
    spawnSync(
      gitExecutable,
      argumentsList,
      {
        cwd: workingDirectory,
        encoding: "utf8",
        env: gitEnvironment,
      },
    );

  assert.equal(
    result.error,
    undefined,
    result.error?.message,
  );

  assert.equal(
    result.status,
    0,
    [
      `git ${argumentsList.join(" ")}`,
      result.stdout,
      result.stderr,
    ].join("\n"),
  );

  return result.stdout.trim();
}

async function expectGitError(
  operation,
  code,
  operationName,
) {
  await assert.rejects(
    operation,
    (error) => {
      assert.equal(
        error instanceof
          GitPrimitiveError,
        true,
      );

      assert.equal(
        error.code,
        code,
      );

      assert.equal(
        error.operation,
        operationName,
      );

      return true;
    },
  );
}

before(() => {
  temporaryRoot =
    mkdtempSync(
      join(
        tmpdir(),
        "change-proof-m26-git-",
      ),
    );

  repository =
    join(
      temporaryRoot,
      "repository with spaces",
    );

  nestedDirectory =
    join(
      repository,
      "nested",
    );

  nonRepository =
    join(
      temporaryRoot,
      "not-a-repository",
    );

  mkdirSync(
    nestedDirectory,
    {
      recursive: true,
    },
  );

  mkdirSync(
    nonRepository,
    {
      recursive: true,
    },
  );

  runSetupGit(
    [
      "init",
      "-b",
      "main",
    ],
    repository,
  );

  runSetupGit(
    [
      "config",
      "user.name",
      "Change Proof M2.6",
    ],
    repository,
  );

  runSetupGit(
    [
      "config",
      "user.email",
      "m2.6@example.invalid",
    ],
    repository,
  );

  writeFileSync(
    join(repository, "keep.txt"),
    "unchanged\n",
    "utf8",
  );

  writeFileSync(
    join(repository, "modify.txt"),
    "base version\n",
    "utf8",
  );

  writeFileSync(
    join(repository, "delete.txt"),
    "deleted on head\n",
    "utf8",
  );

  writeFileSync(
    join(
      repository,
      "rename-old.txt",
    ),
    "rename content\n",
    "utf8",
  );

  writeFileSync(
    join(
      repository,
      "space name.txt",
    ),
    "space base\n",
    "utf8",
  );

  writeFileSync(
    join(
      nestedDirectory,
      "value.txt",
    ),
    "nested base\n",
    "utf8",
  );

  runSetupGit(
    [
      "add",
      "--",
      ".",
    ],
    repository,
  );

  runSetupGit(
    [
      "commit",
      "-m",
      "base",
    ],
    repository,
  );

  baseSha =
    runSetupGit(
      [
        "rev-parse",
        "HEAD^{commit}",
      ],
      repository,
    );

  writeFileSync(
    join(repository, "modify.txt"),
    "head version\n",
    "utf8",
  );

  writeFileSync(
    join(repository, "add.txt"),
    "added on head\n",
    "utf8",
  );

  writeFileSync(
    join(
      repository,
      "space name.txt",
    ),
    "space head\n",
    "utf8",
  );

  writeFileSync(
    join(
      repository,
      "unicodé.txt",
    ),
    "unicode addition\n",
    "utf8",
  );

  writeFileSync(
    join(
      nestedDirectory,
      "value.txt",
    ),
    "nested head\n",
    "utf8",
  );

  rmSync(
    join(
      repository,
      "delete.txt",
    ),
  );

  runSetupGit(
    [
      "mv",
      "--",
      "rename-old.txt",
      "rename-new.txt",
    ],
    repository,
  );

  runSetupGit(
    [
      "add",
      "-A",
    ],
    repository,
  );

  runSetupGit(
    [
      "commit",
      "-m",
      "head",
    ],
    repository,
  );

  headSha =
    runSetupGit(
      [
        "rev-parse",
        "HEAD^{commit}",
      ],
      repository,
    );

  primitives =
    createGitRepositoryPrimitives({
      gitExecutable,

      environment: {
        ...gitEnvironment,
      },

      timeoutMs: 5_000,

      maxStdoutBytes:
        1024 * 1024,

      maxStderrBytes:
        1024 * 1024,
    });
});

after(() => {
  rmSync(
    temporaryRoot,
    {
      recursive: true,
      force: true,
    },
  );
});

test(
  "resolves the repository root from a nested directory",
  async () => {
    assert.equal(
      await primitives
        .resolveRepositoryRoot(
          nestedDirectory,
        ),
      repository,
    );
  },
);

test(
  "resolves refs to immutable full commit IDs",
  async () =>{
    assert.equal(
      await primitives.resolveCommit(
        repository,
        baseSha,
      ),
      baseSha,
    );

    assert.equal(
      await primitives.resolveCommit(
        repository,
        "HEAD",
      ),
      headSha,
    );

    assert.match(
      headSha,
      /^[0-9a-f]{40}$/,
    );
  },
);

test(
  "rejects an unresolved Git ref explicitly",
  async () => {
    await expectGitError(
      () =>
        primitives.resolveCommit(
          repository,
          "definitely-missing-ref",
        ),

      GIT_PRIMITIVE_ERROR_CODES
        .REF_RESOLUTION_FAILED,

      "resolve_commit",
    );
  },
);

test(
  "lists changed paths without rename inference",
  async () => {
    assert.deepEqual(
      await primitives
        .listChangedPaths(
          repository,
          baseSha,
          headSha,
        ),

      [
        "add.txt",
        "delete.txt",
        "modify.txt",
        "nested/value.txt",
        "rename-new.txt",
        "rename-old.txt",
        "space name.txt",
        "unicodé.txt",
      ],
    );
  },
);

test(
  "preserves spaces and Unicode in NUL-delimited paths",
  async () => {
    const paths =
      await primitives
        .listChangedPaths(
          repository,
          baseSha,
          headSha,
        );

    assert.equal(
      paths.includes(
        "space name.txt",
      ),
      true,
    );

    assert.equal(
      paths.includes(
        "unicodé.txt",
      ),
      true,
    );
  },
);

test(
  "returns no changed paths for the same immutable commit",
  async () => {
    assert.deepEqual(
      await primitives
        .listChangedPaths(
          repository,
          headSha,
          headSha,
        ),

      [],
    );
  },
);

test(
  "returns equal blob IDs for an unchanged file",
  async () => {
    const base =
      await primitives
        .readCommitBlobIds(
          repository,
          baseSha,
          ["keep.txt"],
        );

    const head =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          ["keep.txt"],
        );

    assert.match(
      base["keep.txt"],
      /^[0-9a-f]{40}$/,
    );

    assert.equal(
      base["keep.txt"],
      head["keep.txt"],
    );
  },
);

test(
  "returns different blob IDs for a modified file",
  async () => {
    const base =
      await primitives
        .readCommitBlobIds(
          repository,
          baseSha,
          ["modify.txt"],
        );

    const head =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          ["modify.txt"],
        );

    assert.notEqual(
      base["modify.txt"],
      null,
    );

    assert.notEqual(
      head["modify.txt"],
      null,
    );

    assert.notEqual(
      base["modify.txt"],
      head["modify.txt"],
    );
  },
);

test(
  "uses null blob identities for additions and deletions",
  async () => {
    const paths = [
      "add.txt",
      "delete.txt",
    ];

    const base =
      await primitives
        .readCommitBlobIds(
          repository,
          baseSha,
          paths,
        );

    const head =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          paths,
        );

    assert.equal(
      base["add.txt"],
      null,
    );

    assert.notEqual(
      head["add.txt"],
      null,
    );

    assert.notEqual(
      base["delete.txt"],
      null,
    );

    assert.equal(
      head["delete.txt"],
      null,
    );
  },
);

test(
  "represents a rename as delete pl addition while preserving its blob",
  async () => {
    const base =
      await primitives
        .readCommitBlobIds(
          repository,
          baseSha,
          [
            "rename-new.txt",
            "rename-old.txt",
          ],
        );

    const head =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          [
            "rename-new.txt",
            "rename-old.txt",
          ],
        );

    assert.notEqual(
      base["rename-old.txt"],
      null,
    );

    assert.equal(
      base["rename-new.txt"],
      null,
    );

    assert.equal(
      head["rename-old.txt"],
      null,
    );

    assert.equal(
      base["rename-old.txt"],
      head["rename-new.txt"],
    );
  },
);

test(
  "returns null for a path absent from the commit",
  async () => {
    assert.deepEqual(
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          ["missing.txt"],
        ),

      {
        "missing.txt": null,
      },
    );
  },
);

test(
  "returns deterministic blob maps without mutating path input",
  async () => {
    const paths =
      Object.freeze([
        "modify.txt",
        "keep.txt",
      ]);

    const before =
      JSON.stringify(paths);

    const first =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          paths,
        );

    const second =
      await primitives
        .readCommitBlobIds(
          repository,
          headSha,
          paths,
        );

    assert.equal(
      JSON.stringify(paths),
      before,
    );

    assert.deepEqual(
      first,
      second,
    );

    assert.deepEqual(
      Object.keys(first),
      [
        "keep.txt",
        "modify.txt",
      ],
    );

    assert.notEqual(
      first,
      second,
    );
  },
);

test(
  "reports a committed repository as clean",
  async () => {
    assert.equal(
      await primitives
        .isWorktreeClean(
          repository,
        ),
      true,
    );
  },
);

test(
  "detects a dirty tracked worktree",
  async () => {
    try {
      appendFileSync(
        join(
          repository,
          "keep.txt",
        ),
        "dirty\n",
        "utf8",
      );

      assert.equal(
        await primitives
          .isWorktreeClean(
            repository,
          ),
        false,
      );
    } finally {
      runSetupGit(
        [
          "restore",
          "--",
          "keep.txt",
        ],
        repository,
      );
    }

    assert.equal(
      await primitives
        .isWorktreeClean(
          repository,
        ),
      true,
    );
  },
);

test(
  "detects an untracked worktree path",
  async () => {
    const path =
      join(
        repository,
        "untracked.txt",
      );

    try {
      writeFileSync(
        path,
        "untracked\n",
        "utf8",
      );

      assert.equal(
        await primitives
          .isWorktreeClean(
            repository,
          ),
        false,
      );
    } finally {
      rmSync(
        path,
        {
          force: true,
        },
      );
    }

    assert.equal(
      await primitives
        .isWorktreeClean(
          repository,
        ),
      true,
    );
  },
);

test(
  "validates the primitive factory configuration",
  () => {
    assert.throws(
      () =>
        createGitRepositoryPrimitives(),

      {
        message:
          "invalid_git_string:" +
          "gitExecutable",
      },
    );

    assert.throws(
      () =>
        createGitRepositoryPrimitives({
          gitExecutable: "git",
          environment: null,
          timeoutMs: 1,
          maxStdoutBytes: 1,
          maxStderrBytes: 1,
        }),

      {
        message:
          "invalid_git_environment",
      },
    );

    assert.throws(
      () =>
        createGitRepositoryPrimitives({
          gitExecutable: "git",
          environment: {},
          timeoutMs: 0,
          maxStdoutBytes: 1,
          maxStderrBytes: 1,
        }),

      {
        message:
          "invalid_git_integer:" +
          "timeoutMs",
      },
    );

    assert.throws(
      () =>
        createGitRepositoryPrimitives({
          gitExecutable: "git",
          environment: {},
          timeoutMs: 1,
          maxStdoutBytes: 0,
          maxStderrBytes: 1,
        }),

      {
        message:
          "invalid_git_integer:" +
          "maxStdoutBytes",
      },
    );
  },
);

test(
  "validates repository directories",
  async () => {
    for (const directory of [
      undefined,
      null,
      "",
      "bad\0directory",
    ]) {
      await assert.rejects(
        () =>
          primitives
            .resolveRepositoryRoot(
              directory,
            ),

        {
          message:
            "invalid_git_string:" +
            "directory",
        },
      );
    }
  },
);

test(
  "validates refs before invoking Git",
  async () => {
    for (const reference of [
      undefined,
      null,
      "",
      "bad\0ref",
    ]) {
      await assert.rejects(
        () =>
          primitives.resolveCommit(
            repository,
            reference,
          ),

        {
          message:
            "invalid_git_string:ref",
        },
      );
    }

    for (const reference of [
      "bad\nref",
      "bad\rref",
    ]) {
      await assert.rejects(
        () =>
          primitives.resolveCommit(
            repository,
            reference,
          ),

        {
          message:
            "invalid_git_ref",
        },
      );
    }
  },
);

test(
  "requires immutable commit IDs for tree comparisons",
  async () => {
    for (const value of [
      "HEAD",
      "",
      "abc",
      "g".repeat(40),
      "a".repeat(41),
    ]) {
      await assert.rejects(
        () =>
          primitives
            .listChangedPaths(
              repository,
              value,
              headSha,
            ),

        {
          message:
            "invalid_git_commit_id",
        },
      );
    }
  },
);

test(
  "validates the blob path collection",
  async () => {
    for (const paths of [
      undefined,
      null,
      [],
      "file.txt",
    ]) {
      await assert.rejects(
        () =>
          primitives
            .readCommitBlobIds(
              repository,
              headSha,
              paths,
            ),

        {
          message:
            "invalid_git_repository_paths",
        },
      );
    }

    await assert.rejects(
      () =>
        primitives
          .readCommitBlobIds(
            repository,
            headSha,
            [
              "keep.txt",
              "keep.txt",
            ],
          ),

      {
        message:
          "duplicate_git_repository_path",
      },
    );
  },
);

test(
  "rejects unsafe or non-root-relative repository paths",
  async () => {
    for (const path of [
      "/absolute.txt",
      "../outside.txt",
      "./local.txt",
      "nested//value.txt",
      "nested\\value.txt",
      "C:\\value.txt",
    ]) {
      await assert.rejects(
        () =>
          primitives
            .readCommitBlobIds(
              repository,
              headSha,
              [path],
            ),

        {
          message:
            "invalid_git_repository_path",
        },
      );
    }
  },
);

test(
  "maps a missing working directory to a process error",
  async () => {
    await expectGitError(
      () =>
        primitives
          .resolveRepositoryRoot(
            join(
              temporaryRoot,
              "missing-directory",
            ),
          ),

      GIT_PRIMITIVE_ERROR_CODES
        .PROCESS_ERROR,

      "resolve_repository_root",
    );
  },
);

test(
  "maps a non-repository directory to a root-resolution failure",
  async () => {
    await expectGitError(
      () =>
        primitives
          .resolveRepositoryRoot(
            nonRepository,
          ),

      GIT_PRIMITIVE_ERROR_CODES
        .REPOSITORY_ROOT_FAILED,

      "resolve_repository_root",
    );
  },
);

test(
  "exposes bounded operational metadata without raw Git output",
  async () => {
    await assert.rejects(
      () =>
        primitives.resolveCommit(
          repository,
          "missing-ref",
        ),

      (error) => {
        assert.equal(
          error instanceof
            GitPrimitiveError,
          true,
        );

        assert.equal(
          error.code,
          GIT_PRIMITIVE_ERROR_CODES
            .REF_RESOLUTION_FAILED,
        );

        assert.equal(
          error.exitCode !== 0,
          true,
        );

        assert.equal(
          Object.hasOwn(
            error,
            "stdout",
          ),
          false,
        );

        assert.equal(
          Object.hasOwn(
            error,
            "stderr",
          ),
          false,
        );

        assert.doesNotThrow(
          () =>
            JSON.stringify({
              code: error.code,
              operation:
                error.operation,
              exitCode:
                error.exitCode,
              signal:
                error.signal,
              timedOut:
                error.timedOut,
              processErrorCode:
                error.processErrorCode,
            }),
        );

        return true;
      },
    );
  },
);

const {
  after: task5CommonDirAfter,
  test: task5CommonDirTest,
} = await import("node:test");

const task5CommonDirAssert = (
  await import("node:assert/strict")
).default;

const {
  chmod: task5CommonDirChmod,
  lstat: task5CommonDirLstat,
  mkdir: task5CommonDirMkdir,
  mkdtemp: task5CommonDirMkdtemp,
  realpath: task5CommonDirRealpath,
  rm: task5CommonDirRm,
  writeFile: task5CommonDirWriteFile,
} = await import("node:fs/promises");

const {
  isAbsolute: task5CommonDirIsAbsolute,
  join: task5CommonDirJoin,
  resolve: task5CommonDirResolve,
} = await import("node:path");

const {
  tmpdir: task5CommonDirTmpdir,
} = await import("node:os");

const {
  spawnSync: task5CommonDirSpawnSync,
} = await import("node:child_process");

const {
  createGitRepositoryPrimitives:
    task5CreateGitRepositoryPrimitives,
  GitPrimitiveError:
    Task5GitPrimitiveError,
} = await import(
  "../../src/core/git-repository-primitives.mjs"
);

const task5CommonDirRoot =
  await task5CommonDirMkdtemp(
    task5CommonDirJoin(
      task5CommonDirTmpdir(),
      "change-proof-common-dir-",
    ),
  );

task5CommonDirAfter(
  async () => {
    await task5CommonDirRm(
      task5CommonDirRoot,
      {
        recursive: true,
        force: true,
      },
    );
  },
);

function task5CommonDirGit(
  cwd,
  argumentsList,
) {
  const result =
    task5CommonDirSpawnSync(
      "git",
      argumentsList,
      {
        cwd,
        encoding: "utf8",
      },
    );

  if (result.status !== 0) {
    throw new Error(
      [
        `git ${argumentsList.join(" ")} failed`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    );
  }

  return result.stdout;
}

function task5CommonDirConfiguration(
  overrides = {},
) {
  return {
    gitExecutable:
      "git",

    environment:
      Object.fromEntries(
        Object.entries(
          process.env,
        ).filter(
          ([, value]) =>
            typeof value === "string",
        ),
      ),

    timeoutMs:
      30_000,

    maxStdoutBytes:
      4 * 1024 * 1024,

    maxStderrBytes:
      4 * 1024 * 1024,

    ...overrides,
  };
}

async function task5CreateRepository(
  name,
) {
  const repository =
    task5CommonDirJoin(
      task5CommonDirRoot,
      name,
    );

  await task5CommonDirMkdir(
    repository,
    {
      recursive: true,
    },
  );

  task5CommonDirGit(
    repository,
    [
      "init",
      "-q",
    ],
  );

  task5CommonDirGit(
    repository,
    [
      "config",
      "user.email",
      "task5@example.invalid",
    ],
  );

  task5CommonDirGit(
    repository,
    [
      "config",
      "user.name",
      "Task Five",
    ],
  );

  await task5CommonDirWriteFile(
    task5CommonDirJoin(
      repository,
      "tracked.txt",
    ),
    "base\n",
  );

  task5CommonDirGit(
    repository,
    [
      "add",
      "--",
      "tracked.txt",
    ],
  );

  task5CommonDirGit(
    repository,
    [
      "commit",
      "-q",
      "-m",
      "base",
    ],
  );

  return repository;
}

async function task5ExpectedCommonDir(
  repositoryRoot,
) {
  const raw =
    task5CommonDirGit(
      repositoryRoot,
      [
        "rev-parse",
        "--git-common-dir",
      ],
    ).replace(
      /\r?\n$/,
      "",
    );

  const candidate =
    task5CommonDirIsAbsolute(raw)
      ? raw
      : task5CommonDirResolve(
          repositoryRoot,
          raw,
        );

  return task5CommonDirRealpath(
    candidate,
  );
}

task5CommonDirTest(
  "resolveGitCommonDir returns canonical absolute common dir for ordinary primary repository",
  async () => {
    const repository =
      await task5CreateRepository(
        "ordinary",
      );

    const primitives =
      task5CreateGitRepositoryPrimitives(
        task5CommonDirConfiguration(),
      );

    const repositoryRoot =
      await primitives
        .resolveRepositoryRoot(
          repository,
        );

    const actual =
      await primitives
        .resolveGitCommonDir(
          repositoryRoot,
        );

    const expected =
      await task5ExpectedCommonDir(
        repositoryRoot,
      );

    task5CommonDirAssert.equal(
      actual,
      expected,
    );

    task5CommonDirAssert.equal(
      task5CommonDirIsAbsolute(
        actual,
      ),
      true,
    );

    task5CommonDirAssert.equal(
      actual,
      await task5CommonDirRealpath(
        actual,
      ),
    );

    task5CommonDirAssert.equal(
      (
        await task5CommonDirLstat(
          actual,
        )
      ).isDirectory(),
      true,
    );
  },
);

task5CommonDirTest(
  "linked worktree returns shared repository common dir not per-worktree admin dir",
  async () => {
    const repository =
      await task5CreateRepository(
        "linked-source",
      );

    const linked =
      task5CommonDirJoin(
        task5CommonDirRoot,
        "linked-worktree",
      );

    task5CommonDirGit(
      repository,
      [
        "worktree",
        "add",
        "--detach",
        linked,
        "HEAD",
      ],
    );

    try {
      const primitives =
        task5CreateGitRepositoryPrimitives(
          task5CommonDirConfiguration(),
        );

      const actual =
        await primitives
          .resolveGitCommonDir(
            linked,
          );

      const expected =
        await task5ExpectedCommonDir(
          linked,
        );

      const primaryCommon =
        await task5CommonDirRealpath(
          task5CommonDirJoin(
            repository,
            ".git",
          ),
        );

      const rawAdmin =
        task5CommonDirGit(
          linked,
          [
            "rev-parse",
            "--git-dir",
          ],
        ).replace(
          /\r?\n$/,
          "",
        );

      const adminPath =
        task5CommonDirIsAbsolute(
          rawAdmin,
        )
          ? rawAdmin
          : task5CommonDirResolve(
              linked,
              rawAdmin,
            );

      const adminRealpath =
        await task5CommonDirRealpath(
          adminPath,
        );

      task5CommonDirAssert.equal(
        actual,
        expected,
      );

      task5CommonDirAssert.equal(
        actual,
        primaryCommon,
      );

      task5CommonDirAssert.notEqual(
        actual,
        adminRealpath,
      );
    } finally {
      task5CommonDirGit(
        repository,
        [
          "worktree",
          "remove",
          "--force",
          linked,
        ],
      );
    }
  },
);

task5CommonDirTest(
  "resolveGitCommonDir fails closed for malformed output and operational Git failures",
  async (suite) => {
    const repository =
      await task5CreateRepository(
        "failure-source",
      );

    await task5CommonDirWriteFile(
      task5CommonDirJoin(
        repository,
        "not-a-directory",
      ),
      "file\n",
    );

    const fakeGit =
      task5CommonDirJoin(
        task5CommonDirRoot,
        "fake-git.mjs",
      );

    await task5CommonDirWriteFile(
      fakeGit,
      `#!/usr/bin/env node
const mode =
  process.env.TASK5_COMMON_DIR_MODE;

if (mode === "empty") {
  process.exit(0);
}

if (mode === "multiple") {
  process.stdout.write(
    "one\\ntwo\\n",
  );
  process.exit(0);
}

if (mode === "nul") {
  process.stdout.write(
    "one\\u0000two\\n",
  );
  process.exit(0);
}

if (mode === "file") {
  process.stdout.write(
    "not-a-directory\\n",
  );
  process.exit(0);
}

if (mode === "nonzero") {
  process.stderr.write(
    "injected failure\\n",
  );
  process.exit(7);
}

if (mode === "signal") {
  process.kill(
    process.pid,
    "SIGTERM",
  );
  return;
}

if (mode === "timeout") {
  setTimeout(
    () => {},
    10_000,
  );
  return;
}

if (mode === "stdout-truncated") {
  process.stdout.write(
    "x".repeat(16_384),
  );
  process.exit(0);
}

if (mode === "stderr-truncated") {
  process.stderr.write(
    "x".repeat(16_384),
  );
  process.exit(7);
}

process.stdout.write(
  ".git\\n",
);
`,
    );

    await task5CommonDirChmod(
      fakeGit,
      0o700,
    );

    for (const mode of [
      "empty",
      "multiple",
      "nul",
      "file",
      "nonzero",
      "signal",
      "timeout",
      "stdout-truncated",
      "stderr-truncated",
    ]) {
      await suite.test(
        mode,
        async () => {
          const base =
            task5CommonDirConfiguration();

          const primitives =
            task5CreateGitRepositoryPrimitives({
              ...base,

              gitExecutable:
                fakeGit,

              environment: {
                ...base.environment,

                TASK5_COMMON_DIR_MODE:
                  mode,
              },

              timeoutMs:
                mode === "timeout"
                  ? 40
                  : base.timeoutMs,

              maxStdoutBytes:
                mode ===
                  "stdout-truncated"
                    ? 64
                    : base
                        .maxStdoutBytes,

              maxStderrBytes:
                mode ===
                  "stderr-truncated"
                    ? 64
                    : base
                        .maxStderrBytes,
            });

          await task5CommonDirAssert.rejects(
            () =>
              primitives
                .resolveGitCommonDir(
                  repository,
                ),
            (error) =>
              error instanceof
                Task5GitPrimitiveError,
          );
        },
      );
    }
  },
);

task5CommonDirTest(
  "missing Git executable preserves existing primitive process-error code",
  async () => {
    const repository =
      await task5CreateRepository(
        "missing-executable",
      );

    const missingGit =
      task5CommonDirJoin(
        task5CommonDirRoot,
        "definitely-missing-git",
      );

    const primitives =
      task5CreateGitRepositoryPrimitives(
        task5CommonDirConfiguration({
          gitExecutable:
            missingGit,
        }),
      );

    let existingError;
    let commonDirError;

    try {
      await primitives
        .resolveRepositoryRoot(
          repository,
        );

      task5CommonDirAssert.fail(
        "expected repository-root failure",
      );
    } catch (error) {
      existingError =
        error;
    }

    try {
      await primitives
        .resolveGitCommonDir(
          repository,
        );

      task5CommonDirAssert.fail(
        "expected common-dir failure",
      );
    } catch (error) {
      commonDirError =
        error;
    }

    task5CommonDirAssert.equal(
      existingError instanceof
        Task5GitPrimitiveError,
      true,
    );

    task5CommonDirAssert.equal(
      commonDirError instanceof
        Task5GitPrimitiveError,
      true,
    );

    task5CommonDirAssert.equal(
      commonDirError.code,
      existingError.code,
    );
  },
);

task5CommonDirTest(
  "resolveGitCommonDir reuses existing runGit and introduces no shell second runner or remote command",
  async () => {
    const {
      readFile,
    } =
      await import(
        "node:fs/promises"
      );

    const source =
      await readFile(
        new URL(
          "../../src/core/git-repository-primitives.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const start =
      source.indexOf(
        "async function resolveGitCommonDir(",
      );

    task5CommonDirAssert.notEqual(
      start,
      -1,
    );

    const next =
      source.indexOf(
        "\n  async function ",
        start + 1,
      );

    const implementation =
      source.slice(
        start,
        next === -1
          ? source.length
          : next,
      );

    task5CommonDirAssert.equal(
      implementation.includes(
        "runGit(",
      ),
      true,
    );

    task5CommonDirAssert.equal(
      implementation.includes(
        "parseSingleLine(",
      ),
      true,
    );

    for (const forbidden of [
      "runBoundedCommand(",
      "spawn(",
      "spawnSync(",
      "exec(",
      "execFile(",
      "shell:",
      '"fetch"',
      '"push"',
      '"pull"',
      '"remote"',
      '"clone"',
    ]) {
      task5CommonDirAssert.equal(
        implementation.includes(
          forbidden,
        ),
        false,
        forbidden,
      );
    }
  },
);
