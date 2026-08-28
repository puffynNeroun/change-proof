import { constants } from "node:fs";
import {
  lstat,
  open,
} from "node:fs/promises";

/**
 * Low-level strict JSON/file primitives.
 *
 * Domain/public error taxonomy remains caller-owned through `fail` + `codes`.
 * Native JSON.parse duplicate-key behavior is intentionally preserved.
 */
export function createStrictJsonFilePrimitives({
  fail,
  maxBytes,
  dangerousKeys,
  codes,
  isMappedError,
}) {
  const MAX_CONFIG_BYTES =
    maxBytes;

  const SPECIAL_KEYS =
    dangerousKeys;

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
        fail(codes.fieldInvalid);
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
          fail(codes.unknownKey);
        }
        scanParsedValue(value[key]);
      }
    }
  }

  function requireObject(value, allowedKeys) {
    if (!isPlainObject(value)) {
      fail(codes.fieldInvalid);
    }

    const allowed = new Set(allowedKeys);
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        fail(codes.unknownKey);
      }
    }

    for (const key of allowedKeys) {
      if (!Object.hasOwn(value, key)) {
        fail(codes.requiredFieldMissing);
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
      fail(codes.fieldInvalid);
    }
    return value;
  }

  function requireStringArray(value, { nonEmpty = false } = {}) {
    if (
      !Array.isArray(value) ||
      (nonEmpty && value.length === 0)
    ) {
      fail(codes.fieldInvalid);
    }

    return value.map((item) => requireString(item));
  }

  function requirePositiveInteger(value) {
    if (
      !Number.isSafeInteger(value) ||
      value < 1 ||
      value > 2_147_483_647
    ) {
      fail(codes.fieldInvalid);
    }
    return value;
  }

  async function readConfigFile(configPath) {
    let metadata;
    try {
      metadata = await lstat(configPath);
    } catch (error) {
      if (error?.code === "ENOENT") {
        fail(codes.fileNotFound, error);
      }
      fail(codes.fileReadFailed, error);
    }

    if (metadata.isSymbolicLink()) {
      fail(codes.fileSymlink);
    }
    if (!metadata.isFile()) {
      fail(codes.fileNotRegular);
    }
    if (metadata.size > MAX_CONFIG_BYTES) {
      fail(codes.fileTooLarge);
    }

    let handle;
    try {
      handle = await open(
        configPath,
        constants.O_RDONLY | constants.O_NOFOLLOW,
      );
      const openedMetadata = await handle.stat();
      if (!openedMetadata.isFile()) {
        fail(codes.fileNotRegular);
      }
      if (openedMetadata.size > MAX_CONFIG_BYTES) {
        fail(codes.fileTooLarge);
      }
      return await handle.readFile();
    } catch (error) {
      if (isMappedError(error)) {
        throw error;
      }
      if (error?.code === "ELOOP") {
        fail(codes.fileSymlink, error);
      }
      fail(codes.fileReadFailed, error);
    } finally {
      if (handle !== undefined) {
        try {
          await handle.close();
        } catch {
          // A failed close cannot make successfully read bytes trustworthy.
          fail(codes.fileReadFailed);
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
        fail(codes.jsonInvalid);
      }
    }

    let text;
    try {
      text = new TextDecoder("utf-8", {
        fatal: true,
        ignoreBOM: true,
      }).decode(bytes.subarray(offset));
    } catch (error) {
      fail(codes.jsonInvalid, error);
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      fail(codes.jsonInvalid, error);
    }
  }

  return Object.freeze({
    isPlainObject,
    scanParsedValue,
    requireObject,
    requireString,
    requireStringArray,
    requirePositiveInteger,
    readConfigFile,
    parseConfigBytes,
  });
}
