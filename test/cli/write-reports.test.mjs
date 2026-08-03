import assert from "node:assert/strict";
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";

import {
  writeEvidenceReports,
} from "../../src/cli/write-reports.mjs";

const JSON_REPORT = "{\"verdict\":\"PASS\"}\n";
const MARKDOWN_REPORT = "# Change Proof\n";

async function fixture(t, createOutput = true) {
  const root = await mkdtemp(join(
    tmpdir(),
    "change-proof-write-reports-",
  ));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDirectory = join(root, "output");
  if (createOutput) {
    await mkdir(outputDirectory);
  }
  return { root, outputDirectory };
}

function inputFor(outputDirectory) {
  return {
    outputDirectory,
    json: JSON_REPORT,
    markdown: MARKDOWN_REPORT,
  };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error?.code, code);
    return true;
  });
}

function failingTemporaryOpen(failureNumber) {
  let temporaryNumber = 0;
  return async (path, flags, mode) => {
    const handle = await open(path, flags, mode);
    if (
      flags === "wx" &&
      basename(path).endsWith(".tmp")
    ) {
      temporaryNumber += 1;
      if (temporaryNumber === failureNumber) {
        return {
          async writeFile() {
            const error = new Error("injected write failure");
            error.code = "EIO";
            throw error;
          },
          async close() {
            await handle.close();
          },
        };
      }
    }
    return handle;
  };
}

