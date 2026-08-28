import { createStrictJsonFilePrimitives } from "./strict-json-file.mjs";
import {
  lstat,
  realpath,
  stat,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";

import packageMetadata from "../../package.json" with {
  type: "json",
};

const MAX_CONFIG_BYTES = 1024 * 1024;
const SPECIAL_KEYS = new Set([
  "__proto__",
  "prototype",
  "constructor",
]);

class ChangeProofConfigError extends Error {
  constructor(code, cause) {
    super(code, cause === undefined ? {} : { cause });
    this.name = "ChangeProofConfigError";
    this.code = code;
  }
}

function configError(code, cause) {
  return new ChangeProofConfigError(code, cause);
}

function fail(code, cause) {
  throw configError(code, cause);
}

const {
  isPlainObject,
  scanParsedValue,
  requireObject,
  requireString,
  requireStringArray,
  requirePositiveInteger,
  readConfigFile,
  parseConfigBytes,
} = createStrictJsonFilePrimitives({
  fail,
  maxBytes: MAX_CONFIG_BYTES,
  dangerousKeys: SPECIAL_KEYS,
  codes: {
    fieldInvalid:
      "CONFIG_FIELD_INVALID",
    unknownKey:
      "CONFIG_UNKNOWN_KEY",
    requiredFieldMissing:
      "CONFIG_REQUIRED_FIELD_MISSING",
    fileNotFound:
      "CONFIG_FILE_NOT_FOUND",
    fileReadFailed:
      "CONFIG_FILE_READ_FAILED",
    fileSymlink:
      "CONFIG_FILE_SYMLINK",
    fileNotRegular:
      "CONFIG_FILE_NOT_REGULAR",
    fileTooLarge:
      "CONFIG_FILE_TOO_LARGE",
    jsonInvalid:
      "CONFIG_JSON_INVALID",
  },
  isMappedError: (error) =>
    error instanceof ChangeProofConfigError,
});

function requireExpectedCount(value) {
  if (!Number.isSafeInteger(value) || value < 0) {
    fail("CONFIG_FIELD_INVALID");
  }
  return value;
}

function isWindowsAbsolute(value) {
  return /^[A-Za-z]:[\\/]/.test(value);
}

function normalizeWorkingDirectory(value) {
  requireString(value);
  if (
    isAbsolute(value) ||
    isWindowsAbsolute(value) ||
    value.includes("\\") ||
    value.split("/").includes("..")
  ) {
    fail("CONFIG_FIELD_INVALID");
  }
  return value;
}

function normalizeIncludedPaths(value) {
  const paths = requireStringArray(value, {
    nonEmpty: true,
  });

  for (const path of paths) {
    const segments = path.split("/");
    if (
      isAbsolute(path) ||
      isWindowsAbsolute(path) ||
      path.includes("\\") ||
      segments.some((segment) =>
        segment === "" ||
        segment === "." ||
        segment === "..")
    ) {
      fail("CONFIG_FIELD_INVALID");
    }
  }

  if (new Set(paths).size !== paths.length) {
    fail("CONFIG_DUPLICATE_PATH");
  }

  return [...paths];
}

function normalizeEnvironment(value) {
  if (!isPlainObject(value)) {
    fail("CONFIG_FIELD_INVALID");
  }

  const environment = {};
  for (const key of Object.keys(value)) {
    const item = value[key];
    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0") ||
      typeof item !== "string" ||
      item.includes("\0")
    ) {
      fail("CONFIG_FIELD_INVALID");
    }
    environment[key] = item;
  }
  return environment;
}

function normalizeExpectedFailures(value) {
  if (!Array.isArray(value) || value.length === 0) {
    fail("CONFIG_FIELD_INVALID");
  }

  const failures = value.map((item) => {
    requireObject(item, ["testName", "outputIncludes"]);
    return {
      testName: requireString(item.testName),
      outputIncludes: requireStringArray(
        item.outputIncludes,
        { nonEmpty: true },
      ),
    };
  });

  const names = failures.map(({ testName }) => testName);
  if (new Set(names).size !== names.length) {
    fail("CONFIG_DUPLICATE_EXPECTED_FAILURE");
  }

  return failures;
}

