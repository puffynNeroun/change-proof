# Contributing to Change Proof

Change Proof is a pre-release developer tool with a deliberately narrow evidence contract. Contributions should preserve that contract rather than broaden product claims implicitly.

## Development requirements

Use:

- Linux or WSL for the currently validated development environment;
- Node.js 24 or newer;
- Git;
- npm supplied with the Node.js installation.

The repository currently has no runtime or development dependencies. A dependency-install step is therefore not required for the current checkout.

If dependencies are introduced in the future, the change must include the appropriate lockfile and update CI to use a deterministic install.

## Before making a change

Start from the current `main` branch and use a focused task branch.

Keep a pull request limited to one coherent change. Avoid unrelated refactors, formatting churn, release changes, repository-setting changes, or contract changes unless they are part of the stated task.

Read the relevant contracts before changing behavior:

- `docs/EVIDENCE_MODEL.md` for the evidence model;
- `docs/M3_PUBLIC_CLI_CONTRACT.md` for the public CLI contract;
- `docs/MVP_LIMITATIONS.md` for supported boundaries and limitations;
- `docs/M6_CI_CONTRACT.md` for CI behavior;
- `SECURITY.md` for the trust model and vulnerability-reporting policy.

## Validation

The primary repository gate is:

`npm test`

The default suite includes core, CLI, integration, and packed-package consumer acceptance tests.

Some external pilot validations require separately configured trusted local repositories and may be skipped when those repositories are not configured.

For changes that can affect package contents, metadata, documentation included in the package, executable behavior, or release preparation, also inspect the package projection with:

`npm pack --dry-run --ignore-scripts --json`

The current pre-release package contract is:

- package: `@changeproof/cli`;
- version: `0.1.0-beta.1`;
- binary: `change-proof`;
- package inventory: 18 files;
- no bundled dependencies.

Do not create or commit generated `.tgz` artifacts.

## Test discipline

Do not weaken, delete, or broaden assertions merely to make a change pass.

A failing test should first be classified as one of:

- an actual product defect;
- an intended contract change;
- a test or fixture defect;
- an environment or harness problem.

Behavioral changes should have evidence that distinguishes the intended new behavior from accidental test accommodation.

Changes to the evidence engine, State C boundary handling, cleanup behavior, execution limits, verdict classification, report contents, or public CLI semantics require corresponding contract and test review.

## Evidence and claim discipline

`OBSERVED_TEST_DISCRIMINATION` is intentionally narrow.

Do not change documentation, reports, examples, or CLI text in a way that implies Change Proof proves:

- complete implementation correctness;
- absence of regressions;
- correctness of an entire pull request;
- production readiness;
- security of repository code;
- sandboxed execution;
- general causality outside the selected evidence envelope.

If a contribution changes what the tool can legitimately claim, update the relevant contract documentation in the same pull request.

## Security

Change Proof executes configured repository code. Git worktrees isolate repository states but do not provide a security sandbox.

Do not add privileged pull-request workflows, repository secrets, publication credentials, write permissions, or ambient credential access without an explicit security review.

Do not report vulnerability details in a normal public issue or pull request. Follow `SECURITY.md`.

## CI and GitHub Actions

Pull requests targeting `main` must pass the repository CI workflow.

GitHub Actions dependencies must remain pinned to exact reviewed commit SHAs. Do not replace exact action pins with mutable tags such as a major-version tag.

The normal CI workflow must not use `pull_request_target` for repository test execution.

Changes to release, publication, provenance, or repository security settings are separate release concerns and should not be mixed into unrelated contributions.

## Pull requests

A useful pull request should explain:

- what changed;
- why the change is needed;
- how it was validated;
- which public or internal contracts are affected;
- any security, packaging, compatibility, or limitation changes.

Keep the repository clean after validation and do not commit temporary reports, local configuration, logs, build artifacts, editor files, or test workspaces.

The project does not currently require Conventional Commits or another machine-enforced commit-message format. Use concise, descriptive commit messages.
