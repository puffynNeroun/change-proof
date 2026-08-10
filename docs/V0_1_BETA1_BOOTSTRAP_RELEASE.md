# Change Proof 0.1.0-beta.1 bootstrap publication record

## Scope

This record captures the first public npm publication of `@changeproof/cli`.

It records observed evidence. It does not reinterpret the Change Proof product
evidence model or expand the project's supported-platform claims.

## Reviewed source

- package: `@changeproof/cli`
- version: `0.1.0-beta.1`
- reviewed merge commit:
  `c079a9440340220965886e7dcbef1b40a3a020c3`
- bootstrap GitHub Actions run: `31344589959`
- requested npm prerelease tag: `beta`

## Publication outcome

The workflow's `npm publish` step completed successfully.

The exact package became publicly readable from the npm registry.

Observed package evidence:

- package: `@changeproof/cli@0.1.0-beta.1`
- license: `Apache-2.0`
- package inventory: 18 files
- bundled dependencies: 0
- packed size: 42402 bytes
- unpacked size: 208617 bytes
- registry integrity:
  `sha512-v3sHfg2IXxRPmUHfk1yJkhwxzedAcU8JdXnkjxtbcr39AILn6RBud/HD5FDEDIVoSb7vIB4b4sjygiqH+R7b4g==`

Independent consumer verification confirmed:

- clean public install succeeds;
- `change-proof --version` reports `0.1.0-beta.1`;
- `change-proof --help` succeeds;
- npm registry signature verification succeeds;
- npm provenance attestation verification succeeds.

## Dist-tag observation

The publication command explicitly requested the npm `beta` dist-tag.

After the first publication the registry exposed:

- `beta` -> `0.1.0-beta.1`
- `latest` -> `0.1.0-beta.1`

The bootstrap workflow expected `latest` to be absent and therefore reported a
post-publication failure after the actual publication had already succeeded.

A subsequent authenticated attempt to remove `latest` was rejected by the npm
registry with HTTP 400. No package version was republished, unpublished, or
modified by that failed removal attempt.

The recorded release contract is therefore:

- `beta` is the intentional Change Proof prerelease channel;
- the initial `latest` mapping is registry state for the first published
  package;
- the project does not describe `0.1.0-beta.1` as a stable release;
- beta installation examples use `@changeproof/cli@beta` explicitly.

## Bootstrap workflow disposition

The bootstrap publication mechanism was one-time infrastructure.

It must not be used for subsequent versions.

Steady-state npm publication must migrate to npm Trusted Publishing through
GitHub Actions OIDC, preferably with staged publication and maintainer approval.

The temporary bootstrap credential remains installed only until the trusted
publisher relationship has been configured and independently verified.

After that verification:

1. remove the GitHub `NPM_BOOTSTRAP_TOKEN` environment secret;
2. revoke the temporary npm bootstrap token;
3. restrict traditional token publication at the package level;
4. continue releases through the reviewed Trusted Publishing workflow.

## Git release state

At the time this record was created:

- npm package publication: complete;
- Git tag `v0.1.0-beta.1`: not yet created;
- GitHub prerelease: not yet created.

The Git tag and GitHub prerelease remain gated on Trusted Publishing migration
and bootstrap credential retirement.
