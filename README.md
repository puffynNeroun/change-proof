# Change Proof

Change Proof is a local evidence tool for checking whether explicitly selected changed tests distinguish an exact base implementation from an exact head implementation.

## Current status

**Public v0.1 beta: `0.1.0-beta.1`**

The public npm `beta` dist-tag currently resolves to `0.1.0-beta.1`. The repository `main` additionally contains unreleased Beta.2 functionality.

The Change Proof repository is public. The production three-state evidence engine and configuration-driven CLI have been validated on two bounded external repository cases: the earlier Rulden pilot and the project-forge nested `node:test` pilot.

The initial npm distribution uses the canonical package `@changeproof/cli` and the explicit `beta` dist-tag. This remains a beta contract: it is not a stable-release, production-readiness, general correctness, broad framework-support, or sandboxing claim.

## What M2.10 proved

M2.10 ran the production engine against the non-synthetic Rulden repository with immutable base and head commits. It observed:

- State A passing 20 of 20 tests;
- State B passing 24 of 24 tests;
- State C running 24 tests and observing the exact expected set of eight failures;
- a valid explicit test boundary;
- the `OBSERVED_TEST_DISCRIMINATION` verdict;
- verified workspace cleanup with no primary-checkout, ref, or worktree-registry mutation.

That pilot demonstrated the engine on one bounded real change. It did not establish general implementation correctness, complete regression coverage, production readiness, or safety for untrusted code.

## External validation

The second external validation exercises the public binary against project-forge's nested Node.js `node:test` CLI suite with one exact selected-test envelope. It is gated on a trusted local checkout:

```text
CHANGE_PROOF_M4_PROJECT_FORGE_REPOSITORY=/absolute/path/to/project-forge node --test --test-reporter=tap test/integration/m4-project-forge-public-cli.test.mjs
```

The exact repository, commit, state, dependency-projection, determinism, cleanup, and non-claim contract is recorded in [`docs/M4_SECOND_EXTERNAL_VALIDATION.md`](docs/M4_SECOND_EXTERNAL_VALIDATION.md). These two bounded pilots do not imply broad framework support, automatic framework or dependency discovery, general implementation correctness, complete regression coverage, stable-release maturity, or production sandboxing.

## Installation

The canonical npm package is `@changeproof/cli`, and the installed executable is `change-proof`.

Public beta releases are intentionally addressed through the explicit `beta` dist-tag. On the initial npm publication the registry also initialized `latest` to `0.1.0-beta.1`. That registry alias does not represent a stable-release contract. During the beta line, consumers should select `@changeproof/cli@beta` explicitly.

Install the beta globally:

```text
npm install -g @changeproof/cli@beta
```

Verify the installed CLI:

```text
change-proof --version
change-proof --help
```

Run a manually preregistered evidence check:

```text
change-proof run --config change-proof.config.json
```

### Unreleased Beta.2 prepare -> review -> promote -> run workflow

The current repository `main` adds an optional assisted preregistration workflow without changing the authoritative three-state evidence engine.

This workflow is not yet part of the registry-installed `@changeproof/cli@beta` package. Use an exact reviewed `main` checkout or reviewed packed build for Beta.2 cold-start validation.

Prepare a non-authoritative candidate:

```text
change-proof prepare --config change-proof.prepare.json --candidate candidate.json
```

The candidate is not a verdict and is not an evidence report.

Review the entire candidate, including the complete proposed State C failure set. Promotion is whole-candidate only. Change Proof does not selectively accept individual failures from one candidate.

Promote one eligible candidate:

```text
change-proof promote \
  --config change-proof.prepare.json \
  --candidate candidate.json \
  --output-config change-proof.promoted.json \
  --output-directory ../change-proof-output
```

Promotion writes a strict schema `0.2` run configuration containing `expectationProvenance`.

Then run the promoted configuration authoritatively:

```text
change-proof run --config change-proof.promoted.json
```

Before State A/B/C execution, schema `0.2` runs fail closed unless runtime-reconstructible provenance still matches the repository context, resolved commits, execution contract, selected envelope, and complete expected-failure set.

The final reports include promoted expectation provenance after successful runtime verification. `candidateSha256` and `prepareConfigSha256` remain lineage identifiers and are not recomputed from the final run config alone.

