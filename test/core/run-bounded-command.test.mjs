import assert from "node:assert/strict";
import test from "node:test";

import {
  runBoundedCommand,
} from "../../src/core/run-bounded-command.mjs";

const nodeExecutable =
  process.execPath;

const workingDirectory =
  process.cwd();

function command(
  script,
  overrides = {},
) {
  return {
    executable:
      nodeExecutable,

    arguments: [
      "-e",
      script,
    ],

    workingDirectory,

    environment: {},

    timeoutMs: 2_000,

    maxStdoutBytes:
      64 * 1024,

    maxStderrBytes:
      64 * 1024,

    ...overrides,
  };
}

test(
  "captures separate stdout and stderr for a successful process",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            'process.stdout.write("stdout-value");',
            'process.stderr.write("stderr-value");',
          ].join(""),
        ),
      );

    assert.deepEqual(
      result,
      {
        exitCode: 0,
        signal: null,
        timedOut: false,
        processErrorCode: null,
        stdout: "stdout-value",
        stderr: "stderr-value",
        stdoutTruncated: false,
        stderrTruncated: false,
        durationMs:
          result.durationMs,
      },
    );

    assert.equal(
      Number.isInteger(
        result.durationMs,
      ),
      true,
    );

    assert.equal(
      result.durationMs >= 0,
      true,
    );
  },
);

test(
  "records a non-zero exit without assigning a behavioral classification",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            'process.stdout.write("failed");',
            "process.exitCode = 7;",
          ].join(""),
        ),
      );

    assert.equal(result.exitCode, 7);
    assert.equal(result.signal, null);
    assert.equal(result.timedOut, false);
    assert.equal(
      result.processErrorCode,
      null,
    );
    assert.equal(result.stdout, "failed");

    assert.equal(
      Object.hasOwn(
        result,
        "outcome",
      ),
      false,
    );

    assert.equal(
      Object.hasOwn(
        result,
        "verdict",
      ),
      false,
    );
  },
);

test(
  "passes arguments literally without shell interpolation",
  async () => {
    const literal =
      "$(printf injected)";

    const result =
      await runBoundedCommand({
        ...command(
          "process.stdout.write(process.argv[1]);",
        ),

        arguments: [
          "-e",
          "process.stdout.write(process.argv[1]);",
          literal,
        ],
      });

    assert.equal(result.exitCode, 0);
    assert.equal(
      result.stdout,
      literal,
    );
  },
);

test(
  "preserves arguments containing spaces",
  async () => {
    const value =
      "one argument with spaces";

    const result =
      await runBoundedCommand({
        ...command(
          "process.stdout.write(process.argv[1]);",
        ),

        arguments: [
          "-e",
          "process.stdout.write(process.argv[1]);",
          value,
        ],
      });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, value);
  },
);

test(
  "passes only the explicitly supplied environment",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            "process.stdout.write(",
            "process.env.CHANGE_PROOF_TEST ?? ",
            '"missing"',
            ");",
          ].join(""),

          {
            environment: {
              CHANGE_PROOF_TEST:
                "explicit-value",
            },
          },
        ),
      );

    assert.equal(result.exitCode, 0);

    assert.equal(
      result.stdout,
      "explicit-value",
    );
  },
);

test(
  "supports a process with no output",
  async () => {
    const result =
      await runBoundedCommand(
        command(""),
      );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");

    assert.equal(
      result.stdoutTruncated,
      false,
    );

    assert.equal(
      result.stderrTruncated,
      false,
    );
  },
);

test(
  "truncates stdout at its independent byte limit",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          'process.stdout.write("abcdefghij");',
          {
            maxStdoutBytes: 4,
          },
        ),
      );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, "abcd");

    assert.equal(
      result.stdoutTruncated,
      true,
    );

    assert.equal(
      result.stderrTruncated,
      false,
    );
  },
);

test(
  "truncates stderr at its independent byte limit",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          'process.stderr.write("abcdefghij");',
          {
            maxStderrBytes: 5,
          },
        ),
      );

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "abcde");

    assert.equal(
      result.stderrTruncated,
      true,
    );

    assert.equal(
      result.stdoutTruncated,
      false,
    );
  },
);

