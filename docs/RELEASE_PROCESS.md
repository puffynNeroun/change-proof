# Release Process

## Purpose

This document defines the release boundary for the Change Proof pre-release package.

Release preparation is intentionally separated from publication. Passing repository CI or release preflight does not authorize an npm publication, Git tag, GitHub Release, repository visibility change, security-setting change, credential creation, or trusted-publisher configuration.

## Current bootstrap state

The canonical package is `@changeproof/cli`.

The current candidate version is `0.1.0-beta.1`, and the installed executable is `change-proof`.

The package has not yet been published to npm.

The repository currently retains `"private": true` in `package.json` as an intentional publication safety lock.

The repository release preflight must not remove or bypass that lock.

There are currently no public Git tags or GitHub Releases for Change Proof.

## Release preflight

`.github/workflows/release-preflight.yml` is a non-publishing workflow.

It exists only to reproduce release-candidate validation on a GitHub-hosted Node.js 24 runner.

The preflight:

- is manual-only;
- runs only against `main`;
- has `contents: read` permission;
- has no OIDC token permission;
- receives no npm publication credential;
- performs no publication;
- creates no Git tag or GitHub Release;
- changes no repository or npm settings;
- requires the publication safety lock to remain active;
- requires the bootstrap package name to remain absent from the npm registry;
- requires the candidate Git tag to remain absent;
- runs the full regression suite;
- validates the npm package projection;
- finishes with a clean checkout and no generated tarball artifact.

A successful preflight means only that the current unpublished candidate satisfies the recorded bootstrap checks.

It is not a release authorization.

## Why the first publication is different

npm trusted-publisher relationships and staged publishing require the package to already exist in the npm registry.

Because `@changeproof/cli` does not yet exist, the first publication cannot itself be authenticated through a pre-existing trusted-publisher relationship for that package.

The first publication is therefore a one-time bootstrap operation.

That bootstrap operation is outside the M6.4 preflight workflow and requires a separate explicit release decision.

## Bootstrap publication gate

Before the first npm publication, all of the following must be reviewed explicitly:

1. the exact release commit;
2. the final package version and prerelease dist-tag;
3. the full regression and consumer acceptance result;
4. the exact npm package projection;
5. public repository visibility if provenance is required;
6. the removal of `"private": true`;
7. the public vulnerability-reporting configuration and `SECURITY.md`;
8. the authentication mechanism for the one-time bootstrap publication;
9. the provenance configuration;
10. post-publication installation and CLI acceptance;
11. Git tag and GitHub prerelease creation.

None of these state-changing operations is authorized by this document.

## Preferred bootstrap publication model

For the first public package, the preferred model is a one-time GitHub-hosted publication from the exact reviewed release commit after the repository is public.

The bootstrap publication should:

- publish `@changeproof/cli` as a public scoped package;
- use an explicit prerelease dist-tag rather than implicitly promoting the beta to `latest`;
- generate npm provenance;
- use a narrowly scoped temporary publication credential only for the bootstrap operation;
- expose no credential in repository files or logs;
- be verified immediately from the public registry after publication.

Credential creation, secret configuration, repository visibility changes, and the bootstrap publish itself require separate explicit approval.

## Trusted publishing after bootstrap

After the package exists in npm, token-based automation should not remain the steady-state release mechanism.

The preferred steady-state model is npm Trusted Publishing from GitHub Actions using OIDC.

The trusted relationship must bind the package to:

- the exact GitHub repository;
- the exact release workflow filename;
- the intended GitHub-hosted execution environment;
- only the publication operation actually required by the release process.

The npm CLI used to manage the trust relationship must meet the current `npm trust` version requirement.

The workflow must use only the minimum GitHub permissions required for OIDC publication.

## Preferred staged-release posture

When supported by the selected npm CLI and package configuration, the preferred steady-state publishing posture is:

1. CI submits the package with trusted OIDC authentication;
2. the trusted publisher is allowed to stage, not directly publish;
3. a maintainer reviews the staged artifact;
4. a maintainer approves publication with 2FA;
5. traditional automation tokens are disallowed;
6. any bootstrap publication token is revoked.

This keeps proof-of-presence in the release process while avoiding a long-lived npm publication token in GitHub Actions.

## Provenance

Provenance is part of the intended public release contract.

npm provenance requires the source repository used for the publication to be public.

A package published from the current private repository cannot satisfy that provenance objective.

Repository visibility therefore remains a separate explicit release gate.

## GitHub Actions supply chain

Release-related workflows must follow the same action supply-chain discipline as CI.

GitHub Actions dependencies must be pinned to exact reviewed commit SHAs.

The current temporary `actions/setup-node` security-fix pin remains in use until upstream publishes a reviewed immutable release containing the fix for `GHSA-3jxr-9vmj-r5cp`.

## Version and tag integrity

A package version is immutable once published.

The release process must verify before publication that:

- the intended npm version does not already exist;
- the intended Git tag does not already exist;
- package metadata identifies the canonical repository;
- the package projection is the reviewed projection;
- the exact release commit is known.

The initial beta should use an explicit prerelease npm dist-tag.

## Post-publication migration

After a successful bootstrap publication:

1. verify the public package metadata;
2. install the package into a clean external consumer;
3. verify `change-proof --version` and the supported CLI surface;
4. configure the npm trusted publisher;
5. verify the trusted relationship;
6. revoke and remove the bootstrap publication credential;
7. restrict traditional token publishing where supported;
8. replace the bootstrap preflight with the reviewed steady-state release workflow;
9. verify provenance for releases that claim it;
10. update `SECURITY.md` supported versions;
11. create the corresponding Git tag and GitHub prerelease only under the approved release procedure.

## Failure policy

Publication is fail-closed.

A mismatch in version, package inventory, repository identity, test result, registry state, tag state, security configuration, provenance prerequisites, or authentication configuration blocks release.

A failed or partial release must be analyzed before any retry.

Do not force-push, move an existing public tag, reuse a published package version, or attempt to conceal a partially completed publication.
