# Beta.2 independent cold-start validation

This protocol validates whether a new user can complete the unreleased Beta.2 assisted preregistration workflow from documented public surfaces without reading Change Proof source code.

It is a usability and workflow validation, not additional evidence semantics and not a release authorization.

## Preconditions

Use:

- a trusted external Git repository;
- an exact reviewed Change Proof `main` checkout or reviewed packed artifact;
- Node.js >=24;
- explicit BASE and HEAD refs;
- a real changed-test envelope suitable for the external repository.

Do not use the registry-installed `@changeproof/cli@beta` package for this validation while it still resolves to `0.1.0-beta.1`.

## Operator workflow

The operator should proceed from README and CLI help only:

1. create a prepare configuration;
2. run `change-proof prepare`;
3. inspect the complete candidate;
4. understand that the candidate is non-authoritative and is not a verdict or evidence report;
5. review the complete proposed State C failure set;
6. promote the whole eligible candidate;
7. run the promoted schema `0.2` configuration;
8. inspect `report.json` and `report.md`;
9. verify that expectation provenance is runtime-verified;
10. exercise one provenance mismatch and confirm that execution fails closed before authoritative reports are produced.

## Readiness questions

Record whether the operator can determine, without reading source code:

- how to construct the prepare configuration;
- what `prepare` observes and what it does not prove;
- what must be reviewed in the candidate;
- why selective failure acceptance is not allowed;
- how to promote the complete candidate;
- how to run the promoted configuration;
- what `EXPECTATION_PROVENANCE_MISMATCH` means;
- where authoritative evidence begins;
- which reports are authoritative;
- which steps cause material friction or ambiguity.

## Acceptance boundary

A successful cold-start means that, for the selected trusted repository and reviewed Change Proof build, an independent operator completed the documented workflow without reading source code and without violating the observed evidence boundaries.

It does not prove:

- general correctness;
- regression completeness;
- broad test-framework support;
- production readiness;
- sandboxing;
- absence of UX problems in other repositories.

Any UX change proposed after this validation should be tied to an observed operator failure or repeated friction. Do not expand product scope from hypothetical future needs.
