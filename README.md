# Change Proof

Change Proof is a local evidence tool for checking whether explicitly selected changed tests distinguish an exact base implementation from an exact head implementation.

## Current status

**Research stage: M3 public CLI beta candidate**

The repository contains a verified production three-state engine and a thin, configuration-driven CLI candidate. The CLI is a beta contract for local evaluation, not a production-readiness or correctness claim.

## What M2.10 proved

M2.10 ran the production engine against a non-synthetic local repository with immutable base and head commits. It observed:

- State A passing 20 of 20 tests;
- State B passing 24 of 24 tests;
- State C running 24 tests and observing the exact expected set of eight failures;
- a valid explicit test boundary;
- the `OBSERVED_TEST_DISCRIMINATION` verdict;
- verified workspace cleanup with no primary-checkout, ref, or worktree-registry mutation.

That pilot demonstrated the engine on one bounded real change. It did not establish general implementation correctness, complete regression coverage, production readiness, or safety for untrusted code.

## Installation status

Change Proof is not published to npm. There are intentionally no npm installation instructions for M3, and the package manifest remains private.

Run the local checkout with Node.js 24 or newer:

```text
node bin/change-proof.mjs run --config change-proof.config.json
```

The future installed package-surface syntax is:

```text
change-proof run --config change-proof.config.json
```

That syntax documents the binary contract; it is not a claim that an npm package has been published.

## Configuration

The CLI accepts one strict UTF-8 JSON configuration with schema version `0.1`. It requires explicit repository refs, one literal executable and argument array, a repository-relative working directory, an explicit environment, bounded execution limits, selected envelope paths, expected test counts, exact State C expected-failure evidence, an external temporary parent, a workspace prefix, and an external output directory.

Start from [`change-proof.config.example.json`](change-proof.config.example.json). Replace its generic refs, paths, test counts, expected failure fragments, and explicit `PATH` with values correct for your trusted repository and environment.

The loader rejects unknown keys, comments, trailing commas, special object keys, duplicate paths, ambiguous symbolic links, and output or temporary paths inside the repository. It does not merge `process.env`, discover `PATH`, infer commands, discover tests, discover dependencies, or install packages.

The complete beta contract is in [`docs/M3_PUBLIC_CLI_CONTRACT.md`](docs/M3_PUBLIC_CLI_CONTRACT.md).

## Output files

A completed run writes a pair into the configured output directory:

- `report.json` — the authoritative evidence report;
- `report.md` — a human-readable projection of the same report.

The writer never overwrites an existing report target. It writes both reports transactionally; a handled failure does not leave only one new final report.

## Exit codes

- `0` — the run completed, both reports were written, and policy accepted the verdict.
- `1` — the run completed, both reports were written, and `--fail-on` rejected the verdict.
- `2` — command usage or configuration was invalid.
- `3` — an operational or report-writing failure prevented valid completion.

A behavioral verdict is not automatically a process failure. For example, `NON_DISCRIMINATING_TESTS` exits `0` without matching policy.

## Verdict policy

Reject one completed verdict in automation:

```text
node bin/change-proof.mjs run --config change-proof.config.json --fail-on NON_DISCRIMINATING_TESTS
```

Repeat `--fail-on` for more than one case:

```text
node bin/change-proof.mjs run --config change-proof.config.json --fail-on NON_DISCRIMINATING_TESTS --fail-on INCONCLUSIVE
```

Verdict values are case-sensitive and come from the production engine. Policy is applied only after both reports exist and never changes their evidence or verdict.

## Trust and security model

Change Proof executes explicitly configured repository code locally at exact Git states. Use it only with code and commands you trust.

Git worktrees isolate repository states. They are not a security sandbox. Change Proof does not make untrusted pull-request code safe and does not provide container, credential, filesystem, process, or network isolation.

The tool itself performs no remote fetch and requires no network access. It does not install dependencies. Configured repository code remains responsible for its own behavior, including any network or external-service use.

## Evidence model and limitations

- **State A:** exact base commit with base tests.
- **State B:** exact head commit with head tests.
- **State C:** exact base implementation with only explicitly selected head test paths.

A positive observation requires States A and B to pass, State C to execute the expected tests and exact expected failure set, and the materialized boundary to remain valid.

`OBSERVED_TEST_DISCRIMINATION` means only that the selected test envelope distinguished the recorded base and head states in the recorded environment. It does not prove implementation correctness, complete change correctness, complete regression coverage, broad framework support, or general causality.

M3 provides no automatic test, envelope, dependency, environment, or command discovery. The current engine targets explicit Node.js `node:test` TAP executions. Windows-native and macOS behavior have not been validated.

## Project structure

- [`bin/change-proof.mjs`](bin/change-proof.mjs) — public executable adapter.
- [`src/cli`](src/cli) — strict config loading, report transaction, and command runner.
- [`src/core`](src/core) — production three-state evidence engine.
- [`change-proof.config.example.json`](change-proof.config.example.json) — editable strict configuration example.
- [`docs/M3_PUBLIC_CLI_CONTRACT.md`](docs/M3_PUBLIC_CLI_CONTRACT.md) — M3 beta CLI contract.
- [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md) — evidence model.
- [`docs/MVP_LIMITATIONS.md`](docs/MVP_LIMITATIONS.md) — research limitations.
- [`experiments/m1-controlled-fixture`](experiments/m1-controlled-fixture) — deterministic M1 historical experiment.

## Historical milestones

M1 established the controlled three-state fixture, deterministic output, fail-fast behavior, and explicit non-claims.

M2 extracted and verified reusable production primitives. M2.10 then exercised the orchestrator on a non-synthetic repository with an exact eight-failure State C contract and verified cleanup and repository immutability.

M3 wraps that engine in the minimum local public CLI beta. It does not replace or duplicate the engine.

## License

No public license has been selected. The tracked `LICENSE` file does not establish an SPDX license, so the M3 package manifest intentionally omits a `license` field. Until a license is selected, this repository should be treated as unpublished research material with no granted redistribution rights.
