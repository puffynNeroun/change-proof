import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createStrictJsonFilePrimitives,
} from "../../src/cli/strict-json-file.mjs";

class TestMappedError extends Error {
  constructor(code, cause) {
    super(code, { cause });

    this.name =
      "TestMappedError";

    this.code =
      code;
  }
}

const CODES =
  Object.freeze({
    fieldInvalid:
      "TEST_FIELD_INVALID",
    unknownKey:
      "TEST_UNKNOWN_KEY",
    requiredFieldMissing:
      "TEST_REQUIRED_FIELD_MISSING",
    fileNotFound:
      "TEST_FILE_NOT_FOUND",
    fileReadFailed:
      "TEST_FILE_READ_FAILED",
    fileSymlink:
      "TEST_FILE_SYMLINK",
    fileNotRegular:
      "TEST_FILE_NOT_REGULAR",
    fileTooLarge:
      "TEST_FILE_TOO_LARGE",
    jsonInvalid:
      "TEST_JSON_INVALID",
  });

function fail(code, cause) {
  throw new TestMappedError(
    code,
    cause,
  );
}

function createPrimitives(
  maxBytes = 1024,
) {
  return createStrictJsonFilePrimitives({
    fail,
    maxBytes,
    dangerousKeys:
      new Set([
        "__proto__",
        "prototype",
        "constructor",
      ]),
    codes: CODES,
    isMappedError: (error) =>
      error instanceof TestMappedError,
  });
}

async function fixture(t) {
  const root =
    await mkdtemp(
      join(
        tmpdir(),
        "change-proof-strict-json-",
      ),
    );

  t.after(async () => {
    await rm(
      root,
      {
        recursive: true,
        force: true,
      },
    );
  });

  return root;
}

async function rejectsCode(
  promise,
  code,
) {
  await assert.rejects(
    promise,
    (error) => {
      assert.equal(
        error?.code,
        code,
      );

      return true;
    },
  );
}

test(
  "reads a bounded regular file without changing bytes",
  async (t) => {
    const root =
      await fixture(t);

    const path =
      join(root, "config.json");

    const bytes =
      Buffer.from(
        '{"value":"exact"}',
        "utf8",
      );

    await writeFile(
      path,
      bytes,
    );

    assert.deepEqual(
      await createPrimitives()
        .readConfigFile(path),
      bytes,
    );
  },
);

test(
  "maps missing, directory, symlink, and oversized files through caller codes",
  async (t) => {
    const root =
      await fixture(t);

    const primitives =
      createPrimitives(8);

    await rejectsCode(
      primitives.readConfigFile(
        join(root, "missing.json"),
      ),
      CODES.fileNotFound,
    );

    const directory =
      join(root, "directory");

    await mkdir(directory);

    await rejectsCode(
      primitives.readConfigFile(
        directory,
      ),
      CODES.fileNotRegular,
    );

    const real =
      join(root, "real.json");

    await writeFile(
      real,
      "{}",
      "utf8",
    );

    const linked =
      join(root, "linked.json");

    await symlink(
      real,
      linked,
    );

    await rejectsCode(
      primitives.readConfigFile(
        linked,
      ),
      CODES.fileSymlink,
    );

    const large =
      join(root, "large.json");

    await writeFile(
      large,
      "123456789",
      "utf8",
    );

    await rejectsCode(
      primitives.readConfigFile(
        large,
      ),
      CODES.fileTooLarge,
    );
  },
);

test(
  "accepts exactly one optional UTF-8 BOM and rejects malformed UTF-8",
  () => {
    const {
      parseConfigBytes,
    } =
      createPrimitives();

    const bom =
      Buffer.from([
        0xef,
        0xbb,
        0xbf,
      ]);

    const payload =
      Buffer.from(
        '{"value":"ok"}',
        "utf8",
      );

    assert.deepEqual(
      parseConfigBytes(
        Buffer.concat([
          bom,
          payload,
        ]),
      ),
      {
        value: "ok",
      },
    );

    assert.throws(
      () =>
        parseConfigBytes(
          Buffer.from([0xff]),
        ),
      (error) => {
        assert.equal(
          error?.code,
          CODES.jsonInvalid,
        );
        return true;
      },
    );

    assert.throws(
      () =>
        parseConfigBytes(
          Buffer.concat([
            bom,
            bom,
            payload,
          ]),
        ),
      (error) => {
        assert.equal(
          error?.code,
          CODES.jsonInvalid,
        );
        return true;
      },
    );
  },
);

test(
  "maps malformed JSON through caller taxonomy",
  () => {
    const {
      parseConfigBytes,
    } =
      createPrimitives();

    assert.throws(
      () =>
        parseConfigBytes(
          Buffer.from(
            '{"broken":',
            "utf8",
          ),
        ),
      (error) => {
        assert.equal(
          error?.code,
          CODES.jsonInvalid,
        );
        return true;
      },
    );
  },
);

test(
  "preserves native JSON.parse duplicate-key behavior",
  () => {
    const {
      parseConfigBytes,
      scanParsedValue,
    } =
      createPrimitives();

    const parsed =
      parseConfigBytes(
        Buffer.from(
          '{"value":1,"value":2}',
          "utf8",
        ),
      );

    assert.doesNotThrow(
      () =>
        scanParsedValue(parsed),
    );

    assert.deepEqual(
      parsed,
      {
        value: 2,
      },
    );
  },
);

test(
  "recursively rejects dangerous keys with caller mapping",
  () => {
    const {
      parseConfigBytes,
      scanParsedValue,
    } =
      createPrimitives();

    const parsed =
      parseConfigBytes(
        Buffer.from(
          '{"safe":{"constructor":true}}',
          "utf8",
        ),
      );

    assert.throws(
      () =>
        scanParsedValue(parsed),
      (error) => {
        assert.equal(
          error?.code,
          CODES.unknownKey,
        );
        return true;
      },
    );
  },
);

test(
  "preserves recursive NUL-string rejection",
  () => {
    const {
      parseConfigBytes,
      scanParsedValue,
    } =
      createPrimitives();

    const parsed =
      parseConfigBytes(
        Buffer.from(
          JSON.stringify({
            nested: {
              value: "a\0b",
            },
          }),
          "utf8",
        ),
      );

    assert.throws(
      () =>
        scanParsedValue(parsed),
      (error) => {
        assert.equal(
          error?.code,
          CODES.fieldInvalid,
        );
        return true;
      },
    );
  },
);

test(
  "schema-neutral validators retain exact Beta.1 semantics",
  () => {
    const {
      requireObject,
      requireString,
      requireStringArray,
      requirePositiveInteger,
    } =
      createPrimitives();

    assert.deepEqual(
      requireObject(
        {
          required: "value",
        },
        [
          "required",
        ],
      ),
      {
        required: "value",
      },
    );

    assert.equal(
      requireString("value"),
      "value",
    );

    assert.deepEqual(
      requireStringArray([
        "a",
        "b",
      ]),
      [
        "a",
        "b",
      ],
    );

    assert.equal(
      requirePositiveInteger(1),
      1,
    );

    assert.throws(
      () =>
        requireObject(
          {
            required: "value",
            extra: true,
          },
          [
            "required",
          ],
        ),
      (error) => {
        assert.equal(
          error?.code,
          CODES.unknownKey,
        );
        return true;
      },
    );
  },
);
