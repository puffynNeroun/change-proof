import { constants } from "node:fs";
import {
  lstat,
  open,
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

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return (
    prototype === Object.prototype ||
    prototype === null
  );
}

function scanParsedValue(value) {
  if (typeof value === "string") {
    if (value.includes("\0")) {
      fail("CONFIG_FIELD_INVALID");
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      scanParsedValue(item);
    }
    return;
  }

  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (SPECIAL_KEYS.has(key)) {
        fail("CONFIG_UNKNOWN_KEY");
      }
      scanParsedValue(value[key]);
    }
  }
}

function requireObject(value, allowedKeys) {
  if (!isPlainObject(value)) {
    fail("CONFIG_FIELD_INVALID");
  }

  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail("CONFIG_UNKNOWN_KEY");
    }
  }

  for (const key of allowedKeys) {
    if (!Object.hasOwn(value, key)) {
      fail("CONFIG_REQUIRED_FIELD_MISSING");
    }
  }

  return value;
}

function requireString(value) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    fail("CONFIG_FIELD_INVALID");
  }
  return value;
}

function requireStringArray(value, { nonEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (nonEmpty && value.length === 0)
  ) {
    fail("CONFIG_FIELD_INVALID");
  }

  return value.map((item) => requireString(item));
}

function requirePositiveInteger(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > 2_147_483_647
  ) {
    fail("CONFIG_FIELD_INVALID");
  }
  return value;
}

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

async function readConfigFile(configPath) {
  let metadata;
  try {
    metadata = await lstat(configPath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      fail("CONFIG_FILE_NOT_FOUND", error);
    }
    fail("CONFIG_FILE_READ_FAILED", error);
  }

  if (metadata.isSymbolicLink()) {
    fail("CONFIG_FILE_SYMLINK");
  }
  if (!metadata.isFile()) {
    fail("CONFIG_FILE_NOT_REGULAR");
  }
  if (metadata.size > MAX_CONFIG_BYTES) {
    fail("CONFIG_FILE_TOO_LARGE");
  }

  let handle;
  try {
    handle = await open(
      configPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const openedMetadata = await handle.stat();
    if (!openedMetadata.isFile()) {
      fail("CONFIG_FILE_NOT_REGULAR");
    }
    if (openedMetadata.size > MAX_CONFIG_BYTES) {
      fail("CONFIG_FILE_TOO_LARGE");
    }
    return await handle.readFile();
  } catch (error) {
    if (error instanceof ChangeProofConfigError) {
      throw error;
    }
    if (error?.code === "ELOOP") {
      fail("CONFIG_FILE_SYMLINK", error);
    }
    fail("CONFIG_FILE_READ_FAILED", error);
  } finally {
    if (handle !== undefined) {
      try {
        await handle.close();
      } catch {
        // A failed close cannot make successfully read bytes trustworthy.
        fail("CONFIG_FILE_READ_FAILED");
      }
    }
  }
}

function parseConfigBytes(bytes) {
  let offset = 0;
  const hasBom = (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  );
  if (hasBom) {
    offset = 3;
    if (
      bytes.length >= 6 &&
      bytes[3] === 0xef &&
      bytes[4] === 0xbb &&
      bytes[5] === 0xbf
    ) {
      fail("CONFIG_JSON_INVALID");
    }
  }

  let text;
  try {
    text = new TextDecoder("utf-8", {
      fatal: true,
      ignoreBOM: true,
    }).decode(bytes.subarray(offset));
  } catch (error) {
    fail("CONFIG_JSON_INVALID", error);
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    fail("CONFIG_JSON_INVALID", error);
  }
}

function normalizeSchema(config) {
  requireObject(config, [
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
  ]);

  if (config.schemaVersion !== "0.1") {
    fail("CONFIG_SCHEMA_VERSION_UNSUPPORTED");
  }

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
    repositoryRoot: requireString(config.repositoryRoot),
    baseRef: requireString(config.baseRef),
    headRef: requireString(config.headRef),
    command: {
      executable: requireString(command.executable),
      arguments: requireStringArray(command.arguments),
      workingDirectory: normalizeWorkingDirectory(
        command.workingDirectory,
      ),
      environment: normalizeEnvironment(
        command.environment,
      ),
      timeoutMs: requirePositiveInteger(command.timeoutMs),
      maxStdoutBytes: requirePositiveInteger(
        command.maxStdoutBytes,
      ),
      maxStderrBytes: requirePositiveInteger(
        command.maxStderrBytes,
      ),
    },
    envelope: {
      includedPaths: normalizeIncludedPaths(
        envelope.includedPaths,
      ),
    },
    classification: {
      stateA: {
        expectedTestCount: requireExpectedCount(
          stateA.expectedTestCount,
        ),
      },
      stateB: {
        expectedTestCount: requireExpectedCount(
          stateB.expectedTestCount,
        ),
      },
      stateC: {
        expectedTestCount: requireExpectedCount(
          stateC.expectedTestCount,
        ),
        expectedFailures: normalizeExpectedFailures(
          stateC.expectedFailures,
        ),
      },
    },
    temporaryParentDirectory: requireString(
      config.temporaryParentDirectory,
    ),
    workspacePrefix,
    outputDirectory: requireString(
      config.outputDirectory,
    ),
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
      toolVersion: packageMetadata.version,
      temporaryParentDirectory,
      workspacePrefix: normalized.workspacePrefix,
    },
    outputDirectory,
    configPath: canonicalConfigPath,
  };
}
