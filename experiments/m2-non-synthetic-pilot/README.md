# M2.10 Non-Synthetic Pilot

This experiment runs the production Change Proof engine against a real historical change from the Rulden repository, not a generated fixture. The source repository is `https://github.com/ruldenhq/rulden.git`; the runner operates only on existing local Git objects and performs no network access.

## Immutable change

- Base: `2a47fb6b5b28579c30ef5cd52f11c13f594e71f9`
- Head: `d9ba86e32e991bdc1385d487f26f74c36dba122a`
- Subject: `feat: validate PR head and bound check watch`
- Changed implementation: `tools/forge-validator/src/pr-watch.mjs`
- Changed test: `tools/forge-validator/test/pr-watch.test.mjs`

State C starts at the exact base, includes only the changed test, and intentionally excludes the changed implementation.

## Expected evidence

- State A: `PASS`, 20/20 tests.
- State B: `PASS`, 24/24 tests.
- State C: `EXPECTED_TEST_FAILURE`, 24 tests with 16 passing and the exact eight expected failures.
- Boundary: valid; the selected test matches head and the excluded implementation remains at base.
- Verdict: `OBSERVED_TEST_DISCRIMINATION`.

This verdict means only that the explicitly selected head tests observed a behavioral difference against the exact base implementation.

## Run locally

```sh
node experiments/m2-non-synthetic-pilot/run.mjs \
  /path/to/local/rulden \
  /tmp/change-proof-m210-report
```

The command creates `report.json` and `report.md` after orchestration and owned-workspace cleanup succeed. This runner is an internal milestone experiment, not the public Change Proof CLI.

## Trust model and limitations

- The repository and test command are trusted local inputs; repository code is executed locally.
- No dependencies are installed or discovered.
- No relevant tests are discovered automatically; the test path is explicit.
- No network access is required or permitted for this pilot.
- Git worktrees isolate repository states but are not a security sandbox.
- Only the selected test path is transferred into State C.
- The result does not prove implementation correctness, complete-change correctness, complete test relevance, general causality, or production sufficiency.
