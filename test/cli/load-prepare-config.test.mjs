import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadPrepareConfig,
} from "../../src/cli/load-prepare-config.mjs";

function config() {
  return {
    schemaVersion: "0.1",
    repositoryRoot: "repository",
    baseRef: "base",
    headRef: "head",

    command: {
      executable: "node",
      arguments: [
        "--test",
        "test/example.test.mjs",
      ],
      workingDirectory: ".",
      environment: {
        ONLY: "explicit",
        EMPTY: "",
      },
      timeoutMs: 30_000,
      maxStdoutBytes: 4_194_304,
      maxStderrBytes: 4_194_304,
    },

    envelope: {
      includedPaths: [
        "test/example.test.mjs",
      ],
    },

    temporaryParentDirectory:
      "temporary",

    workspacePrefix:
      "change-proof-prepare-",
  };
}

async function fixture(t) {
  const root =
    await mkdtemp(
      path.join(
        os.tmpdir(),
        "change-proof-prepare-config-",
      ),
    );

  t.after(
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

  await mkdir(
    path.join(
      root,
      "repository",
    ),
  );

  await mkdir(
    path.join(
      root,
      "temporary",
    ),
  );

  return {
    root,

    path:
      path.join(
        root,
        "prepare.json",
      ),

    config:
      config(),
  };
}

async function write(item) {
  await writeFile(
    item.path,
    JSON.stringify(
      item.config,
      null,
      2,
    ),
    "utf8",
  );
}

async function rejects(
  promise,
  code,
) {
  await assert.rejects(
    promise,
    (error) =>
      error?.code === code,
  );
}

test(
  "loads the exact frozen prepare config",
  async (t) => {
    const item =
      await fixture(t);

    await write(item);

    const loaded =
      await loadPrepareConfig(
        item.path,
      );

    assert.deepEqual(
      loaded.prepareConfig,
      {
        ...item.config,

        repositoryRoot:
          path.join(
            item.root,
            "repository",
          ),

        temporaryParentDirectory:
          path.join(
            item.root,
            "temporary",
          ),
      },
    );

    assert.equal(
      loaded.configPath,
      item.path,
    );

    for (const forbidden of [
      "classification",
      "expectedTestCount",
      "expectedFailures",
      "outputDirectory",
      "provenance",
    ]) {
      assert.equal(
        forbidden in
          loaded.prepareConfig,
        false,
      );
    }
  },
);

test(
  "rejects every missing required top-level field",
  async (t) => {
    for (const field of [
      "schemaVersion",
      "repositoryRoot",
      "baseRef",
      "headRef",
      "command",
      "envelope",
      "temporaryParentDirectory",
      "workspacePrefix",
    ]) {
      await t.test(
        field,
        async () => {
          const item =
            await fixture(t);

          delete item.config[field];

          await write(item);

          await rejects(
            loadPrepareConfig(
              item.path,
            ),
            "PREPARE_CONFIG_REQUIRED_FIELD_MISSING",
          );
        },
      );
    }
  },
);

test(
  "rejects every missing required command/envelope field",
  async (t) => {
    for (const field of [
      "executable",
      "arguments",
      "workingDirectory",
      "environment",
      "timeoutMs",
      "maxStdoutBytes",
      "maxStderrBytes",
    ]) {
      await t.test(
        `command.${field}`,
        async () => {
          const item =
            await fixture(t);

          delete item
            .config
            .command[field];

          await write(item);

          await rejects(
            loadPrepareConfig(
              item.path,
            ),
            "PREPARE_CONFIG_REQUIRED_FIELD_MISSING",
          );
        },
      );
    }

    await t.test(
      "envelope.includedPaths",
      async () => {
        const item =
          await fixture(t);

        delete item
          .config
          .envelope
          .includedPaths;

        await write(item);

        await rejects(
          loadPrepareConfig(
            item.path,
          ),
          "PREPARE_CONFIG_REQUIRED_FIELD_MISSING",
        );
      },
    );
  },
);

test(
  "rejects unknown keys at every schema level",
  async (t) => {
    const cases = [
      [
        "top",
        (value) => {
          value.extra = true;
        },
      ],
      [
        "command",
        (value) => {
          value.command.extra =
            true;
        },
      ],
      [
        "envelope",
        (value) => {
          value.envelope.extra =
            true;
        },
      ],
    ];

    for (
      const [name, mutate]
      of cases
    ) {
      await t.test(
        name,
        async () => {
          const item =
            await fixture(t);

          mutate(item.config);

          await write(item);

          await rejects(
            loadPrepareConfig(
              item.path,
            ),
            "PREPARE_CONFIG_UNKNOWN_KEY",
          );
        },
      );
    }
  },
);

test(
  "rejects run-only and future-policy fields",
  async (t) => {
    for (const field of [
      "classification",
      "expectedTestCount",
      "expectedFailures",
      "outputDirectory",
      "provenance",
      "packageManager",
      "dependencies",
      "testFramework",
      "discovery",
    ]) {
      await t.test(
        field,
        async () => {
          const item =
            await fixture(t);

          item.config[field] = {};

          await write(item);

          await rejects(
            loadPrepareConfig(
              item.path,
            ),
            "PREPARE_CONFIG_UNKNOWN_KEY",
          );
        },
      );
    }
  },
);

test(
  "enforces path environment envelope and workspace invariants",
  async (t) => {
    const cases = [
      [
        "absolute working directory",
        (value) => {
          value.command
            .workingDirectory =
            "/tmp";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "escaping working directory",
        (value) => {
          value.command
            .workingDirectory =
            "../outside";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "invalid environment key",
        (value) => {
          value.command.environment = {
            "BAD=KEY": "value",
          };
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "invalid environment value",
        (value) => {
          value.command.environment = {
            GOOD: 123,
          };
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "duplicate envelope",
        (value) => {
          value.envelope
            .includedPaths = [
              "test/a.test.mjs",
              "test/a.test.mjs",
            ];
        },
        "PREPARE_CONFIG_DUPLICATE_PATH",
      ],
      [
        "escaping envelope",
        (value) => {
          value.envelope
            .includedPaths = [
              "../test.mjs",
            ];
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "absolute envelope",
        (value) => {
          value.envelope
            .includedPaths = [
              "/tmp/test.mjs",
            ];
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "workspace path",
        (value) => {
          value.workspacePrefix =
            "bad/prefix";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "workspace prefix newline",
        (value) => {
          value.workspacePrefix =
            "bad\nprefix";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "workspace prefix carriage return",
        (value) => {
          value.workspacePrefix =
            "bad\rprefix";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
      [
        "workspace prefix CRLF",
        (value) => {
          value.workspacePrefix =
            "bad\r\nprefix";
        },
        "PREPARE_CONFIG_FIELD_INVALID",
      ],
    ];

    for (
      const [name, mutate, code]
      of cases
    ) {
      await t.test(
        name,
        async () => {
          const item =
            await fixture(t);

          mutate(item.config);

          await write(item);

          await rejects(
            loadPrepareConfig(
              item.path,
            ),
            code,
          );
        },
      );
    }
  },
);

test(
  "rejects repository/temp containment and missing directories",
  async (t) => {
    await t.test(
      "missing repository",
      async () => {
        const item =
          await fixture(t);

        item.config.repositoryRoot =
          "missing";

        await write(item);

        await rejects(
          loadPrepareConfig(
            item.path,
          ),
          "PREPARE_CONFIG_REPOSITORY_INVALID",
        );
      },
    );

    await t.test(
      "temp inside repository",
      async () => {
        const item =
          await fixture(t);

        await mkdir(
          path.join(
            item.root,
            "repository",
            "temporary",
          ),
        );

        item.config
          .temporaryParentDirectory =
          "repository/temporary";

        await write(item);

        await rejects(
          loadPrepareConfig(
            item.path,
          ),
          "PREPARE_CONFIG_PATH_CONTAINMENT_INVALID",
        );
      },
    );
  },
);

test(
  "preserves native JSON.parse duplicate-key behavior",
  async (t) => {
    const item =
      await fixture(t);

    const raw = `{
  "schemaVersion":"0.1",
  "repositoryRoot":"repository",
  "baseRef":"base",
  "headRef":"first",
  "headRef":"second",
  "command":{
    "executable":"node",
    "arguments":[],
    "workingDirectory":".",
    "environment":{},
    "timeoutMs":30000,
    "maxStdoutBytes":4194304,
    "maxStderrBytes":4194304
  },
  "envelope":{
    "includedPaths":["test/example.test.mjs"]
  },
  "temporaryParentDirectory":"temporary",
  "workspacePrefix":"change-proof-prepare-"
}`;

    await writeFile(
      item.path,
      raw,
      "utf8",
    );

    const loaded =
      await loadPrepareConfig(
        item.path,
      );

    assert.equal(
      loaded.prepareConfig.headRef,
      "second",
    );
  },
);
