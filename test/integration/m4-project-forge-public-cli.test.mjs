import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const executeFile = promisify(execFile);
const configuredRepository =
  process.env.CHANGE_PROOF_M4_PROJECT_FORGE_REPOSITORY;
const skipReason =
  "M4 project-forge repository is not configured; set CHANGE_PROOF_M4_PROJECT_FORGE_REPOSITORY";
const changeProofRoot = fileURLToPath(
  new URL("../..", import.meta.url),
);
const binaryPath = join(changeProofRoot, "bin/change-proof.mjs");
const checkoutCommitId =
  "479ee8ff4e2fb580acf5f80da3a91739cbb8b700";
const baseCommitId =
  "c93d36d26815b8825c9fb67eb844a69dbd87303c";
const headCommitId =
  "fe621d5e72ff1f0f8d1e8ccc9f53de3b1f3b2e40";
const selectedTestPath = "test/cli.test.ts";
const changedPaths = [
  "README.md",
  "docs/TASKS.md",
  "src/cli.ts",
  selectedTestPath,
];
const failedLeafTests = [
  "prints version with --version",
  "prints version with -V",
  "rejects --version with an extra argument",
  "rejects --version on the new command",
];
const dependencyVersions = {
  typescript: "5.9.3",
  typesNode: "24.13.2",
  undiciTypes: "7.18.2",
};

function explicitEnvironment() {
  const environment = {
    LC_ALL: "C",
    LANG: "C",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_OPTIONAL_LOCKS: "0",
  };

  if (
    typeof process.env.PATH === "string" &&
    process.env.PATH.length > 0
  ) {
    environment.PATH = process.env.PATH;
  }

  return environment;
}

async function runFile(executable, argumentsList, cwd, timeout = 30_000) {
  try {
    const result = await executeFile(executable, argumentsList, {
      cwd,
      encoding: "utf8",
      env: explicitEnvironment(),
      timeout,
      maxBuffer: 8 * 1024 * 1024,
      shell: false,
      windowsHide: true,
    });
    return {
      exitCode: 0,
      signal: null,
      timedOut: false,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : null,
      signal: error.signal ?? null,
      timedOut: error.killed === true,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
      processErrorCode:
        typeof error.code === "string" ? error.code : null,
    };
  }
}

async function git(repositoryRoot, argumentsList) {
  const result = await runFile(
    "git",
    ["--no-pager", ...argumentsList],
    repositoryRoot,
    20_000,
  );
  assert.equal(result.timedOut, false, "Git command timed out");
  assert.equal(result.processErrorCode ?? null, null);
  assert.equal(result.signal, null);
  assert.equal(result.exitCode, 0, result.stderr);
  return result.stdout;
}

async function snapshotGit(repositoryRoot) {
  return {
    branch: (await git(
      repositoryRoot,
      ["branch", "--show-current"],
    )).trim(),
    head: (await git(repositoryRoot, ["rev-parse", "HEAD"])).trim(),
    status: await git(repositoryRoot, [
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
    ]),
    refs: await git(repositoryRoot, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]),
    worktrees: await git(repositoryRoot, [
      "worktree",
      "list",
      "--porcelain",
    ]),
  };
}

async function snapshotCheckoutBytes(repositoryRoot) {
  const entries = [];

  async function visit(directory, prefix) {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      if (prefix === "" && child.name === ".git") {
        continue;
      }

      const path = join(directory, child.name);
      const repositoryPath = prefix === ""
        ? child.name
        : `${prefix}/${child.name}`;
      const metadata = await lstat(path);

      if (metadata.isSymbolicLink()) {
        entries.push(["link", repositoryPath, await readlink(path)]);
      } else if (metadata.isDirectory()) {
        entries.push(["directory", repositoryPath]);
        await visit(path, repositoryPath);
      } else if (metadata.isFile()) {
        const digest = createHash("sha256")
          .update(await readFile(path))
          .digest("hex");
        entries.push([
          "file",
          repositoryPath,
          metadata.mode & 0o777,
          metadata.size,
          digest,
        ]);
      } else {
        entries.push(["other", repositoryPath, metadata.mode]);
      }
    }
  }

  await visit(repositoryRoot, "");
  return entries;
}

