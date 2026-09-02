# Change Proof Quickstart

A new regression test passing on new code does not show whether that test would catch the old behavior.

This quickstart creates a tiny deterministic Git repository with:

- a BASE commit containing a percentage-discount bug;
- a HEAD commit fixing that bug;
- one new regression test added at HEAD.

It then runs the published `@changeproof/cli@0.1.0-beta.2` package against those exact Git states.

## Run it

Requirements:

- Linux or WSL;
- Git;
- Node.js 24 or newer;
- npm;
- network access if npm has not cached the package.

From the Change Proof repository root:

~~~bash
node examples/quickstart/run.mjs
~~~

## Expected evidence

The important result is:

~~~text
state_a=PASS
state_b=PASS
state_c=TEST_ASSERTION_FAILURE
boundary=VALID
verdict=OBSERVED_TEST_DISCRIMINATION
cleanup=VERIFIED
~~~

The three states mean:

~~~text
State A
BASE implementation + BASE tests
PASS

State B
HEAD implementation + HEAD tests
PASS

State C
BASE implementation + explicitly selected HEAD test
EXPECTED ASSERTION FAILURE
~~~

The selected regression test therefore passed with the fix and was observed failing against the exact old implementation.

That is the bounded claim made by this demonstration.

## What the demo uses

The quickstart uses manually preregistered schema `0.1` expectations.

This is intentionally the shortest transparent path for demonstrating the core three-state evidence model. It does not hide the expected State C failure behind automatic discovery.

Beta.2 also provides the assisted:

~~~text
prepare -> human review -> promote -> run
~~~

workflow for producing a provenance-bound schema `0.2` configuration. That workflow is documented in the main project README.

## Output

The run writes generated artifacts under the ignored:

~~~text
examples/quickstart/.work/
~~~

directory.

The important files are:

~~~text
.work/output/report.json
.work/output/report.md
~~~

A committed example of the Markdown evidence report is available in [`sample-report.md`](sample-report.md).

## What this does not prove

This demonstration does not prove that:

- the implementation is generally correct;
- the pull request has no regressions;
- all relevant tests were selected;
- Change Proof supports arbitrary test frameworks or repositories;
- the executed repository code is sandboxed.

It demonstrates one bounded question:

> Were the explicitly selected changed tests observed distinguishing the exact base behavior from the exact head behavior?

The fixture is synthetic and deterministic. It is a demonstration of the public CLI contract, not a production-readiness claim.
