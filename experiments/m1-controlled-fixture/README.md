# M1 Controlled Fixture

This directory contains the executable controlled experiment for the Change Proof three-state evidence model.

It is fixture-specific. It is not the future reusable execution engine and is not a stable public API.

## Run

From the repository root:

```text
node experiments/m1-controlled-fixture/run.mjs
```

A successful execution returns exit code `0`, prints four passing scenario summaries, emits a JSON manifest with status `VERIFIED`, and ends with:

```text
M1_RUNNER_VERIFIED
```

## Files

- `run.mjs` - thin executable entry point.
- `state-c-experiment.mjs` - validation, Git construction, worktree lifecycle, execution, State C construction, classification, verdict evaluation, scenario matrix, and manifest creation.
- `fixture/` - controlled repository variants.

The entry point does not duplicate Git or test-execution logic.

## State model

### State A

Exact base commit with its baseline tests.

### State B

Exact head commit with its complete head tests.

### State C

Exact base implementation with only this selected test restored from head:

```text
test/qualifies-for-free-shipping.test.js
```

State C must not receive the head implementation or package manifest.

## Product rule

Free shipping is available when the subtotal is `50` or greater.

The canonical base implementation is intentionally defective:

```js
return subtotal > 50;
```

The canonical head implementation fixes the boundary:

```js
return subtotal >= 50;
```

The named regression test is:

```text
allows free shipping at the exact threshold
```

## Scenario matrix

### `positive`

- State A: `PASS`
- State B: `PASS`
- State C: `TEST_ASSERTION_FAILURE`
- Verdict: `OBSERVED_TEST_DISCRIMINATION`

State C must reach the named regression assertion and observe the expected mismatch `false !== true`.

### `non_discriminating`

- State A: `PASS`
- State B: `PASS`
- State C: `PASS`
- Verdict: `NON_DISCRIMINATING_TESTS`

A changed test that also passes against base does not establish test discrimination.

### `head_failed`

- State A: `PASS`
- State B: `INCONCLUSIVE`
- State C: `NOT_RUN`
- Verdict: `HEAD_FAILED`

State C is not constructed after the head state fails to pass.

### `base_failed`

- State A: `INCONCLUSIVE`
- State B: `NOT_RUN`
- State C: `NOT_RUN`
- Verdict: `BASE_FAILED`

State B tests and State C execution are skipped after the baseline fails to pass.

## Aggregate verdicts

The controlled evaluator currently supports:

- `OBSERVED_TEST_DISCRIMINATION`
- `NON_DISCRIMINATING_TESTS`
- `HEAD_FAILED`
- `BASE_FAILED`
- `INVALID_TEST_ENVELOPE`
- `OPERATIONAL_ERROR`
- `INCONCLUSIVE`

These names remain preliminary.

## State outcomes

The controlled orchestrator currently emits:

- `PASS`
- `TEST_ASSERTION_FAILURE`
- `INCONCLUSIVE`
- `NOT_RUN`

Additional process metadata distinguishes assertion evidence from timeout, signal, syntax, module-load, and operational failures.

## JSON manifest

The manifest appears between:

```text
===== M1 JSON MANIFEST BEGIN =====
===== M1 JSON MANIFEST END =====
```

Top-level fields include:

- `schemaVersion`
- `experiment`
- `selectedTestPath`
- `scenarioCount`
- `completedScenarioCount`
- `status`
- `scenarios`

Raw TAP output is not included.

## Exit codes

- `0` - matrix verified.
- `1` - verification mismatch.
- `2` - preflight failure.
- `3` - operational failure.

Controlled failure injection verifies all four exit-code paths.

## Determinism

Five consecutive executions produced identical stdout, identical normalized manifests, stable SHAs, identical verdicts, and no workspace leaks.

## Workspace and security boundary

Owned temporary workspaces use a restricted `/tmp` prefix and an ownership marker.

Cleanup fails closed when ownership cannot be established.

Worktrees isolate repository state but do not sandbox executed code. Run M1 only against the controlled fixture included in this repository.

Do not use it to execute arbitrary or untrusted pull requests.

## Current limitations

The fixture does not support arbitrary repositories, arbitrary test commands, TypeScript, package installation, dependency changes, build tools, monorepos, external services, Windows-native execution, GitHub Actions, or untrusted code.

See [`../../docs/MVP_LIMITATIONS.md`](../../docs/MVP_LIMITATIONS.md).