A minimal prepare configuration is schema `0.1` without `classification` or `outputDirectory`:

```json
{
  "schemaVersion": "0.1",
  "repositoryRoot": "./repository",
  "baseRef": "BASE_COMMIT_OR_REF",
  "headRef": "HEAD_COMMIT_OR_REF",
  "command": {
    "executable": "node",
    "arguments": [
      "--test",
      "--test-reporter=tap",
      "test/regression.test.mjs"
    ],
    "workingDirectory": ".",
    "environment": {
      "PATH": "/usr/local/bin:/usr/bin:/bin",
      "LC_ALL": "C",
      "LANG": "C"
    },
    "timeoutMs": 30000,
    "maxStdoutBytes": 4194304,
    "maxStderrBytes": 4194304
  },
  "envelope": {
    "includedPaths": [
      "test/regression.test.mjs"
    ]
  },
  "temporaryParentDirectory": "../change-proof-temp",
  "workspacePrefix": "change-proof-prepare-"
}
```

Manual schema `0.1` preregistration remains supported and is epistemically stronger because its expected counts and failure evidence are supplied independently rather than derived from prior observation.

Or run the beta without a global installation:

```text
npx --yes @changeproof/cli@beta run --config change-proof.config.json
```

For unreleased Beta.2 validation, use an exact reviewed `main` checkout or reviewed packed build rather than the registry `@changeproof/cli@beta` package.

## Configuration

The authoritative `run` command accepts strict UTF-8 JSON configuration schema `0.1` or promoted schema `0.2`. Manual schema `0.1` remains fully supported. Schema `0.2` requires strict `expectationProvenance` generated by whole-candidate promotion.

The original manual schema `0.1` configuration It requires explicit repository refs, one literal executable and argument array, a repository-relative working directory, an explicit environment, bounded execution limits, selected envelope paths, expected test counts, exact State C expected-failure evidence, an external temporary parent, a workspace prefix, and an external output directory.

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

Security vulnerabilities should be reported according to [`SECURITY.md`](SECURITY.md). Do not publish vulnerability details in a public issue or pull request.

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
- [`CONTRIBUTING.md`](CONTRIBUTING.md) - development, validation, and pull-request expectations.
- [`docs/M3_PUBLIC_CLI_CONTRACT.md`](docs/M3_PUBLIC_CLI_CONTRACT.md) — M3 beta CLI contract.
- [`docs/M4_SECOND_EXTERNAL_VALIDATION.md`](docs/M4_SECOND_EXTERNAL_VALIDATION.md) — second external public-CLI validation.
- [`docs/RELEASE_PROCESS.md`](docs/RELEASE_PROCESS.md) - release bootstrap, trusted-publishing, and publication gates.
- [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md) — evidence model.
- [`docs/MVP_LIMITATIONS.md`](docs/MVP_LIMITATIONS.md) — research limitations.
- [`experiments/m1-controlled-fixture`](experiments/m1-controlled-fixture) — deterministic M1 historical experiment.

## Historical milestones

M1 established the controlled three-state fixture, deterministic output, fail-fast behavior, and explicit non-claims.

M2 extracted and verified reusable production primitives. M2.10 then exercised the orchestrator on a non-synthetic repository with an exact eight-failure State C contract and verified cleanup and repository immutability.

M3 wraps that engine in the minimum local public CLI beta. It does not replace or duplicate the engine.

M4.2 repeats the local beta evidence observation on project-forge's nested `node:test` CLI suite, providing a second external validation without making a release-readiness claim.

## Distribution identity

The canonical npm package is `@changeproof/cli`. The installed executable is `change-proof`.

The initial public beta line is `0.1.0-beta.1` and is distributed under the explicit npm `beta` dist-tag.

Install it with:

```text
npm install -g @changeproof/cli@beta
```

The npm registry currently resolves both `beta` and `latest` to the initial prerelease because this is the package's first published version. Only `beta` is the intentional prerelease channel; `latest` must not be described as a stable Change Proof release until an actual stable version is published. Registry publication, provenance, Git tagging, and GitHub prerelease creation remain separate release gates.

## License

Change Proof is licensed under the Apache License 2.0. See [`LICENSE`](LICENSE).
