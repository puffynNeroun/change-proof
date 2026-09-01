# Beta.2 fresh-session clean-room validation

## Status

PASS WITH FRICTION.

This validation used a fresh isolated assistant session as the workflow operator.
The maintainer executed the supplied shell commands and returned stdout/stderr.

This is not represented as independent-human validation.

## Reviewed build

- Source commit:
  `0e746f3a1448e47a345af570980514bd9c2b64e1`
- Package identity:
  `@changeproof/cli@0.1.0-beta.1`
- Validation tarball SHA-256:
  `ab7e5531b3e0f0ae15baa1228769356cee82d4c4a9a37773ec1b26a5c95dc6e5`
- Node.js:
  `v24.16.0`

The tarball was validation-only and was not published.

## Clean-room boundary

The operator was instructed not to use Change Proof source code, project tests,
internal docs, Git history, pull requests, issues, previous validation results,
or hidden project context.

The allowed Change Proof surfaces were:

- README from the installed packed package;
- `change-proof --help`;
- CLI-produced candidate, promoted config, reports, and errors.

The external trusted fixture and ordinary Git, Node.js, npm, JSON, and shell
knowledge were also allowed.

## External fixture

Repository:

`chnlich/charlie-bot`

Refs:

- BASE: `6356013836fc2b5e0f5bb2ebdf5b8c36a61a1e9e`
- HEAD: `cf116ba86e66e8d316662d450c5de90b021fadbf`

Selected changed-test envelope:

`tests/plan_panel.test.js`

## Prepare and candidate review

The operator independently constructed the schema `0.1` prepare config and ran
`change-proof prepare`.

Observed candidate result:

- `authoritative: false`
- outcome: `ASSERTION_CANDIDATE_OBSERVED`
- promotion eligible: yes
- State A: 39 tests, 39 pass
- State B: 44 tests, 44 pass
- State C: 44 tests, 40 pass, 4 fail
- boundary valid: yes

The complete four-failure State C candidate set was reviewed before promotion.
No selective acceptance or candidate editing was performed.

## Promotion and authoritative run

Whole-candidate promotion succeeded:

- promoted schema: `0.2`
- `whole_failure_set=ACCEPTED`

The authoritative run completed with:

- State A: `PASS`
- State B: `PASS`
- State C: `TEST_ASSERTION_FAILURE`
- boundary: `VALID`
- verdict: `OBSERVED_TEST_DISCRIMINATION`
- cleanup: verified

Both authoritative reports were produced:

- `report.json`
- `report.md`

Expectation provenance was runtime-verified.

## Provenance mismatch

The operator independently chose a mismatch test by changing one promoted
`classification.stateC.expectedFailures[*].outputIncludes` value while leaving
the promoted provenance unchanged.

The resulting run failed closed:

- error: `EXPECTATION_PROVENANCE_MISMATCH`
- exit code: `3`
- mismatch output directory: absent
- `report.json`: not produced
- `report.md`: not produced

The fixture working tree was clean after validation and no auxiliary Change
Proof worktrees remained registered.

## Observed friction

Two non-blocking ambiguities were observed.

First, `candidateSha256` looks like a raw artifact SHA-256 but does not equal
`sha256sum candidate.json`. The public surface does not explain its canonical
lineage-digest derivation in detail.

Second, the exact fixture test command had to be inferred from the external
repository and the documented Node.js `node:test` execution model:

`node --test --test-reporter=tap tests/plan_panel.test.js`

The second item is primarily fixture-specific rather than a Change Proof
workflow defect.

Neither ambiguity prevented completion of the workflow.

## Classification

The result is `PASS WITH FRICTION`.

Every readiness question in the cold-start exercise was answerable from the
permitted public surfaces, and the complete workflow reached authoritative
evidence plus a successful fail-closed provenance check.

The result is deliberately not called independent-human validation.

## Beta.2 release interpretation

For this solo-maintainer beta, this fresh-session clean-room result is accepted
as sufficient usability evidence to proceed to preparation of a Beta.2 release
candidate.

This is an explicit Beta.2 release-process decision, not a claim that the
independent-human acceptance boundary was satisfied.

It permits preparation and review of a `0.1.0-beta.2` release-candidate change.
It does not authorize npm staging, npm approval, publication, Git tagging, or a
GitHub Release by itself.
