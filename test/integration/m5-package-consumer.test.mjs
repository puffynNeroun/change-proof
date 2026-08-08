import assert from "node:assert/strict";
import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const repositoryRoot = fileURLToPath(
  new URL("../../", import.meta.url),
);

const commandTimeoutMs = 60_000;
const maxBuffer = 16 * 1024 * 1024;

function run(executable, arguments_, options = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: options.cwd,
    env: options.env ?? process.env,
    encoding: "utf8",
    timeout: options.timeout ?? commandTimeoutMs,
    maxBuffer,
  });

  return {
    status: result.status,
    signal: result.signal,
    error: result.error,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assertSucceeded(result, context) {
  assert.equal(
    result.error,
    undefined,
    `${context} spawn error: ${result.error?.message}`,
  );

  assert.equal(
    result.signal,
    null,
    `${context} terminated by signal ${result.signal}`,
  );

  assert.equal(
    result.status,
    0,
    `${context} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
}

function git(repository, ...arguments_) {
  const result = run("git", arguments_, {
    cwd: repository,
  });

  assertSucceeded(
    result,
    `git ${arguments_.join(" ")}`,
  );

  return result.stdout.trim();
}

async function write(path, contents) {
  await mkdir(dirname(path), {
    recursive: true,
  });

  await writeFile(path, contents, "utf8");
}

test(
  "installs the packed package into an isolated consumer and runs evidence through the installed binary",
  {
    skip:
      process.platform !== "linux"
        ? "v0.1 consumer acceptance is Linux/WSL only"
        : false,
    timeout: 120_000,
  },
  async () => {
    const temporaryRoot = await mkdtemp(
      join(tmpdir(), "change-proof-consumer-"),
    );

    try {
      const packageJson = JSON.parse(
        await readFile(
          join(repositoryRoot, "package.json"),
          "utf8",
        ),
      );

      assert.equal(
        packageJson.name,
        "@changeproof/cli",
      );

      assert.equal(
        packageJson.private,
        true,
      );

      assert.deepEqual(
        packageJson.publishConfig,
        {
          access: "public",
        },
      );

      assert.equal(
        packageJson.bin?.["change-proof"],
        "bin/change-proof.mjs",
      );

      const packDirectory = join(
        temporaryRoot,
        "pack",
      );

      const consumerDirectory = join(
        temporaryRoot,
        "consumer",
      );

      const candidateRepository = join(
        temporaryRoot,
        "candidate-repository",
      );

      const workspaceParent = join(
        temporaryRoot,
        "workspaces",
      );

      await mkdir(packDirectory, {
        recursive: true,
      });

      await mkdir(consumerDirectory, {
        recursive: true,
      });

      await mkdir(candidateRepository, {
        recursive: true,
      });

      await mkdir(workspaceParent, {
        recursive: true,
      });

      /*
       * Produce the actual distribution tarball.
       *
       * It is intentionally created outside the repository checkout.
       */
      const packResult = run(
        "npm",
        [
          "pack",
          "--ignore-scripts",
          "--json",
          "--pack-destination",
          packDirectory,
        ],
        {
          cwd: repositoryRoot,
        },
      );

      assertSucceeded(
        packResult,
        "npm pack",
      );

      const packOutput = JSON.parse(
        packResult.stdout,
      );

      assert.equal(packOutput.length, 1);

      const packed = packOutput[0];

      assert.equal(
        packed.name,
        packageJson.name,
      );

      assert.equal(
        packed.version,
        packageJson.version,
      );

      assert.ok(packed.filename);

      const packedPaths = packed.files.map(
        (entry) => entry.path,
      );

      assert.ok(
        packedPaths.includes("LICENSE"),
      );

      assert.ok(
        packedPaths.includes("README.md"),
      );

      assert.ok(
        packedPaths.includes(
          "bin/change-proof.mjs",
        ),
      );

      assert.ok(
        packedPaths.includes("package.json"),
      );

      assert.equal(
        packedPaths.some(
          (path) => path.startsWith("test/"),
        ),
        false,
      );

      assert.equal(
        packedPaths.some(
          (path) => path.startsWith("docs/"),
        ),
        false,
      );

      const tarballPath = join(
        packDirectory,
        packed.filename,
      );

      await access(
        tarballPath,
        fsConstants.R_OK,
      );

      /*
       * Create a completely separate consumer package.
       */
      await write(
        join(
          consumerDirectory,
          "package.json",
        ),
        JSON.stringify(
          {
            name: "change-proof-consumer-acceptance",
            version: "1.0.0",
            private: true,
          },
          null,
          2,
        ) + "\n",
      );

      /*
       * The package has no runtime dependencies.
       * --offline makes registry independence explicit.
       */
      const installResult = run(
        "npm",
        [
          "install",
          "--offline",
          "--ignore-scripts",
          "--no-audit",
          "--no-fund",
          "--package-lock=false",
          tarballPath,
        ],
        {
          cwd: consumerDirectory,
        },
      );

      assertSucceeded(
        installResult,
        "isolated local-tarball npm install",
      );

      const installedBinary = join(
        consumerDirectory,
        "node_modules",
        ".bin",
        "change-proof",
      );

      await access(
        installedBinary,
        fsConstants.X_OK,
      );

      /*
       * Public binary surface from installed package.
       */
      const versionResult = run(
        installedBinary,
        ["--version"],
        {
          cwd: consumerDirectory,
        },
      );

      assertSucceeded(
        versionResult,
        "installed --version",
      );

      assert.match(
        versionResult.stdout,
        new RegExp(
          packageJson.version.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          ),
        ),
      );

      const helpResult = run(
        installedBinary,
        ["--help"],
        {
          cwd: consumerDirectory,
        },
      );

      assertSucceeded(
        helpResult,
        "installed --help",
      );

      assert.match(
        helpResult.stdout,
        /change-proof run --config <path>/,
      );

      const runHelpResult = run(
        installedBinary,
        ["run", "--help"],
        {
          cwd: consumerDirectory,
        },
      );

      assertSucceeded(
        runHelpResult,
        "installed run --help",
      );

      assert.match(
        runHelpResult.stdout,
        /--fail-on <VERDICT>/,
      );

      /*
       * Build an independent two-commit Git repository.
       *
       * Base:
       *   implementation => "base"
       *   test expects "base"
       *
       * Head:
       *   implementation => "head"
       *   changed test expects "head"
       *
       * State C therefore receives:
       *   base implementation + head test
       * and must produce the exact expected assertion failure.
       */
      git(
        candidateRepository,
        "init",
        "-b",
        "main",
      );

      git(
        candidateRepository,
        "config",
        "user.name",
        "Change Proof Consumer Acceptance",
      );

      git(
        candidateRepository,
        "config",
        "user.email",
        "consumer-acceptance@example.invalid",
      );

      await write(
        join(
          candidateRepository,
          "src",
          "behavior.mjs",
        ),
        [
          'export function behavior() {',
          '  return "base";',
          '}',
          '',
        ].join("\n"),
      );

      await write(
        join(
          candidateRepository,
          "test",
          "behavior.test.mjs",
        ),
        [
          'import assert from "node:assert/strict";',
          'import test from "node:test";',
          'import { behavior } from "../src/behavior.mjs";',
          '',
          'test("returns base behavior", () => {',
          '  assert.equal(behavior(), "base");',
          '});',
          '',
        ].join("\n"),
      );

      git(
        candidateRepository,
        "add",
        "--all",
      );

      git(
        candidateRepository,
        "commit",
        "-m",
        "consumer fixture base",
      );

      const baseSha = git(
        candidateRepository,
        "rev-parse",
        "HEAD",
      );

      await write(
        join(
          candidateRepository,
          "src",
          "behavior.mjs",
        ),
        [
          'export function behavior() {',
          '  return "head";',
          '}',
          '',
        ].join("\n"),
      );

      await write(
        join(
          candidateRepository,
          "test",
          "behavior.test.mjs",
        ),
        [
          'import assert from "node:assert/strict";',
          'import test from "node:test";',
          'import { behavior } from "../src/behavior.mjs";',
          '',
          'test("returns head behavior", () => {',
          '  assert.equal(',
          '    behavior(),',
          '    "head",',
          '    "CHANGE_PROOF_CONSUMER_EXPECTS_HEAD",',
          '  );',
          '});',
          '',
        ].join("\n"),
      );

      git(
        candidateRepository,
        "add",
        "--all",
      );

      git(
        candidateRepository,
        "commit",
        "-m",
        "consumer fixture head",
      );

      const headSha = git(
        candidateRepository,
        "rev-parse",
        "HEAD",
      );

      assert.notEqual(
        baseSha,
        headSha,
      );

      assert.equal(
        git(
          candidateRepository,
          "status",
          "--porcelain",
        ),
        "",
      );

      const reportsDirectory = join(
        temporaryRoot,
        "reports",
      );

      const configuration = {
        schemaVersion: "0.1",
        repositoryRoot: candidateRepository,
        baseRef: baseSha,
        headRef: headSha,
        command: {
          executable: process.execPath,
          arguments: [
            "--test",
            "--test-reporter=tap",
            "test/behavior.test.mjs",
          ],
          workingDirectory: ".",
          environment: {},
          timeoutMs: 30_000,
          maxStdoutBytes: 4_194_304,
          maxStderrBytes: 4_194_304,
        },
        envelope: {
          includedPaths: [
            "test/behavior.test.mjs",
          ],
        },
        classification: {
          stateA: {
            expectedTestCount: 1,
          },
          stateB: {
            expectedTestCount: 1,
          },
          stateC: {
            expectedTestCount: 1,
            expectedFailures: [
              {
                testName: "returns head behavior",
                outputIncludes: [
                  "CHANGE_PROOF_CONSUMER_EXPECTS_HEAD",
                ],
              },
            ],
          },
        },
        temporaryParentDirectory:
          workspaceParent,
        workspacePrefix:
          "change-proof-consumer-",
        outputDirectory:
          reportsDirectory,
      };

      const configPath = join(
        temporaryRoot,
        "change-proof.config.json",
      );

      await write(
        configPath,
        JSON.stringify(
          configuration,
          null,
          2,
        ) + "\n",
      );

      /*
       * Positive completed evidence run.
       */
      const evidenceResult = run(
        installedBinary,
        [
          "run",
          "--config",
          configPath,
        ],
        {
          cwd: consumerDirectory,
        },
      );

      assertSucceeded(
        evidenceResult,
        "installed evidence run",
      );

      assert.match(
        evidenceResult.stdout,
        /OBSERVED_TEST_DISCRIMINATION/,
      );

      const reportJsonPath = join(
        reportsDirectory,
        "report.json",
      );

      const reportMarkdownPath = join(
        reportsDirectory,
        "report.md",
      );

      const reportJsonText = await readFile(
        reportJsonPath,
        "utf8",
      );

      const reportJson = JSON.parse(
        reportJsonText,
      );

      const reportMarkdown = await readFile(
        reportMarkdownPath,
        "utf8",
      );

      assert.equal(
        reportJson.verdict,
        "OBSERVED_TEST_DISCRIMINATION",
      );

      /*
       * Avoid coupling this distribution test to internal
       * report nesting while still proving that the exact
       * immutable commit identities were recorded.
       */
      assert.match(
        reportJsonText,
        new RegExp(baseSha),
      );

      assert.match(
        reportJsonText,
        new RegExp(headSha),
      );

      assert.match(
        reportMarkdown,
        /OBSERVED_TEST_DISCRIMINATION/,
      );

      assert.match(
        reportMarkdown,
        new RegExp(baseSha),
      );

      assert.match(
        reportMarkdown,
        new RegExp(headSha),
      );

      /*
       * Policy rejection must happen after reports exist.
       */
      const policyReportsDirectory = join(
        temporaryRoot,
        "policy-reports",
      );

      const policyConfigPath = join(
        temporaryRoot,
        "change-proof-policy.config.json",
      );

      await write(
        policyConfigPath,
        JSON.stringify(
          {
            ...configuration,
            outputDirectory:
              policyReportsDirectory,
          },
          null,
          2,
        ) + "\n",
      );

      const policyResult = run(
        installedBinary,
        [
          "run",
          "--config",
          policyConfigPath,
          "--fail-on",
          "OBSERVED_TEST_DISCRIMINATION",
        ],
        {
          cwd: consumerDirectory,
        },
      );

      assert.equal(
        policyResult.error,
        undefined,
      );

      assert.equal(
        policyResult.signal,
        null,
      );

      assert.equal(
        policyResult.status,
        1,
        [
          "policy run returned unexpected status",
          `stdout:\n${policyResult.stdout}`,
          `stderr:\n${policyResult.stderr}`,
        ].join("\n"),
      );

      const policyReportJson = JSON.parse(
        await readFile(
          join(
            policyReportsDirectory,
            "report.json",
          ),
          "utf8",
        ),
      );

      await access(
        join(
          policyReportsDirectory,
          "report.md",
        ),
        fsConstants.R_OK,
      );

      assert.equal(
        policyReportJson.verdict,
        "OBSERVED_TEST_DISCRIMINATION",
      );

      /*
       * Both completed runs must clean every temporary
       * Change Proof worktree registration.
       */
      const worktreeResult = run(
        "git",
        [
          "worktree",
          "list",
          "--porcelain",
        ],
        {
          cwd: candidateRepository,
        },
      );

      assertSucceeded(
        worktreeResult,
        "post-run git worktree list",
      );

      const registeredWorktrees =
        worktreeResult.stdout
          .split("\n")
          .filter(
            (line) =>
              line.startsWith("worktree "),
          );

      assert.equal(
        registeredWorktrees.length,
        1,
      );

      assert.equal(
        git(
          candidateRepository,
          "status",
          "--porcelain",
        ),
        "",
      );

      assert.equal(
        git(
          candidateRepository,
          "rev-parse",
          "HEAD",
        ),
        headSha,
      );
    } finally {
      await rm(
        temporaryRoot,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);
