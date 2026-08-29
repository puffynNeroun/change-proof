import { realpath } from "node:fs/promises";
import { resolve } from "node:path";

import {
  normalizePrepareCandidate,
} from "../core/prepare-candidate.mjs";
import {
  createStrictJsonFilePrimitives,
} from "./strict-json-file.mjs";

const MAX_CANDIDATE_BYTES =
  1024 * 1024;

const DANGEROUS_KEYS =
  new Set([
    "__proto__",
    "prototype",
    "constructor",
  ]);

export class PrepareCandidateLoadError
  extends Error {
  constructor(code, options = {}) {
    super(code, options);
    this.name =
      "PrepareCandidateLoadError";
    this.code = code;
  }
}

function fail(code, cause) {
  throw new PrepareCandidateLoadError(
    code,
    cause === undefined
      ? {}
      : { cause },
  );
}

const CODES =
  Object.freeze({
    fieldInvalid:
      "PREPARE_CANDIDATE_FIELD_INVALID",

    unknownKey:
      "PREPARE_CANDIDATE_UNKNOWN_KEY",

    requiredFieldMissing:
      "PREPARE_CANDIDATE_REQUIRED_FIELD_MISSING",

    fileNotFound:
      "PREPARE_CANDIDATE_FILE_NOT_FOUND",

    fileReadFailed:
      "PREPARE_CANDIDATE_FILE_READ_FAILED",

    fileSymlink:
      "PREPARE_CANDIDATE_FILE_SYMLINK",

    fileNotRegular:
      "PREPARE_CANDIDATE_FILE_NOT_REGULAR",

    fileTooLarge:
      "PREPARE_CANDIDATE_FILE_TOO_LARGE",

    jsonInvalid:
      "PREPARE_CANDIDATE_JSON_INVALID",
  });

const strictJson =
  createStrictJsonFilePrimitives({
    fail,

    maxBytes:
      MAX_CANDIDATE_BYTES,

    dangerousKeys:
      DANGEROUS_KEYS,

    codes:
      CODES,

    isMappedError(error) {
      return (
        error instanceof
          PrepareCandidateLoadError
      );
    },
  });

export async function loadPrepareCandidate(
  candidatePath,
) {
  if (
    typeof candidatePath !== "string" ||
    candidatePath.length === 0 ||
    candidatePath.includes("\0")
  ) {
    fail(
      "PREPARE_CANDIDATE_PATH_INVALID",
    );
  }

  const absolutePath =
    resolve(candidatePath);

  const bytes =
    await strictJson.readConfigFile(
      absolutePath,
    );

  let canonicalPath;

  try {
    canonicalPath =
      await realpath(
        absolutePath,
      );
  } catch (error) {
    fail(
      "PREPARE_CANDIDATE_FILE_READ_FAILED",
      error,
    );
  }

  if (
    canonicalPath !==
      absolutePath
  ) {
    fail(
      "PREPARE_CANDIDATE_FILE_SYMLINK",
    );
  }

  const parsed =
    strictJson.parseConfigBytes(
      bytes,
    );

  strictJson.scanParsedValue(
    parsed,
  );

  let candidate;

  try {
    candidate =
      normalizePrepareCandidate(
        parsed,
      );
  } catch (error) {
    fail(
      "PREPARE_CANDIDATE_CONTRACT_INVALID",
      error,
    );
  }

  return {
    candidate,
    candidatePath:
      canonicalPath,
  };
}