test("writes the report pair as a fail-closed transaction", async (t) => {
  await t.test("writes exact JSON and Markdown bytes", async (t) => {
    const item = await fixture(t);
    await writeEvidenceReports(inputFor(item.outputDirectory));
    assert.equal(
      await readFile(join(item.outputDirectory, "report.json"), "utf8"),
      JSON_REPORT,
    );
    assert.equal(
      await readFile(join(item.outputDirectory, "report.md"), "utf8"),
      MARKDOWN_REPORT,
    );
  });

  await t.test("uses fixed final filenames", async (t) => {
    const item = await fixture(t);
    await writeEvidenceReports(inputFor(item.outputDirectory));
    assert.deepEqual(
      (await readdir(item.outputDirectory)).sort(),
      ["report.json", "report.md"],
    );
  });

  await t.test("returns absolute final paths", async (t) => {
    const item = await fixture(t);
    assert.deepEqual(
      await writeEvidenceReports(inputFor(item.outputDirectory)),
      {
        jsonPath: join(item.outputDirectory, "report.json"),
        markdownPath: join(item.outputDirectory, "report.md"),
      },
    );
  });

  await t.test("creates an absent output directory", async (t) => {
    const item = await fixture(t, false);
    await writeEvidenceReports(inputFor(item.outputDirectory));
    assert.equal(
      (await lstat(item.outputDirectory)).isDirectory(),
      true,
    );
  });

  await t.test("accepts an existing real empty directory", async (t) => {
    const item = await fixture(t);
    await writeEvidenceReports(inputFor(item.outputDirectory));
    assert.equal((await readdir(item.outputDirectory)).length, 2);
  });

  await t.test("requires exactly one final LF", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      writeEvidenceReports({
        ...inputFor(item.outputDirectory),
        json: "{}",
      }),
      "REPORT_INPUT_INVALID",
    );
    await rejectsCode(
      writeEvidenceReports({
        ...inputFor(item.outputDirectory),
        markdown: "# Report\n\n",
      }),
      "REPORT_INPUT_INVALID",
    );
  });

  await t.test("rejects invalid input", async () => {
    await rejectsCode(
      writeEvidenceReports(null),
      "REPORT_INPUT_INVALID",
    );
  });

  await t.test("rejects output directory symlink", async (t) => {
    const item = await fixture(t, false);
    const realOutput = join(item.root, "real-output");
    await mkdir(realOutput);
    await symlink(realOutput, item.outputDirectory);
    await rejectsCode(
      writeEvidenceReports(inputFor(item.outputDirectory)),
      "REPORT_OUTPUT_DIRECTORY_SYMLINK",
    );
  });

  await t.test("rejects existing report.json", async (t) => {
    const item = await fixture(t);
    await writeFile(
      join(item.outputDirectory, "report.json"),
      "user json",
    );
    await rejectsCode(
      writeEvidenceReports(inputFor(item.outputDirectory)),
      "REPORT_TARGET_EXISTS",
    );
  });

  await t.test("rejects existing report.md", async (t) => {
    const item = await fixture(t);
    await writeFile(
      join(item.outputDirectory, "report.md"),
      "user markdown",
    );
    await rejectsCode(
      writeEvidenceReports(inputFor(item.outputDirectory)),
      "REPORT_TARGET_EXISTS",
    );
  });

  await t.test("rejects report target symlink", async (t) => {
    const item = await fixture(t);
    const userFile = join(item.root, "user-file");
    await writeFile(userFile, "user content");
    await symlink(
      userFile,
      join(item.outputDirectory, "report.json"),
    );
    await rejectsCode(
      writeEvidenceReports(inputFor(item.outputDirectory)),
      "REPORT_TARGET_SYMLINK",
    );
    assert.equal(await readFile(userFile, "utf8"), "user content");
  });

  await t.test("never overwrites user content", async (t) => {
    const item = await fixture(t);
    const path = join(item.outputDirectory, "report.md");
    await writeFile(path, "keep me");
    await rejectsCode(
      writeEvidenceReports(inputFor(item.outputDirectory)),
      "REPORT_TARGET_EXISTS",
    );
    assert.equal(await readFile(path, "utf8"), "keep me");
  });

  await t.test("cleans temporary files after JSON write failure", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      writeEvidenceReports(
        inputFor(item.outputDirectory),
        { open: failingTemporaryOpen(1) },
      ),
      "REPORT_TEMP_WRITE_FAILED",
    );
    assert.deepEqual(await readdir(item.outputDirectory), []);
  });

  await t.test("cleans temporary files after Markdown write failure", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      writeEvidenceReports(
        inputFor(item.outputDirectory),
        { open: failingTemporaryOpen(2) },
      ),
      "REPORT_TEMP_WRITE_FAILED",
    );
    assert.deepEqual(await readdir(item.outputDirectory), []);
  });

  await t.test("rolls back first final when second finalize fails", async (t) => {
    const item = await fixture(t);
    let calls = 0;
    await rejectsCode(
      writeEvidenceReports(
        inputFor(item.outputDirectory),
        {
          async rename(...argumentsList) {
            calls += 1;
            if (calls === 2) {
              const error = new Error("injected rename failure");
              error.code = "EIO";
              throw error;
            }
            return rename(...argumentsList);
          },
        },
      ),
      "REPORT_FINALIZE_FAILED",
    );
    assert.deepEqual(await readdir(item.outputDirectory), []);
  });

  await t.test("does not remove pre-existing files", async (t) => {
    const item = await fixture(t);
    const userFile = join(item.outputDirectory, "notes.txt");
    await writeFile(userFile, "keep");
    await rejectsCode(
      writeEvidenceReports(
        inputFor(item.outputDirectory),
        { open: failingTemporaryOpen(2) },
      ),
      "REPORT_TEMP_WRITE_FAILED",
    );
    assert.equal(await readFile(userFile, "utf8"), "keep");
  });

  await t.test("leaves no partial final report pair", async (t) => {
    const item = await fixture(t);
    await rejectsCode(
      writeEvidenceReports(
        inputFor(item.outputDirectory),
        { open: failingTemporaryOpen(1) },
      ),
      "REPORT_TEMP_WRITE_FAILED",
    );
    for (const name of ["report.json", "report.md"]) {
      await assert.rejects(lstat(join(item.outputDirectory, name)), {
        code: "ENOENT",
      });
    }
  });

  await t.test("writes no files outside output directory", async (t) => {
    const item = await fixture(t);
    await writeEvidenceReports(inputFor(item.outputDirectory));
    assert.deepEqual((await readdir(item.root)).sort(), ["output"]);
  });

  await t.test("does not mutate input", async (t) => {
    const item = await fixture(t);
    const input = inputFor(item.outputDirectory);
    const before = { ...input };
    await writeEvidenceReports(input);
    assert.deepEqual(input, before);
  });

  await t.test("repeated invocation fails closed", async (t) => {
    const item = await fixture(t);
    const input = inputFor(item.outputDirectory);
    await writeEvidenceReports(input);
    await rejectsCode(
      writeEvidenceReports(input),
      "REPORT_TARGET_EXISTS",
    );
  });

  await t.test("final files use restrictive permissions", async (t) => {
    const item = await fixture(t);
    const paths = await writeEvidenceReports(
      inputFor(item.outputDirectory),
    );
    assert.equal((await lstat(paths.jsonPath)).mode & 0o777, 0o600);
    assert.equal((await lstat(paths.markdownPath)).mode & 0o777, 0o600);
  });
});