test(
  "applies stdout and stderr limits independently",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            'process.stdout.write("123456");',
            'process.stderr.write("abcdef");',
          ].join(""),

          {
            maxStdoutBytes: 2,
            maxStderrBytes: 4,
          },
        ),
      );

    assert.equal(result.stdout, "12");
    assert.equal(result.stderr, "abcd");

    assert.equal(
      result.stdoutTruncated,
      true,
    );

    assert.equal(
      result.stderrTruncated,
      true,
    );
  },
);

test(
  "supports zero-byte output limits",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            'process.stdout.write("stdout");',
            'process.stderr.write("stderr");',
          ].join(""),

          {
            maxStdoutBytes: 0,
            maxStderrBytes: 0,
          },
        ),
      );

    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");

    assert.equal(
      result.stdoutTruncated,
      true,
    );

    assert.equal(
      result.stderrTruncated,
      true,
    );
  },
);

test(
  "bounds multibyte UTF-8 output by captured input bytes",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          'process.stdout.write("€€€");',
          {
            maxStdoutBytes: 4,
          },
        ),
      );

    assert.equal(result.exitCode, 0);

    assert.equal(
      result.stdout.startsWith("€"),
      true,
    );

    assert.equal(
      result.stdoutTruncated,
      true,
    );
  },
);

test(
  "drains large stdout while retaining only the configured prefix",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            "process.stdout.write(",
            '"x".repeat(512 * 1024)',
            ");",
          ].join(""),

          {
            maxStdoutBytes: 64,
          },
        ),
      );

    assert.equal(result.exitCode, 0);

    assert.equal(
      result.stdout,
      "x".repeat(64),
    );

    assert.equal(
      result.stdoutTruncated,
      true,
    );
  },
);

test(
  "terminates a process after the configured timeout",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          "setInterval(() => {}, 1_000);",
          {
            timeoutMs: 40,
          },
        ),
      );

    assert.equal(
      result.timedOut,
      true,
    );

    assert.equal(
      result.exitCode,
      null,
    );

    assert.equal(
      result.signal !== null,
      true,
    );

    assert.equal(
      result.processErrorCode,
      null,
    );
  },
);

test(
  "retains bounded output produced before a timeout",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          [
            'process.stdout.write("started");',
            "setInterval(() => {}, 1_000);",
          ].join(""),

          {
            timeoutMs: 80,
            maxStdoutBytes: 4,
          },
        ),
      );

    assert.equal(
      result.timedOut,
      true,
    );

    assert.equal(
      result.stdout,
      "star",
    );

    assert.equal(
      result.stdoutTruncated,
      true,
    );
  },
);

test(
  "records an executable spawn error without throwing",
  async () => {
    const result =
      await runBoundedCommand({
        ...command(""),

        executable:
          "/definitely/missing/change-proof-command",
      });

    assert.equal(
      result.exitCode,
      null,
    );

    assert.equal(result.signal, null);

    assert.equal(
      result.timedOut,
      false,
    );

    assert.equal(
      result.processErrorCode,
      "ENOENT",
    );

    assert.equal(result.stdout, "");
    assert.equal(result.stderr, "");
  },
);

test(
  "records an invalid working-directory spawn error",
  async () => {
    const result =
      await runBoundedCommand({
        ...command(""),

        workingDirectory:
          "/definitely/missing/change-proof-directory",
      });

    assert.equal(
      result.exitCode,
      null,
    );

    assert.equal(
      result.processErrorCode,
      "ENOENT",
    );

    assert.equal(
      result.timedOut,
      false,
    );
  },
);

test(
  "records a process signal separately from timeout",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          'process.kill(process.pid, "SIGTERM");',
        ),
      );

    assert.equal(
      result.exitCode,
      null,
    );

    assert.equal(
      result.signal,
      "SIGTERM",
    );

    assert.equal(
      result.timedOut,
      false,
    );

    assert.equal(
      result.processErrorCode,
      null,
    );
  },
);

test(
  "returns the complete ExecutionResult field set",
  async () => {
    const result =
      await runBoundedCommand(
        command(""),
      );

    assert.deepEqual(
      Object.keys(result),
      [
        "exitCode",
        "signal",
        "timedOut",
        "processErrorCode",
        "stdout",
        "stderr",
        "stdoutTruncated",
        "stderrTruncated",
        "durationMs",
      ],
    );
  },
);