function isContained(parent, candidate) {
  const pathFromParent = relative(parent, candidate);
  return (
    pathFromParent === "" ||
    (
      pathFromParent !== ".." &&
      !pathFromParent.startsWith("../") &&
      !isAbsolute(pathFromParent)
    )
  );
}

async function lstatOrFail(path, invalidCode) {
  try {
    return await lstat(path);
  } catch (error) {
    fail(invalidCode, error);
  }
}

async function normalizeExistingDirectory(
  configuredPath,
  configDirectory,
  invalidCode,
) {
  requireString(configuredPath);
  const absolutePath = resolve(
    configDirectory,
    configuredPath,
  );
  const metadata = await lstatOrFail(
    absolutePath,
    invalidCode,
  );

  if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
    fail(invalidCode);
  }

  let canonicalPath;
  try {
    canonicalPath = await realpath(absolutePath);
  } catch (error) {
    fail(invalidCode, error);
  }

  if (canonicalPath !== absolutePath) {
    fail(invalidCode);
  }

  return canonicalPath;
}

async function findExistingParent(candidate) {
  let current = candidate;

  while (true) {
    try {
      const metadata = await lstat(current);
      return { path: current, metadata };
    } catch (error) {
      if (error?.code !== "ENOENT") {
        fail("CONFIG_OUTPUT_DIRECTORY_INVALID", error);
      }
    }

    const parent = dirname(current);
    if (parent === current) {
      fail("CONFIG_OUTPUT_DIRECTORY_INVALID");
    }
    current = parent;
  }
}

async function normalizeOutputDirectory(
  configuredPath,
  configDirectory,
) {
  requireString(configuredPath);
  const absolutePath = resolve(
    configDirectory,
    configuredPath,
  );
  const existing = await findExistingParent(absolutePath);

  if (
    existing.metadata.isSymbolicLink() ||
    !existing.metadata.isDirectory()
  ) {
    fail("CONFIG_OUTPUT_DIRECTORY_INVALID");
  }

  let canonicalParent;
  try {
    canonicalParent = await realpath(existing.path);
  } catch (error) {
    fail("CONFIG_OUTPUT_DIRECTORY_INVALID", error);
  }

  if (canonicalParent !== existing.path) {
    fail("CONFIG_OUTPUT_DIRECTORY_INVALID");
  }

  if (existing.path === absolutePath) {
    return canonicalParent;
  }
  return absolutePath;
}

function requireSha256(value) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{64}$/u.test(value)
  ) {
    fail("CONFIG_FIELD_INVALID");
  }

  return value;
}

function normalizeExpectationProvenance(value) {
  const provenance = requireObject(
    value,
    [
      "source",
      "candidateSha256",
      "candidateContractVersion",
      "prepareToolVersion",
      "prepareConfigSha256",
      "repositoryContextSha256",
      "resolvedCommits",
      "executionContractSha256",
      "envelopeSha256",
      "failureSetSha256",
    ],
  );

  if (
    provenance.source !==
      "change-proof.prepare-candidate" ||
    provenance.candidateContractVersion !==
      "0.1"
  ) {
    fail("CONFIG_FIELD_INVALID");
  }

  const resolvedCommits = requireObject(
    provenance.resolvedCommits,
    ["base", "head"],
  );

  return {
    source:
      "change-proof.prepare-candidate",

    candidateSha256:
      requireSha256(
        provenance.candidateSha256,
      ),

    candidateContractVersion:
      "0.1",

    prepareToolVersion:
      requireString(
        provenance.prepareToolVersion,
      ),

    prepareConfigSha256:
      requireSha256(
        provenance.prepareConfigSha256,
      ),

    repositoryContextSha256:
      requireSha256(
        provenance.repositoryContextSha256,
      ),

    resolvedCommits: {
      base:
        requireString(
          resolvedCommits.base,
        ),

      head:
        requireString(
          resolvedCommits.head,
        ),
    },

    executionContractSha256:
      requireSha256(
        provenance.executionContractSha256,
      ),

    envelopeSha256:
      requireSha256(
        provenance.envelopeSha256,
      ),

    failureSetSha256:
      requireSha256(
        provenance.failureSetSha256,
      ),
  };
}

