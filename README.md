# Change Proof

Change Proof is a research project investigating whether changed tests in a pull request can provide reproducible evidence that they distinguish a base implementation from a head implementation.

## Current status

**Research stage: M1 - controlled fixture implemented and verified**

The repository now contains an executable controlled experiment for the three-state evidence model.

Run it from the repository root:

```text
node experiments/m1-controlled-fixture/run.mjs
```

The current implementation is not yet a reusable CLI, general execution engine, GitHub Action, supported public API, or published package.

## Research question

Can a local tool reproducibly show that an explicitly selected test change:

1. passes with the pull request implementation;
2. fails against the base implementation;
3. reaches the intended behavioral assertion rather than failing because the hybrid state is incompatible?

A non-zero State C exit code alone is not sufficient evidence.

## Evidence states

- **State A:** exact base commit with base tests.
- **State B:** exact head commit with head tests.
- **State C:** exact base implementation with only the explicitly selected head test path.

A positive observation requires:

- State A to pass;
- State B to pass;
- State C to execute the named regression test;
- State C to fail at the expected assertion;
- the hybrid boundary to contain only the selected test path.

## Verified M1 scenarios

| Scenario | State A | State B | State C | Verdict |
| --- | --- | --- | --- | --- |
| `positive` | `PASS` | `PASS` | `TEST_ASSERTION_FAILURE` | `OBSERVED_TEST_DISCRIMINATION` |
| `non_discriminating` | `PASS` | `PASS` | `PASS` | `NON_DISCRIMINATING_TESTS` |
| `head_failed` | `PASS` | `INCONCLUSIVE` | `NOT_RUN` | `HEAD_FAILED` |
| `base_failed` | `INCONCLUSIVE` | `NOT_RUN` | `NOT_RUN` | `BASE_FAILED` |

The controlled orchestrator uses fail-fast execution:

- State B tests do not run when State A does not pass.
- State C is not constructed when State A or State B does not pass.

## Output contract

The entry point prints:

1. a concise scenario summary;
2. one JSON manifest between explicit begin and end markers;
3. one terminal status marker.

The current manifest identity is:

```text
schemaVersion: 0.1
experiment: m1-controlled-fixture
selectedTestPath: test/qualifies-for-free-shipping.test.js
```

The manifest records deterministic commit SHAs, state outcomes, hybrid-boundary evidence, cleanup evidence, checks, and aggregate verdicts.

Raw TAP output is used internally for classification but is not included in the normal runner output or JSON manifest.

## Exit codes

- `0` - all controlled scenarios were verified.
- `1` - execution completed, but one or more expected scenario contracts did not match.
- `2` - fixture preflight failed.
- `3` - the experiment encountered an operational error.

These codes belong to the controlled M1 runner and are not yet a stable public CLI contract.

## Determinism evidence

Five consecutive end-to-end executions produced:

- byte-identical runner output;
- byte-identical normalized JSON manifests;
- stable deterministic base and head commit SHAs;
- identical verdicts and state outcomes;
- no leaked owned workspaces;
- no changes to the main repository checkout.

## Current boundaries

M1 is intentionally limited to:

- local Git;
- Node.js 24;
- JavaScript ESM;
- the built-in `node:test` runner;
- TAP reporter output;
- one implementation file;
- one selected test file;
- no external dependencies;
- no package installation;
- no build step;
- no network, database, container, or external service.

Git worktrees isolate repository states. They do not sandbox executed code.

## Non-claims

The current result does not establish:

- complete implementation correctness;
- complete regression coverage;
- production readiness;
- security of arbitrary repository code;
- compatibility with general repositories;
- safe execution of untrusted pull requests;
- a stable public verdict or report API.

`OBSERVED_TEST_DISCRIMINATION` means only that the selected test envelope distinguished the recorded base and head states in the controlled environment.

## Project structure

- [`experiments/m1-controlled-fixture`](experiments/m1-controlled-fixture) - executable M1 experiment.
- [`docs/PRODUCT_HYPOTHESIS.md`](docs/PRODUCT_HYPOTHESIS.md) - product hypothesis.
- [`docs/EVIDENCE_MODEL.md`](docs/EVIDENCE_MODEL.md) - controlled evidence model.
- [`docs/CONTROLLED_FIXTURE.md`](docs/CONTROLLED_FIXTURE.md) - fixture contract.
- [`docs/MVP_LIMITATIONS.md`](docs/MVP_LIMITATIONS.md) - current limitations.
- [`docs/FALSIFICATION_CRITERIA.md`](docs/FALSIFICATION_CRITERIA.md) - stop and redesign conditions.
- [`docs/decisions/0001-three-state-evidence-model.md`](docs/decisions/0001-three-state-evidence-model.md) - evidence-model decision.

## Next research step

M2 may begin only after the final M1 repository review confirms that implementation, documentation, deterministic evidence, and safety boundaries agree.

M2 must extract reusable primitives without silently treating this fixture-specific implementation as a general engine.

## License

No public license has been selected. Until a license is added, this repository should be treated as unpublished research material with no granted redistribution rights.
