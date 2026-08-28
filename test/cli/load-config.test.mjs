import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import test from "node:test";

import {
  loadChangeProofConfig,
} from "../../src/cli/load-config.mjs";

function validConfig() {
  return {
    schemaVersion: "0.1",
    repositoryRoot: "repository",
    baseRef: "base",
    headRef: "head",
    command: {
      executable: "/usr/bin/node",
      arguments: ["--test", "test/example.test.mjs"],
      workingDirectory: ".",
      environment: {
        PATH: "/usr/bin:/bin",
        LC_ALL: "C",
      },
      timeoutMs: 30_000,
      maxStdoutBytes: 4_194_304,
      maxStderrBytes: 4_194_304,
    },
    envelope: {
      includedPaths: ["test/example.test.mjs"],
    },
    classification: {
      stateA: { expectedTestCount: 1 },
      stateB: { expectedTestCount: 2 },
      stateC: {
        expectedTestCount: 2,
        expectedFailures: [{
          testName: "example regression",
          outputIncludes: ["ERR_ASSERTION"],
        }],
      },
    },
    temporaryParentDirectory: "temporary",
    workspacePrefix: "change-proof-test-",
    outputDirectory: "output",
  };
}

async function fixture(t) {
  const root = await mkdtemp(join(
    tmpdir(),
    "change-proof-load-config-",
  ));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "repository"));
  await mkdir(join(root, "temporary"));
  const configPath = join(root, "change-proof.json");
  const config = validConfig();

  async function save(value = config) {
    await writeFile(
      configPath,
      `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    );
  }

  await save();
  return { root, configPath, config, save };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code);
    assert.equal(error?.stack?.includes("change-proof.json"), false);
    return true;
  });
}

test("loads and validates the strict M3 configuration", async (t) => {
  await t.test("valid complete config", async (t) => {
    const item = await fixture(t);
    const loaded = await loadChangeProofConfig(item.configPath);
    assert.equal(loaded.configPath, item.configPath);
    assert.equal(
      loaded.orchestratorInput.repositoryRoot,
      join(item.root, "repository"),
    );
  });

  await t.test("config path relative to process cwd", async (t) => {
    const item = await fixture(t);
    const path = relative(process.cwd(), item.configPath);
    assert.equal(
      (await loadChangeProofConfig(path)).configPath,
      item.configPath,
    );
  });

  await t.test("repositoryRoot relative to config", async (t) => {
    const item = await fixture(t);
    const loaded = await loadChangeProofConfig(item.configPath);
    assert.equal(
      loaded.orchestratorInput.repositoryRoot,
      resolve(item.root, "repository"),
    );
  });

  await t.test("temporary parent relative to config", async (t) => {
    const item = await fixture(t);
    const loaded = await loadChangeProofConfig(item.configPath);
    assert.equal(
      loaded.orchestratorInput.temporaryParentDirectory,
      resolve(item.root, "temporary"),
    );
  });

  await t.test("output directory relative to config", async (t) => {
    const item = await fixture(t);
    const loaded = await loadChangeProofConfig(item.configPath);
    assert.equal(loaded.outputDirectory, resolve(item.root, "output"));
  });

  await t.test("injects package toolVersion", async (t) => {
    const item = await fixture(t);
    assert.equal(
      (await loadChangeProofConfig(item.configPath))
        .orchestratorInput.toolVersion,
      "0.1.0-beta.1",
    );
  });

  await t.test("caller value is not mutated", async (t) => {
    const item = await fixture(t);
    const before = JSON.stringify(item.config);
    await loadChangeProofConfig(item.configPath);
    assert.equal(JSON.stringify(item.config), before);
  });

  await t.test("parsed values are not reused by reference", async (t) => {
    const item = await fixture(t);
    const first = await loadChangeProofConfig(item.configPath);
    const second = await loadChangeProofConfig(item.configPath);
    first.orchestratorInput.command.arguments.push("changed");
    first.orchestratorInput.classification.stateC
      .expectedFailures[0].outputIncludes.push("changed");
    assert.deepEqual(second.orchestratorInput.command.arguments, [
      "--test",
      "test/example.test.mjs",
    ]);
    assert.deepEqual(
      second.orchestratorInput.classification.stateC
        .expectedFailures[0].outputIncludes,
      ["ERR_ASSERTION"],
    );
  });

  await t.test("missing config path", async () => {
    await rejectsCode(
      loadChangeProofConfig(""),
      "CONFIG_PATH_INVALID",
    );
  });

  await t.test("config file not found", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      loadChangeProofConfig(join(item.root, "missing.json")),
      "CONFIG_FILE_NOT_FOUND",
    );
  });

  await t.test("config path is a directory", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      loadChangeProofConfig(item.root),
      "CONFIG_FILE_NOT_REGULAR",
    );
  });

  await t.test("config file symlink", async (t) => {
    const item = await fixture(t);
    const link = join(item.root, "link.json");
    await symlink(item.configPath, link);
    await rejectsCode(
      loadChangeProofConfig(link),
      "CONFIG_FILE_SYMLINK",
    );
  });

  await t.test("config larger than one MiB", async (t) => {
    const item = await fixture(t);
    await writeFile(
      item.configPath,
      Buffer.alloc(1024 * 1024 + 1, 0x20),
    );
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FILE_TOO_LARGE",
    );
  });

  await t.test("invalid UTF-8", async (t) => {
    const item = await fixture(t);
    await writeFile(item.configPath, Buffer.from([0xc3, 0x28]));
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_JSON_INVALID",
    );
  });

  await t.test("valid single leading BOM", async (t) => {
    const item = await fixture(t);
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      Buffer.from(JSON.stringify(item.config)),
    ]);
    await writeFile(item.configPath, bytes);
    assert.equal(
      (await loadChangeProofConfig(item.configPath))
        .orchestratorInput.baseRef,
      "base",
    );
  });

  await t.test("invalid JSON", async (t) => {
    const item = await fixture(t);
    await writeFile(item.configPath, "{\n", "utf8");
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_JSON_INVALID",
    );
  });

  await t.test("unsupported schemaVersion", async (t) => {
    const item = await fixture(t);
    item.config.schemaVersion = "1.0";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_SCHEMA_VERSION_UNSUPPORTED",
    );
  });

  await t.test("non-object top level", async (t) => {
    const item = await fixture(t);
    await item.save([]);
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  const unknownCases = [
    ["unknown top-level key", (c) => { c.extra = true; }],
    ["unknown command key", (c) => { c.command.extra = true; }],
    ["unknown envelope key", (c) => { c.envelope.extra = true; }],
    ["unknown classification key", (c) => {
      c.classification.extra = true;
    }],
    ["unknown state key", (c) => {
      c.classification.stateA.extra = true;
    }],
    ["unknown expected-failure key", (c) => {
      c.classification.stateC.expectedFailures[0].extra = true;
    }],
  ];
  for (const [name, mutate] of unknownCases) {
    await t.test(name, async (t) => {
      const item = await fixture(t);
      mutate(item.config);
      await item.save();
      await rejectsCode(
        loadChangeProofConfig(item.configPath),
        "CONFIG_UNKNOWN_KEY",
      );
    });
  }

  await t.test("missing required field", async (t) => {
    const item = await fixture(t);
    delete item.config.headRef;
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_REQUIRED_FIELD_MISSING",
    );
  });

  await t.test("invalid executable", async (t) => {
    const item = await fixture(t);
    item.config.command.executable = "";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("invalid arguments", async (t) => {
    const item = await fixture(t);
    item.config.command.arguments = [1];
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("invalid environment", async (t) => {
    const item = await fixture(t);
    item.config.command.environment = { "BAD=KEY": "value" };
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("NUL string", async (t) => {
    const item = await fixture(t);
    item.config.baseRef = "bad\0ref";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("invalid limits", async (t) => {
    const item = await fixture(t);
    item.config.command.timeoutMs = 0;
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("invalid expected count", async (t) => {
    const item = await fixture(t);
    item.config.classification.stateB.expectedTestCount = -1;
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("empty expectedFailures", async (t) => {
    const item = await fixture(t);
    item.config.classification.stateC.expectedFailures = [];
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("invalid expected failure", async (t) => {
    const item = await fixture(t);
    item.config.classification.stateC
      .expectedFailures[0].outputIncludes = [];
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_FIELD_INVALID",
    );
  });

  await t.test("duplicate included path", async (t) => {
    const item = await fixture(t);
    item.config.envelope.includedPaths.push(
      "test/example.test.mjs",
    );
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_DUPLICATE_PATH",
    );
  });

  await t.test("duplicate expected failure test name", async (t) => {
    const item = await fixture(t);
    item.config.classification.stateC.expectedFailures.push({
      testName: "example regression",
      outputIncludes: ["different"],
    });
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_DUPLICATE_EXPECTED_FAILURE",
    );
  });

  for (const key of ["__proto__", "prototype", "constructor"]) {
    await t.test(`${key} key`, async (t) => {
      const item = await fixture(t);
      const raw = JSON.stringify(item.config).replace(
        /^{/,
        `{${JSON.stringify(key)}:true,`,
      );
      await writeFile(item.configPath, raw, "utf8");
      await rejectsCode(
        loadChangeProofConfig(item.configPath),
        "CONFIG_UNKNOWN_KEY",
      );
    });
  }

  await t.test("invalid repositoryRoot", async (t) => {
    const item = await fixture(t);
    item.config.repositoryRoot = "missing";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_REPOSITORY_INVALID",
    );
  });

  await t.test("repositoryRoot symlink", async (t) => {
    const item = await fixture(t);
    await mkdir(join(item.root, "real-repository"));
    await rm(join(item.root, "repository"), { recursive: true });
    await symlink(
      join(item.root, "real-repository"),
      join(item.root, "repository"),
    );
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_REPOSITORY_INVALID",
    );
  });

  await t.test("invalid temporaryParentDirectory", async (t) => {
    const item = await fixture(t);
    item.config.temporaryParentDirectory = "missing";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_TEMP_DIRECTORY_INVALID",
    );
  });

  await t.test("temporary parent symlink", async (t) => {
    const item = await fixture(t);
    await mkdir(join(item.root, "real-temporary"));
    await rm(join(item.root, "temporary"), { recursive: true });
    await symlink(
      join(item.root, "real-temporary"),
      join(item.root, "temporary"),
    );
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_TEMP_DIRECTORY_INVALID",
    );
  });

  await t.test("temporary parent inside repository", async (t) => {
    const item = await fixture(t);
    await mkdir(join(item.root, "repository", "temporary"));
    item.config.temporaryParentDirectory = "repository/temporary";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_PATH_CONTAINMENT_INVALID",
    );
  });

  await t.test("output equals repositoryRoot", async (t) => {
    const item = await fixture(t);
    item.config.outputDirectory = "repository";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_PATH_CONTAINMENT_INVALID",
    );
  });

  await t.test("output inside repositoryRoot", async (t) => {
    const item = await fixture(t);
    item.config.outputDirectory = "repository/output";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_PATH_CONTAINMENT_INVALID",
    );
  });

  await t.test("existing output symlink", async (t) => {
    const item = await fixture(t);
    await mkdir(join(item.root, "real-output"));
    await symlink(
      join(item.root, "real-output"),
      join(item.root, "output"),
    );
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_OUTPUT_DIRECTORY_INVALID",
    );
  });

  await t.test("output with symlinked existing parent", async (t) => {
    const item = await fixture(t);
    await mkdir(join(item.root, "real-parent"));
    await symlink(
      join(item.root, "real-parent"),
      join(item.root, "linked-parent"),
    );
    item.config.outputDirectory = "linked-parent/output";
    await item.save();
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_OUTPUT_DIRECTORY_INVALID",
    );
  });

  await t.test("exact environment preservation", async (t) => {
    const item = await fixture(t);
    item.config.command.environment = {
      SECOND: "two",
      FIRST: "one",
    };
    await item.save();
    const environment = (await loadChangeProofConfig(
      item.configPath,
    )).orchestratorInput.command.environment;
    assert.deepEqual(environment, {
      SECOND: "two",
      FIRST: "one",
    });
  });

  await t.test("does not merge process.env", async (t) => {
    const item = await fixture(t);
    item.config.command.environment = { ONLY: "explicit" };
    await item.save();
    const environment = (await loadChangeProofConfig(
      item.configPath,
    )).orchestratorInput.command.environment;
    assert.deepEqual(environment, { ONLY: "explicit" });
  });

  await t.test("exact arguments preservation", async (t) => {
    const item = await fixture(t);
    item.config.command.arguments = [
      "literal space",
      "$HOME",
      "*.test.mjs",
    ];
    await item.save();
    const argumentsList = (await loadChangeProofConfig(
      item.configPath,
    )).orchestratorInput.command.arguments;
    assert.deepEqual(argumentsList, [
      "literal space",
      "$HOME",
      "*.test.mjs",
    ]);
  });

  await t.test("double leading BOM is rejected", async (t) => {
    const item = await fixture(t);
    const bom = Buffer.from([0xef, 0xbb, 0xbf]);
    await writeFile(item.configPath, Buffer.concat([
      bom,
      bom,
      Buffer.from(JSON.stringify(item.config)),
    ]));
    await rejectsCode(
      loadChangeProofConfig(item.configPath),
      "CONFIG_JSON_INVALID",
    );
  });

  await t.test("unreadable content fails closed", async (t) => {
    const item = await fixture(t);
    await chmod(item.configPath, 0o000);
    try {
      await rejectsCode(
        loadChangeProofConfig(item.configPath),
        "CONFIG_FILE_READ_FAILED",
      );
    } finally {
      await chmod(item.configPath, 0o600);
    }
  });
});

function promotedProvenanceFixture() {
  return {
    source:
      "change-proof.prepare-candidate",

    candidateSha256:
      "11".repeat(32),

    candidateContractVersion:
      "0.1",

    prepareToolVersion:
      "0.2.0-beta.2",

    prepareConfigSha256:
      "22".repeat(32),

    repositoryContextSha256:
      "33".repeat(32),

    resolvedCommits: {
      base:
        "resolved-base-object-id",

      head:
        "resolved-head-object-id",
    },

    executionContractSha256:
      "44".repeat(32),

    envelopeSha256:
      "55".repeat(32),

    failureSetSha256:
      "66".repeat(32),
  };
}

test(
  "schema 0.2 requires and preserves strict expectation provenance",
  async (t) => {
    const item = await fixture(t);

    item.config.schemaVersion =
      "0.2";

    item.config.expectationProvenance =
      promotedProvenanceFixture();

    await item.save();

    const loaded =
      await loadChangeProofConfig(
        item.configPath,
      );

    assert.deepEqual(
      loaded.expectationProvenance,
      item.config.expectationProvenance,
    );

    assert.equal(
      "expectationProvenance" in
        loaded.orchestratorInput,
      false,
    );
  },
);

test(
  "schema 0.2 without expectation provenance is rejected",
  async (t) => {
    const item = await fixture(t);

    item.config.schemaVersion =
      "0.2";

    await item.save();

    await rejectsCode(
      loadChangeProofConfig(
        item.configPath,
      ),
      "CONFIG_REQUIRED_FIELD_MISSING",
    );
  },
);

test(
  "schema 0.1 with expectation provenance is rejected",
  async (t) => {
    const item = await fixture(t);

    item.config.expectationProvenance =
      promotedProvenanceFixture();

    await item.save();

    await rejectsCode(
      loadChangeProofConfig(
        item.configPath,
      ),
      "CONFIG_UNKNOWN_KEY",
    );
  },
);

test(
  "schema 0.2 expectation provenance rejects unknown keys",
  async (t) => {
    const item = await fixture(t);

    item.config.schemaVersion =
      "0.2";

    item.config.expectationProvenance = {
      ...promotedProvenanceFixture(),
      unexpected:
        "not allowed",
    };

    await item.save();

    await rejectsCode(
      loadChangeProofConfig(
        item.configPath,
      ),
      "CONFIG_UNKNOWN_KEY",
    );
  },
);

test(
  "schema 0.2 expectation provenance rejects malformed digests",
  async (t) => {
    const item = await fixture(t);

    item.config.schemaVersion =
      "0.2";

    item.config.expectationProvenance =
      promotedProvenanceFixture();

    item.config
      .expectationProvenance
      .failureSetSha256 =
      "not-a-sha256";

    await item.save();

    await rejectsCode(
      loadChangeProofConfig(
        item.configPath,
      ),
      "CONFIG_FIELD_INVALID",
    );
  },
);

test(
  "schema 0.1 remains provenance-free and backwards compatible",
  async (t) => {
    const item = await fixture(t);

    const loaded =
      await loadChangeProofConfig(
        item.configPath,
      );

    assert.equal(
      loaded.expectationProvenance,
      null,
    );

    assert.equal(
      loaded.orchestratorInput
        .classification
        .stateC
        .expectedFailures[0]
        .testName,
      "example regression",
    );
  },
);
