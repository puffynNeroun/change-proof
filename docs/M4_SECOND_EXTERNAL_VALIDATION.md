# M4 Second External Validation

## Purpose

M4.2 validates the local Change Proof v0.1 beta evidence model on a second external repository. The first external pilot used the Rulden repository; this pilot uses project-forge and its nested Node.js `node:test` CLI suite. The objective is a strict, repeatable observation through the public `bin/change-proof.mjs` entry point, not a broader product-readiness claim.

## Repository and commit contract

The configured repository must be a canonicalized, clean `project-forge` `main` checkout at exactly `479ee8ff4e2fb580acf5f80da3a91739cbb8b700`. The tested change is the single-parent edge:

- base: `c93d36d26815b8825c9fb67eb844a69dbd87303c`;
- head: `fe621d5e72ff1f0f8d1e8ccc9f53de3b1f3b2e40`;
- the head's only direct parent: the exact base commit;
- exact changed paths, in deterministic order: `README.md`, `docs/TASKS.md`, `src/cli.ts`, and `test/cli.test.ts`.

The integration test records and compares the candidate branch, HEAD, status, refs, worktree registry, and checkout bytes before and after both runs. Checkout snapshots exclude `.git`; symbolic links are recorded as links and are not followed. It applies the same Git-state and checkout-byte comparison to Change Proof itself.

## Selected test envelope and observations

The strict JSON configuration selects exactly `test/cli.test.ts`. The aggregate `project-forge CLI` suite is excluded from expected-failure matching; the expected failures are the four leaf tests, in this order:

1. `prints version with --version`
2. `prints version with -V`
3. `rejects --version with an extra argument`
4. `rejects --version on the new command`

The exact observations are:

- State A: 61 tests, 61 pass, 0 fail — `PASS`;
- State B: 65 tests, 65 pass, 0 fail — `PASS`;
- State C: 65 tests, 61 pass, 4 assertion failures — `TEST_ASSERTION_FAILURE` with the exact four leaf names above;
- verdict: `OBSERVED_TEST_DISCRIMINATION`.

The exact valid boundary is based on the base commit, materializes only `test/cli.test.ts` from head, leaves every excluded changed path at its base blob, produces only `test/cli.test.ts` as a resulting change, and reports no boundary reason codes. Cleanup evidence must report ownership validation, three registered and removed worktrees, zero resources left behind, workspace removal, no cleanup failure codes, and no owned workspace residue.

## Dependency projection and execution constraints

The pilot uses only project-forge's existing trusted pnpm dependency snapshot: TypeScript `5.9.3`, `@types/node` `24.13.2`, and `undici-types` `7.18.2`. It discovers exactly one copy of each required package in the existing `node_modules/.pnpm` store and projects directory symlinks only into Change Proof-owned temporary `state-a`, `state-b`, and `state-c` worktrees. The original project-forge `node_modules` tree is compared byte-for-byte, including link targets, before and after the run.

No dependency installation occurs and the validation requires no network access. Commands use executable-and-argument arrays with shell execution disabled, explicit environments, timeouts, and bounded stdout and stderr. Temporary data is removed through `finally` handling.

## Determinism

The public CLI runs twice independently. After removing only recorded timing fields, the two parsed JSON reports must be semantically identical. The Markdown reports must be byte-identical, and terminal summaries must be equal after normalizing their distinct output-directory paths.

## Maintainer command

Run the gated validation against the trusted local checkout:

```text
CHANGE_PROOF_M4_PROJECT_FORGE_REPOSITORY=/absolute/path/to/project-forge node --test --test-reporter=tap test/integration/m4-project-forge-public-cli.test.mjs
```

Without `CHANGE_PROOF_M4_PROJECT_FORGE_REPOSITORY`, the file reports exactly one skipped top-level test and performs no project-forge work.

## Limitations and non-claims

This validates the local v0.1 beta evidence model on a second external repository. It does not establish implementation correctness, a security sandbox, automatic framework or dependency discovery, npm publication readiness, release readiness, security-policy readiness, or CI readiness. It also does not establish complete change correctness, complete regression coverage, general causality, broad framework support, stable-release status, GitHub Action availability, or safety for untrusted code.
