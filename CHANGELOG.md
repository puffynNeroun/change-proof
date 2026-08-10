# Changelog

All notable public changes to Change Proof are recorded here.

## 0.1.0-beta.1 - 2026-08-10

Initial public beta.

### Added

- Three-state evidence execution for exact base, exact head, and selected head-test-on-base State C.
- Explicit verdict model including `OBSERVED_TEST_DISCRIMINATION`, `NON_DISCRIMINATING_TESTS`, failure, invalid-envelope, operational, and inconclusive outcomes.
- Strict JSON configuration and bounded command execution.
- Detached Git worktree lifecycle with fail-closed ownership and cleanup checks.
- Explicit selected-path materialization and State C boundary validation.
- Exact nested `node:test` / TAP leaf-failure classification.
- Deterministic authoritative `report.json` and human-readable `report.md`.
- CLI commands for running evidence, version/help output, and repeatable verdict rejection through `--fail-on`.
- Packed-package consumer acceptance coverage.
- Linux/WSL and Node.js 24 beta support contract.
- Public GitHub CI, security policy, contribution guidance, release preflight, and bootstrap release controls.

### External validation

- Validated one bounded positive discrimination case against Rulden.
- Validated a second bounded nested `node:test` discrimination case against project-forge.

### Security and limitations

- Change Proof is for trusted repositories and trusted commands.
- Git worktrees are repository-state isolation, not a security sandbox.
- The beta does not claim Windows-native or macOS validation, arbitrary test-framework support, automatic dependency/test/command discovery, complete regression coverage, or general implementation correctness.
