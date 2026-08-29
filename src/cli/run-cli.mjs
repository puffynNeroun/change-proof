import { resolve } from "node:path";

import packageMetadata from "../../package.json" with {
  type: "json",
};
import { VERDICTS } from "../core/evaluate-evidence.mjs";
import {
  promotePrepareCandidate,
} from "../core/promote-prepare-candidate.mjs";
import { runChangeProof } from "../core/run-change-proof.mjs";
import { runPrepare } from "../core/run-prepare.mjs";
import { loadChangeProofConfig } from "./load-config.mjs";
import {
  loadPrepareCandidate,
} from "./load-prepare-candidate.mjs";
import {
  loadPrepareConfig,
} from "./load-prepare-config.mjs";
import {
  writeExclusiveArtifact,
} from "./write-exclusive-artifact.mjs";
import { writeEvidenceReports } from "./write-reports.mjs";

const HELP = `Change Proof
Collect reproducible local evidence that selected tests distinguish base and head implementations.

Usage:
  change-proof prepare --config <path> --candidate <path>
  change-proof promote --config <path> --candidate <path> --output-config <path> --output-directory <path>
  change-proof run --config <path> [--fail-on <VERDICT>]...
  change-proof --help
  change-proof <command> --help
  change-proof --version

Commands:
  prepare                     Observe A/B/C and write a non-authoritative candidate.
  promote                     Promote one whole eligible candidate into schema 0.2.
  run                         Run the authoritative evidence check.

Prepare:
  --config <path>             Strict schema 0.1 prepare configuration.
  --candidate <path>          Candidate artifact path; never overwritten.

Promote:
  --config <path>             Same schema 0.1 prepare configuration.
  --candidate <path>          Candidate artifact produced by prepare.
  --output-config <path>      Promoted schema 0.2 config; never overwritten.
  --output-directory <path>   Report directory embedded in the promoted config.

Run:
  --config <path>             Strict schema 0.1 or promoted schema 0.2 config.
  --fail-on <VERDICT>         Reject a completed verdict; may be repeated.

General:
  --help                      Show this help.
  --version                   Show the package version.

Workflow:
  prepare -> review candidate -> promote whole candidate -> run promoted config

Reports:
  report.json                 Authoritative JSON evidence report.
  report.md                   Human-readable Markdown projection.

Exit codes:
  0  Command completed successfully.
  1  Run completed but --fail-on rejected its verdict.
  2  Invalid command usage, configuration, candidate, or promotion input.
  3  Operational failure prevented completion or artifact finalization.

Security:
  Configured repository code is executed locally. Git worktrees isolate states but are not a security sandbox.
`;

function write(stream, value) {
  stream.write(value);
}

function usageFailure(code) {
  return { type: "usage", code };
}

function optionValue(
  argumentsList,
  index,
) {
  const value =
    argumentsList[index + 1];

  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.startsWith("-")
  ) {
    return null;
  }

  return value;
}

function parsePrepareArguments(
  argumentsList,
) {
  let configPath = null;
  let candidatePath = null;

  for (
    let index = 1;
    index < argumentsList.length;
    index += 1
  ) {
    const argument =
      argumentsList[index];

    if (
      argument !== "--config" &&
      argument !== "--candidate"
    ) {
      return usageFailure(
        argument.startsWith("-")
          ? "CLI_OPTION_UNKNOWN"
          : "CLI_POSITIONAL_ARGUMENT",
      );
    }

    const value =
      optionValue(
        argumentsList,
        index,
      );

    if (value === null) {
      return usageFailure(
        "CLI_OPTION_VALUE_MISSING",
      );
    }

    if (argument === "--config") {
      if (configPath !== null) {
        return usageFailure(
          "CLI_CONFIG_DUPLICATE",
        );
      }

      configPath = value;
    } else {
      if (candidatePath !== null) {
        return usageFailure(
          "CLI_CANDIDATE_DUPLICATE",
        );
      }

      candidatePath = value;
    }

    index += 1;
  }

  if (configPath === null) {
    return usageFailure(
      "CLI_CONFIG_REQUIRED",
    );
  }

  if (candidatePath === null) {
    return usageFailure(
      "CLI_CANDIDATE_REQUIRED",
    );
  }

  return {
    type: "prepare",
    configPath,
    candidatePath,
  };
}