function normalizeSchema(config) {
  if (!isPlainObject(config)) {
    fail("CONFIG_FIELD_INVALID");
  }

  if (
    config.schemaVersion !== "0.1" &&
    config.schemaVersion !== "0.2"
  ) {
    fail("CONFIG_SCHEMA_VERSION_UNSUPPORTED");
  }

  const commonKeys = [
    "schemaVersion",
    "repositoryRoot",
    "baseRef",
    "headRef",
    "command",
    "envelope",
    "classification",
    "temporaryParentDirectory",
    "workspacePrefix",
    "outputDirectory",
  ];

  requireObject(
    config,
    config.schemaVersion === "0.2"
      ? [
          ...commonKeys,
          "expectationProvenance",
        ]
      : commonKeys,
  );

  const command = requireObject(config.command, [
    "executable",
    "arguments",
    "workingDirectory",
    "environment",
    "timeoutMs",
    "maxStdoutBytes",
    "maxStderrBytes",
  ]);

  const envelope = requireObject(config.envelope, [
    "includedPaths",
  ]);

  const classification = requireObject(
    config.classification,
    ["stateA", "stateB", "stateC"],
  );

  const stateA = requireObject(
    classification.stateA,
    ["expectedTestCount"],
  );

  const stateB = requireObject(
    classification.stateB,
    ["expectedTestCount"],
  );

  const stateC = requireObject(
    classification.stateC,
    ["expectedTestCount", "expectedFailures"],
  );

  const workspacePrefix = requireString(
    config.workspacePrefix,
  );

  if (
    workspacePrefix === "." ||
    workspacePrefix === ".." ||
    workspacePrefix.includes("/") ||
    workspacePrefix.includes("\\") ||
    workspacePrefix.includes("\n") ||
    workspacePrefix.includes("\r")
  ) {
    fail("CONFIG_FIELD_INVALID");
  }

  return {
    schemaVersion:
      config.schemaVersion,

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
        requireStringArray(command.arguments),

      workingDirectory:
        normalizeWorkingDirectory(
          command.workingDirectory,
        ),

      environment:
        normalizeEnvironment(
          command.environment,
        ),

      timeoutMs:
        requirePositiveInteger(
          command.timeoutMs,
        ),

      maxStdoutBytes:
        requirePositiveInteger(
          command.maxStdoutBytes,
        ),

      maxStderrBytes:
        requirePositiveInteger(
          command.maxStderrBytes,
        ),
    },

    envelope: {
      includedPaths:
        normalizeIncludedPaths(
          envelope.includedPaths,
        ),
    },

    classification: {
      stateA: {
        expectedTestCount:
          requireExpectedCount(
            stateA.expectedTestCount,
          ),
      },

      stateB: {
        expectedTestCount:
          requireExpectedCount(
            stateB.expectedTestCount,
          ),
      },

      stateC: {
        expectedTestCount:
          requireExpectedCount(
            stateC.expectedTestCount,
          ),

        expectedFailures:
          normalizeExpectedFailures(
            stateC.expectedFailures,
          ),
      },
    },

    expectationProvenance:
      config.schemaVersion === "0.2"
        ? normalizeExpectationProvenance(
            config.expectationProvenance,
          )
        : null,

    temporaryParentDirectory:
      requireString(
        config.temporaryParentDirectory,
      ),

    workspacePrefix,

    outputDirectory:
      requireString(config.outputDirectory),
  };
}

