import {
  mkdir,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  runChangeProof,
} from "../../src/core/run-change-proof.mjs";

const BASE_COMMIT =
  "2a47fb6b5b28579c30ef5cd52f11c13f594e71f9";
const HEAD_COMMIT =
  "d9ba86e32e991bdc1385d487f26f74c36dba122a";
const TEST_PATH =
  "tools/forge-validator/test/pr-watch.test.mjs";

const EXPECTED_FAILURES = Object.freeze([
  {
    testName:
      "collectPrWatchStatus handles immediately registered passing checks",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'passed'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus reports persistent missing checks without starting watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "+ 'missing'",
      "- 'not_registered'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus preserves failing final checks",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'failed'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus preserves pending final checks",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'pending'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus times out a bounded watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 1234",
    ],
  },
  {
    testName:
      "collectPrWatchStatus rejects a head change before watch",
    outputIncludes: [
      "code: 'ERR_TEST_FAILURE'",
      "Unexpected command: pr checks 89 --watch",
    ],
  },
  {
    testName:
      "collectPrWatchStatus rejects a head change after watch",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "+ 'passing'",
      "- 'head_changed'",
    ],
  },
  {
    testName:
      "collectPrWatchStatus classifies cancelled checks as failed",
    outputIncludes: [
      "code: 'ERR_ASSERTION'",
      "- 'failed'",
    ],
  },
]);

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

async function main(argumentsList) {
  if (argumentsList.length !== 2) {
    throw new Error(
      "usage: node experiments/m2-non-synthetic-pilot/run.mjs <repository-root> <output-directory>",
    );
  }

  const [repositoryArgument, outputArgument] =
    argumentsList;
  const repositoryRoot = resolve(repositoryArgument);
  const outputDirectory = resolve(outputArgument);
  const result = await runChangeProof({
    repositoryRoot,
    baseRef: BASE_COMMIT,
    headRef: HEAD_COMMIT,
    command: {
      executable: process.execPath,
      arguments: [
        "--test",
        "--test-reporter=tap",
        TEST_PATH,
      ],
      workingDirectory: ".",
      environment: explicitEnvironment(),
      timeoutMs: 30_000,
      maxStdoutBytes: 4 * 1024 * 1024,
      maxStderrBytes: 4 * 1024 * 1024,
    },
    envelope: {
      includedPaths: [TEST_PATH],
    },
    classification: {
      stateA: { expectedTestCount: 20 },
      stateB: { expectedTestCount: 24 },
      stateC: {
        expectedTestCount: 24,
        expectedFailures: EXPECTED_FAILURES.map(
          (failure) => ({
            testName: failure.testName,
            outputIncludes: [
              ...failure.outputIncludes,
            ],
          }),
        ),
      },
    },
    toolVersion: "0.1.0-m2.10",
    temporaryParentDirectory: tmpdir(),
    workspacePrefix: "change-proof-m210-pilot-",
  });
  const jsonPath = join(outputDirectory, "report.json");
  const markdownPath = join(outputDirectory, "report.md");

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(jsonPath, result.json, "utf8");
  await writeFile(markdownPath, result.markdown, "utf8");

  const report = result.report;
  const lines = [
    "Change Proof M2.10 pilot",
    `base=${report.repository.baseCommitId}`,
    `head=${report.repository.headCommitId}`,
    `state_a=${report.states.stateA.outcome}`,
    `state_b=${report.states.stateB.outcome}`,
    `state_c=${report.states.stateC.outcome}`,
    `boundary=${report.boundary.valid ? "VALID" : "INVALID"}`,
    `verdict=${report.verdict}`,
    `report_json=${jsonPath}`,
    `report_markdown=${markdownPath}`,
    `cleanup=${report.workspace.cleanupCompleted ? "VERIFIED" : "NOT_VERIFIED"}`,
  ];

  process.stdout.write(`${lines.join("\n")}\n`);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error
    ? error.message
    : String(error);
  process.stderr.write(
    `Change Proof M2.10 pilot failed: ${message}\n`,
  );
  process.exitCode = 1;
}
