# M3 Public CLI Beta Contract

## Status and milestone question

This document defines the M3 beta command contract. It is not a stable 1.0 compatibility promise.

M3 asks whether a software engineer can run one stable local command with one strict JSON configuration file, receive authoritative `report.json` and `report.md` artifacts, and obtain predictable exit codes without invoking internal experiment runners.

## Public command

The primary command is:

```text
change-proof run --config <path>
```

The exact accepted forms are:

```text
change-proof run --config <path>
change-proof run --config <path> --fail-on <VERDICT>
change-proof run --config <path> --fail-on <VERDICT> --fail-on <VERDICT>
change-proof --help
change-proof run --help
change-proof --version
```

`--fail-on` may be repeated any number of times. Duplicate values are de-duplicated. Verdicts are case-sensitive and must be values from the production `VERDICTS` contract. Positional arguments, short options, comma-separated values, `--config=<path>`, `--fail-on=<VERDICT>`, unknown commands, unknown options, duplicate `--config`, and missing option values are rejected.

`--help` is accepted only as `change-proof --help` or `change-proof run --help`. `--version` is accepted only as the sole argument.

## Strict configuration schema

The configuration is a UTF-8 JSON file of at most 1 MiB. It may have one leading UTF-8 BOM. Comments, trailing commas, YAML, TOML, JavaScript modules, and arbitrary extension keys are not accepted.

The complete schema shape is:

```json
{
  "schemaVersion": "0.1",
  "repositoryRoot": "...",
  "baseRef": "...",
  "headRef": "...",
  "command": {
    "executable": "...",
    "arguments": ["..."],
    "workingDirectory": ".",
    "environment": {
      "NAME": "value"
    },
    "timeoutMs": 30000,
    "maxStdoutBytes": 4194304,
    "maxStderrBytes": 4194304
  },
  "envelope": {
    "includedPaths": ["..."]
  },
  "classification": {
    "stateA": {
      "expectedTestCount": 20
    },
    "stateB": {
      "expectedTestCount": 24
    },
    "stateC": {
      "expectedTestCount": 24,
      "expectedFailures": [
        {
          "testName": "...",
          "outputIncludes": ["..."]
        }
      ]
    }
  },
  "temporaryParentDirectory": "/tmp",
  "workspacePrefix": "change-proof-",
  "outputDirectory": "../change-proof-output"
}
```

Every listed field is required. Unknown keys are rejected at every defined object level. `__proto__`, `prototype`, and `constructor` keys are rejected anywhere. Required strings are non-empty and no string may contain NUL. Limits are safe positive integers. Expected test counts are non-negative safe integers. Included paths and expected-failure test names must be unique. State C requires at least one expected failure, and each expected failure requires at least one non-empty output fragment.

The public configuration does not accept `toolVersion`, `failOn`, shell or command strings, package-manager names, test-framework names, discovery settings, or network settings. `toolVersion` is read from the local package manifest. The loader does not infer commands, discover `PATH`, merge `process.env`, or install dependencies. Executable arguments and configured environment values remain literal and explicit.

See [`../change-proof.config.example.json`](../change-proof.config.example.json) for an editable example.

## Path resolution and filesystem checks

The config path is resolved from the CLI working directory. `repositoryRoot`, `temporaryParentDirectory`, and `outputDirectory` are resolved from the config file directory. `command.workingDirectory` and `envelope.includedPaths` remain repository-relative values for the production engine. `command.executable`, its arguments, and its environment are passed as configured.

The config file, repository root, and temporary parent must exist without symbolic-link ambiguity. The repository root and temporary parent must be real directories. They must be distinct, and the temporary parent must be outside the repository.

The output directory may be absent. Its nearest existing parent is checked without calling `realpath` on a nonexistent target. The output directory must be outside the repository and its `.git` directory. An existing output directory must be a real directory, not a symbolic link. Ambiguous containment or symbolic-link conditions fail closed.

