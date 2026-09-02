# Change Proof Evidence Report

## Verdict

**OBSERVED_TEST_DISCRIMINATION**

The explicitly selected head tests observed a behavioral difference against the exact base implementation.

## Reasons

- The selected head test failed at the expected assertion against the exact base implementation.

## Expectation Provenance

- Mode: manual preregistration.
- Runtime provenance verification: not applicable.

## Immutable Repository States

- Base: `"7fa4620d2d0d1cf6b204be5b2308ca43b94612f9"`
- Head: `"f81d165b648f799bb6802c2e62aa786f16725da5"`

## Command

```json
{
  "executable": "node",
  "arguments": [
    "--test",
    "--test-reporter=tap",
    "test/discount.test.mjs"
  ],
  "workingDirectory": "."
}
```

## Requested Included Paths

- `"test/discount.test.mjs"`

## Excluded Changed Paths

- `"src/discount.mjs"`

## States

### State A

- Outcome: `"PASS"`
- Commit: `"7fa4620d2d0d1cf6b204be5b2308ca43b94612f9"`
- Classifier reason: `"NODE_TEST_PASS"`
- Summary: tests=1, pass=1, fail=0, cancelled=0, skipped=0, todo=0.

### State B

- Outcome: `"PASS"`
- Commit: `"f81d165b648f799bb6802c2e62aa786f16725da5"`
- Classifier reason: `"NODE_TEST_PASS"`
- Summary: tests=2, pass=2, fail=0, cancelled=0, skipped=0, todo=0.

### State C

- Outcome: `"TEST_ASSERTION_FAILURE"`
- Commit: `"7fa4620d2d0d1cf6b204be5b2308ca43b94612f9"`
- Classifier reason: `"EXPECTED_ASSERTION_FAILURE_OBSERVED"`
- Summary: tests=2, pass=1, fail=1, cancelled=0, skipped=0, todo=0.

## Boundary

- Result: VALID.
- Based on exact base: yes.
- Selected paths match head: yes.
- Unchanged paths match base: yes.

## Cleanup

- Result: VERIFIED.
- Workspace removed: yes.
- Worktrees created: 3.
- Worktrees removed: 3.

## Limitations

- Only explicitly selected paths were evaluated.
- The result does not prove implementation correctness.
- Worktrees provide state isolation but not a security sandbox.
- Trusted local repository code was executed.
- Dependencies were not discovered automatically.
- Relevant tests were not discovered automatically.

## Warnings

- None.
