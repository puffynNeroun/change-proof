import assert
  from "node:assert/strict";

import test, {
  after,
} from "node:test";

import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
} from "node:fs/promises";

import {
  join,
} from "node:path";

import {
  tmpdir,
} from "node:os";

import {
  readFile,
} from "node:fs/promises";

import {
  resolveStateWorkingDirectory,
} from "../../src/core/resolve-state-working-directory.mjs";

const root =
  await mkdtemp(
    join(
      tmpdir(),
      "change-proof-state-cwd-",
    ),
  );

const canonicalRoot =
  await realpath(root);

const outside =
  await mkdtemp(
    join(
      tmpdir(),
      "change-proof-state-cwd-outside-",
    ),
  );

const canonicalOutside =
  await realpath(outside);

after(
  async () => {
    await rm(
      root,
      {
        recursive:
          true,
        force:
          true,
      },
    );

    await rm(
      outside,
      {
        recursive:
          true,
        force:
          true,
      },
    );
  },
);

test(
  '"." resolves to the exact canonical state worktree root',
  async () => {
    assert.equal(
      await resolveStateWorkingDirectory(
        canonicalRoot,
        ".",
      ),
      canonicalRoot,
    );
  },
);

test(
  "valid nested directory resolves to its canonical path",
  async () => {
    const nested =
      join(
        canonicalRoot,
        "packages",
        "example",
      );

    await mkdir(
      nested,
      {
        recursive:
          true,
      },
    );

    assert.equal(
      await resolveStateWorkingDirectory(
        canonicalRoot,
        "packages/example",
      ),
      await realpath(
        nested,
      ),
    );
  },
);

test(
  "nested symlink remaining inside the state worktree follows existing realpath semantics",
  async () => {
    const target =
      join(
        canonicalRoot,
        "real",
        "nested",
      );

    await mkdir(
      target,
      {
        recursive:
          true,
      },
    );

    const link =
      join(
        canonicalRoot,
        "inside-link",
      );

    await symlink(
      target,
      link,
    );

    assert.equal(
      await resolveStateWorkingDirectory(
        canonicalRoot,
        "inside-link",
      ),
      await realpath(
        target,
      ),
    );
  },
);

test(
  "symlink escape outside the exact state worktree is rejected after canonicalization",
  async () => {
    const link =
      join(
        canonicalRoot,
        "escape-link",
      );

    await symlink(
      canonicalOutside,
      link,
    );

    await assert.rejects(
      () =>
        resolveStateWorkingDirectory(
          canonicalRoot,
          "escape-link",
        ),
      {
        message:
          "invalid_change_proof_input:command.workingDirectory",
      },
    );
  },
);

test(
  "nonexistent working directory preserves authoritative realpath failure behavior",
  async () => {
    await assert.rejects(
      () =>
        resolveStateWorkingDirectory(
          canonicalRoot,
          "does-not-exist",
        ),
      (error) => {
        assert.equal(
          error?.code,
          "ENOENT",
        );

        return true;
      },
    );
  },
);

test(
  "canonicalized directory outside the state root is rejected with the existing error",
  async () => {
    const outsideName =
      canonicalOutside
        .split("/")
        .at(-1);

    const parent =
      canonicalRoot
        .split("/")
        .slice(0, -1)
        .join("/") ||
      "/";

    if (
      parent !==
      canonicalOutside
        .split("/")
        .slice(0, -1)
        .join("/")
    ) {
      return;
    }

    await assert.rejects(
      () =>
        resolveStateWorkingDirectory(
          canonicalRoot,
          `../${outsideName}`,
        ),
      {
        message:
          "invalid_change_proof_input:command.workingDirectory",
      },
    );
  },
);

test(
  "authoritative run imports and calls the exported shared resolver instead of a private copy",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/core/run-change-proof.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    assert.equal(
      source.includes(
        'from "./resolve-state-working-directory.mjs"',
      ),
      true,
    );

    assert.equal(
      source.includes(
        "await resolveStateWorkingDirectory(",
      ),
      true,
    );

    assert.equal(
      source.includes(
        "async function resolveStateWorkingDirectory(",
      ),
      false,
    );
  },
);

test(
  "shared resolver retains realpath before post-canonicalization containment",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/core/resolve-state-working-directory.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    const realpathIndex =
      source.indexOf(
        "await realpath(",
      );

    const containmentIndex =
      source.indexOf(
        "isContained(",
        realpathIndex,
      );

    assert.notEqual(
      realpathIndex,
      -1,
    );

    assert.notEqual(
      containmentIndex,
      -1,
    );

    assert.equal(
      realpathIndex <
        containmentIndex,
      true,
    );
  },
);