function parsePromoteArguments(
  argumentsList,
) {
  const values = {
    configPath: null,
    candidatePath: null,
    outputConfigPath: null,
    outputDirectory: null,
  };

  const options = new Map([
    ["--config", "configPath"],
    ["--candidate", "candidatePath"],
    ["--output-config", "outputConfigPath"],
    ["--output-directory", "outputDirectory"],
  ]);

  for (
    let index = 1;
    index < argumentsList.length;
    index += 1
  ) {
    const argument =
      argumentsList[index];

    const field =
      options.get(argument);

    if (field === undefined) {
      return usageFailure(
        argument.startsWith("-")
          ? "CLI_OPTION_UNKNOWN"
          : "CLI_POSITIONAL_ARGUMENT",
      );
    }

    const value =
      optionValue(
        argumentsList,
        index,
      );

    if (value === null) {
      return usageFailure(
        "CLI_OPTION_VALUE_MISSING",
      );
    }

    if (values[field] !== null) {
      return usageFailure(
        argument === "--config"
          ? "CLI_CONFIG_DUPLICATE"
          : "CLI_OPTION_DUPLICATE",
      );
    }

    values[field] = value;
    index += 1;
  }

  if (values.configPath === null) {
    return usageFailure(
      "CLI_CONFIG_REQUIRED",
    );
  }

  if (values.candidatePath === null) {
    return usageFailure(
      "CLI_CANDIDATE_REQUIRED",
    );
  }

  if (values.outputConfigPath === null) {
    return usageFailure(
      "CLI_OUTPUT_CONFIG_REQUIRED",
    );
  }

  if (values.outputDirectory === null) {
    return usageFailure(
      "CLI_OUTPUT_DIRECTORY_REQUIRED",
    );
  }

  return {
    type: "promote",
    ...values,
  };
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
    [
      "prepare",
      "promote",
      "run",
    ].includes(argumentsList[0]) &&
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

  if (
    argumentsList[0] ===
      "prepare"
  ) {
    return parsePrepareArguments(
      argumentsList,
    );
  }

  if (
    argumentsList[0] ===
      "promote"
  ) {
    return parsePromoteArguments(
      argumentsList,
    );
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

function prepareSummary(result) {
  return [
    "Change Proof prepare",
    `candidate=${result.candidatePath}`,
    `candidate_sha256=${result.candidate.candidateSha256}`,
    `outcome=${result.candidate.identity.prepareOutcome}`,
    `promotion_eligible=${result.candidate.identity.promotionEligible ? "YES" : "NO"}`,
    "",
  ].join("\n");
}

function promoteSummary(
  promoted,
  outputConfigPath,
) {
  return [
    "Change Proof promote",
    `config=${outputConfigPath}`,
    `schema=${promoted.schemaVersion}`,
    `candidate_sha256=${promoted.expectationProvenance.candidateSha256}`,
    "whole_failure_set=ACCEPTED",
    "",
  ].join("\n");
}

function serializePromotedConfig(
  promoted,
) {
  return (
    JSON.stringify(
      promoted,
      null,
      2,
    ) + "\n"
  );
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

  const loadPrepare =
    injected.loadPrepareConfig ??
    loadPrepareConfig;

  const prepareEngine =
    injected.runPrepare ??
    runPrepare;

  const loadCandidate =
    injected.loadPrepareCandidate ??
    loadPrepareCandidate;

  const promoteCandidate =
    injected.promotePrepareCandidate ??
    promotePrepareCandidate;

  const writeArtifact =
    injected.writeExclusiveArtifact ??
    writeExclusiveArtifact;

  if (parsed.type === "prepare") {
    let loadedPrepare;

    try {
      loadedPrepare =
        await loadPrepare(
          resolve(
            currentWorkingDirectory,
            parsed.configPath,
          ),
        );
    } catch (error) {
      write(
        stderr,
        "change-proof: configuration error: " +
          `${errorCode(error, "PREPARE_CONFIG_LOAD_FAILED")}\n`,
      );
      return 2;
    }

    let result;

    try {
      result =
        await prepareEngine(
          {
            prepareConfig:
              loadedPrepare.prepareConfig,

            prepareToolVersion:
              packageMetadata.version,

            candidatePath:
              resolve(
                currentWorkingDirectory,
                parsed.candidatePath,
              ),
          },
          {
            gitExecutable:
              "git",

            environment: {
              ...loadedPrepare
                .prepareConfig
                .command
                .environment,
            },

            timeoutMs:
              loadedPrepare
                .prepareConfig
                .command
                .timeoutMs,

            maxStdoutBytes:
              loadedPrepare
                .prepareConfig
                .command
                .maxStdoutBytes,

            maxStderrBytes:
              loadedPrepare
                .prepareConfig
                .command
                .maxStderrBytes,
          },
        );
    } catch (error) {
      write(
        stderr,
        "change-proof: operational error: " +
          `${errorCode(error, "PREPARE_FAILED")}\n`,
      );
      return 3;
    }

    write(
      stdout,
      prepareSummary(result),
    );

    return 0;
  }

  if (parsed.type === "promote") {
    let loadedPrepare;
    let loadedCandidate;

    try {
      loadedPrepare =
        await loadPrepare(
          resolve(
            currentWorkingDirectory,
            parsed.configPath,
          ),
        );

      loadedCandidate =
        await loadCandidate(
          resolve(
            currentWorkingDirectory,
            parsed.candidatePath,
          ),
        );
    } catch (error) {
      write(
        stderr,
        "change-proof: configuration error: " +
          `${errorCode(error, "PREPARE_PROMOTION_INPUT_INVALID")}\n`,
      );
      return 2;
    }

    let promoted;

    try {
      promoted =
        promoteCandidate({
          prepareConfig:
            loadedPrepare.prepareConfig,

          candidate:
            loadedCandidate.candidate,

          outputDirectory:
            resolve(
              currentWorkingDirectory,
              parsed.outputDirectory,
            ),
        });
    } catch (error) {
      write(
        stderr,
        "change-proof: configuration error: " +
          `${errorCode(error, "PREPARE_PROMOTION_FAILED")}\n`,
      );
      return 2;
    }

    const targetPath =
      resolve(
        currentWorkingDirectory,
        parsed.outputConfigPath,
      );

    let artifact;

    try {
      artifact =
        await writeArtifact({
          targetPath,

          content:
            serializePromotedConfig(
              promoted,
            ),
        });
    } catch (error) {
      write(
        stderr,
        "change-proof: operational error: " +
          `${errorCode(error, "PROMOTED_CONFIG_WRITE_FAILED")}\n`,
      );
      return 3;
    }

    write(
      stdout,
      promoteSummary(
        promoted,
        artifact.targetPath,
      ),
    );

    return 0;
  }

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
