import assert
  from "node:assert/strict";

import {
  after,
  test,
} from "node:test";

import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";

import {
  basename,
  join,
} from "node:path";

import {
  tmpdir,
} from "node:os";

import {
  EXCLUSIVE_ARTIFACT_ERROR_CODES,
  createExclusiveArtifactWriter,
  writeExclusiveArtifact,
} from "../../src/cli/write-exclusive-artifact.mjs";

const root =
  await mkdtemp(
    join(
      tmpdir(),
      "change-proof-exclusive-artifact-",
    ),
  );

after(
  async () => {
    await rm(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  },
);

async function makeDirectory(
  name,
) {
  const path =
    join(
      root,
      name,
    );

  await mkdir(
    path,
    {
      mode: 0o700,
    },
  );

  return path;
}

test(
  "successful write leaves one complete 0600 artifact and no temp residue",
  async () => {
    const parent =
      await makeDirectory(
        "success",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    await writeExclusiveArtifact({
      targetPath: target,
      content: "{}\n",
    });

    assert.equal(
      await readFile(
        target,
        "utf8",
      ),
      "{}\n",
    );

    assert.equal(
      (
        await lstat(
          target,
        )
      ).mode & 0o777,
      0o600,
    );

    assert.deepEqual(
      await readdir(parent),
      [
        "candidate.json",
      ],
    );
  },
);

test(
  "existing final is never overwritten",
  async () => {
    const parent =
      await makeDirectory(
        "existing",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    await writeFile(
      target,
      "foreign\n",
      {
        flag: "wx",
        mode: 0o600,
      },
    );

    await assert.rejects(
      () =>
        writeExclusiveArtifact({
          targetPath: target,
          content: "owned\n",
        }),
      (error) =>
        error?.code ===
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .TARGET_EXISTS,
    );

    assert.equal(
      await readFile(
        target,
        "utf8",
      ),
      "foreign\n",
    );
  },
);

test(
  "publication race fails closed without overwriting winner",
  async () => {
    const parent =
      await makeDirectory(
        "race",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    const {
      link,
    } =
      await import(
        "node:fs/promises"
      );

    let injected =
      false;

    const writer =
      createExclusiveArtifactWriter({
        async link(
          source,
          destination,
        ) {
          if (!injected) {
            injected =
              true;

            await writeFile(
              destination,
              "foreign-winner\n",
              {
                flag: "wx",
                mode: 0o600,
              },
            );
          }

          return link(
            source,
            destination,
          );
        },
      });

    await assert.rejects(
      () =>
        writer({
          targetPath: target,
          content: "owned\n",
        }),
      (error) =>
        error?.code ===
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .TARGET_EXISTS,
    );

    assert.equal(
      await readFile(
        target,
        "utf8",
      ),
      "foreign-winner\n",
    );

    assert.deepEqual(
      await readdir(parent),
      [
        "candidate.json",
      ],
    );
  },
);

test(
  "concurrent callers have exactly one winner",
  async () => {
    const parent =
      await makeDirectory(
        "concurrent",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    const results =
      await Promise.allSettled([
        writeExclusiveArtifact({
          targetPath: target,
          content: "one\n",
        }),

        writeExclusiveArtifact({
          targetPath: target,
          content: "two\n",
        }),
      ]);

    assert.equal(
      results.filter(
        ({ status }) =>
          status === "fulfilled",
      ).length,
      1,
    );

    assert.equal(
      results.filter(
        ({ status }) =>
          status === "rejected",
      ).length,
      1,
    );

    assert.deepEqual(
      await readdir(parent),
      [
        "candidate.json",
      ],
    );
  },
);

test(
  "temporary write failure leaves no final or temp residue",
  async () => {
    const parent =
      await makeDirectory(
        "write-failure",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    const writer =
      createExclusiveArtifactWriter({
        async open(
          path,
          flags,
          mode,
        ) {
          const handle =
            await open(
              path,
              flags,
              mode,
            );

          return {
            async writeFile() {
              throw new Error(
                "injected write failure",
              );
            },

            sync:
              handle.sync.bind(
                handle,
              ),

            close:
              handle.close.bind(
                handle,
              ),
          };
        },
      });

    await assert.rejects(
      () =>
        writer({
          targetPath: target,
          content: "{}\n",
        }),
    );

    assert.deepEqual(
      await readdir(parent),
      [],
    );
  },
);

test(
  "close failure leaves no final",
  async () => {
    const parent =
      await makeDirectory(
        "close-failure",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    const writer =
      createExclusiveArtifactWriter({
        async open(
          path,
          flags,
          mode,
        ) {
          const handle =
            await open(
              path,
              flags,
              mode,
            );

          return {
            writeFile:
              handle.writeFile.bind(
                handle,
              ),

            sync:
              handle.sync.bind(
                handle,
              ),

            async close() {
              await handle.close();

              throw new Error(
                "injected close failure",
              );
            },
          };
        },
      });

    await assert.rejects(
      () =>
        writer({
          targetPath: target,
          content: "{}\n",
        }),
    );

    assert.deepEqual(
      await readdir(parent),
      [],
    );
  },
);

test(
  "post-publication temp cleanup failure preserves complete final and reports failure",
  async () => {
    const parent =
      await makeDirectory(
        "post-publication-cleanup-failure",
      );

    const target =
      join(
        parent,
        "candidate.json",
      );

    const {
      unlink,
    } =
      await import(
        "node:fs/promises"
      );

    let publicationCompleted =
      false;

    let ownedTemporaryPath =
      null;

    const writer =
      createExclusiveArtifactWriter({
        async link(
          source,
          destination,
        ) {
          const {
            link,
          } =
            await import(
              "node:fs/promises"
            );

          await link(
            source,
            destination,
          );

          publicationCompleted =
            true;

          ownedTemporaryPath =
            source;
        },

        async unlink(path) {
          if (
            publicationCompleted &&
            path ===
              ownedTemporaryPath
          ) {
            const error =
              new Error(
                "injected post-publication cleanup failure",
              );

            error.code =
              "EIO";

            throw error;
          }

          return unlink(path);
        },
      });

    await assert.rejects(
      () =>
        writer({
          targetPath:
            target,

          content:
            "complete-final\\n",
        }),
      (error) =>
        error?.code ===
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .TEMPORARY_CLEANUP_FAILED,
    );

    assert.equal(
      await readFile(
        target,
        "utf8",
      ),
      "complete-final\\n",
    );

    assert.notEqual(
      ownedTemporaryPath,
      null,
    );

    assert.equal(
      await readFile(
        ownedTemporaryPath,
        "utf8",
      ),
      "complete-final\\n",
    );

    assert.deepEqual(
      (
        await readdir(
          parent,
        )
      ).sort(),
      [
        basename(
          ownedTemporaryPath,
        ),
        "candidate.json",
      ].sort(),
    );
  },
);

test(
  "symlink parent fails closed",
  async () => {
    const realParent =
      await makeDirectory(
        "real-parent",
      );

    const alias =
      join(
        root,
        "alias",
      );

    await symlink(
      realParent,
      alias,
    );

    await assert.rejects(
      () =>
        writeExclusiveArtifact({
          targetPath:
            join(
              alias,
              "candidate.json",
            ),
          content: "{}\n",
        }),
    );
  },
);

test(
  "writer source uses hard-link publication and never rename",
  async () => {
    const source =
      await readFile(
        new URL(
          "../../src/cli/write-exclusive-artifact.mjs",
          import.meta.url,
        ),
        "utf8",
      );

    assert.equal(
      source.includes(
        "await operations.link(",
      ),
      true,
    );

    assert.equal(
      /\brename(?:Sync)?\b/
        .test(source),
      false,
    );
  },
);
