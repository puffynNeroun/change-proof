# Release Process

## Purpose

This document defines the release boundary for the Change Proof public beta.

Release preparation, npm publication, trusted-publisher configuration, Git tagging, and GitHub Release creation are separate gates. A successful CI or preflight run does not by itself authorize or prove completion of another gate.

## Current public release state

The canonical npm package is `@changeproof/cli`.

The current public beta is `0.1.0-beta.1`, the installed executable is `change-proof`, and the npm prerelease dist-tag is `beta`.

The `main` branch also contains unreleased Beta.2 assisted preregistration functionality (`prepare -> review -> promote -> run`). That repository state is not yet an npm Beta.2 release and does not authorize a version bump or publication.

The independent Beta.2 cold-start readiness protocol is defined in [`BETA2_COLD_START_VALIDATION.md`](BETA2_COLD_START_VALIDATION.md).

A project-team post-fix revalidation of commit
`c9874def705aefbe0b55a401ebd8b05279d20457` passed the complete
`prepare -> review -> promote -> run` workflow and the provenance-mismatch
fail-closed check. The result is recorded in
[`BETA2_COLD_START_REVALIDATION.md`](BETA2_COLD_START_REVALIDATION.md).

That result resolves the observed Task 12 workflow blocker but does not satisfy
the independent-operator cold-start gate and does not authorize a version bump,
npm staging, or publication.

The source repository is public and GitHub Private Vulnerability Reporting is enabled.

## Observed bootstrap publication result

The first public npm publication completed from reviewed commit
`c079a9440340220965886e7dcbef1b40a3a020c3`.

The publication step for `@changeproof/cli@0.1.0-beta.1` succeeded and produced
a public package with npm registry signature and provenance attestation.

The publication command explicitly requested the `beta` dist-tag. On this first
publication the npm registry exposed both:

- `beta` -> `0.1.0-beta.1`;
- `latest` -> `0.1.0-beta.1`.

The bootstrap workflow originally treated any `latest` tag as a failure. That
postcondition was incorrect for the observed first-package registry behavior.
The failed workflow conclusion therefore does not mean the package publication
failed: the `npm publish` step succeeded, and the public artifact, package
projection, consumer installation, CLI surface, registry signature, and
provenance were independently verified.

The `latest` mapping is recorded as registry state, not as a Change Proof stable
release promise. During the beta line, release documentation and installation
examples must continue to use `@changeproof/cli@beta` explicitly.

The one-time bootstrap workflow must not be reused after this publication.

The `main` branch is protected and requires the project's GitHub Actions CI check.

The release-candidate manifest is intentionally publishable: the earlier `"private": true` bootstrap safety lock is removed only in the reviewed release-candidate change.

The beta.1 bootstrap release is complete: `@changeproof/cli@0.1.0-beta.1` is public, the `v0.1.0-beta.1` Git tag exists, and the `Change Proof 0.1.0-beta.1` GitHub prerelease has been published. The published npm version must not be republished, and the existing public tag must not be moved or reused.

## Historical bootstrap release candidate preflight

The bootstrap-only `.github/workflows/release-preflight.yml` workflow was retired after the first npm publication. During bootstrap it was a non-publishing workflow.

It:

- is manual-only;
- runs only against `main`;
- has `contents: read` permission only;
- has no OIDC token permission;
- receives no npm publication credential;
- performs no npm publication;
- creates no Git tag or GitHub Release;
- changes no repository or npm settings;
- requires the exact publishable package identity and version;
- requires the package to remain absent from npm during bootstrap;
- requires the candidate Git tag to remain absent;
- verifies public repository identity and that GitHub Private Vulnerability Reporting remains enabled;
- runs the full regression suite;
- validates the exact npm package projection;
- finishes with a clean checkout and no generated tarball artifact.

A successful preflight proves only that the selected unpublished release candidate passed those checks.

## Why the first npm publication is special

npm Trusted Publishing cannot be configured for a package that does not yet exist in the registry.

npm staged publishing also requires the package to already exist.

Therefore the first `@changeproof/cli` publication is a one-time direct bootstrap publication.

After that first package exists, releases should migrate away from the bootstrap credential model.

## Historical bootstrap publication workflow

The one-time `.github/workflows/bootstrap-publish.yml` workflow was retired after `0.1.0-beta.1` was published. It was the bootstrap publication workflow.

It is intentionally manual-only and runs on a GitHub-hosted Node.js 24 runner.

The workflow requires:

- execution from `main`;
- an operator-supplied exact reviewed release commit;
- an operator-supplied exact expected version;
- the GitHub run SHA to equal that reviewed commit;
- `@changeproof/cli` to still be absent from npm;
- the candidate Git tag to still be absent;
- the canonical GitHub repository to remain public with Private Vulnerability Reporting enabled;
- the full regression suite to pass;
- the exact package projection to pass;
- an environment-scoped temporary npm bootstrap credential;
- GitHub OIDC permission for npm provenance.

The workflow publishes exactly:

- package: `@changeproof/cli`;
- version: `0.1.0-beta.1`;
- access: public;
- requested dist-tag: `beta`;
- provenance: enabled.

For the initial package publication, npm also initialized `latest` to `0.1.0-beta.1`. The release process records that alias but does not treat it as a stable release channel.

It does not create a Git tag or GitHub Release.

The workflow must not be dispatched until its exact commit, package projection, npm authentication mechanism, and environment secret have been independently verified.

