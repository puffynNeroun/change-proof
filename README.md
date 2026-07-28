# Change Proof

Change Proof is an early technical experiment investigating whether changed tests in a pull request can demonstrate an observable difference between a base implementation and a head implementation.

## Current status

**Research stage: M0 - product and evidence contract**

This repository currently contains research documentation only.

It does not yet contain:

- a CLI;
- a reusable execution engine;
- a GitHub Action;
- a supported public API;
- a published package;
- production-ready functionality.

## Research question

Can a local tool reproducibly show that an explicitly selected test change:

1. passes with the pull request implementation;
2. fails against the base implementation;
3. reaches the intended assertion rather than failing because the hybrid state is incompatible?

## Initial evidence states

- **State A:** base code with base tests;
- **State B:** head code with head tests;
- **State C:** base code with an explicitly selected test envelope from head.

A positive observation requires State A to pass, State B to pass, and State C to reach the intended regression-test assertion failure.

A non-zero State C exit code alone is not sufficient evidence.

## Non-claims

Change Proof does not claim to establish complete correctness, production safety, complete regression coverage, pull-request security, or universal repository compatibility.

## Project boundary

Change Proof is a standalone project. It is not a new Rulden version, a Rulden CLI extension, a renamed Rulden lifecycle, or a task artifact system.

## Documentation

- [Product hypothesis](docs/PRODUCT_HYPOTHESIS.md)
- [Evidence model](docs/EVIDENCE_MODEL.md)
- [Controlled fixture contract](docs/CONTROLLED_FIXTURE.md)
- [MVP limitations](docs/MVP_LIMITATIONS.md)
- [Falsification criteria](docs/FALSIFICATION_CRITERIA.md)
- [Decision 0001](docs/decisions/0001-three-state-evidence-model.md)

## License

No public license has been selected. Until a license is added, this repository should be treated as unpublished research material with no granted redistribution rights.
