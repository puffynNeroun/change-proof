# Release Process

## Purpose

This document defines the release boundary for the Change Proof public beta.

Release preparation, npm publication, trusted-publisher configuration, Git tagging, and GitHub Release creation are separate gates. A successful CI or preflight run does not by itself authorize or prove completion of another gate.

## Current release candidate

The canonical npm package is `@changeproof/cli`.

The initial beta version is `0.1.0-beta.1`, the installed executable is `change-proof`, and the npm prerelease dist-tag is `beta`.

The source repository is public and GitHub Private Vulnerability Reporting is enabled.

The `main` branch is protected and requires the project's GitHub Actions CI check.

The release-candidate manifest is intentionally publishable: the earlier `"private": true` bootstrap safety lock is removed only in the reviewed release-candidate change.

Until the bootstrap publication completes, `@changeproof/cli` must remain absent from the npm registry and the corresponding Git tag and GitHub Release must remain absent.

## Release candidate preflight

`.github/workflows/release-preflight.yml` is a non-publishing workflow.

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

## Bootstrap publication workflow

`.github/workflows/bootstrap-publish.yml` is the one-time publication workflow.

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
- dist-tag: `beta`;
- provenance: enabled.

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
3. verify the beta did not establish an unintended stable `latest` contract;
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

After the trusted relationship is verified:

- revoke the temporary bootstrap credential;
- remove the `NPM_BOOTSTRAP_TOKEN` environment secret;
- replace or retire the one-time bootstrap workflow;
- enforce the strongest practical npm token restrictions compatible with Trusted Publishing.

## Version and tag integrity

An npm package version is immutable once published.

Before publication, verify that:

- the intended package version does not already exist;
- the intended Git tag does not already exist;
- the package metadata identifies the canonical repository;
- the package projection is the reviewed projection;
- the exact release commit is known;
- the intended dist-tag is `beta`.

Do not publish this beta under `latest`.

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
