# Evidence Model

## Status

Implemented by the production v0.1 beta engine and exercised through the public local CLI contract.

Verdict names, outcome semantics, precedence, and report fields are beta contracts. They are not a stable 1.0 compatibility promise.

## Purpose

The model records what was constructed, executed, and observed.

It does not establish complete correctness, production readiness, security, complete regression protection, or compatibility with arbitrary repositories.

## Repository identity

Every controlled scenario records deterministic base and head commit SHAs.

State identity is verified before execution results are interpreted.

## State A: base baseline

State A contains the exact base implementation and base tests.

When State A does not pass, State B tests and State C execution are skipped.

## State B: head

State B contains the exact head implementation and head tests.

Passing State B does not by itself show that changed tests distinguish previous behavior.

When State B does not pass, State C is not constructed.

## State C: base plus selected head test

State C starts from the exact base commit and receives only the explicitly configured test-envelope paths materialized from head. The original M1 fixture used one selected test file; the production v0.1 engine accepts an explicit set of included paths subject to the same fail-closed boundary validation.

Boundary validation confirms:

- State C is based on base;
- its implementation remains consistent with base outside the selected envelope;
- its selected envelope paths match head;
- its resulting diff contains only the explicitly selected envelope paths.

## State outcomes

- `PASS` - expected passing TAP summary observed.
- `TEST_ASSERTION_FAILURE` - named regression test executed and failed at the expected assertion.
- `INCONCLUSIVE` - evidence did not satisfy a stronger confirmed state contract.
- `NOT_RUN` - fail-fast orchestration skipped the state.

Process evidence also records exit code, signal, timeout, process errors, TAP checks, named-test detection, and invalid-failure classification.

## Positive observation

`OBSERVED_TEST_DISCRIMINATION` requires:

- State A: `PASS`;
- State B: `PASS`;
- State C: `TEST_ASSERTION_FAILURE`;
- intended regression test executed;
- expected assertion mismatch observed;
- valid State C boundary;
- no operational failure.

A non-zero exit code alone is insufficient.

Expected failure identities apply to failed leaf test points in valid
`node:test` TAP. Aggregate suite failures such as `subtestsFailed` are
structural propagation records, not additional behavioral failures, and are
excluded from exact failure-set matching. Output fragments are matched only
within the corresponding leaf record.

Malformed or ambiguous nested TAP remains `INCONCLUSIVE`; nested support does
not broaden the supported test framework beyond `node:test`.

## Aggregate verdicts

### `OBSERVED_TEST_DISCRIMINATION`

State A and State B pass, State C reaches the expected assertion failure, and the hybrid boundary is valid.

### `NON_DISCRIMINATING_TESTS`

State A, State B, and State C pass.

### `HEAD_FAILED`

State A passes, but State B does not pass. State C is not constructed.

### `BASE_FAILED`

State A does not pass. State B tests and State C execution are not run.

### `INVALID_TEST_ENVELOPE`

State A and State B pass, but State C boundary evidence is invalid.

### `OPERATIONAL_ERROR`

The experiment encounters an operational exception or invalid process failure.

Operational errors are not behavioral evidence.

### `INCONCLUSIVE`

The evidence does not match a stronger valid verdict.

## Current verdict precedence

The controlled evaluator applies:

1. `OPERATIONAL_ERROR`;
2. `BASE_FAILED`;
3. `HEAD_FAILED`;
4. `INVALID_TEST_ENVELOPE`;
5. `OBSERVED_TEST_DISCRIMINATION`;
6. `NON_DISCRIMINATING_TESTS`;
7. `INCONCLUSIVE`.

## Fail-fast behavior

- State A executes first.
- If State A does not pass, State B and State C receive `NOT_RUN`.
- If State A passes, State B executes.
- If State B does not pass, State C receives `NOT_RUN`.
- State C is constructed only after State A and State B pass.

## Manifest boundary

The controlled JSON manifest records:

- schema and experiment identity;
- selected test path;
- scenario counts and overall status;
- deterministic repository SHAs;
- changed paths;
- state SHAs and outcomes;
- boundary evidence;
- cleanup evidence;
- expected and actual verdicts;
- verification checks.

Raw TAP output is not part of the manifest.

## Determinism requirement

The fixture must reproduce identical commit identities, state relationships, hybrid paths, outcomes, verdicts, normalized manifest, and runner output.

The current implementation passed this requirement across five consecutive end-to-end executions.

## Evidence limitation

Positive evidence applies only to the recorded fixture, commits, selected test path, command, environment, and outcomes.

It is not proof of complete correctness or evidence that the method generalizes to another repository.