export async function loadChangeProofConfig(configPath) {
  if (
    typeof configPath !== "string" ||
    configPath.length === 0 ||
    configPath.includes("\0")
  ) {
    fail("CONFIG_PATH_INVALID");
  }

  const resolvedConfigPath = resolve(configPath);
  const bytes = await readConfigFile(resolvedConfigPath);

  let canonicalConfigPath;
  try {
    canonicalConfigPath = await realpath(resolvedConfigPath);
  } catch (error) {
    fail("CONFIG_FILE_READ_FAILED", error);
  }
  if (canonicalConfigPath !== resolvedConfigPath) {
    fail("CONFIG_FILE_SYMLINK");
  }

  const parsed = parseConfigBytes(bytes);
  scanParsedValue(parsed);
  const normalized = normalizeSchema(parsed);
  const configDirectory = dirname(canonicalConfigPath);
  const repositoryRoot = await normalizeExistingDirectory(
    normalized.repositoryRoot,
    configDirectory,
    "CONFIG_REPOSITORY_INVALID",
  );
  const temporaryParentDirectory =
    await normalizeExistingDirectory(
      normalized.temporaryParentDirectory,
      configDirectory,
      "CONFIG_TEMP_DIRECTORY_INVALID",
    );
  const outputDirectory = await normalizeOutputDirectory(
    normalized.outputDirectory,
    configDirectory,
  );

  if (
    repositoryRoot === temporaryParentDirectory ||
    isContained(repositoryRoot, temporaryParentDirectory) ||
    outputDirectory === repositoryRoot ||
    isContained(repositoryRoot, outputDirectory) ||
    isContained(resolve(repositoryRoot, ".git"), outputDirectory)
  ) {
    fail("CONFIG_PATH_CONTAINMENT_INVALID");
  }

  return {
    orchestratorInput: {
      repositoryRoot,
      baseRef: normalized.baseRef,
      headRef: normalized.headRef,
      command: {
        executable: normalized.command.executable,
        arguments: [...normalized.command.arguments],
        workingDirectory:
          normalized.command.workingDirectory,
        environment: {
          ...normalized.command.environment,
        },
        timeoutMs: normalized.command.timeoutMs,
        maxStdoutBytes:
          normalized.command.maxStdoutBytes,
        maxStderrBytes:
          normalized.command.maxStderrBytes,
      },
      envelope: {
        includedPaths: [
          ...normalized.envelope.includedPaths,
        ],
      },
      classification: {
        stateA: {
          expectedTestCount:
            normalized.classification.stateA
              .expectedTestCount,
        },
        stateB: {
          expectedTestCount:
            normalized.classification.stateB
              .expectedTestCount,
        },
        stateC: {
          expectedTestCount:
            normalized.classification.stateC
              .expectedTestCount,
          expectedFailures:
            normalized.classification.stateC
              .expectedFailures.map((failure) => ({
                testName: failure.testName,
                outputIncludes: [
                  ...failure.outputIncludes,
                ],
              })),
        },
      },
      expectationProvenance:
        normalized.expectationProvenance === null
          ? null
          : {
              ...normalized.expectationProvenance,

              resolvedCommits: {
                ...normalized
                  .expectationProvenance
                  .resolvedCommits,
              },
            },

      toolVersion: packageMetadata.version,
      temporaryParentDirectory,
      workspacePrefix: normalized.workspacePrefix,
    },
    outputDirectory,

    expectationProvenance:
      normalized.expectationProvenance === null
        ? null
        : {
            ...normalized.expectationProvenance,

            resolvedCommits: {
              ...normalized
                .expectationProvenance
                .resolvedCommits,
            },
          },

    configPath: canonicalConfigPath,
  };
}
