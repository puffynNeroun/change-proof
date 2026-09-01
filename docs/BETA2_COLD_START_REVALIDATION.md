# Beta.2 post-fix cold-start revalidation

## Status

PASS as a project-team post-fix revalidation.

This is not the independent operator acceptance defined by
`BETA2_COLD_START_VALIDATION.md` and does not by itself authorize a Beta.2
release.

## Reviewed Change Proof build

- Source commit:
  `c9874def705aefbe0b55a401ebd8b05279d20457`
- Source change: merged PR #35, Task 12 expectation replay fix.
- Validation package metadata remained:
  `@changeproof/cli@0.1.0-beta.1`
- Validation-only packed artifact SHA-256:
  `ab7e5531b3e0f0ae15baa1228769356cee82d4c4a9a37773ec1b26a5c95dc6e5`
- The validation artifact was not published.

## External fixture

Repository:

`chnlich/charlie-bot`

Refs:

- BASE: `6356013836fc2b5e0f5bb2ebdf5b8c36a61a1e9e`
- HEAD: `cf116ba86e66e8d316662d450c5de90b021fadbf`

BASE to HEAD changed:

- `tests/plan_panel.test.js`
- `web/static/js/plan-panel.js`

The selected changed-test envelope was:

`tests/plan_panel.test.js`

## Original blocker

The first cold-start exercise on pre-Task-12 `main` reached an authoritative
schema `0.2` run but returned `INCONCLUSIVE`.

State C still contained the expected four failing leaves, but P3 had been
prepared with a multiline fragment containing Node 24 reporter comparison
framing:

`plan-selector cleared for plan-less B\n+ actual - expected`

The authoritative replay matcher could not reproduce that prepared normalized
fragment against the runtime failure block and returned
`EXPECTED_ASSERTION_FAILURE_NOT_OBSERVED`.

Task 12 fixed the prepare-to-run replay contract and added regression coverage
for failure-local normalized multiline fragments and sibling isolation.

## Post-fix prepare

Fresh install, fixture clone, prepare config, candidate, promoted config, and
reports were created from scratch.

Prepare result:

- outcome: `ASSERTION_CANDIDATE_OBSERVED`
- promotion eligible: yes
- cleanup verified: yes
- boundary valid: yes
- candidate SHA-256:
  `0e96c65dec25df213982f98d6f953a10f72f28805dcba485b34d7d626f2bb973`
- failure-set SHA-256:
  `20ec368f7e9c2c8109d8cc2bcf36377ee8778d767dd98f328e1075d314dfeef8`

Observed states:

- State A: 39 tests, 39 pass, 0 fail
- State B: 44 tests, 44 pass, 0 fail
- State C: 44 tests, 40 pass, 4 fail

The reviewed State C failure set remained exactly P1-P4.

P3 was now prepared with only the semantic fragment:

`plan-selector cleared for plan-less B`

No `+ actual - expected` reporter framing leaked into the candidate.

## Promotion and authoritative run

The complete candidate failure set was promoted without selective editing into
schema `0.2`.

The authoritative run completed with:

- State A: `PASS`
- State B: `PASS`
- State C: `TEST_ASSERTION_FAILURE`
- State C reason: `EXPECTED_ASSERTION_FAILURE_OBSERVED`
- boundary: `VALID`
- verdict: `OBSERVED_TEST_DISCRIMINATION`
- expectation provenance runtime verification: verified
- cleanup: verified

Both authoritative reports were produced:

- `report.json`
- `report.md`

## Provenance mismatch check

A copy of the promoted config was changed only by replacing
`expectationProvenance.failureSetSha256` with a different valid 64-hex digest.

The run failed closed with:

- error: `EXPECTATION_PROVENANCE_MISMATCH`
- exit code: `3`
- authoritative output directory created: no
- authoritative reports produced: no

The external fixture remained clean.

## Observed non-blocking friction

Two usability ambiguities were observed during the broader cold-start work:

1. Command-specific `prepare --help` currently repeats the global help instead
   of providing a more focused command-specific surface.
2. The candidate's internal `candidateSha256` is not the ordinary SHA-256 of
   the serialized candidate JSON file, and that distinction is not immediately
   obvious to an operator.

Neither issue blocked completion of the post-fix workflow.

## Interpretation

The Task 12 release blocker is resolved on the exact reviewed merged build.

The project-team workflow successfully completed:

`prepare -> review -> promote -> authoritative run -> provenance mismatch`

The remaining Beta.2 cold-start gate is the genuinely independent operator
validation defined by `BETA2_COLD_START_VALIDATION.md`.

This record does not claim general correctness, production readiness, or release
authorization.
