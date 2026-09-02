import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.join(here, ".work");
const repository = path.join(work, "repository");
const tempParent = path.join(work, "temp");
const outputDirectory = path.join(work, "output");
const configPath = path.join(work, "change-proof.config.json");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? process.env,
    encoding: "utf8",
    stdio: options.stdio ?? "pipe",
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} exited with code ${result.status}`);
  }

  return result.stdout?.trim() ?? "";
}

function commit(cwd, message, date) {
  run("git", ["add", "."], { cwd });

  run("git", ["commit", "-q", "-m", message], {
    cwd,
    env: {
      ...process.env,
      GIT_AUTHOR_DATE: date,
      GIT_COMMITTER_DATE: date,
    },
  });

  return run("git", ["rev-parse", "HEAD"], { cwd });
}

fs.rmSync(work, { recursive: true, force: true });
fs.mkdirSync(path.join(repository, "src"), { recursive: true });
fs.mkdirSync(path.join(repository, "test"), { recursive: true });
fs.mkdirSync(tempParent, { recursive: true });

run("git", ["init", "-q"], { cwd: repository });
run("git", ["config", "user.name", "Change Proof Demo"], {
  cwd: repository,
});
run("git", ["config", "user.email", "demo@changeproof.local"], {
  cwd: repository,
});

fs.writeFileSync(
  path.join(repository, "src", "discount.mjs"),
  `export function finalPrice(price, discountPercent) {
  return price - discountPercent;
}
`,
);

fs.writeFileSync(
  path.join(repository, "test", "discount.test.mjs"),
  `import test from "node:test";
import assert from "node:assert/strict";
import { finalPrice } from "../src/discount.mjs";

test("zero percent leaves price unchanged", () => {
  assert.equal(finalPrice(50, 0), 50);
});
`,
);

const baseRef = commit(
  repository,
  "base: initial discount behavior",
  "2026-01-01T00:00:00Z",
);

fs.writeFileSync(
  path.join(repository, "src", "discount.mjs"),
  `export function finalPrice(price, discountPercent) {
  return price * (1 - discountPercent / 100);
}
`,
);

fs.writeFileSync(
  path.join(repository, "test", "discount.test.mjs"),
  `import test from "node:test";
import assert from "node:assert/strict";
import { finalPrice } from "../src/discount.mjs";

test("zero percent leaves price unchanged", () => {
  assert.equal(finalPrice(50, 0), 50);
});

test("applies a percentage discount", () => {
  assert.equal(
    finalPrice(50, 10),
    45,
    "regression: percentage discount must scale with price",
  );
});
`,
);

const headRef = commit(
  repository,
  "head: fix percentage discount and add regression test",
  "2026-01-02T00:00:00Z",
);

const config = {
  schemaVersion: "0.1",
  repositoryRoot: repository,
  baseRef,
  headRef,
  command: {
    executable: "node",
    arguments: [
      "--test",
      "--test-reporter=tap",
      "test/discount.test.mjs",
    ],
    workingDirectory: ".",
    environment: {
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      LC_ALL: "C",
      LANG: "C",
    },
    timeoutMs: 30000,
    maxStdoutBytes: 4194304,
    maxStderrBytes: 4194304,
  },
  envelope: {
    includedPaths: ["test/discount.test.mjs"],
  },
  classification: {
    stateA: {
      expectedTestCount: 1,
    },
    stateB: {
      expectedTestCount: 2,
    },
    stateC: {
      expectedTestCount: 2,
      expectedFailures: [
        {
          testName: "applies a percentage discount",
          outputIncludes: [
            "regression: percentage discount must scale with price",
          ],
        },
      ],
    },
  },
  temporaryParentDirectory: tempParent,
  workspacePrefix: "change-proof-demo-",
  outputDirectory,
};

fs.writeFileSync(
  configPath,
  `${JSON.stringify(config, null, 2)}\n`,
);

console.log("");
console.log("Change Proof quickstart");
console.log("=======================");
console.log(`BASE: ${baseRef.slice(0, 12)}`);
console.log(`HEAD: ${headRef.slice(0, 12)}`);
console.log(`Config: ${configPath}`);
console.log("");
console.log("Running published @changeproof/cli@0.1.0-beta.2...");
console.log("");

const npmExecutionDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "change-proof-quickstart-npm-"),
);

const result = spawnSync(
  "npm",
  [
    "exec",
    "--yes",
    "--package=@changeproof/cli@0.1.0-beta.2",
    "--",
    "change-proof",
    "run",
    "--config",
    configPath,
  ],
  {
    cwd: npmExecutionDirectory,
    env: process.env,
    encoding: "utf8",
    stdio: "inherit",
  },
);

fs.rmSync(npmExecutionDirectory, { recursive: true, force: true });

if (result.status !== 0) {
  console.error("");
  console.error(`Change Proof exited with code ${result.status}`);
  process.exit(result.status ?? 1);
}

const reportPath = path.join(outputDirectory, "report.md");

console.log("");
console.log("Authoritative evidence report");
console.log("=============================");
console.log("");
console.log(fs.readFileSync(reportPath, "utf8"));
console.log("");
console.log(`Full demo workspace: ${work}`);
console.log(`JSON report: ${path.join(outputDirectory, "report.json")}`);
console.log(`Markdown report: ${reportPath}`);
