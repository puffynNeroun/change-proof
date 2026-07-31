# Controlled Fixture Contract

## Status

Implemented and verified for the M1 controlled fixture.

This is a narrow research contract. It is not a stable public execution, verdict, or report API.

The implementation must not weaken this contract merely to obtain the expected result.

## Purpose

The fixture tests whether a changed regression test can distinguish a base implementation from a head implementation in a deliberately simple repository.

It tests deterministic repository construction, three-state evidence, fail-fast orchestration, assertion classification, and cleanup behavior.

It does not test general repository compatibility.

## Runtime boundary

The fixture uses:

- Node.js 24;
- JavaScript ESM;
- local Git;
- the built-in `node:test` runner;
- TAP reporter output;
- no external dependencies;
- no package installation;
- no build step;
- no snapshots, helpers, setup files, or external services.

## Fixture files

Each repository variant contains exactly:

- `package.json`;
- `src/qualifies-for-free-shipping.js`;
- `test/qualifies-for-free-shipping.test.js`.

## Product rule

Free shipping is available when the subtotal is `50` or greater.

## Canonical base

The base implementation intentionally contains:

```js
return subtotal > 50;
```

Its tests cover `49` and `51`, but intentionally omit `50`.

## Canonical head

The head implementation fixes the boundary:

```js
return subtotal >= 50;
```

Head adds the named regression test:

```text
allows free shipping at the exact threshold
```

## Test command

States execute:

```text
node --test --test-reporter=tap
```

Execution uses no shell, a bounded output buffer, and a ten-second timeout.

## State boundaries

### State A

Exact detached worktree of the generated base commit.

### State B

Exact generated head repository.

### State C

Exact base commit with only:

```text
test/qualifies-for-free-shipping.test.js
```

restored from head.

State C must prove:

- its commit identity equals base;
- its implementation blob equals the base implementation blob;
- its selected test blob equals the head test blob;
- its diff contains only the selected test path.

## Positive scenario

Required result:

- State A: `PASS`;
- State B: `PASS`;
- State C: `TEST_ASSERTION_FAILURE`;
- named regression test discovered;
- expected assertion mismatch observed;
- no operational failure;
- valid hybrid boundary.

Verdict:

```text
OBSERVED_TEST_DISCRIMINATION
```

This means only that the selected test distinguished the recorded base and head states in the controlled environment.

## Non-discriminating scenario

Required result:

- State A: `PASS`;
- State B: `PASS`;
- State C: `PASS`;
- verdict: `NON_DISCRIMINATING_TESTS`.

## Head-failed scenario

Required result:

- State A: `PASS`;
- State B: `INCONCLUSIVE`;
- State C: `NOT_RUN`;
- verdict: `HEAD_FAILED`.

State C must not be constructed after State B fails to pass.

## Base-failed scenario

Required result:

- State A: `INCONCLUSIVE`;
- State B: `NOT_RUN`;
- State C: `NOT_RUN`;
- verdict: `BASE_FAILED`.

State B tests and State C execution must not run after State A fails to pass.

The current fixture helper still constructs deterministic base and head commits before test execution. The fail-fast guarantee applies to state test execution and State C construction.

## Aggregate verdicts

The controlled evaluator supports:

- `OBSERVED_TEST_DISCRIMINATION`;
- `NON_DISCRIMINATING_TESTS`;
- `HEAD_FAILED`;
- `BASE_FAILED`;
- `INVALID_TEST_ENVELOPE`;
- `OPERATIONAL_ERROR`;
- `INCONCLUSIVE`.

## Runner and manifest

Run:

```text
node experiments/m1-controlled-fixture/run.mjs
```

The controlled manifest uses:

```text
schemaVersion: 0.1
experiment: m1-controlled-fixture
selectedTestPath: test/qualifies-for-free-shipping.test.js
```

It records deterministic SHAs, changed paths, state outcomes, boundary evidence, cleanup evidence, expected and actual verdicts, and verification checks.

Raw TAP output is not included in the public runner manifest.

## Exit-code contract

- `0` - verified matrix.
- `1` - verification mismatch.
- `2` - preflight failure.
- `3` - operational failure.

Controlled failure injection has verified each non-zero path.

## Invalid State C failures

A State C failure is not positive evidence when caused by syntax, import, load, configuration, dependency, timeout, signal, process, or infrastructure errors.

A non-zero exit code alone is insufficient evidence.

## Determinism gate

Five consecutive end-to-end executions must produce:

- identical deterministic SHAs;
- identical state outcomes;
- identical verdicts;
- identical hybrid paths;
- byte-identical runner output;
- byte-identical normalized manifests;
- no temporary workspace leaks;
- no changes to the main checkout.

This gate is verified for the current fixture.

## Workspace ownership

Temporary workspaces use an expected Change Proof prefix and ownership marker.

Cleanup fails closed when ownership cannot be established.

Worktrees provide repository-state isolation. They do not sandbox executed code.

## Stop condition

Do not proceed to a reusable M2 engine if:

- positive evidence requires transferring the head implementation into State C;
- a negative scenario produces a positive verdict;
- deterministic output cannot be reproduced;
- cleanup can affect unrelated paths;
- operational failures are reported as behavioral evidence;
- documentation and implementation disagree.
