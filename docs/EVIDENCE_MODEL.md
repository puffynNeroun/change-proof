# Evidence Model

## Status

Proposed evidence model for the controlled M1 experiment.

Verdict names and report fields are not a stable public API.

## Purpose

The model records what was executed and what was observed.

It does not establish complete correctness, production readiness, security, or complete regression protection.

## Repository identity

Every execution state must record exact base and head commit SHAs.

Symbolic refs may later be accepted as input, but they must be resolved before execution.

## State A: base baseline

State A contains the exact base implementation and base tests.

A passing State A means only that the selected command passed on the base state.

## State B: head

State B contains the exact head implementation and head tests.

A passing State B does not show that changed tests distinguish the old behavior.

## State C: base plus head test envelope

State C contains the base implementation plus only explicitly approved test changes from head.

The experiment must record included paths, excluded changed paths, and the resulting hybrid diff.

## Positive observation requirements

State C must discover and execute the intended regression test.

It must fail at the intended assertion rather than during import, build, setup, configuration, dependency resolution, timeout, or infrastructure execution.

A non-zero exit code alone is insufficient evidence.

## Execution outcomes

- PASS: the command completed successfully.
- TEST_ASSERTION_FAILURE: the intended test executed and its assertion failed.
- BUILD_OR_LOAD_FAILURE: the test suite could not load or compile.
- CONFIGURATION_FAILURE: required test configuration was missing or incompatible.
- DEPENDENCY_FAILURE: required dependencies were unavailable.
- TIMEOUT: the execution exceeded its time limit.
- PROCESS_FAILURE: the process failed outside a confirmed test assertion.
- TOOL_OPERATIONAL_ERROR: the experiment itself failed.

An operational error is not a product verdict.

## Preliminary positive verdict

OBSERVED_TEST_DISCRIMINATION requires:

- State A: PASS;
- State B: PASS;
- State C: TEST_ASSERTION_FAILURE;
- confirmation that the intended changed test executed;
- successful hybrid boundary validation.

This means only that the selected test envelope distinguished base and head in the recorded environment.

## Other preliminary verdicts

- NON_DISCRIMINATING_TESTS: States A, B, and C pass.
- HEAD_FAILED: State B does not pass.
- BASELINE_FAILED: State A does not pass.
- INCONCLUSIVE: valid evidence could not be produced.

## Determinism requirement

The controlled fixture must reproduce the same commit identities, hybrid paths, execution outcomes, failing test name, and failure category across at least five consecutive executions.
