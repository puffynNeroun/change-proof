# M6 CI Contract

## Purpose

The CI workflow is the repository-level regression and package-projection gate for the Change Proof v0.1 beta.

It validates the repository on GitHub-hosted Linux with Node.js 24 without publishing packages, creating releases, writing repository contents, or executing privileged pull-request workflows.

## Triggers

CI runs for:

- pull requests targeting `main`;
- pushes to `main`;
- explicit manual `workflow_dispatch` runs.

The workflow deliberately does not use `pull_request_target`.

## Permissions

The workflow grants the GitHub token only `contents: read`.

All other token permissions remain disabled.

Checkout credentials are not persisted after the checkout step.

## Runtime

The supported CI runtime is:

- GitHub-hosted `ubuntu-latest`;
- Node.js 24;
- the repository's existing npm CLI;
- Git.

The project currently has no runtime or development dependencies, so M6.1 deliberately performs no dependency-install step.

If dependencies are introduced later, the repository must add and commit the appropriate lockfile and CI must use a deterministic install before tests execute.

## Validation gate

The CI job must:

1. run the complete `npm test` regression suite;
2. therefore exercise the isolated packed-package consumer acceptance already included in the suite;
3. project the npm package with `npm pack --dry-run --ignore-scripts --json`;
4. verify the package name is `@changeproof/cli` and the packed version matches `package.json`;
5. verify the exact 28-file package inventory;
6. verify there are no bundled dependencies;
7. reject leakage of tests, docs, or GitHub workflow files into the package;
8. finish with a clean Git checkout and no generated `.tgz` artifact.

## Security boundary

CI is a correctness and packaging gate, not a sandbox.

Repository test code executes with the permissions and environment of the GitHub-hosted runner.

The workflow must not receive publication credentials, npm tokens, release permissions, write permissions, or repository secrets as part of M6.1.

Publication and provenance are separate release concerns and are not part of this workflow.

## Action supply chain

GitHub-owned actions used by the workflow are pinned to exact commit SHAs rather than mutable major-version references.

`actions/checkout` is pinned to an exact reviewed release commit. `actions/setup-node` is temporarily pinned to upstream merged commit `e51e5fe84fc33b4c73ebe40526b2694712b5b858`, which contains the rebuilt distribution for the fix to `GHSA-3jxr-9vmj-r5cp`. This temporary pin must be replaced by an exact patched immutable release commit once upstream publishes one.

Updates to action revisions must be explicit repository changes reviewed through the normal pull-request lifecycle.