## Bootstrap credential

The bootstrap credential is temporary and exists only because the package cannot use a pre-existing npm trusted-publisher relationship before its first publication.

Immediately before creating that credential, the current npm authentication requirements must be rechecked.

The credential must:

- be limited to the npm bootstrap publication purpose;
- be stored only as the `NPM_BOOTSTRAP_TOKEN` secret of the `npm-bootstrap` GitHub environment;
- never be committed to the repository;
- never be printed in logs;
- be revoked after Trusted Publishing has been configured and verified.

## Provenance

The first publication is performed from the public canonical GitHub repository on a GitHub-hosted runner with npm provenance enabled.

The `repository.url` metadata must continue to match the canonical GitHub repository.

A release must not claim provenance unless the npm registry exposes the expected provenance for the published package.

## Post-bootstrap verification

A successful `npm publish` command is not sufficient to complete the release.

After publication:

1. verify `@changeproof/cli@0.1.0-beta.1` from the public registry;
2. verify `beta` points exactly to `0.1.0-beta.1`;
3. record the actual registry `latest` mapping and ensure documentation does not represent the prerelease as a stable release;
4. verify package metadata, license, engine requirement, repository identity, binary mapping, and package inventory;
5. verify npm provenance;
6. install the package in a clean consumer;
7. verify `change-proof --version` and `change-proof --help`;
8. verify `npx @changeproof/cli@beta`;
9. run a real Change Proof evidence case through the registry-installed package.

Only after these checks is the bootstrap package considered accepted.

## Trusted Publishing after bootstrap

After the package exists, configure npm Trusted Publishing for the canonical GitHub repository.

The npm CLI used for trust management must satisfy the current `npm trust` minimum-version requirement.

The preferred steady-state permission is staged publication rather than unrestricted direct publication when the npm feature remains supported:

1. GitHub Actions authenticates through OIDC;
2. CI stages the package;
3. the maintainer reviews the staged artifact;
4. the maintainer approves it with 2FA;
5. no long-lived publication token remains in GitHub Actions.

After the trusted relationship is configured and its exact registry
configuration is verified:

- remove the `NPM_BOOTSTRAP_TOKEN` environment secret;
- revoke the temporary bootstrap npm token;
- set package publishing access to require 2FA and disallow traditional
  tokens;
- keep the Trusted Publisher stage-only;
- use the first real future staging operation as the end-to-end OIDC
  execution proof.

The bootstrap workflows have already been retired.

## Steady-state staged publishing workflow

Future beta releases use `.github/workflows/npm-stage.yml`.

The workflow is manual-only and is bound to the `npm-release` GitHub
environment. It receives no npm token.

Its GitHub permissions are limited to:

- `contents: read`;
- `id-token: write`.

The workflow requires:

- execution from `main`;
- the exact reviewed main commit as `expected_commit`;
- the exact beta version already present in `package.json` as
  `expected_version`;
- npm CLI `>=11.15.0`;
- the package version to be absent from the public npm registry;
- the corresponding Git tag to be absent;
- the complete regression suite to pass;
- the package projection to pass;
- the packed-package consumer acceptance to exercise the public Beta.2
  `prepare -> review -> promote -> run` path successfully;
- the final promoted run to expose runtime-verified expectation provenance;
- a tampered promoted runtime binding to fail closed before producing reports;
- a clean checkout before staging.

The only npm release mutation performed by the workflow is:

`npm stage publish --tag beta --provenance --ignore-scripts`

The npm Trusted Publisher relationship must be configured exactly as:

- package: `@changeproof/cli`;
- provider: GitHub Actions;
- repository: `puffynNeroun/change-proof`;
- workflow filename: `npm-stage.yml`;
- GitHub environment: `npm-release`;
- allowed action: `npm stage publish`;
- direct `npm publish`: not allowed.

The workflow does not approve a staged package, create a Git tag, or create
a GitHub Release.

After a successful staging run, a maintainer must inspect the staged artifact
and explicitly approve it with npm 2FA. Approval is the proof-of-presence gate
that makes the version publicly available.

The trusted relationship is intentionally stage-only. Long-lived or
bypass-2FA npm tokens are not part of the steady-state publishing path.

The already-published `0.1.0-beta.1` is not restaged or republished through
this workflow.

## Version and tag integrity

An npm package version is immutable once published.

Before publication, verify that:

- the intended package version does not already exist;
- the intended Git tag does not already exist;
- the package metadata identifies the canonical repository;
- the package projection is the reviewed projection;
- the exact release commit is known;
- the intended dist-tag is `beta`.

Release commands for the beta line must explicitly request `beta`; they must not intentionally target `latest`. The registry-created initial `latest` alias is recorded compatibility state and is not a stable-release claim.

## Git tag and GitHub prerelease

The Git tag and GitHub prerelease are created only after the npm artifact has passed post-publication verification.

The tag must identify the exact reviewed release commit from which the accepted npm package was published.

The initial tag is `v0.1.0-beta.1`.

The GitHub Release must be marked as a prerelease and must describe the beta support boundary and known limitations.

## Failure policy

Publication is fail-closed.

A mismatch in version, package inventory, repository identity, test result, registry state, tag state, security configuration, provenance prerequisites, authentication configuration, or post-publication acceptance blocks progression.

A failed or partial release must be analyzed before retry.

Do not force-push, move an existing public tag, reuse a published package version, or attempt to conceal a partial release.
