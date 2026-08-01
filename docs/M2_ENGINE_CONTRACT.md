# M2 Internal Engine Contract

## Status

- Status: Proposed
- Scope: M2 internal engine extraction
- Public API: No
- Baseline: M1 commit `6ed814815c6b030ebd1ffbda36bbbfb2657f4fd5`

## Purpose

M2 extracts the minimum reusable execution primitives required to run the Change Proof three-state evidence model without knowledge of the controlled fixture domain, fixture directory names, expected fixture SHAs, scenario names, or free-shipping behavior.

M2 is an extraction from the verified M1 experiment. It is not a rewrite, public SDK, universal test framework, package release, or GitHub Action.

## M2 outcome

At the end of M2:

1. The controlled M1 fixture consumes internal reusable primitives.
2. The four M1 scenarios retain their existing outcomes and verdicts.
3. M1 deterministic identities and cleanup behavior remain valid.
4. The same internal engine is exercised against one small non-synthetic Node.js repository.
5. Unsupported cases fail explicitly rather than being interpreted as behavioral evidence.

## Internal engine boundary

The internal engine may know about:

- repository roots;
- Git refs, commits, trees, paths, and blobs;
- State A, State B, and State C;
- explicitly declared envelope paths;
- owned workspace lifecycle;
- bounded process execution;
- normalized execution results;
- classified test evidence;
- boundary evidence;
- aggregate verdict evaluation;
- report construction.

The internal engine must not know about:

- `fixture/base`;
- `fixture/head`;
- `positive`;
- `non_discriminating`;
- `head_failed`;
- `base_failed`;
- the free-shipping product rule;
- the exact-threshold test name;
- expected controlled-fixture commit SHAs;
- expected scenario verdicts;
- controlled-fixture test counts.

Those details remain fixture-specific.

## Initial data contracts

These structures describe internal responsibilities. They are not a stable public TypeScript or JavaScript API.

### Repository selection

~~~text
RepositorySelection
  repositoryRoot
  baseRef
  headRef
~~~

Refs must be resolved before state construction:

~~~text
ResolvedRepositorySelection
  repositoryRoot
  baseSha
  headSha
~~~

`baseSha` and `headSha` must be immutable full commit identities.

### Command specification

~~~text
CommandSpecification
  executable
  arguments
  workingDirectory
  environment
  timeoutMs
  maxStdoutBytes
  maxStderrBytes
~~~

The bounded command runner must not require a shell command string.

### Envelope specification

The first generic envelope model is intentionally explicit:

~~~text
EnvelopeSpecification
  includedPaths
~~~

M2 does not automatically discover test dependencies.

### Execution result

~~~text
ExecutionResult
  exitCode
  signal
  timedOut
  processErrorCode
  stdout
  stderr
  stdoutTruncated
  stderrTruncated
  durationMs
~~~

`ExecutionResult` describes process behavior only. It must not contain a Change Proof verdict.

### Classified execution

~~~text
ClassifiedExecution
  outcome
  reasonCode
  testDiscovered
  testExecuted
  assertionObserved
  invalidFailure
~~~

Initial outcome vocabulary:

- `PASS`
- `TEST_ASSERTION_FAILURE`
- `TEST_DISCOVERY_FAILURE`
- `LOAD_FAILURE`
- `TIMEOUT`
- `PROCESS_FAILURE`
- `OPERATIONAL_ERROR`
- `INCONCLUSIVE`
- `NOT_RUN`

The controlled M1 adapter may map more specific internal outcomes back to the existing M1 manifest vocabulary.

### State evidence

~~~text
StateEvidence
  state
  commitSha
  execution
  classification
~~~

### Boundary evidence

~~~text
BoundaryEvidence
  basedOnBase
  selectedPathsMatchHead
  unchangedPathsMatchBase
  resultingChangedPaths
  boundaryValid
~~~

### Workspace evidence

~~~text
WorkspaceEvidence
  ownershipVerified
  removed
~~~

Absolute temporary workspace paths should not be required in the authoritative report.

### Evidence report

~~~text
EvidenceReport
  schemaVersion
  repository
  command
  envelope
  states
  boundary
  verdict
  reasonCodes
  warnings
  limitations
  cleanup
~~~

## Execution pipeline

The internal pipeline is:

1. Validate repository and command inputs.
2. Resolve base and head refs to immutable SHAs.
3. Determine changed paths.
4. Create and verify owned temporary workspaces.
5. Execute State A.
6. Stop state execution if State A does not pass.
7. Execute State B.
8. Stop before State C if State B does not pass.
9. Materialize the explicit envelope onto exact base.
10. Verify State C boundary evidence.
11. Execute State C.
12. Classify executions.
13. Evaluate the aggregate verdict.
14. Construct the report.
15. Clean all owned workspaces.
16. Record cleanup evidence.

