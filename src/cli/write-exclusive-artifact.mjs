import {
  link,
  lstat,
  open,
  realpath,
  unlink,
} from "node:fs/promises";

import {
  randomUUID,
} from "node:crypto";

import {
  basename,
  dirname,
  resolve,
} from "node:path";

export const EXCLUSIVE_ARTIFACT_ERROR_CODES =
  Object.freeze({
    INVALID_INPUT:
      "EXCLUSIVE_ARTIFACT_INVALID_INPUT",

    PARENT_INVALID:
      "EXCLUSIVE_ARTIFACT_PARENT_INVALID",

    TARGET_EXISTS:
      "EXCLUSIVE_ARTIFACT_TARGET_EXISTS",

    TEMPORARY_CREATE_FAILED:
      "EXCLUSIVE_ARTIFACT_TEMPORARY_CREATE_FAILED",

    TEMPORARY_WRITE_FAILED:
      "EXCLUSIVE_ARTIFACT_TEMPORARY_WRITE_FAILED",

    TEMPORARY_CLOSE_FAILED:
      "EXCLUSIVE_ARTIFACT_TEMPORARY_CLOSE_FAILED",

    PUBLICATION_FAILED:
      "EXCLUSIVE_ARTIFACT_PUBLICATION_FAILED",

    TEMPORARY_CLEANUP_FAILED:
      "EXCLUSIVE_ARTIFACT_TEMPORARY_CLEANUP_FAILED",
  });

export class ExclusiveArtifactError
  extends Error {
  constructor(
    code,
    stage,
    cause = null,
  ) {
    super(code);

    this.name =
      "ExclusiveArtifactError";

    this.code =
      code;

    this.stage =
      stage;

    if (cause !== null) {
      Object.defineProperty(
        this,
        "cause",
        {
          configurable: true,
          enumerable: false,
          value: cause,
          writable: false,
        },
      );
    }
  }
}

function artifactError(
  code,
  stage,
  cause = null,
) {
  return new ExclusiveArtifactError(
    code,
    stage,
    cause,
  );
}

function validContent(
  value,
) {
  return (
    typeof value === "string" ||
    value instanceof Uint8Array
  );
}

const DEFAULT_OPERATIONS =
  Object.freeze({
    link,
    lstat,
    open,
    realpath,
    unlink,
    randomUUID,
  });

async function removeOwnedTemporary(
  operations,
  temporaryPath,
) {
  try {
    await operations.unlink(
      temporaryPath,
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      return;
    }

    throw artifactError(
      EXCLUSIVE_ARTIFACT_ERROR_CODES
        .TEMPORARY_CLEANUP_FAILED,
      "cleanup_temporary",
      error,
    );
  }
}

