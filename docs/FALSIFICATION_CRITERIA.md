# Falsification Criteria

## Purpose

These criteria define evidence that must stop, narrow, or materially change the project.

The project must not continue only because development time has already been invested.

## M1 technical gate

Do not proceed to a reusable execution engine unless the controlled experiment proves all of the following:

1. Base and head are exact reproducible commits.
2. State A consistently passes.
3. State B consistently passes.
4. State C reaches the intended changed regression test.
5. State C fails at the intended assertion.
6. State C does not fail because of load, setup, configuration, dependency, timeout, or infrastructure errors.
7. The hybrid diff contains only the approved test envelope.
8. The head implementation is absent from the hybrid state.
9. The main repository checkout remains unchanged.
10. Temporary states are cleaned without touching unrelated paths.
11. The same result repeats at least five consecutive times.
12. Negative cases do not produce a positive discrimination verdict.

## Required negative case: non-discriminating tests

Expected result:

- State A: PASS;
- State B: PASS;
- State C: PASS.

The experiment must not report observed test discrimination.

## Required negative case: head failure

State B fails.

The experiment must not report observed test discrimination regardless of the State C result.

## Misleading-result stop condition

Any positive verdict produced without reaching the intended behavioral assertion is a release-blocking defect.

Until the cause is understood and covered by a deterministic fixture:

- do not broaden support;
- do not publish a beta;
- do not add promotional claims;
- do not add automatic pull-request comments.

## Product stop criteria

Pause or redesign the project if later pilots show that:

- most real pull requests are inconclusive;
- valid test envelopes require extensive manual classification;
- failure reasons cannot be explained reliably;
- reports require verbal explanation from the author;
- users interpret evidence as a correctness guarantee;
- execution cost is unacceptable;
- reviewers do not find the result actionable;
- supported cases are too narrow for a standalone tool;
- safe CI execution cannot be established;
- the product becomes a visible task lifecycle.

## External-validation limitation

Do not describe the project as validated if success depends on author assistance, undocumented adjustments, specially prepared repositories, manually edited reports, or exclusion of failed attempts.
