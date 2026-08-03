import { resolve } from "node:path";

import packageMetadata from "../../package.json" with {
  type: "json",
};
import { VERDICTS } from "../core/evaluate-evidence.mjs";
import { runChangeProof } from "../core/run-change-proof.mjs";
import { loadChangeProofConfig } from "./load-config.mjs";
import { writeEvidenceReports } from "./write-reports.mjs";

const HELP = `Change Proof
Collect reproducible local evidence that selected tests distinguish base and head implementations.

Usage:
  change-proof run --config <path> [--fail-on <VERDICT>]...
  change-proof --help
  change-proof run --help
  change-proof --version

Commands:
  run                         Run the configured evidence check.

Options:
  --config <path>             Strict JSON configuration file.
  --fail-on <VERDICT>         Reject a completed verdict; may be repeated.
  --help                      Show this help.
  --version                   Show the package version.

Reports:
  report.json                 Authoritative JSON evidence report.
  report.md                   Human-readable Markdown projection.

Exit codes:
  0  Completed and accepted after both reports were written.
  1  Completed and rejected by --fail-on after both reports were written.
  2  Invalid command usage or configuration.
  3  Operational failure prevented completion or report finalization.

Security:
  Configured repository code is executed locally. Git worktrees isolate states but are not a security sandbox.
`;

function write(stream, value) {
  stream.write(value);
}

function usageFailure(code) {
  return { type: "usage", code };
}

function parseArguments(argumentsList) {
  if (
    argumentsList.length === 1 &&
    argumentsList[0] === "--help"
  ) {
    return { type: "help" };
  }
  if (
    argumentsList.length === 2 &&
    argumentsList[0] === "run" &&
    argumentsList[1] === "--help"
  ) {
    return { type: "help" };
  }
  if (
    argumentsList.length === 1 &&
    argumentsList[0] === "--version"
  ) {
    return { type: "version" };
  }
  if (argumentsList.length === 0) {
    return usageFailure("CLI_ARGUMENTS_REQUIRED");
  }
  if (argumentsList[0] !== "run") {
    return usageFailure("CLI_COMMAND_INVALID");
  }

  let configPath = null;
  const failOn = new Set();
  const allowedVerdicts = new Set(
    Object.values(VERDICTS),
  );

  for (let index = 1; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === "--config") {
      if (configPath !== null) {
        return usageFailure("CLI_CONFIG_DUPLICATE");
      }
      const value = argumentsList[index + 1];
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("-")
      ) {
        return usageFailure("CLI_OPTION_VALUE_MISSING");
      }
      configPath = value;
      index += 1;
      continue;
    }
    if (argument === "--fail-on") {
      if (configPath === null) {
        return usageFailure("CLI_CONFIG_REQUIRED");
      }
      const value = argumentsList[index + 1];
      if (
        typeof value !== "string" ||
        value.length === 0 ||
        value.startsWith("-")
      ) {
        return usageFailure("CLI_OPTION_VALUE_MISSING");
      }
      if (!allowedVerdicts.has(value)) {
        return usageFailure("CLI_FAIL_ON_INVALID");
      }
      failOn.add(value);
      index += 1;
      continue;
    }
    if (argument.startsWith("-")) {
      return usageFailure("CLI_OPTION_UNKNOWN");
    }
    return usageFailure("CLI_POSITIONAL_ARGUMENT");
  }

  if (configPath === null) {
    return usageFailure("CLI_CONFIG_REQUIRED");
  }
  return { type: "run", configPath, failOn };
}

function cleanupStatus(workspace) {
  return (
    workspace?.cleanupCompleted === true &&
    workspace?.resourcesNotRemoved === 0
  )
    ? "VERIFIED"
    : "NOT_VERIFIED";
}

function completedSummary(report, paths, rejected) {
  const lines = [
    "Change Proof",
    `base=${report.repository.baseCommitId}`,
    `head=${report.repository.headCommitId}`,
    `state_a=${report.states.stateA.outcome}`,
    `state_b=${report.states.stateB.outcome}`,
    `state_c=${report.states.stateC.outcome}`,
    `boundary=${report.boundary.valid ? "VALID" : "INVALID"}`,
    `verdict=${report.verdict}`,
    `report_json=${paths.jsonPath}`,
    `report_markdown=${paths.markdownPath}`,
    `cleanup=${cleanupStatus(report.workspace)}`,
  ];
  if (rejected) {
    lines.push("policy=REJECTED");
  }
  return `${lines.join("\n")}\n`;
}

function errorCode(error, fallback) {
  return (
    typeof error?.code === "string" &&
    error.code.length > 0
  )
    ? error.code
    : fallback;
}

export async function runCli(input, injected = {}) {
  const argumentsList = input?.argumentsList;
  const stdout = input?.stdout;
  const stderr = input?.stderr;
  const currentWorkingDirectory =
    input?.currentWorkingDirectory;

  if (
    !Array.isArray(argumentsList) ||
    argumentsList.some((item) => typeof item !== "string") ||
    typeof stdout?.write !== "function" ||
    typeof stderr?.write !== "function" ||
    typeof currentWorkingDirectory !== "string" ||
    currentWorkingDirectory.length === 0
  ) {
    if (typeof stderr?.write === "function") {
      write(
        stderr,
        "change-proof: usage error: CLI_INPUT_INVALID\n",
      );
    }
    return 2;
  }

  const parsed = parseArguments([...argumentsList]);
  if (parsed.type === "help") {
    write(stdout, HELP);
    return 0;
  }
  if (parsed.type === "version") {
    write(stdout, `${packageMetadata.version}\n`);
    return 0;
  }
  if (parsed.type === "usage") {
    write(
      stderr,
      `change-proof: usage error: ${parsed.code}\n`,
    );
    return 2;
  }

  const loadConfig = injected.loadConfig ??
    loadChangeProofConfig;
  const runEngine = injected.runEngine ?? runChangeProof;
  const writeReports = injected.writeReports ??
    writeEvidenceReports;

  let loaded;
  try {
    loaded = await loadConfig(resolve(
      currentWorkingDirectory,
      parsed.configPath,
    ));
  } catch (error) {
    write(
      stderr,
      "change-proof: configuration error: " +
        `${errorCode(error, "CONFIG_LOAD_FAILED")}\n`,
    );
    return 2;
  }

  let result;
  try {
    result = await runEngine(loaded.orchestratorInput);
  } catch (error) {
    write(
      stderr,
      "change-proof: operational error: " +
        `${errorCode(error, "ENGINE_FAILED")}\n`,
    );
    return 3;
  }

  let paths;
  try {
    paths = await writeReports({
      outputDirectory: loaded.outputDirectory,
      json: result.json,
      markdown: result.markdown,
    });
  } catch (error) {
    write(
      stderr,
      "change-proof: operational error: " +
        `${errorCode(error, "REPORT_WRITE_FAILED")}\n`,
    );
    return 3;
  }

  const rejected = parsed.failOn.has(
    result.report.verdict,
  );
  write(
    stdout,
    completedSummary(result.report, paths, rejected),
  );
  return rejected ? 1 : 0;
}