export function createExclusiveArtifactWriter(
  overrides = {},
) {
  if (
    overrides === null ||
    typeof overrides !== "object" ||
    Array.isArray(overrides)
  ) {
    throw artifactError(
      EXCLUSIVE_ARTIFACT_ERROR_CODES
        .INVALID_INPUT,
      "validate_operations",
    );
  }

  const operations = {
    ...DEFAULT_OPERATIONS,
    ...overrides,
  };

  for (const name of [
    "link",
    "lstat",
    "open",
    "realpath",
    "unlink",
    "randomUUID",
  ]) {
    if (
      typeof operations[name] !==
        "function"
    ) {
      throw artifactError(
        EXCLUSIVE_ARTIFACT_ERROR_CODES
          .INVALID_INPUT,
        "validate_operations",
      );
    }
  }

  return async function writeExclusiveArtifact(
    input,
  ) {
    if (
      input === null ||
      typeof input !== "object" ||
      Array.isArray(input) ||
      typeof input.targetPath !== "string" ||
      input.targetPath.length === 0 ||
      input.targetPath.includes("\0") ||
      !validContent(input.content)
    ) {
      throw artifactError(
        EXCLUSIVE_ARTIFACT_ERROR_CODES
          .INVALID_INPUT,
        "validate_input",
      );
    }

    const targetPath =
      resolve(
        input.targetPath,
      );

    const parentPath =
      dirname(
        targetPath,
      );

    let parentMetadata;
    let canonicalParent;

    try {
      parentMetadata =
        await operations.lstat(
          parentPath,
        );

      canonicalParent =
        await operations.realpath(
          parentPath,
        );
    } catch (error) {
      throw artifactError(
        EXCLUSIVE_ARTIFACT_ERROR_CODES
          .PARENT_INVALID,
        "validate_parent",
        error,
      );
    }

    if (
      !parentMetadata.isDirectory() ||
      parentMetadata.isSymbolicLink() ||
      canonicalParent !==
        resolve(parentPath)
    ) {
      throw artifactError(
        EXCLUSIVE_ARTIFACT_ERROR_CODES
          .PARENT_INVALID,
        "validate_parent",
      );
    }

    try {
      await operations.lstat(
        targetPath,
      );

      throw artifactError(
        EXCLUSIVE_ARTIFACT_ERROR_CODES
          .TARGET_EXISTS,
        "inspect_target",
      );
    } catch (error) {
      if (
        error instanceof
          ExclusiveArtifactError
      ) {
        throw error;
      }

      if (error?.code !== "ENOENT") {
        throw artifactError(
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .PUBLICATION_FAILED,
          "inspect_target",
          error,
        );
      }
    }

    const temporaryPath =
      resolve(
        canonicalParent,
        `.${basename(targetPath)}.change-proof-${operations.randomUUID()}.tmp`,
      );

    let handle = null;
    let temporaryCreated = false;
    let published = false;

    try {
      try {
        handle =
          await operations.open(
            temporaryPath,
            "wx",
            0o600,
          );

        temporaryCreated = true;
      } catch (error) {
        throw artifactError(
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .TEMPORARY_CREATE_FAILED,
          "create_temporary",
          error,
        );
      }

      let writeFailure = null;

      try {
        await handle.writeFile(
          input.content,
        );

        await handle.sync();
      } catch (error) {
        writeFailure =
          artifactError(
            EXCLUSIVE_ARTIFACT_ERROR_CODES
              .TEMPORARY_WRITE_FAILED,
            "write_temporary",
            error,
          );
      }

      let closeFailure = null;

      try {
        await handle.close();
      } catch (error) {
        closeFailure =
          artifactError(
            EXCLUSIVE_ARTIFACT_ERROR_CODES
              .TEMPORARY_CLOSE_FAILED,
            "close_temporary",
            error,
          );
      } finally {
        handle = null;
      }

      if (writeFailure !== null) {
        throw writeFailure;
      }

      if (closeFailure !== null) {
        throw closeFailure;
      }

      try {
        await operations.link(
          temporaryPath,
          targetPath,
        );

        published = true;
      } catch (error) {
        if (error?.code === "EEXIST") {
          throw artifactError(
            EXCLUSIVE_ARTIFACT_ERROR_CODES
              .TARGET_EXISTS,
            "publish",
            error,
          );
        }

        throw artifactError(
          EXCLUSIVE_ARTIFACT_ERROR_CODES
            .PUBLICATION_FAILED,
          "publish",
          error,
        );
      }

      await removeOwnedTemporary(
        operations,
        temporaryPath,
      );

      temporaryCreated = false;

      return Object.freeze({
        targetPath,
      });
    } catch (error) {
      if (handle !== null) {
        try {
          await handle.close();
        } catch {
          // Preserve primary failure.
        }
      }

      if (
        temporaryCreated &&
        !published
      ) {
        try {
          await removeOwnedTemporary(
            operations,
            temporaryPath,
          );
        } catch {
          // Preserve primary failure.
        }
      }

      throw error;
    }
  };
}

export const writeExclusiveArtifact =
  createExclusiveArtifactWriter();
