import {
  realpath,
  stat,
} from "node:fs/promises";

import {
  dirname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";

import {
  createStrictJsonFilePrimitives,
} from "./strict-json-file.mjs";

const MAX_CONFIG_BYTES =
  1_048_576;

const DANGEROUS_KEYS =
  new Set([
    "__proto__",
    "constructor",
    "prototype",
  ]);

const CODES =
  Object.freeze({
    unknownKey:
      "PREPARE_CONFIG_UNKNOWN_KEY",

    fileNotFound:
      "PREPARE_CONFIG_FILE_NOT_FOUND",

    fileReadFailed:
      "PREPARE_CONFIG_FILE_READ_FAILED",

    fileSymlink:
      "PREPARE_CONFIG_FILE_SYMLINK",

    fileNotRegular:
      "PREPARE_CONFIG_FILE_NOT_REGULAR",

    fileTooLarge:
      "PREPARE_CONFIG_FILE_TOO_LARGE",

    jsonInvalid:
      "PREPARE_CONFIG_JSON_INVALID",
  });

export class PrepareConfigError
  extends Error {
  constructor(
    code,
    cause = undefined,
  ) {
    super(
      code,
      {
        cause,
      },
    );

    this.name =
      "PrepareConfigError";

    this.code = code;
  }
}

function fail(
  code,
  cause = undefined,
) {
  throw new PrepareConfigError(
    code,
    cause,
  );
}

const {
  readConfigFile,
  parseConfigBytes,
  scanParsedValue,
} =
  createStrictJsonFilePrimitives({
    fail,

    maxBytes:
      MAX_CONFIG_BYTES,

    dangerousKeys:
      DANGEROUS_KEYS,

    codes:
      CODES,

    isMappedError:
      (error) =>
        error instanceof
          PrepareConfigError,
  });

function isPlainObject(value) {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return false;
  }

  const prototype =
    Object.getPrototypeOf(value);

  return (
    prototype ===
      Object.prototype ||
    prototype === null
  );
}

function requireObject(value) {
  if (!isPlainObject(value)) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return value;
}

function requireExactKeys(
  value,
  keys,
) {
  const object =
    requireObject(value);

  const allowed =
    new Set(keys);

  for (const key of keys) {
    if (
      !Object.hasOwn(
        object,
        key,
      )
    ) {
      fail(
        "PREPARE_CONFIG_REQUIRED_FIELD_MISSING",
      );
    }
  }

  for (
    const key
    of Object.keys(object)
  ) {
    if (!allowed.has(key)) {
      fail(
        "PREPARE_CONFIG_UNKNOWN_KEY",
      );
    }
  }

  return object;
}

