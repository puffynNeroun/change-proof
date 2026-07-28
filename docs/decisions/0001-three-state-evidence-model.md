# Decision 0001: Three-State Evidence Model

- Status: Proposed
- Date: 2026-07-29
- Scope: M0 and M1 controlled research
- Public API impact: None

## Context

A normal pull-request test run evaluates the head implementation together with the head tests.

It does not directly show whether changed tests would detect behavior present in the base implementation.

The project needs a minimal falsifiable experiment without introducing a visible development lifecycle.

## Decision

The first experiment evaluates:

1. State A: exact base commit with base tests;
2. State B: exact head commit with head tests;
3. State C: exact base commit with one explicitly approved changed test file from head.

The controlled fixture uses JavaScript ESM, the Node.js built-in test runner, TAP output, no external dependencies, no build step, no helpers, no snapshots, and no dependency changes.

## Positive observation requirements

Observed test discrimination requires:

- State A passes;
- State B passes;
- State C executes the intended changed test;
- State C fails at the intended assertion;
- State C has no load, configuration, dependency, timeout, or infrastructure failure;
- hybrid validation confirms that no head implementation file was transferred.

## Important distinction

The sequence exit 0, exit 0, exit non-zero is insufficient.

The required observation is PASS, PASS, and intended test assertion failure.

## Rationale

This model directly tests the core mechanism, can be falsified cheaply, adds evidence not provided by head-only CI, avoids a custom lifecycle, and makes hybrid-state validity explicit.

## Alternatives considered

- Head tests only: rejected because this duplicates ordinary CI.
- Mutation testing: deferred because it answers a broader question.
- State C based only on exit code: rejected because compatibility failures can create false positive evidence.
- Automatic test-file detection: deferred because filename patterns do not define a semantic boundary.
- Four-state model: deferred until State D demonstrates additional value.

## Consequences

The experiment remains small and fail-closed, but it is runner-specific, intentionally narrow, and not yet representative of real repositories.

## Revisit conditions

Revisit this decision if the fixture is not reproducible, assertion execution cannot be confirmed, negative cases are misclassified, real repositories require another state model, or State D becomes necessary.
