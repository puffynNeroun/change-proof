# Change Proof — Engineering Case Study

## Problem

A green CI run shows that the current implementation passes the current tests.

When a pull request changes both implementation and tests, however, that does not demonstrate that the new regression test would have detected the previous behavior.

Change Proof explores one narrow question:

> Do explicitly selected changed tests distinguish the exact base implementation from the exact head implementation?

The project does not attempt to prove complete implementation correctness, complete regression coverage, or overall pull-request quality.

## Origin

Change Proof grew out of Rulden, an earlier experiment in repository-native evidence for AI-assisted software delivery.

Rulden explored task contracts, deterministic validation, Git identity, testing evidence, review evidence, lifecycle artifacts, bounded diagnostics, and fail-closed repository operations.

Dogfooding showed that rigorous evidence mechanisms can work technically while still creating too much process friction when the entire verification lifecycle becomes part of the user experience.

Instead of expanding Rulden further, Change Proof narrowed the problem to one independently useful question:

> Can a regression test be shown to distinguish the old behavior from the new behavior using reproducible repository evidence?

## Three-state evidence model

Change Proof evaluates three repository states.

### State A — BASE

Exact base implementation with the base test state.

Expected result:

    PASS

This establishes that the historical repository state is valid under the configured execution.

### State B — HEAD

Exact head implementation with the head test state.

Expected result:

    PASS

This establishes that the proposed implementation and its changed tests pass normally.

### State C — BASE + selected HEAD tests

State C begins from the exact base commit and materializes only an explicitly selected test envelope from head.

For positive discrimination evidence, the selected regression assertion must fail in the expected way.

A positive experiment therefore looks like:

    State A  BASE implementation + BASE tests           PASS
    State B  HEAD implementation + HEAD tests           PASS
    State C  BASE implementation + selected HEAD tests  TEST_ASSERTION_FAILURE

    boundary=VALID
    verdict=OBSERVED_TEST_DISCRIMINATION

A generic non-zero exit code is not sufficient evidence.

The failure must correspond to the expected test and assertion, and the materialized State C boundary must be independently verified.

## Architecture

The system separates repository construction, execution, classification, boundary verification, and verdict evaluation.

Conceptually:

    Configuration
          |
          v
    Resolve immutable BASE / HEAD
          |
          v
    Construct isolated states
          |
          +---- State A
          +---- State B
          +---- State C
                  |
                  v
           bounded execution
                  |
                  v
           test classification
                  |
                  v
          boundary validation
                  |
                  v
           verdict evaluation
                  |
                  v
         report.json + report.md

Git worktrees provide repository-state isolation.

Execution uses an explicit executable, argument array, environment, timeout, and stdout/stderr limits rather than shell interpretation.

Verdict evaluation remains separate from process execution and test classification so that operational failures cannot accidentally become positive behavioral evidence.

## Key engineering challenges

### Exact repository reconstruction

The comparison is meaningful only if BASE, HEAD, and State C represent the intended immutable Git states.

Change Proof resolves exact commits and validates repository identity before interpreting behavioral results.

### Hybrid State C construction

State C must preserve the base implementation while replacing only the explicitly selected test envelope from head.

If unrelated files leak into that state, the experiment becomes invalid.

The resulting boundary is therefore verified rather than assumed.

### Behavioral failure versus operational failure

A timeout, spawn error, malformed test output, dependency issue, unrelated assertion, or unexpected failure cannot be interpreted as evidence that the regression test caught the change.

These outcomes are modeled explicitly and ambiguous evidence fails closed.

### Cleanup and repository safety

Temporary repository states must not corrupt the user's primary checkout.

Worktree lifecycle, cleanup failures, workspace ownership, and report-writing paths are covered by tests.

### Evidence honesty

`OBSERVED_TEST_DISCRIMINATION` has deliberately narrow semantics.

It means that, under the recorded repository states and execution contract, the selected tests distinguished the observed base and head behavior.

It does not prove:

- global implementation correctness;
- complete regression coverage;
- production readiness;
- security of repository code;
- automatic discovery of every relevant test or dependency;
- sandbox-level isolation.

## Product decisions

Several seemingly useful features were deliberately deferred.

The current beta does not attempt to provide automatic test discovery, automatic dependency discovery, arbitrary framework support, a plugin architecture, a hosted dashboard, project management, pull-request orchestration, autonomous code generation, remote execution, or a security sandbox.

The project instead prioritizes:

1. evidence honesty over convenience;
2. boundary integrity over feature count;
3. determinism over heuristic inference;
4. explicit negative evidence over forced success;
5. real repository validation over speculative abstraction.

## Public workflow

The current beta supports an assisted preregistration workflow:

    prepare
       |
       v
    review candidate
       |
       v
    promote
       |
       v
    run

`prepare` records a non-authoritative candidate.

The candidate is reviewed before promotion.

`promote` creates a configuration with expectation provenance.

`run` verifies the configured evidence contract before producing the authoritative result.

Manual preregistration remains supported.

## Validation

The audited public package is:

    @changeproof/cli@0.1.0-beta.2

The final portfolio-readiness audit verified:

- 745 test executions;
- 742 passing;
- 0 failing;
- 3 external-pilot tests skipped when their repositories were not configured;
- installed-package consumer execution;
- deterministic quickstart execution;
- State A PASS;
- State B PASS;
- State C TEST_ASSERTION_FAILURE;
- valid State C boundary;
- OBSERVED_TEST_DISCRIMINATION;
- verified workspace cleanup;
- successful npm package dry-run;
- public npm beta distribution;
- execution through npx;
- clean demo lint;
- 10/10 demo tests;
- successful TypeScript and production demo build.

The evidence engine has also been exercised against bounded external repository cases rather than only the controlled fixture.

## Demonstration

The repository includes an interactive browser demonstration of the same evidence model.

The browser experience does not execute repository tests itself. It presents a recorded experiment and preserves the distinction between:

    BASE + BASE tests
    HEAD + HEAD tests
    BASE + selected HEAD tests

The demonstration is deliberately separated from the authoritative CLI evidence engine.

## What I learned

The largest lesson from Rulden and Change Proof was that more automation does not automatically create a better product.

Rulden demonstrated that a technically rigorous evidence lifecycle can create excessive user friction when its internal mechanics become the user workflow.

Change Proof moved in the opposite direction: one narrow problem, one bounded claim, explicit inputs, reproducible outputs, and no speculative abstractions without evidence that users need them.

The project also reinforced a broader principle for AI-assisted development:

> Conversational or generated claims should not replace independently inspectable repository evidence.

## Current status

Change Proof is a public prerelease beta and engineering research project.

Its narrow technical hypothesis has been implemented and validated within the documented scope.

The remaining question is product validation:

> Will developers and reviewers find this evidence useful enough to use repeatedly in real change-review workflows?

Further development should therefore be driven by real usage, onboarding friction, observed defects, and evidence-clarity problems rather than speculative feature expansion.
