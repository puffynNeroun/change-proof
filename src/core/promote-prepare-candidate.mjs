import {
  normalizePrepareCandidate,
} from "./prepare-candidate.mjs";

import {
  canonicalSerialize,
  sha256Hex,
} from "./provenance-digests.mjs";

function fail(code) {
  const error = new TypeError(code);
  error.code = code;
  throw error;
}

function requireString(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    fail("PREPARE_PROMOTION_INPUT_INVALID");
  }

  return value;
}

function requirePlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    !(
      Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null
    )
  ) {
    fail("PREPARE_PROMOTION_INPUT_INVALID");
  }

  return value;
}

function requireExactKeys(
  value,
  requiredKeys,
) {
  requirePlainObject(value);

  const suppliedKeys =
    Object.keys(value).sort();

  const expectedKeys =
    [...requiredKeys].sort();

  if (
    canonicalSerialize(suppliedKeys) !==
    canonicalSerialize(expectedKeys)
  ) {
    fail("PREPARE_PROMOTION_INPUT_INVALID");
  }

  return value;
}

function cloneStringArray(value) {
  if (!Array.isArray(value)) {
    fail("PREPARE_PROMOTION_INPUT_INVALID");
  }

  return value.map(requireString);
}

function cloneEnvironment(value) {
  requirePlainObject(value);

  const result = {};

  for (const [key, item] of Object.entries(value)) {
    requireString(key);

    if (
      key.includes("=") ||
      typeof item !== "string" ||
      item.includes("\0")
    ) {
      fail("PREPARE_PROMOTION_INPUT_INVALID");
    }

    result[key] = item;
  }

  return result;
}

function normalizePrepareConfig(input) {
  const config =
    requireExactKeys(
      input,
      [
        "schemaVersion",
        "repositoryRoot",
        "baseRef",
        "headRef",
        "command",
        "envelope",
        "temporaryParentDirectory",
        "workspacePrefix",
      ],
    );

  if (config.schemaVersion !== "0.1") {
    fail("PREPARE_PROMOTION_INPUT_INVALID");
  }

  const command =
    requireExactKeys(
      config.command,
      [
        "executable",
        "arguments",
        "workingDirectory",
        "environment",
        "timeoutMs",
        "maxStdoutBytes",
        "maxStderrBytes",
      ],
    );

  const envelope =
    requireExactKeys(
      config.envelope,
      ["includedPaths"],
    );

  for (
    const numericValue
    of [
      command.timeoutMs,
      command.maxStdoutBytes,
      command.maxStderrBytes,
    ]
  ) {
    if (
      !Number.isSafeInteger(numericValue) ||
      numericValue <= 0
    ) {
      fail("PREPARE_PROMOTION_INPUT_INVALID");
    }
  }

  return {
    schemaVersion: "0.1",

    repositoryRoot:
      requireString(config.repositoryRoot),

    baseRef:
      requireString(config.baseRef),

    headRef:
      requireString(config.headRef),

    command: {
      executable:
        requireString(command.executable),

      arguments:
        cloneStringArray(command.arguments),

      workingDirectory:
        requireString(command.workingDirectory),

      environment:
        cloneEnvironment(command.environment),

      timeoutMs:
        command.timeoutMs,

      maxStdoutBytes:
        command.maxStdoutBytes,

      maxStderrBytes:
        command.maxStderrBytes,
    },

    envelope: {
      includedPaths:
        cloneStringArray(
          envelope.includedPaths,
        ),
    },

    temporaryParentDirectory:
      requireString(
        config.temporaryParentDirectory,
      ),

    workspacePrefix:
      requireString(config.workspacePrefix),
  };
}

function observedTestCount(state) {
  if (
    state?.status !== "OBSERVED" ||
    state.inspection?.structuralStatus !==
      "COMPLETE" ||
    !Number.isSafeInteger(
      state.inspection.observedTestCount,
    ) ||
    state.inspection.observedTestCount < 0
  ) {
    fail(
      "PREPARE_PROMOTION_OBSERVATION_INVALID",
    );
  }

  return state.inspection.observedTestCount;
}

