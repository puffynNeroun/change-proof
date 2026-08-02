# Change Proof v0.1 Product Scope

Status: scope lock for the first usable beta.

This document defines what Change Proof is, what it is not, what evidence it may claim, and what must be completed before the v0.1 beta is considered credible.

## 1. Product question

Change Proof answers one narrow question:

> Do the selected changed tests demonstrate that the behavior introduced at head is observably different from the behavior at base?

The product does not evaluate the overall quality of a pull request.

It does not decide whether a fix is correct in every relevant case.

It produces bounded evidence about test discrimination under an explicitly constructed and verified comparison.

## 2. Evidence model

Change Proof evaluates three primary states.

### State A

Exact base implementation with the base test state.

Expected condition for useful evidence:

- tests pass.

### State B

Exact head implementation with the head test state.

Expected condition for useful evidence:

- tests pass.

### State C

Exact base implementation with only the explicitly allowed test envelope taken from head.

Expected condition for positive discrimination evidence:

- the selected expected regression assertion fails;
- the failure matches the declared test and expected output contract;
- the State C boundary is independently verified.

A generic non-zero exit code is not proof of discrimination.

A syntax error, missing dependency, process failure, timeout, unrelated test failure, or unexpected assertion failure is not positive evidence.

## 3. Positive result

The strongest positive result is:

    OBSERVED_TEST_DISCRIMINATION

It requires all of the following:

- State A passes;
- State B passes;
- State C reaches the expected assertion failure;
- the failed test identity matches the explicit expectation;
- the expected output fragments match;
- the materialized State C boundary is valid;
- no operational failure invalidates the run.

This result means:

> Under the declared command, selected test envelope, repository states, and execution limits, the selected tests observed a behavioral difference between exact base and exact head.

It does not mean that the implementation is globally correct.

## 4. First-class negative and inconclusive results

The beta must treat negative results as product outcomes rather than implementation failures.

Required verdicts include:

- `NON_DISCRIMINATING_TESTS`;
- `HEAD_FAILED`;
- `BASE_FAILED`;
- `INVALID_TEST_ENVELOPE`;
- `OPERATIONAL_ERROR`;
- `INCONCLUSIVE`.

Negative evidence must remain visible in both machine-readable and human-readable reports.

The product must not rewrite an inconclusive result into a positive result for convenience.

## 5. Claims Change Proof must not make

Change Proof must not claim that it proves:

- complete correctness of a fix;
- absence of all regressions;
- quality of an entire pull request;
- security of the changed code;
- production readiness;
- correctness of every unchanged test;
- correctness outside the executed command;
- isolation equivalent to a security sandbox;
- that AI proved the change;
- that every relevant dependency was included automatically;
- that a passing State C is evidence of a correct implementation.

Reports, CLI messages, README content, and examples must preserve these limitations.

## 6. Target user

The initial user is a software engineer reviewing a change where tests and implementation changed together.

The highest-value initial cases include:

- AI-generated or agent-generated pull requests;
- regression fixes accompanied by new tests;
- refactors where tests may accidentally only validate the new implementation;
- reviews where the author wants reproducible evidence that a new test fails against the previous behavior.

Change Proof is a developer tool, not a project-management product.

## 7. v0.1 supported environment

The first beta intentionally supports a limited environment:

- Linux and WSL;
- trusted local Git repositories;
- explicit base and head refs;
- exact immutable commit resolution;
- Node.js repositories;
- `node:test` as the first supported test framework;
- explicit test-envelope paths;
- explicit process executable and argument arrays;
- local execution;
- bounded stdout and stderr;
- bounded execution time;
- temporary detached Git worktrees;
- authoritative JSON evidence;
- human-readable Markdown evidence.

The initial beta does not promise native Windows support.

The initial beta does not promise macOS validation until it is tested.

## 8. Trust model

Change Proof executes repository code.

For v0.1, the supported model is a trusted local repository controlled by the user.

Git worktrees isolate repository state from the primary checkout, but they are not a security sandbox.

The beta must not, by default:

- install dependencies;
- execute code from an untrusted external pull request;
- fetch arbitrary network resources;
- expose secrets;
- inherit an unspecified ambient environment;
- claim protection against malicious repository code.

Security hardening beyond this trust model requires a separate product decision.

## 9. Public CLI surface

The v0.1 beta should expose one primary public command:

    change-proof run

The preferred initial invocation is configuration-driven:

    change-proof run --config change-proof.config.json

The internal command contract must use:

- an executable string;
- a literal argument array;
- an explicit environment object;
- a timeout;
- independent stdout and stderr limits.

The engine must not depend on shell parsing.

Additional public commands such as `validate`, `inspect`, `init`, or `explain` are deferred until a demonstrated user need exists.

## 10. Required outputs

A completed run must provide:

- resolved base commit;
- resolved head commit;
- State A outcome;
- State B outcome;
- State C outcome;
- selected envelope paths;
- excluded changed paths;
- materialized-path evidence;
- blob-identity evidence;
- boundary result;
- classification result;
- final verdict;
- reasons;
- limitations;
- warnings;
- timing;
- execution limits;
- cleanup evidence;
- tool and schema versions.

The authoritative output is:

    report.json

The human-readable projection is:

    report.md

The Markdown report must not contain claims stronger than the JSON evidence.

## 11. Exit-code contract

The intended beta exit-code model is:

- `0` - the evidence run completed and produced a report;
- `1` - a configured policy such as `--fail-on` rejected the resulting verdict;
- `2` - invalid usage or invalid configuration;
- `3` - operational failure prevented a valid completed run.