function requireString(
  value,
  {
    allowEmpty = false,
  } = {},
) {
  if (
    typeof value !== "string" ||
    (
      !allowEmpty &&
      value.length === 0
    ) ||
    value.includes("\0")
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return value;
}

function requirePositiveInteger(
  value,
) {
  if (
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return value;
}

function normalizeArguments(value) {
  if (!Array.isArray(value)) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return value.map(
    (argument) =>
      requireString(
        argument,
        {
          allowEmpty: true,
        },
      ),
  );
}

function normalizeEnvironment(value) {
  const environment =
    requireObject(value);

  const normalized = {};

  for (
    const [key, item]
    of Object.entries(environment)
  ) {
    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0")
    ) {
      fail(
        "PREPARE_CONFIG_FIELD_INVALID",
      );
    }

    normalized[key] =
      requireString(
        item,
        {
          allowEmpty: true,
        },
      );
  }

  return normalized;
}

function normalizeRelativePath(
  value,
  {
    allowDot,
  },
) {
  const input =
    requireString(value);

  if (isAbsolute(input)) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  const normalized =
    normalize(input);

  if (
    normalized === ".." ||
    normalized.startsWith(
      `..${sep}`,
    )
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  if (
    !allowDot &&
    normalized === "."
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return normalized;
}

function normalizeIncludedPaths(
  value,
) {
  if (
    !Array.isArray(value) ||
    value.length === 0
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  const seen =
    new Set();

  return value.map(
    (item) => {
      const normalized =
        normalizeRelativePath(
          item,
          {
            allowDot: false,
          },
        );

      if (seen.has(normalized)) {
        fail(
          "PREPARE_CONFIG_DUPLICATE_PATH",
        );
      }

      seen.add(normalized);

      return normalized;
    },
  );
}

function normalizeWorkspacePrefix(
  value,
) {
  const prefix =
    requireString(value);

  if (
    prefix === "." ||
    prefix === ".." ||
    prefix.includes("/") ||
    prefix.includes("\\") ||
    prefix.includes("\n") ||
    prefix.includes("\r")
  ) {
    fail(
      "PREPARE_CONFIG_FIELD_INVALID",
    );
  }

  return prefix;
}

function isContained(
  parent,
  child,
) {
  const difference =
    relative(
      parent,
      child,
    );

  return (
    difference !== "" &&
    difference !== ".." &&
    !difference.startsWith(
      `..${sep}`,
    ) &&
    !isAbsolute(difference)
  );
}

async function normalizeExistingDirectory(
  value,
  configDirectory,
  code,
) {
  const configured =
    requireString(value);

  const resolved =
    resolve(
      configDirectory,
      configured,
    );

  let canonical;

  try {
    canonical =
      await realpath(resolved);
  } catch (error) {
    fail(
      code,
      error,
    );
  }

  if (canonical !== resolved) {
    fail(code);
  }

  let information;

  try {
    information =
      await stat(canonical);
  } catch (error) {
    fail(
      code,
      error,
    );
  }

  if (!information.isDirectory()) {
    fail(code);
  }

  return canonical;
}

function normalizeSchema(parsed) {
  const config =
    requireExactKeys(
      parsed,
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

  if (
    config.schemaVersion !==
      "0.1"
  ) {
    fail(
      "PREPARE_CONFIG_SCHEMA_VERSION_UNSUPPORTED",
    );
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
      [
        "includedPaths",
      ],
    );

  return {
    schemaVersion:
      "0.1",

    repositoryRoot:
      requireString(
        config.repositoryRoot,
      ),

    baseRef:
      requireString(
        config.baseRef,
      ),

    headRef:
      requireString(
        config.headRef,
      ),

    command: {
      executable:
        requireString(
          command.executable,
        ),

      arguments:
        normalizeArguments(
          command.arguments,
        ),

      workingDirectory:
        normalizeRelativePath(
          command.workingDirectory,
          {
            allowDot: true,
          },
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

    temporaryParentDirectory:
      requireString(
        config
          .temporaryParentDirectory,
      ),

    workspacePrefix:
      normalizeWorkspacePrefix(
        config.workspacePrefix,
      ),
  };
}

export async function loadPrepareConfig(
  configPath,
) {
  if (
    typeof configPath !==
      "string" ||
    configPath.length === 0 ||
    configPath.includes("\0")
  ) {
    fail(
      "PREPARE_CONFIG_PATH_INVALID",
    );
  }

  const resolvedConfigPath =
    resolve(configPath);

  const bytes =
    await readConfigFile(
      resolvedConfigPath,
    );

  let canonicalConfigPath;

  try {
    canonicalConfigPath =
      await realpath(
        resolvedConfigPath,
      );
  } catch (error) {
    fail(
      "PREPARE_CONFIG_FILE_READ_FAILED",
      error,
    );
  }

  if (
    canonicalConfigPath !==
      resolvedConfigPath
  ) {
    fail(
      "PREPARE_CONFIG_FILE_SYMLINK",
    );
  }

  const parsed =
    parseConfigBytes(bytes);

  scanParsedValue(parsed);

  const normalized =
    normalizeSchema(parsed);

  const configDirectory =
    dirname(
      canonicalConfigPath,
    );

  const repositoryRoot =
    await normalizeExistingDirectory(
      normalized.repositoryRoot,
      configDirectory,
      "PREPARE_CONFIG_REPOSITORY_INVALID",
    );

  const temporaryParentDirectory =
    await normalizeExistingDirectory(
      normalized
        .temporaryParentDirectory,
      configDirectory,
      "PREPARE_CONFIG_TEMP_DIRECTORY_INVALID",
    );

  if (
    repositoryRoot ===
      temporaryParentDirectory ||
    isContained(
      repositoryRoot,
      temporaryParentDirectory,
    )
  ) {
    fail(
      "PREPARE_CONFIG_PATH_CONTAINMENT_INVALID",
    );
  }

  return {
    prepareConfig: {
      schemaVersion:
        normalized.schemaVersion,

      repositoryRoot,

      baseRef:
        normalized.baseRef,

      headRef:
        normalized.headRef,

      command: {
        executable:
          normalized
            .command
            .executable,

        arguments: [
          ...normalized
            .command
            .arguments,
        ],

        workingDirectory:
          normalized
            .command
            .workingDirectory,

        environment: {
          ...normalized
            .command
            .environment,
        },

        timeoutMs:
          normalized
            .command
            .timeoutMs,

        maxStdoutBytes:
          normalized
            .command
            .maxStdoutBytes,

        maxStderrBytes:
          normalized
            .command
            .maxStderrBytes,
      },

      envelope: {
        includedPaths: [
          ...normalized
            .envelope
            .includedPaths,
        ],
      },

      temporaryParentDirectory,

      workspacePrefix:
        normalized
          .workspacePrefix,
    },

    configPath:
      canonicalConfigPath,
  };
}
