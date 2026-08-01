# Decision 0002: Extract an Internal Engine from M1

- Status: Accepted for M2
- Date: 2026-08-01
- Scope: M2 internal architecture

## Context

M1 proved the three-state evidence mechanism in a deterministic controlled fixture.

The implementation is intentionally fixture-specific and currently combines Git construction, workspace lifecycle, process execution, TAP classification, State C materialization, verdict evaluation, scenario verification, and manifest construction.

Treating the M1 module directly as a general-purpose engine would preserve fixture assumptions and create an unstable foundation.

Rewriting the experiment from scratch would discard verified behavior and introduce unnecessary migration risk.

## Decision

M2 will extract minimum reusable internal primitives from the verified M1 implementation.

The work will be an incremental extraction, not a rewrite.

The controlled M1 fixture will remain an executable regression consumer of the extracted engine.

The extracted engine will remain internal during M2. No stable public API, package contract, or plugin interface will be declared.

## Extraction principles

1. Preserve behavior before broadening scope.
2. Extract responsibilities only when their contracts are explicit.
3. Prefer pure functions for verdict, classification, comparison, and report construction.
4. Keep process execution independent from framework classification.
5. Keep framework classification independent from verdict evaluation.
6. Keep fixture expectations outside the engine.
7. Keep explicit envelope paths before attempting discovery.
8. Preserve fail-fast state execution.
9. Preserve fail-closed workspace cleanup.
10. Validate the engine against a non-synthetic repository before adding broad framework support.

## Consequences

Positive consequences:

- M1 remains a regression oracle.
- Extraction risk is observable after each step.
- Fixture-specific assumptions can be identified explicitly.
- Generic behavior is added only when supported by evidence.
- The project can reach a real repository earlier.

Negative consequences:

- M2 may temporarily contain adapters between M1 structures and internal contracts.
- Some duplication may remain until behavior is safely migrated.
- Internal contracts may change during the first non-synthetic pilot.
- M2 will not immediately produce a polished CLI.

## Alternatives rejected

### Rewrite M1 as a new engine

Rejected because it would discard verified behavior and make regressions harder to identify.

### Publish the current M1 module as the engine

Rejected because it contains controlled-fixture knowledge and is not a stable reusable contract.

### Design a universal multi-framework architecture first

Rejected because no real repository evidence justifies that complexity.

### Build the CLI before engine extraction

Rejected because a CLI would stabilize user-facing behavior before the internal evidence mechanism is reusable.

### Build automatic envelope discovery first

Rejected because explicit envelope paths are required to preserve a provable State C boundary during early validation.

## Acceptance signals

This decision is working when:

- M1 runs through extracted internal primitives;
- M1 outputs remain verified;
- the engine contains no free-shipping or fixture-scenario knowledge;
- one non-synthetic Node.js repository completes the supported flow;
- unsupported behavior is diagnosed explicitly;
- new abstractions are introduced only for demonstrated responsibilities.

## Revisit conditions

Revisit this decision if:

- incremental extraction cannot preserve M1 behavior;
- fixture adapters become more complex than a clean replacement;
- the first non-synthetic pilot invalidates the three-state model;
- explicit envelopes prove unusable for the supported scope;
- internal contracts require a materially different evidence model.