export function promotePrepareCandidate({
  prepareConfig,
  candidate,
  outputDirectory,
}) {
  const normalizedPrepareConfig =
    normalizePrepareConfig(prepareConfig);

  const normalizedCandidate =
    normalizePrepareCandidate(candidate);

  const normalizedOutputDirectory =
    requireString(outputDirectory);

  const identity =
    normalizedCandidate.identity;

  if (
    identity.promotionEligible !== true ||
    identity.prepareOutcome !==
      "ASSERTION_CANDIDATE_OBSERVED" ||
    identity.failureSetSha256 === null ||
    identity.candidateFailures.length === 0
  ) {
    fail("PREPARE_PROMOTION_NOT_ELIGIBLE");
  }

  const prepareConfigSha256 =
    sha256Hex(
      canonicalSerialize(
        normalizedPrepareConfig,
      ),
    );

  if (
    prepareConfigSha256 !==
    identity.prepareConfigSha256
  ) {
    fail(
      "PREPARE_PROMOTION_CONFIG_DIGEST_MISMATCH",
    );
  }

  const stateAExpectedTestCount =
    observedTestCount(
      identity.states.stateA,
    );

  const stateBExpectedTestCount =
    observedTestCount(
      identity.states.stateB,
    );

  const stateCExpectedTestCount =
    observedTestCount(
      identity.states.stateC,
    );

  const expectedFailures =
    identity.candidateFailures.map(
      (failure) => ({
        testName:
          failure.testName,

        outputIncludes: [
          ...failure.outputIncludes,
        ],
      }),
    );

  return {
    schemaVersion: "0.2",

    repositoryRoot:
      normalizedPrepareConfig.repositoryRoot,

    baseRef:
      normalizedPrepareConfig.baseRef,

    headRef:
      normalizedPrepareConfig.headRef,

    command: {
      executable:
        normalizedPrepareConfig
          .command.executable,

      arguments: [
        ...normalizedPrepareConfig
          .command.arguments,
      ],

      workingDirectory:
        normalizedPrepareConfig
          .command.workingDirectory,

      environment: {
        ...normalizedPrepareConfig
          .command.environment,
      },

      timeoutMs:
        normalizedPrepareConfig
          .command.timeoutMs,

      maxStdoutBytes:
        normalizedPrepareConfig
          .command.maxStdoutBytes,

      maxStderrBytes:
        normalizedPrepareConfig
          .command.maxStderrBytes,
    },

    envelope: {
      includedPaths: [
        ...normalizedPrepareConfig
          .envelope.includedPaths,
      ],
    },

    classification: {
      stateA: {
        expectedTestCount:
          stateAExpectedTestCount,
      },

      stateB: {
        expectedTestCount:
          stateBExpectedTestCount,
      },

      stateC: {
        expectedTestCount:
          stateCExpectedTestCount,

        expectedFailures,
      },
    },

    expectationProvenance: {
      source:
        "change-proof.prepare-candidate",

      candidateSha256:
        normalizedCandidate
          .candidateSha256,

      candidateContractVersion:
        identity.candidateContractVersion,

      prepareToolVersion:
        identity.prepareToolVersion,

      prepareConfigSha256:
        identity.prepareConfigSha256,

      repositoryContextSha256:
        identity.repositoryContextSha256,

      resolvedCommits: {
        base:
          identity.resolvedCommits.base,

        head:
          identity.resolvedCommits.head,
      },

      executionContractSha256:
        identity.executionContractSha256,

      envelopeSha256:
        identity.envelopeSha256,

      failureSetSha256:
        identity.failureSetSha256,
    },

    temporaryParentDirectory:
      normalizedPrepareConfig
        .temporaryParentDirectory,

    workspacePrefix:
      normalizedPrepareConfig.workspacePrefix,

    outputDirectory:
      normalizedOutputDirectory,
  };
}