async function pathType(path) {
  try {
    return await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

async function discoverSinglePackageFile(
  repositoryRoot,
  packageSuffix,
  description,
) {
  const storeRoot = join(repositoryRoot, "node_modules", ".pnpm");
  const storeEntries = await readdir(storeRoot, { withFileTypes: true });
  const matches = [];

  for (const entry of storeEntries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const candidate = join(storeRoot, entry.name, ...packageSuffix);
    const metadata = await pathType(candidate);
    if (metadata?.isFile()) {
      matches.push(candidate);
    }
  }

  matches.sort();
  assert.equal(
    matches.length,
    1,
    `expected exactly one ${description}, found ${matches.length}`,
  );
  return matches[0];
}

async function resolveDependencySnapshot(repositoryRoot) {
  const typescriptCompiler = await discoverSinglePackageFile(
    repositoryRoot,
    ["node_modules", "typescript", "bin", "tsc"],
    "TypeScript compiler in node_modules/.pnpm/*/node_modules/typescript/bin/tsc",
  );
  const typesNodePackageJson = await discoverSinglePackageFile(
    repositoryRoot,
    ["node_modules", "@types", "node", "package.json"],
    "@types/node package in node_modules/.pnpm/*/node_modules/@types/node/package.json",
  );
  const typesNodeDirectory = dirname(typesNodePackageJson);
  const typesNodeMetadata = JSON.parse(
    await readFile(typesNodePackageJson, "utf8"),
  );

  assert.equal(typesNodeMetadata.name, "@types/node");
  assert.equal(typesNodeMetadata.version, dependencyVersions.typesNode);
  assert.equal(
    typeof typesNodeMetadata.dependencies?.["undici-types"],
    "string",
  );

  const linkedUndiciTypes = join(
    dirname(dirname(typesNodeDirectory)),
    "undici-types",
  );
  const linkedMetadata = await lstat(linkedUndiciTypes);
  assert.equal(linkedMetadata.isSymbolicLink(), true);
  const undiciTypesDirectory = await realpath(linkedUndiciTypes);
  const undiciTypesMetadata = JSON.parse(
    await readFile(join(undiciTypesDirectory, "package.json"), "utf8"),
  );
  assert.equal(undiciTypesMetadata.name, "undici-types");
  assert.equal(
    undiciTypesMetadata.version,
    dependencyVersions.undiciTypes,
  );

  const typescriptDirectory = dirname(dirname(typescriptCompiler));
  const typescriptMetadata = JSON.parse(
    await readFile(join(typescriptDirectory, "package.json"), "utf8"),
  );
  assert.equal(typescriptMetadata.name, "typescript");
  assert.equal(
    typescriptMetadata.version,
    dependencyVersions.typescript,
  );

  for (const dependencyPath of [
    typescriptCompiler,
    typesNodeDirectory,
    undiciTypesDirectory,
  ]) {
    const pathFromRepository = relative(repositoryRoot, dependencyPath);
    assert.equal(pathFromRepository.startsWith("../"), false);
    assert.notEqual(pathFromRepository, "..");
  }

  return {
    typescriptCompiler,
    typescriptDirectory,
    typesNodeDirectory,
    undiciTypesDirectory,
  };
}

function runnerSource() {
  return `import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  symlinkSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";

const [
  temporaryRoot,
  workspacePrefix,
  typescriptCompiler,
  typescriptDirectory,
  typesNodeDirectory,
  undiciTypesDirectory,
] = process.argv.slice(2);
assert.equal(process.argv.length, 8);

const workingDirectory = realpathSync(process.cwd());
const workspaceDirectory = dirname(workingDirectory);
assert.equal(
  realpathSync(dirname(workspaceDirectory)),
  realpathSync(temporaryRoot),
);
assert.equal(
  basename(workspaceDirectory).startsWith(workspacePrefix),
  true,
);
assert.equal(
  new Set(["state-a", "state-b", "state-c"])
    .has(basename(workingDirectory)),
  true,
);
const marker = lstatSync(join(workspaceDirectory, ".change-proof-owned"));
assert.equal(marker.isFile(), true);
assert.equal(marker.isSymbolicLink(), false);

function project(target, linkPath) {
  assert.throws(() => lstatSync(linkPath), (error) => error?.code === "ENOENT");
  mkdirSync(dirname(linkPath), { recursive: true });
  symlinkSync(target, linkPath, "dir");
}

project(typescriptDirectory, join(process.cwd(), "node_modules", "typescript"));
project(typesNodeDirectory, join(process.cwd(), "node_modules", "@types", "node"));
project(undiciTypesDirectory, join(process.cwd(), "node_modules", "undici-types"));

const compile = spawnSync(process.execPath, [typescriptCompiler], {
  cwd: process.cwd(),
  env: { ...process.env },
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  shell: false,
  timeout: 15_000,
});
assert.equal(compile.error, undefined);
process.stdout.write(compile.stdout);
process.stderr.write(compile.stderr);
if (compile.status !== 0) process.exit(compile.status ?? 1);

const compiledTestDirectory = join(
  process.cwd(),
  "dist",
  "test",
);

const testFiles = readdirSync(
  compiledTestDirectory,
  {
    withFileTypes: true,
  },
)
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith(".test.js"),
  )
  .map(
    (entry) =>
      join(
        compiledTestDirectory,
        entry.name,
      ),
  )
  .sort();

assert.equal(
  testFiles.length > 0,
  true,
);

const tested = spawnSync(process.execPath, [
  "--test",
  "--test-reporter=tap",
  ...testFiles,
], {
  cwd: process.cwd(),
  env: { ...process.env },
  encoding: "utf8",
  maxBuffer: 8 * 1024 * 1024,
  shell: false,
  timeout: 25_000,
});
assert.equal(tested.error, undefined);
process.stdout.write(tested.stdout);
process.stderr.write(tested.stderr);
process.exit(tested.status ?? 1);
`;
}

function configuration(
  repositoryRoot,
  temporaryRoot,
  runnerPath,
  dependencies,
  outputDirectory,
) {
  return {
    schemaVersion: "0.1",
    repositoryRoot,
    baseRef: baseCommitId,
    headRef: headCommitId,
    command: {
      executable: process.execPath,
      arguments: [
        runnerPath,
        temporaryRoot,
        "change-proof-m4-project-forge-",
        dependencies.typescriptCompiler,
        dependencies.typescriptDirectory,
        dependencies.typesNodeDirectory,
        dependencies.undiciTypesDirectory,
      ],
      workingDirectory: ".",
      environment: explicitEnvironment(),
      timeoutMs: 45_000,
      maxStdoutBytes: 8 * 1024 * 1024,
      maxStderrBytes: 8 * 1024 * 1024,
    },
    envelope: {
      includedPaths: [selectedTestPath],
    },
    classification: {
      stateA: { expectedTestCount: 61 },
      stateB: { expectedTestCount: 65 },
      stateC: {
        expectedTestCount: 65,
        expectedFailures: [
          {
            testName: failedLeafTests[0],
            outputIncludes: [
              "code: 'ERR_ASSERTION'",
              "expected: 0",
              "actual: 2",
              "operator: 'strictEqual'",
            ],
          },
          {
            testName: failedLeafTests[1],
            outputIncludes: [
              "code: 'ERR_ASSERTION'",
              "expected: 0",
              "actual: 2",
              "operator: 'strictEqual'",
            ],
          },
          {
            testName: failedLeafTests[2],
            outputIncludes: [
              "--version must be used by itself",
              "Unknown option '--version'",
              "code: 'ERR_ASSERTION'",
              "operator: 'match'",
            ],
          },
          {
            testName: failedLeafTests[3],
            outputIncludes: [
              "--version must be used by itself",
              "Unknown option '--version'",
              "code: 'ERR_ASSERTION'",
              "operator: 'match'",
            ],
          },
        ],
      },
    },
    temporaryParentDirectory: temporaryRoot,
    workspacePrefix: "change-proof-m4-project-forge-",
    outputDirectory,
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function invoke(configPath) {
  return runFile(
    process.execPath,
    [binaryPath, "run", "--config", configPath],
    changeProofRoot,
    180_000,
  );
}

function expectedSummary(report, outputDirectory) {
  return [
    "Change Proof",
    `base=${report.repository.baseCommitId}`,
    `head=${report.repository.headCommitId}`,
    `state_a=${report.states.stateA.outcome}`,
    `state_b=${report.states.stateB.outcome}`,
    `state_c=${report.states.stateC.outcome}`,
    `boundary=${report.boundary.valid ? "VALID" : "INVALID"}`,
    `verdict=${report.verdict}`,
    `report_json=${join(outputDirectory, "report.json")}`,
    `report_markdown=${join(outputDirectory, "report.md")}`,
    "cleanup=VERIFIED",
    "",
  ].join("\n");
}

function withoutTiming(report) {
  const normalized = structuredClone(report);
  delete normalized.timing.startedAt;
  delete normalized.timing.durationMs;
  for (const state of Object.values(normalized.states)) {
    if (state.execution !== null) {
      delete state.execution.durationMs;
    }
  }
  return normalized;
}

function assertState(state, expected) {
  assert.equal(state.outcome, expected.outcome);
  assert.equal(state.reasonCode, expected.reasonCode);
  assert.equal(state.testDiscovered, true);
  assert.equal(state.testExecuted, true);
  assert.equal(state.assertionObserved, expected.assertionObserved);
  assert.equal(state.invalidFailure, false);
  assert.equal(state.tapVersionPresent, true);
  assert.deepEqual(state.summary, expected.summary);
  assert.deepEqual(state.failedSubtests, expected.failedSubtests);
  assert.equal(state.execution.exitCode, expected.exitCode);
  assert.equal(state.execution.signal, null);
  assert.equal(state.execution.timedOut, false);
  assert.equal(state.execution.processErrorCode, null);
  assert.equal(state.execution.stdoutTruncated, false);
  assert.equal(state.execution.stderrTruncated, false);
  assert.equal(Number.isSafeInteger(state.execution.durationMs), true);
  assert.equal(state.execution.durationMs >= 0, true);
}

async function assertNoOwnedWorkspaceResidue(temporaryRoot) {
  const names = await readdir(temporaryRoot);
  assert.deepEqual(
    names.filter((name) =>
      name.startsWith("change-proof-m4-project-forge-")),
    [],
  );
}

test(
  "reproduces the M4 project-forge public CLI validation",
  {
    skip: (
      typeof configuredRepository !== "string" ||
      configuredRepository.length === 0
    )
      ? skipReason
      : false,
  },
  async () => {
    const suppliedPath = resolve(configuredRepository);
    const suppliedMetadata = await lstat(suppliedPath);
    assert.equal(suppliedMetadata.isDirectory(), true);
    assert.equal(suppliedMetadata.isSymbolicLink(), false);
    const repositoryRoot = await realpath(suppliedPath);
    assert.equal(
      await realpath((await git(
        repositoryRoot,
        ["rev-parse", "--show-toplevel"],
      )).trim()),
      repositoryRoot,
    );

    const projectForgeBefore = await snapshotGit(repositoryRoot);
    const changeProofBefore = await snapshotGit(changeProofRoot);
    const projectForgeBytesBefore =
      await snapshotCheckoutBytes(repositoryRoot);
    const changeProofBytesBefore =
      await snapshotCheckoutBytes(changeProofRoot);

    assert.equal(projectForgeBefore.branch, "main");
    assert.equal(projectForgeBefore.head, checkoutCommitId);
    assert.equal(projectForgeBefore.status, "");

    for (const commitId of [baseCommitId, headCommitId]) {
      assert.equal(
        (await git(repositoryRoot, [
          "rev-parse",
          "--verify",
          `${commitId}^{commit}`,
        ])).trim(),
        commitId,
      );
    }
    assert.deepEqual(
      (await git(repositoryRoot, [
        "rev-list",
        "--parents",
        "-n",
        "1",
        headCommitId,
      ])).trim().split(" "),
      [headCommitId, baseCommitId],
    );
    assert.deepEqual(
      (await git(repositoryRoot, [
        "diff",
        "--name-only",
        baseCommitId,
        headCommitId,
      ])).trim().split("\n"),
      changedPaths,
    );

    const dependencies = await resolveDependencySnapshot(repositoryRoot);
    const temporaryRoot = await mkdtemp(join(
      tmpdir(),
      "change-proof-m4-project-forge-public-cli-",
    ));
    let runFailure = null;

    try {
      const runnerPath = join(temporaryRoot, "project-forge-runner.mjs");
      await writeFile(runnerPath, runnerSource(), "utf8");
      const runs = [];

      for (const runName of ["first", "second"]) {
        const outputDirectory = join(temporaryRoot, `${runName}-output`);
        const configPath = join(temporaryRoot, `${runName}-config.json`);
        const config = configuration(
          repositoryRoot,
          temporaryRoot,
          runnerPath,
          dependencies,
          outputDirectory,
        );
        await writeJson(configPath, config);
        assert.deepEqual(
          JSON.parse(await readFile(configPath, "utf8")),
          config,
        );

        const invocation = await invoke(configPath);
        assert.equal(invocation.timedOut, false);
        assert.equal(invocation.processErrorCode ?? null, null);
        assert.equal(invocation.signal, null);
        assert.equal(
          invocation.exitCode,
          0,
          `stdout:\n${invocation.stdout}\nstderr:\n${invocation.stderr}`,
        );
        assert.equal(invocation.stderr, "");

        const jsonPath = join(outputDirectory, "report.json");
        const markdownPath = join(outputDirectory, "report.md");
        const json = await readFile(jsonPath, "utf8");
        const markdown = await readFile(markdownPath, "utf8");
        const report = JSON.parse(json);
        assert.equal(
          invocation.stdout,
          expectedSummary(report, outputDirectory),
        );

        assert.equal(report.repository.baseCommitId, baseCommitId);
        assert.equal(report.repository.headCommitId, headCommitId);
        assert.deepEqual(report.repository.changedPaths, changedPaths);
        assertState(report.states.stateA, {
          outcome: "PASS",
          reasonCode: "NODE_TEST_PASS",
          assertionObserved: false,
          summary: {
            tests: 61,
            pass: 61,
            fail: 0,
            cancelled: 0,
            skipped: 0,
            todo: 0,
          },
          failedSubtests: [],
          exitCode: 0,
        });
        assertState(report.states.stateB, {
          outcome: "PASS",
          reasonCode: "NODE_TEST_PASS",
          assertionObserved: false,
          summary: {
            tests: 65,
            pass: 65,
            fail: 0,
            cancelled: 0,
            skipped: 0,
            todo: 0,
          },
          failedSubtests: [],
          exitCode: 0,
        });
        assertState(report.states.stateC, {
          outcome: "TEST_ASSERTION_FAILURE",
          reasonCode: "EXPECTED_ASSERTION_FAILURE_OBSERVED",
          assertionObserved: true,
          summary: {
            tests: 65,
            pass: 61,
            fail: 4,
            cancelled: 0,
            skipped: 0,
            todo: 0,
          },
          failedSubtests: failedLeafTests,
          exitCode: 1,
        });
        assert.equal(
          report.states.stateC.failedSubtests.includes("project-forge CLI"),
          false,
        );
        assert.deepEqual(report.boundary, {
          basedOnBase: true,
          reasonCodes: [],
          resultingChangedPaths: [selectedTestPath],
          selectedPathsMatchHead: true,
          unchangedPathsMatchBase: true,
          valid: true,
        });
        assert.deepEqual(report.envelope.requestedIncludedPaths, [
          selectedTestPath,
        ]);
        assert.deepEqual(report.envelope.includedPaths, [selectedTestPath]);
        assert.deepEqual(report.envelope.materializedPaths, [selectedTestPath]);
        assert.deepEqual(report.envelope.resultingChangedPaths, [
          selectedTestPath,
        ]);
        assert.deepEqual(report.envelope.headChangedPaths, changedPaths);
        assert.deepEqual(report.envelope.excludedChangedPaths, [
          "README.md",
          "docs/TASKS.md",
          "src/cli.ts",
        ]);
        assert.equal(
          report.envelope.stateCBlobIds[selectedTestPath],
          report.envelope.headBlobIds[selectedTestPath],
        );
        for (const path of report.envelope.excludedChangedPaths) {
          assert.equal(
            report.envelope.stateCBlobIds[path],
            report.envelope.baseBlobIds[path],
          );
        }
        assert.equal(report.verdict, "OBSERVED_TEST_DISCRIMINATION");
        assert.deepEqual(report.workspace, {
          cleanupCompleted: true,
          cleanupFailureCodes: [],
          ownershipValidated: true,
          resourcesNotRemoved: 0,
          resourcesRegistered: 3,
          workspaceRemoved: true,
          worktreesCreated: 3,
          worktreesRemoved: 3,
        });
        assert.deepEqual(report.command.environmentKeys, [
          "GIT_CONFIG_GLOBAL",
          "GIT_CONFIG_NOSYSTEM",
          "GIT_OPTIONAL_LOCKS",
          "LANG",
          "LC_ALL",
          ...(Object.hasOwn(explicitEnvironment(), "PATH") ? ["PATH"] : []),
        ]);

        runs.push({
          outputDirectory,
          stdout: invocation.stdout,
          report,
          markdown,
        });
        await assertNoOwnedWorkspaceResidue(temporaryRoot);
      }

      assert.deepEqual(
        withoutTiming(runs[1].report),
        withoutTiming(runs[0].report),
      );
      assert.equal(runs[1].markdown, runs[0].markdown);
      assert.equal(
        runs[1].stdout.replaceAll(runs[1].outputDirectory, "<OUTPUT>"),
        runs[0].stdout.replaceAll(runs[0].outputDirectory, "<OUTPUT>"),
      );
      await assertNoOwnedWorkspaceResidue(temporaryRoot);
    } catch (error) {
      runFailure = error;
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true });
    }

    assert.deepEqual(await snapshotGit(repositoryRoot), projectForgeBefore);
    assert.deepEqual(await snapshotGit(changeProofRoot), changeProofBefore);
    assert.deepEqual(
      await snapshotCheckoutBytes(repositoryRoot),
      projectForgeBytesBefore,
    );
    assert.deepEqual(
      await snapshotCheckoutBytes(changeProofRoot),
      changeProofBytesBefore,
    );

    if (runFailure !== null) {
      throw runFailure;
    }
  },
);