## Report transaction

A completed run writes exactly two UTF-8 artifacts:

- `report.json`, the authoritative serialized evidence report returned by the engine;
- `report.md`, the engine's human-readable Markdown projection.

Both inputs must end in exactly one LF. The writer creates an absent output directory, writes restrictive exclusive temporary files inside it, reserves both fixed final targets without overwriting, and renames both temporary files into place. Existing report targets and symbolic-link targets are rejected.

If finalizing the second report fails, the writer removes only artifacts created by that invocation, including the first finalized report. It cleans temporary files on every handled failure and never deletes pre-existing user files. A successful final state contains the complete pair; a handled failure contains neither new final report.

## Exit codes and policy

| Code | Meaning |
| --- | --- |
| `0` | The evidence run completed, both reports were written, and no `--fail-on` value matched. |
| `1` | The evidence run completed, both reports were written, and a `--fail-on` value matched the final verdict. |
| `2` | CLI usage or configuration was invalid. |
| `3` | An operational failure prevented a valid completed run or prevented the report pair from being written. |

Behavioral verdicts are not process failures by themselves. A `NON_DISCRIMINATING_TESTS` result exits `0` unless that verdict was explicitly selected with `--fail-on`.

Policy is evaluated only after both reports exist. It performs only a membership check against `result.report.verdict`. It does not change the evidence, verdict, reasons, JSON, Markdown, or files, and it does not run the engine again. A policy rejection adds `policy=REJECTED` to the completed-run summary and exits `1`.

## Error output

Failures print one concise LF-terminated line to stderr:

```text
change-proof: usage error: <CODE>
change-proof: configuration error: <CODE>
change-proof: operational error: <CODE>
```

Errors do not print stack traces, raw TAP, raw Git or test stderr, environment values, internal objects, or owned temporary workspace paths. No normal completion summary is printed after an error.

## Engine relationship

The CLI is a thin consumer of `runChangeProof(input)`. It loads and normalizes configuration, invokes `runChangeProof` exactly once, writes the returned `json` and `markdown`, and then applies optional verdict policy.

It does not reproduce State A, State B, State C, worktree ownership, explicit-envelope materialization, TAP classification, boundary evaluation, verdict precedence, report construction, serialization, rendering, or cleanup evidence. Those remain owned by the production engine. Keeping one engine prevents CLI behavior from drifting into a second evidence model.

## Package boundary

M3 defines the `change-proof` package at version `0.1.0-beta.1`, with the `change-proof` binary and Node.js `>=24`. The manifest remains `private: true`; M3 does not publish it.

The package allowlist contains only `bin`, `src`, `README.md`, `LICENSE`, and `change-proof.config.example.json`. It exposes no `main`, `module`, or `exports` entry and therefore promises no public JavaScript SDK. Tests, experiments, and this contract document are not part of the package inventory.

## Trust and security model

Change Proof executes the explicitly configured repository command locally at exact Git states. The user must trust the selected repository code and command. Git worktrees provide state isolation, not a security sandbox. M3 does not make untrusted code safe and does not provide container, process, filesystem, credential, or network isolation.

Configuration is explicit: there is no test discovery, envelope discovery, dependency discovery, environment discovery, shell parsing, dependency installation, or remote fetch. The tool itself requires no network access, but configured repository code is outside that guarantee and may have its own behavior.

## Evidence limitations and non-goals

An observed discrimination verdict means only that the selected test envelope distinguished the recorded base and head states under the recorded execution contract. It does not prove implementation correctness, complete regression coverage, causality beyond the envelope, production readiness, broad repository compatibility, or safe execution of untrusted code.

M3 does not add framework adapters, plugins, automatic configuration, pull-request interaction, branch management, cloud services, CI integration, or a public JavaScript API. GitHub Actions and package publication remain deferred until the local beta contract has been reviewed independently; neither is required to answer the M3 product question.
