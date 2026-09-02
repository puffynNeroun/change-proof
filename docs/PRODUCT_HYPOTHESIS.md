# Product Hypothesis

## Status

Historical product hypothesis and current product-validation framing.

The original technical hypothesis has progressed beyond the M0/M1 experiment into a public `0.1.0-beta.2` CLI with bounded external technical validations. This document is retained to preserve the original reasoning while recording the product question that remains unresolved.

Change Proof is still a prerelease beta. Technical feasibility within the documented narrow scope does not establish product-market fit, stable-release maturity, or broad production readiness.

## Problem

A green CI run shows that head code passes with head tests.

When a pull request changes both implementation and tests, this does not show whether the changed tests would detect the old behavior.

A reviewer may still not know whether:

- the regression test catches the reported defect;
- the test passes independently of the implementation fix;
- the intended behavior was actually exercised;
- the hybrid state failed only because it was incompatible;
- meaningful regression protection was added.

## Technical hypothesis

For a limited class of JavaScript repositories, Change Proof may reproducibly execute:

1. base code with base tests;
2. head code with head tests;
3. base code with an explicitly configured test envelope from head.

The evidence may show whether selected changed tests produce an observable distinction between base and head.

## Product hypothesis

Developers and reviewers may find this evidence useful when reviewing behavior-changing pull requests.

The result is valuable only if it is reproducible, understandable, tied to exact commits and commands, conservative about unsupported cases, and inexpensive enough to run.

## First useful scenario

The initial scenario is a deterministic JavaScript bug-fix pull request that changes implementation, adds one regression test, and does not change dependencies, runtime, or build configuration.

## Proposed value statement

Change Proof records whether selected changed tests were observed failing against the base implementation and passing against the head implementation in a recorded environment.

This must not be expanded into a correctness guarantee.

## Historical M0 decision

At M0, the decision was to proceed only through product definition and the M1 controlled fixture experiment, and not to approve a reusable execution architecture until the positive mechanism and required negative cases were reproduced.

That engineering gate has since been passed for the documented bounded v0.1 scope.

## Current validation question

The unresolved product question is now:

> Will developers and reviewers find this evidence useful enough to adopt it in real change-review workflows and use it repeatedly?

The next stage is external product validation. Development should prioritize observed bugs, onboarding friction, evidence clarity, and other problems demonstrated by real users rather than speculative expansion of product scope.
