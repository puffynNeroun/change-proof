import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { runCli } from "../../src/cli/run-cli.mjs";

function capture() {
  let value = "";
  return {
    write(chunk) {
      value += chunk;
      return true;
    },
    value() {
      return value;
    },
  };
}

function report(verdict = "OBSERVED_TEST_DISCRIMINATION") {
  return {
    repository: {
      baseCommitId: "a".repeat(40),
      headCommitId: "b".repeat(40),
    },
    states: {
      stateA: { outcome: "PASS" },
      stateB: { outcome: "PASS" },
      stateC: { outcome: "EXPECTED_TEST_FAILURE" },
    },
    boundary: { valid: true },
    workspace: {
      cleanupCompleted: true,
      resourcesNotRemoved: 0,
      ownedPath: "/tmp/change-proof-secret-workspace",
    },
    verdict,
  };
}

async function invoke(argumentsList, options = {}) {
  const stdout = capture();
  const stderr = capture();
  const calls = {
    load: [],
    engine: [],
    writer: [],
  };
  const finalReport = options.report ?? report();
  const dependencies = {
    async loadConfig(path) {
      calls.load.push(path);
      if (options.loadError !== undefined) {
        throw options.loadError;
      }
      return {
        orchestratorInput: { identity: "orchestrator-input" },
        outputDirectory: "/tmp/change-proof-output",
        configPath: path,
      };
    },
    async runEngine(input) {
      calls.engine.push(input);
      if (options.engineError !== undefined) {
        throw options.engineError;
      }
      return {
        report: finalReport,
        json: "{\"rawSecret\":\"never-print\"}\n",
        markdown: "# never-print\n",
      };
    },
    async writeReports(input) {
      calls.writer.push(input);
      if (options.writerError !== undefined) {
        throw options.writerError;
      }
      return {
        jsonPath: "/tmp/change-proof-output/report.json",
        markdownPath: "/tmp/change-proof-output/report.md",
      };
    },
  };
  const input = {
    argumentsList,
    stdout,
    stderr,
    currentWorkingDirectory: "/work/project",
  };
  const exitCode = await runCli(input, dependencies);
  return {
    exitCode,
    stdout: stdout.value(),
    stderr: stderr.value(),
    calls,
    finalReport,
  };
}

function errorWithCode(code) {
  const error = new Error(`secret stack content for ${code}`);
  error.code = code;
  return error;
}

function exactlyOneFinalLf(value) {
  return value.endsWith("\n") && !value.endsWith("\n\n");
}