## Required invariants

1. Base and head refs are resolved to full SHAs before execution.
2. State A represents exact base.
3. State B represents exact head.
4. State C is based on exact base.
5. State C receives only explicitly included paths.
6. State C resulting changed paths equal the materialized envelope.
7. Paths outside the envelope remain equal to base.
8. Selected materialized blobs equal their head blobs.
9. State B tests do not run after a non-passing State A.
10. State C is not constructed after a non-passing State A or State B.
11. A non-zero process exit is not sufficient discrimination evidence.
12. Operational failure takes precedence over behavioral verdicts.
13. Cleanup removes only workspaces with verified ownership.
14. The main repository checkout remains unchanged.
15. The generic engine contains no controlled-fixture expectations.
16. M1 behavior remains a regression contract during extraction.

## Envelope contract for M2

M2 supports only explicit repository-relative paths.

The report must distinguish:

- requested included paths;
- changed paths excluded from the envelope;
- paths actually materialized;
- resulting State C changed paths;
- base blob identities;
- head blob identities;
- materialized blob identities.

M2 does not support automatic dependency discovery, arbitrary globs, package installation, changed dependencies, or implicit helper selection.

## Test framework boundary

The first adapter remains:

~~~text
node:test with TAP output
~~~

Framework-specific classification must be isolated from process execution and verdict evaluation.

New frameworks should use structured reporters where possible. M2 must not attempt a universal regex parser for arbitrary console output.

## Verdict boundary

Verdict evaluation must be deterministic and side-effect free.

The evaluator receives state classifications and boundary evidence. It must not read files, execute Git, launch processes, inspect environment variables, or know fixture paths.

M1 verdict precedence remains the regression baseline:

1. `OPERATIONAL_ERROR`
2. `BASE_FAILED`
3. `HEAD_FAILED`
4. `INVALID_TEST_ENVELOPE`
5. `OBSERVED_TEST_DISCRIMINATION`
6. `NON_DISCRIMINATING_TESTS`
7. `INCONCLUSIVE`

## Report boundary

JSON remains the authoritative machine-readable report.

Report construction must be separate from:

- Git operations;
- process execution;
- framework classification;
- verdict evaluation;
- terminal rendering.

Raw unbounded process output must not be embedded in the authoritative report.

## Workspace and security boundary

Worktrees isolate repository state but do not sandbox code execution.

M2 is restricted to trusted local repositories controlled by the user.

M2 does not claim safe execution of untrusted pull-request code.

Owned workspace cleanup must remain fail-closed.

## Non-goals

M2 does not include:

- a public CLI;
- npm publication;
- GitHub Actions;
- untrusted PR execution;
- automatic envelope discovery;
- Jest, Vitest, and Mocha support;
- TypeScript build support;
- monorepo support;
- Windows-native support;
- dashboards or web UI;
- AI classification;
- plugin architecture;
- a dependency-injection container;
- a stable public SDK;
- a stable public report schema.

## Extraction sequence

The preferred extraction order is:

1. Pure verdict evaluation.
2. Pure report construction.
3. Pure boundary comparison.
4. Bounded process execution.
5. `node:test` TAP classification.
6. Git repository primitives.
7. Owned workspace lifecycle.
8. Envelope materialization.
9. M1 fixture migration to the internal engine.
10. One non-synthetic Node.js pilot.

Each extraction must preserve M1 behavior or include an explicitly reviewed report migration.

## M2 acceptance criteria

M2 is complete only when:

- the internal engine contains no controlled-fixture paths or domain expectations;
- the M1 fixture runs through the internal engine;
- all four M1 scenario contracts remain verified;
- M1 cleanup and failure-injection contracts remain verified;
- deterministic identities remain stable or an intentional migration is documented;
- verdict evaluation has table-driven tests;
- bounded execution has timeout and output-limit tests;
- State C boundary proof has dedicated tests;
- one non-synthetic local Node.js repository completes the supported flow;
- unsupported cases produce explicit reasons;
- the main checkout remains unchanged;
- no public compatibility claim is made beyond tested scope.

## M2.0 acceptance criteria

M2.0 is complete when:

- this contract exists;
- ADR 0002 exists;
- no M1 implementation file has changed;
- the M1 runner still reports `VERIFIED`;
- the documents are committed separately on an M2 branch.
