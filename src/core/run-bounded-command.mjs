import {
  spawn,
} from "node:child_process";

const MAX_TIMER_DELAY_MS =
  2_147_483_647;

const TERMINATION_GRACE_MS =
  250;

function isRecord(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function requireCommandString(
  name,
  value,
) {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.includes("\0")
  ) {
    throw new Error(
      `invalid_command_string:${name}`,
    );
  }
}

function requireArguments(value) {
  if (!Array.isArray(value)) {
    throw new Error(
      "invalid_command_arguments",
    );
  }

  for (const argument of value) {
    if (
      typeof argument !== "string" ||
      argument.includes("\0")
    ) {
      throw new Error(
        "invalid_command_argument",
      );
    }
  }
}

function normalizeEnvironment(value) {
  if (!isRecord(value)) {
    throw new Error(
      "invalid_command_environment",
    );
  }

  const normalized = {};

  for (
    const key of Object.keys(value).sort()
  ) {
    const environmentValue = value[key];

    if (
      key.length === 0 ||
      key.includes("=") ||
      key.includes("\0")
    ) {
      throw new Error(
        "invalid_command_environment_key",
      );
    }

    if (
      typeof environmentValue !== "string" ||
      environmentValue.includes("\0")
    ) {
      throw new Error(
        "invalid_command_environment_value:" +
        key,
      );
    }

    normalized[key] =
      environmentValue;
  }

  return normalized;
}

function requireTimeout(value) {
  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_TIMER_DELAY_MS
  ) {
    throw new Error(
      "invalid_command_timeout",
    );
  }
}

function requireByteLimit(
  name,
  value,
) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `invalid_command_byte_limit:${name}`,
    );
  }
}

function createBoundedCollector(
  maximumBytes,
) {
  const chunks = [];

  let capturedBytes = 0;
  let truncated = false;

  const append = (chunk) => {
    const buffer =
      Buffer.isBuffer(chunk)
        ? chunk
        : Buffer.from(chunk);

    const remainingBytes =
      maximumBytes - capturedBytes;

    if (remainingBytes <= 0) {
      if (buffer.length > 0) {
        truncated = true;
      }

      return;
    }

    const selectedLength =
      Math.min(
        remainingBytes,
        buffer.length,
      );

    if (selectedLength > 0) {
      chunks.push(
        Buffer.from(
          buffer.subarray(
            0,
            selectedLength,
          ),
        ),
      );

      capturedBytes +=
        selectedLength;
    }

    if (
      selectedLength <
      buffer.length
    ) {
      truncated = true;
    }
  };

  const toString = () =>
    Buffer.concat(
      chunks,
      capturedBytes,
    ).toString("utf8");

  return {
    append,
    toString,

    get truncated() {
      return truncated;
    },
  };
}

function elapsedMilliseconds(
  startedAt,
) {
  const elapsedNanoseconds =
    process.hrtime.bigint() -
    startedAt;

  return Number(
    elapsedNanoseconds /
    1_000_000n,
  );
}

function normalizeProcessErrorCode(
  error,
) {
  if (
    error &&
    typeof error.code === "string" &&
    error.code.length > 0
  ) {
    return error.code;
  }

  return "UNKNOWN_PROCESS_ERROR";
}

/**
 * Executes one explicitly specified command without a shell.
 *
 * This layer records process behavior only. It does not classify test
 * output and does not produce Change Proof verdicts.
 */
export async function runBoundedCommand(
  specification = {},
) {
  const {
    executable,
    arguments: commandArguments,
    workingDirectory,
    environment,
    timeoutMs,
    maxStdoutBytes,
    maxStderrBytes,
  } = specification;

  requireCommandString(
    "executable",
    executable,
  );

  requireArguments(
    commandArguments,
  );

  requireCommandString(
    "workingDirectory",
    workingDirectory,
  );

  const normalizedEnvironment =
    normalizeEnvironment(
      environment,
    );

  requireTimeout(timeoutMs);

  requireByteLimit(
    "maxStdoutBytes",
    maxStdoutBytes,
  );

  requireByteLimit(
    "maxStderrBytes",
    maxStderrBytes,
  );

  const stdoutCollector =
    createBoundedCollector(
      maxStdoutBytes,
    );

  const stderrCollector =
    createBoundedCollector(
      maxStderrBytes,
    );

  const startedAt =
    process.hrtime.bigint();

  let child;

  try {
    child = spawn(
      executable,
      [...commandArguments],
      {
        cwd: workingDirectory,
        env: normalizedEnvironment,
        shell: false,
        windowsHide: true,

        stdio: [
          "ignore",
          "pipe",
          "pipe",
        ],
      },
    );
  } catch (error) {
    return {
      exitCode: null,
      signal: null,
      timedOut: false,

      processErrorCode:
        normalizeProcessErrorCode(
          error,
        ),

      stdout: "",
      stderr: "",

      stdoutTruncated: false,
      stderrTruncated: false,

      durationMs:
        elapsedMilliseconds(
          startedAt,
        ),
    };
  }

  return await new Promise(
    (resolve) => {
      let processError = null;
      let timedOut = false;
      let timeoutHandle = null;
      let forceKillHandle = null;
      let settled = false;

      const settle = (
        exitCode,
        signal,
      ) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timeoutHandle !== null) {
          clearTimeout(timeoutHandle);
        }

        if (forceKillHandle !== null) {
          clearTimeout(forceKillHandle);
        }

        resolve({
          exitCode:
            processError === null &&
            Number.isInteger(exitCode)
              ? exitCode
              : null,

          signal:
            typeof signal === "string"
              ? signal
              : null,

          timedOut,

          processErrorCode:
            processError === null
              ? null
              : normalizeProcessErrorCode(
                  processError,
                ),

          stdout:
            stdoutCollector.toString(),

          stderr:
            stderrCollector.toString(),

          stdoutTruncated:
            stdoutCollector.truncated,

          stderrTruncated:
            stderrCollector.truncated,

          durationMs:
            elapsedMilliseconds(
              startedAt,
            ),
        });
      };

      child.stdout?.on(
        "data",
        stdoutCollector.append,
      );

      child.stderr?.on(
        "data",
        stderrCollector.append,
      );

      child.once(
        "error",
        (error) => {
          processError = error;
        },
      );

      child.once(
        "close",
        settle,
      );

      timeoutHandle = setTimeout(
        () => {
          if (
            child.exitCode !== null ||
            child.signalCode !== null
          ) {
            return;
          }

          timedOut = true;

          child.kill("SIGTERM");

          forceKillHandle =
            setTimeout(
              () => {
                if (
                  child.exitCode === null &&
                  child.signalCode === null
                ) {
                  child.kill("SIGKILL");
                }
              },
              TERMINATION_GRACE_MS,
            );
        },
        timeoutMs,
      );
    },
  );
}