test("implements the exact public CLI and exit-code contract", async (t) => {
  await t.test("--help", async () => {
    const result = await invoke(["--help"]);
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /^Change Proof\n/);
    for (const expected of [
      "change-proof run --config <path>",
      "--fail-on <VERDICT>",
      "report.json",
      "report.md",
      "not a security sandbox",
    ]) {
      assert.equal(result.stdout.includes(expected), true, expected);
    }
  });

  await t.test("run --help", async () => {
    const first = await invoke(["--help"]);
    const second = await invoke(["run", "--help"]);
    assert.equal(second.exitCode, 0);
    assert.equal(second.stdout, first.stdout);
  });

  await t.test("--version", async () => {
    const result = await invoke(["--version"]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "0.1.0-beta.1\n");
  });

  const usageCases = [
    ["no arguments", [], "CLI_ARGUMENTS_REQUIRED"],
    ["unknown command", ["inspect"], "CLI_COMMAND_INVALID"],
    [
      "unknown option",
      ["run", "--wat"],
      "CLI_OPTION_UNKNOWN",
    ],
    ["missing --config", ["run"], "CLI_CONFIG_REQUIRED"],
    [
      "duplicate --config",
      ["run", "--config", "a", "--config", "b"],
      "CLI_CONFIG_DUPLICATE",
    ],
    [
      "missing config value",
      ["run", "--config"],
      "CLI_OPTION_VALUE_MISSING",
    ],
    [
      "positional argument rejected",
      ["run", "--config", "a", "extra"],
      "CLI_POSITIONAL_ARGUMENT",
    ],
    [
      "unsupported --config=value",
      ["run", "--config=a"],
      "CLI_OPTION_UNKNOWN",
    ],
    [
      "unsupported short option",
      ["run", "-c", "a"],
      "CLI_OPTION_UNKNOWN",
    ],
  ];
  for (const [name, argumentsList, code] of usageCases) {
    await t.test(name, async () => {
      const result = await invoke(argumentsList);
      assert.equal(result.exitCode, 2);
      assert.equal(
        result.stderr,
        `change-proof: usage error: ${code}\n`,
      );
      assert.equal(result.stdout, "");
      assert.equal(result.calls.engine.length, 0);
    });
  }

  await t.test("one valid --fail-on", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
    ]);
    assert.equal(result.exitCode, 1);
  });

  await t.test("repeated valid --fail-on", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "INCONCLUSIVE",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
    ]);
    assert.equal(result.exitCode, 1);
  });

  await t.test("duplicate fail-on is de-duplicated", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
    ]);
    assert.equal(result.exitCode, 1);
    assert.equal(result.calls.engine.length, 1);
    assert.equal(result.calls.writer.length, 1);
  });

  await t.test("invalid fail-on verdict", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "PASS",
    ]);
    assert.equal(result.exitCode, 2);
    assert.equal(
      result.stderr,
      "change-proof: usage error: CLI_FAIL_ON_INVALID\n",
    );
  });

  await t.test("fail-on is case-sensitive", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "inconclusive",
    ]);
    assert.equal(result.exitCode, 2);
  });

  await t.test("success exits 0", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
  });

  await t.test("behavioral negative exits 0 without policy", async () => {
    const result = await invoke(
      ["run", "--config", "config.json"],
      { report: report("NON_DISCRIMINATING_TESTS") },
    );
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /verdict=NON_DISCRIMINATING_TESTS/);
  });

  await t.test("matching fail-on exits 1", async () => {
    const result = await invoke(
      [
        "run", "--config", "config.json",
        "--fail-on", "NON_DISCRIMINATING_TESTS",
      ],
      { report: report("NON_DISCRIMINATING_TESTS") },
    );
    assert.equal(result.exitCode, 1);
  });

  await t.test("non-matching fail-on exits 0", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "INCONCLUSIVE",
    ]);
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout.includes("policy="), false);
  });

  await t.test("reports are written before exit 1", async () => {
    const events = [];
    const stdout = {
      write() {
        events.push("summary");
      },
    };
    const stderr = capture();
    const exitCode = await runCli({
      argumentsList: [
        "run", "--config", "config.json",
        "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
      ],
      stdout,
      stderr,
      currentWorkingDirectory: "/work/project",
    }, {
      async loadConfig() {
        return {
          orchestratorInput: {},
          outputDirectory: "/output",
        };
      },
      async runEngine() {
        return {
          report: report(),
          json: "{}\n",
          markdown: "# Report\n",
        };
      },
      async writeReports() {
        events.push("reports");
        return {
          jsonPath: "/output/report.json",
          markdownPath: "/output/report.md",
        };
      },
    });
    assert.equal(exitCode, 1);
    assert.deepEqual(events, ["reports", "summary"]);
  });

  await t.test("configuration failure exits 2", async () => {
    const result = await invoke(
      ["run", "--config", "bad.json"],
      { loadError: errorWithCode("CONFIG_JSON_INVALID") },
    );
    assert.equal(result.exitCode, 2);
    assert.equal(
      result.stderr,
      "change-proof: configuration error: CONFIG_JSON_INVALID\n",
    );
  });

  await t.test("operational engine failure exits 3", async () => {
    const result = await invoke(
      ["run", "--config", "config.json"],
      { engineError: errorWithCode("GIT_REF_UNRESOLVED") },
    );
    assert.equal(result.exitCode, 3);
    assert.equal(
      result.stderr,
      "change-proof: operational error: GIT_REF_UNRESOLVED\n",
    );
  });

  await t.test("report-writing failure exits 3", async () => {
    const result = await invoke(
      ["run", "--config", "config.json"],
      { writerError: errorWithCode("REPORT_TARGET_EXISTS") },
    );
    assert.equal(result.exitCode, 3);
    assert.equal(
      result.stderr,
      "change-proof: operational error: REPORT_TARGET_EXISTS\n",
    );
  });

  await t.test("runChangeProof is called exactly once", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.calls.engine.length, 1);
  });

  await t.test("writer called exactly once after engine success", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.calls.writer.length, 1);
    assert.equal(
      result.calls.writer[0].json,
      "{\"rawSecret\":\"never-print\"}\n",
    );
  });

  await t.test("writer not called after engine failure", async () => {
    const result = await invoke(
      ["run", "--config", "config.json"],
      { engineError: new Error("failure") },
    );
    assert.equal(result.calls.writer.length, 0);
  });

  await t.test("fail-on does not alter report", async () => {
    const finalReport = report();
    const before = JSON.stringify(finalReport);
    await invoke([
      "run", "--config", "config.json",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
    ], { report: finalReport });
    assert.equal(JSON.stringify(finalReport), before);
  });

  await t.test("concise success summary", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.stdout, [
      "Change Proof",
      `base=${"a".repeat(40)}`,
      `head=${"b".repeat(40)}`,
      "state_a=PASS",
      "state_b=PASS",
      "state_c=EXPECTED_TEST_FAILURE",
      "boundary=VALID",
      "verdict=OBSERVED_TEST_DISCRIMINATION",
      "report_json=/tmp/change-proof-output/report.json",
      "report_markdown=/tmp/change-proof-output/report.md",
      "cleanup=VERIFIED",
      "",
    ].join("\n"));
  });

  await t.test("policy rejected summary", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on", "OBSERVED_TEST_DISCRIMINATION",
    ]);
    assert.match(result.stdout, /\npolicy=REJECTED\n$/);
  });

  await t.test("does not expose raw execution output", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.stdout.includes("never-print"), false);
    assert.equal(result.stderr.includes("never-print"), false);
  });

  await t.test("does not expose temporary workspace paths", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
    ]);
    assert.equal(result.stdout.includes("secret-workspace"), false);
  });

  await t.test("does not print stack traces", async () => {
    const result = await invoke(
      ["run", "--config", "config.json"],
      { engineError: errorWithCode("ENGINE_CODE") },
    );
    assert.equal(result.stderr.includes("at "), false);
    assert.equal(result.stderr.includes("secret stack"), false);
  });

  await t.test("keeps stdout and stderr separate", async () => {
    const success = await invoke([
      "run", "--config", "config.json",
    ]);
    const failure = await invoke([]);
    assert.equal(success.stderr, "");
    assert.equal(failure.stdout, "");
  });

  await t.test("does not mutate input arguments", async () => {
    const argumentsList = ["run", "--config", "config.json"];
    const before = [...argumentsList];
    await invoke(argumentsList);
    assert.deepEqual(argumentsList, before);
  });

  await t.test("does not mutate environment", async () => {
    const before = Object.entries(process.env).sort();
    await invoke(["run", "--config", "config.json"]);
    assert.deepEqual(Object.entries(process.env).sort(), before);
  });

  await t.test("does not change current working directory", async () => {
    const before = process.cwd();
    await invoke(["run", "--config", "config.json"]);
    assert.equal(process.cwd(), before);
  });

  await t.test("all public output ends in exactly one LF", async () => {
    const cases = [
      await invoke(["--help"]),
      await invoke(["--version"]),
      await invoke(["run", "--config", "config.json"]),
      await invoke([]),
    ];
    for (const result of cases) {
      const output = result.stdout || result.stderr;
      assert.equal(exactlyOneFinalLf(output), true);
    }
  });

  await t.test("uses only runChangeProof as engine entry point", async () => {
    const source = await readFile(
      resolve("src/cli/run-cli.mjs"),
      "utf8",
    );
    assert.match(
      source,
      /import \{ runChangeProof \} from "\.\.\/core\/run-change-proof\.mjs";/,
    );
    for (const forbidden of [
      "run-bounded-command",
      "classify-node-test",
      "git-repository-primitives",
      "owned-workspace-lifecycle",
      "materialize-explicit-envelope",
      "evaluate-boundary",
      "build-evidence-report",
      "render-evidence-report-markdown",
    ]) {
      assert.equal(source.includes(forbidden), false, forbidden);
    }
  });

  await t.test("resolves config from supplied cwd", async () => {
    const result = await invoke([
      "run", "--config", "nested/config.json",
    ]);
    assert.deepEqual(result.calls.load, [
      "/work/project/nested/config.json",
    ]);
  });

  await t.test("--version with extra arguments is rejected", async () => {
    const result = await invoke(["--version", "extra"]);
    assert.equal(result.exitCode, 2);
  });

  await t.test("--help after run options is rejected", async () => {
    const result = await invoke([
      "run", "--config", "config.json", "--help",
    ]);
    assert.equal(result.exitCode, 2);
  });

  await t.test("unsupported --fail-on=value is rejected", async () => {
    const result = await invoke([
      "run", "--config", "config.json",
      "--fail-on=INCONCLUSIVE",
    ]);
    assert.equal(result.exitCode, 2);
  });

  await t.test("fail-on before config is rejected", async () => {
    const result = await invoke([
      "run",
      "--fail-on", "INCONCLUSIVE",
      "--config", "config.json",
    ]);
    assert.equal(result.exitCode, 2);
    assert.equal(
      result.stderr,
      "change-proof: usage error: CLI_CONFIG_REQUIRED\n",
    );
  });

  await t.test("invalid runner input returns usage exit", async () => {
    const stderr = capture();
    const exitCode = await runCli({
      argumentsList: "--help",
      stdout: capture(),
      stderr,
      currentWorkingDirectory: "/work",
    });
    assert.equal(exitCode, 2);
    assert.equal(
      stderr.value(),
      "change-proof: usage error: CLI_INPUT_INVALID\n",
    );
  });
});