test(
  "returns a JSON-serializable execution result",
  async () => {
    const result =
      await runBoundedCommand(
        command(
          'process.stdout.write("json");',
        ),
      );

    const serialized =
      JSON.stringify(result);

    assert.deepEqual(
      JSON.parse(serialized),
      result,
    );
  },
);

test(
  "does not mutate the command specification",
  async () => {
    const specification =
      command(
        'process.stdout.write("ok");',
        {
          environment: {
            CHANGE_PROOF_TEST:
              "value",
          },
        },
      );

    const before =
      JSON.stringify(specification);

    await runBoundedCommand(
      specification,
    );

    assert.equal(
      JSON.stringify(specification),
      before,
    );
  },
);

test(
  "isolates concurrent command executions",
  async () => {
    const [
      first,
      second,
    ] = await Promise.all([
      runBoundedCommand(
        command(
          [
            "setTimeout(",
            '() => process.stdout.write("first"),',
            "20",
            ");",
          ].join(""),
        ),
      ),

      runBoundedCommand(
        command(
          'process.stdout.write("second");',
        ),
      ),
    ]);

    assert.equal(first.stdout, "first");
    assert.equal(
      second.stdout,
      "second",
    );
  },
);

test(
  "validates the executable string",
  async () => {
    for (const executable of [
      undefined,
      null,
      "",
      "bad\0command",
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            executable,
          }),

        {
          message:
            "invalid_command_string:" +
            "executable",
        },
      );
    }
  },
);

test(
  "validates the argument array",
  async () => {
    await assert.rejects(
      () =>
        runBoundedCommand({
          ...command(""),
          arguments: null,
        }),

      {
        message:
          "invalid_command_arguments",
      },
    );

    for (const argument of [
      null,
      42,
      "bad\0argument",
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            arguments: [
              argument,
            ],
          }),

        {
          message:
            "invalid_command_argument",
        },
      );
    }
  },
);

test(
  "validates the working-directory string",
  async () => {
    for (const workingDirectoryValue of [
      undefined,
      null,
      "",
      "bad\0directory",
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),

            workingDirectory:
              workingDirectoryValue,
          }),

        {
          message:
            "invalid_command_string:" +
            "workingDirectory",
        },
      );
    }
  },
);

test(
  "validates the environment object",
  async () => {
    for (const environment of [
      undefined,
      null,
      [],
      "PATH=value",
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            environment,
          }),

        {
          message:
            "invalid_command_environment",
        },
      );
    }
  },
);

test(
  "validates environment keys and values",
  async () => {
    for (const environment of [
      {
        "": "value",
      },
      {
        "BAD=KEY": "value",
      },
      {
        "BAD\0KEY": "value",
      },
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            environment,
          }),

        {
          message:
            "invalid_command_environment_key",
        },
      );
    }

    for (const environment of [
      {
        KEY: null,
      },
      {
        KEY: 42,
      },
      {
        KEY: "bad\0value",
      },
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            environment,
          }),

        {
          message:
            "invalid_command_environment_value:" +
            "KEY",
        },
      );
    }
  },
);

test(
  "validates the timeout",
  async () => {
    for (const timeoutMs of [
      undefined,
      null,
      0,
      -1,
      1.5,
      2_147_483_648,
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            timeoutMs,
          }),

        {
          message:
            "invalid_command_timeout",
        },
      );
    }
  },
);

test(
  "validates the stdout byte limit",
  async () => {
    for (const maxStdoutBytes of [
      undefined,
      null,
      -1,
      1.5,
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            maxStdoutBytes,
          }),

        {
          message:
            "invalid_command_byte_limit:" +
            "maxStdoutBytes",
        },
      );
    }
  },
);

test(
  "validates the stderr byte limit",
  async () => {
    for (const maxStderrBytes of [
      undefined,
      null,
      -1,
      1.5,
    ]) {
      await assert.rejects(
        () =>
          runBoundedCommand({
            ...command(""),
            maxStderrBytes,
          }),

        {
          message:
            "invalid_command_byte_limit:" +
            "maxStderrBytes",
        },
      );
    }
  },
);
