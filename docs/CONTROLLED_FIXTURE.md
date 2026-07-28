# Controlled Fixture Contract

## Status

Proposed specification for the M1 controlled fixture.

The fixture implementation must not change this contract merely to obtain the expected result.

## Purpose

The fixture tests whether a changed regression test can distinguish a base implementation from a head implementation in a deliberately simple repository.

It tests the evidence mechanism, not general repository compatibility.

## Runtime boundary

The fixture uses:

- Node.js 24;
- JavaScript ESM;
- the built-in node:test runner;
- TAP reporter output;
- no external dependencies;
- no package manager installation;
- no build or compilation step;
- no snapshots, helpers, setup files, or external services.

## Repository files

The fixture contains exactly:

- package.json;
- src/qualifies-for-free-shipping.js;
- test/qualifies-for-free-shipping.test.js.

The package manifest exists only to declare ESM and the test command.

## Product rule

Free shipping is available when the subtotal is 50 or greater.

## Base implementation

The base implementation intentionally contains this defect:

```js
return subtotal > 50;
```

The exact threshold value 50 is incorrectly rejected.

## Base tests

The base test suite verifies:

- subtotal 49 returns false;
- subtotal 51 returns true.

The base tests intentionally do not check subtotal 50.

## Head implementation

The head implementation fixes the boundary condition:

```js
return subtotal >= 50;
```

## Head test change

Head adds exactly one regression case:

- subtotal 50 returns true.

The regression test name must be:

```text
allows free shipping at the exact threshold
```

## Test command

All three states use:

```text
node --test --test-reporter=tap
```

## Hybrid boundary

State C starts from the exact base commit and receives only:

- test/qualifies-for-free-shipping.test.js.

State C must not receive:

- src/qualifies-for-free-shipping.js;
- package.json;
- any other head file.

## Expected observations

- State A: PASS.
- State B: PASS.
- State C: TEST_ASSERTION_FAILURE.

State C must discover and execute the named regression test.

## Invalid State C failures

The result is inconclusive if State C fails because of syntax, import, load, configuration, dependency, setup, timeout, signal, or infrastructure errors.

## Determinism gate

The same SHAs, hybrid paths, test name, and execution outcomes must repeat across five consecutive runs.

## Stop condition

Do not proceed to M2 if the intended assertion failure cannot be reproduced without transferring the head implementation into State C.
