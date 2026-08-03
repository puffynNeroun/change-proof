import { randomBytes } from "node:crypto";
import {
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";

class ChangeProofReportError extends Error {
  constructor(code, cause) {
    super(code, cause === undefined ? {} : { cause });
    this.name = "ChangeProofReportError";
    this.code = code;
  }
}

function reportError(code, cause) {
  return new ChangeProofReportError(code, cause);
}

function validReportText(value) {
  return (
    typeof value === "string" &&
    value.endsWith("\n") &&
    !value.endsWith("\n\n")
  );
}

async function pathMetadata(path, fileSystem) {
  try {
    return await fileSystem.lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }
    throw reportError(
      "REPORT_OUTPUT_DIRECTORY_INVALID",
      error,
    );
  }
}

async function removeOwnedPath(path, fileSystem) {
  try {
    await fileSystem.unlink(path);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

async function closeHandle(handle) {
  if (handle !== undefined) {
    await handle.close();
  }
}

async function writeTemporaryFile(
  path,
  content,
  fileSystem,
) {
  let handle;
  try {
    handle = await fileSystem.open(path, "wx", 0o600);
    await handle.writeFile(content, {
      encoding: "utf8",
    });
    await closeHandle(handle);
    handle = undefined;
  } catch (error) {
    try {
      await closeHandle(handle);
    } catch {
      // Cleanup below remains authoritative.
    }
    throw reportError("REPORT_TEMP_WRITE_FAILED", error);
  }
}

async function assertTargetAbsent(path, fileSystem) {
  const metadata = await pathMetadata(path, fileSystem);
  if (metadata === null) {
    return;
  }
  if (metadata.isSymbolicLink()) {
    throw reportError("REPORT_TARGET_SYMLINK");
  }
  throw reportError("REPORT_TARGET_EXISTS");
}

async function reserveTarget(path, fileSystem) {
  let handle;
  let created = false;
  try {
    handle = await fileSystem.open(path, "wx", 0o600);
    created = true;
    await closeHandle(handle);
    return;
  } catch (error) {
    try {
      await closeHandle(handle);
    } catch {
      // The reservation failure remains authoritative.
    }
    if (created) {
      try {
        await removeOwnedPath(path, fileSystem);
      } catch (cleanupError) {
        throw reportError(
          "REPORT_CLEANUP_FAILED",
          cleanupError,
        );
      }
    }
    if (error?.code === "EEXIST") {
      await assertTargetAbsent(path, fileSystem);
    }
    throw reportError("REPORT_FINALIZE_FAILED", error);
  }
}

export async function writeEvidenceReports(input, injected = {}) {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    typeof input.outputDirectory !== "string" ||
    input.outputDirectory.length === 0 ||
    !isAbsolute(input.outputDirectory) ||
    !validReportText(input.json) ||
    !validReportText(input.markdown)
  ) {
    throw reportError("REPORT_INPUT_INVALID");
  }

  const fileSystem = {
    lstat,
    mkdir,
    open,
    realpath,
    rename,
    unlink,
    ...injected,
  };
  const outputDirectory = resolve(input.outputDirectory);

  try {
    await fileSystem.mkdir(outputDirectory, {
      recursive: true,
      mode: 0o700,
    });
  } catch (error) {
    throw reportError(
      "REPORT_DIRECTORY_CREATE_FAILED",
      error,
    );
  }

  const outputMetadata = await pathMetadata(
    outputDirectory,
    fileSystem,
  );
  if (outputMetadata?.isSymbolicLink()) {
    throw reportError("REPORT_OUTPUT_DIRECTORY_SYMLINK");
  }
  if (!outputMetadata?.isDirectory()) {
    throw reportError("REPORT_OUTPUT_DIRECTORY_INVALID");
  }

  let canonicalOutput;
  try {
    canonicalOutput = await fileSystem.realpath(
      outputDirectory,
    );
  } catch (error) {
    throw reportError(
      "REPORT_OUTPUT_DIRECTORY_INVALID",
      error,
    );
  }
  if (canonicalOutput !== outputDirectory) {
    throw reportError("REPORT_OUTPUT_DIRECTORY_SYMLINK");
  }

  const jsonPath = resolve(outputDirectory, "report.json");
  const markdownPath = resolve(outputDirectory, "report.md");
  await assertTargetAbsent(jsonPath, fileSystem);
  await assertTargetAbsent(markdownPath, fileSystem);

  const nonce = randomBytes(16).toString("hex");
  const jsonTemporaryPath = resolve(
    outputDirectory,
    `.change-proof-${process.pid}-${nonce}-a.tmp`,
  );
  const markdownTemporaryPath = resolve(
    outputDirectory,
    `.change-proof-${process.pid}-${nonce}-b.tmp`,
  );
  const ownedPaths = new Set([
    jsonTemporaryPath,
    markdownTemporaryPath,
  ]);
  let completed = false;
  let primaryError;

  try {
    await writeTemporaryFile(
      jsonTemporaryPath,
      input.json,
      fileSystem,
    );
    await writeTemporaryFile(
      markdownTemporaryPath,
      input.markdown,
      fileSystem,
    );

    await reserveTarget(jsonPath, fileSystem);
    ownedPaths.add(jsonPath);
    await reserveTarget(markdownPath, fileSystem);
    ownedPaths.add(markdownPath);

    try {
      await fileSystem.rename(jsonTemporaryPath, jsonPath);
      ownedPaths.delete(jsonTemporaryPath);
      await fileSystem.rename(
        markdownTemporaryPath,
        markdownPath,
      );
      ownedPaths.delete(markdownTemporaryPath);
    } catch (error) {
      throw reportError("REPORT_FINALIZE_FAILED", error);
    }

    ownedPaths.delete(jsonPath);
    ownedPaths.delete(markdownPath);
    completed = true;
  } catch (error) {
    primaryError = error instanceof ChangeProofReportError
      ? error
      : reportError("REPORT_FINALIZE_FAILED", error);
  } finally {
    if (!completed) {
      const cleanupFailures = [];
      for (const path of ownedPaths) {
        try {
          await removeOwnedPath(path, fileSystem);
        } catch (error) {
          cleanupFailures.push(error);
        }
      }
      if (cleanupFailures.length > 0) {
        primaryError = reportError(
          "REPORT_CLEANUP_FAILED",
          cleanupFailures[0],
        );
      }
    }
  }

  if (primaryError !== undefined) {
    throw primaryError;
  }

  return { jsonPath, markdownPath };
}