Behavioral verdicts are not automatically process failures.

For example, `NON_DISCRIMINATING_TESTS` may still produce exit code `0` unless an explicit policy requests failure.

## 12. Anti-Rulden boundary

Change Proof must not become:

- a task manager;
- a workflow manager;
- a branch manager;
- a pull-request creator or merger;
- a release orchestrator;
- an agent harness;
- a governance control plane;
- a project-template framework;
- a role-based development lifecycle;
- a plugin platform;
- a universal developer automation foundation.

Internal Git operations are allowed only when required to construct and verify evidence states.

Public PR, task, branch, and release orchestration belong outside Change Proof.

Technical overlap with another CLI is acceptable.

Product-purpose overlap is not.

## 13. Explicit non-goals for v0.1

The first beta does not include:

- automatic envelope discovery;
- automatic dependency discovery;
- plugin architecture;
- multiple test-framework adapters;
- GitHub Action integration;
- dashboard or cloud service;
- database persistence;
- organisation policy management;
- report history service;
- AI-generated tests;
- AI-generated verdicts;
- automated pull-request comments;
- dependency installation;
- remote execution;
- container orchestration;
- commercial team features.

These may only be reconsidered after real repeated usage demonstrates a need.

## 14. Engineering principles

Development priorities are ordered as follows:

1. Evidence honesty over convenience.
2. Boundary integrity over feature count.
3. Determinism over heuristic cleverness.
4. Negative evidence over forced success.
5. A real pilot over another abstraction layer.
6. A thin usable product over a large internal framework.
7. Explicit configuration over hidden inference.
8. Reproducible reports over attractive but unverifiable summaries.

A non-zero exit code is never sufficient evidence of discrimination.

Operational failure takes precedence over behavioral success.

The verdict engine remains pure.

The test classifier must not produce product verdicts.

Git and filesystem mutation must remain isolated from pure evidence evaluation.

## 15. Scope-control rules

Each implementation milestone must answer four questions before code is written:

1. What single product question does this milestone advance?
2. What is explicitly outside its scope?
3. How will the M1 regression baseline remain verified?
4. What is the minimum definition of done?

New public APIs require an immediate real consumer.

New dependencies require a concrete current need.

Extension points for hypothetical future integrations are rejected.

Infrastructure growth without movement toward a complete user-facing run is a stop signal.

A production module larger than approximately 800 to 1000 lines requires explicit justification or decomposition review.

Size alone does not justify risky refactoring of already verified safety-critical code.

## 16. Remaining engine milestones

### M2.8 - explicit envelope materialization

Construct State C from exact base and exact head using only explicitly selected paths.

Required behavior includes:

- modified paths;
- added paths;
- deleted paths;
- deterministic path handling;
- resulting changed-path evidence;
- State C blob identities;
- integration with the existing boundary evaluator;
- no automatic dependency discovery.

### M2.9 - M1 migration

Replace duplicated experimental mechanics with the extracted production primitives.

M1 remains the immutable behavioral regression baseline.

Migration is extraction and integration, not a rewrite of the evidence model.

### M2.10 - non-synthetic pilot

Run the complete engine against a real small Node.js repository that is not the controlled fixture.

The pilot must exercise:

- base and head resolution;
- changed-path inspection;
- State A construction;
- State B construction;
- State C materialization;
- bounded execution;
- test classification;
- boundary verification;
- verdict evaluation;
- JSON report generation;
- Markdown report generation;
- complete cleanup.

After this pilot, internal primitives are frozen unless a demonstrated defect or real user requirement justifies a change.

## 17. v0.1 beta definition of done

The v0.1 beta is credible when all of the following are true:

- the M1 controlled fixture remains verified;
- M2.8 materializes and proves explicit envelopes;
- M2.9 migrates M1 to production primitives;
- M2.10 completes a non-synthetic pilot;
- one internal orchestrator performs the full evidence run;
- one thin CLI command exposes that orchestrator;
- `report.json` is authoritative;
- `report.md` accurately projects the evidence;
- cleanup does not damage the primary checkout;
- exit codes are documented and tested;
- Linux and WSL behavior is validated;
- README explains the product in approximately 60 seconds;
- README clearly states what the tool does not prove;
- at least two external repositories are used for validation before broader public positioning.

## 18. Product evaluation criteria

The product should be judged by:

- whether the evidence is reproducible;
- whether invalid boundaries fail closed;
- whether negative verdicts are understandable;
- whether reports are independently inspectable;
- whether the primary checkout remains intact;
- whether the product question is clear to a new user;
- whether a complete run requires minimal configuration;
- whether the implementation avoids unrelated workflow features.

It should not be judged primarily by:

- number of commands;
- number of integrations;
- number of abstraction layers;
- unsupported enterprise claims;
- artificial star or adoption targets;
- speculative commercial features.

## 19. Commercial boundary

Commercialisation is deferred until the local beta demonstrates repeat value.

Before considering paid features, the project should establish:

- successful external validation;
- repeated use of the same evidence workflow;
- a clear reason users return;
- evidence that reports influence review decisions;
- demand that cannot be met by the local open-source workflow.

Potential future commercial directions must not distort the v0.1 evidence model.

## 20. Decision rule

A proposed feature belongs in Change Proof only when it directly improves one of the following:

- construction of State A, State B, or State C;
- integrity of the evidence boundary;
- classification of executed evidence;
- verdict correctness;
- report reproducibility;
- safe local cleanup;
- usability of the single discrimination workflow.

If it does not improve one of these, it is outside the current product.
