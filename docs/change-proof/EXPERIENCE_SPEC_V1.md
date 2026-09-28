# Change Proof — Experience Spec V1

Status: product-story lock candidate
Scope: flagship interactive web demonstration

## Product promise

Change Proof proves whether a selected test catches a specific recorded behavior change between BASE and HEAD.

The experience must make a first-time visitor understand:

1. what changed;
2. where it changed;
3. which test claims the behavior;
4. what HEAD actually does;
5. what BASE actually does with the same evidence;
6. whether the selected test distinguishes the revisions;
7. what evidence supports that conclusion.

## Core example

Area: Shipping

Boundary input:
5000

BASE implementation:
subtotalCents > FREE_SHIPPING_THRESHOLD_CENTS

HEAD implementation:
subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS

Selected test:
test/checkout.test.js

Expected:
true

HEAD observed:
true

BASE observed:
false

Conclusion:
the selected test catches the recorded boundary change.

---

# Global experience architecture

The experience uses three persistent information zones.

## LEFT — Narrative Rail

Purpose:
Explain what is happening now and why it matters.

The left side answers:

"What am I looking at?"

It contains:
- chapter number;
- chapter title;
- short explanation;
- only the information required for the current step;
- informational status when appropriate.

It is not a second dashboard.

## CENTER — Evidence Machine

Purpose:
Make the evidence relationship physical and memorable.

The machine is the primary object.

Its motion must always correspond to a semantic operation:

- locating a change;
- opening implementation;
- exposing a selected test;
- registering evidence against HEAD;
- moving the same evidence to BASE;
- revealing mismatch;
- producing the verdict.

No mechanical motion should exist only because it looks impressive.

## RIGHT — Evidence Console

Purpose:
Show the accumulating factual state of the investigation.

The console answers:

"What do we know so far?"

It is persistent across the experience.

It should update rather than be replaced by unrelated cards.

Core sections:

REVISION
BASE / HEAD

TRACE
01 Change
02 Implementation
03 Selected Test
04 BASE Replay
05 Verdict

OBSERVATION
input
expected
HEAD
BASE

STATUS

The console is an instrument, not a SaaS dashboard.

---

# Global chapter navigation

A restrained chapter indicator remains available after orientation:

CHANGE
HEAD
TEST
REPLAY
VERDICT

It communicates progress.

It is not primary navigation and should not compete with the machine.

---

# State sequence

## S0 — BOOT

Purpose:
Establish identity and prepare the scene.

Visual:
Black branded field.

Stable content:
CHANGE PROOF
EVIDENCE, NOT ASSUMPTION

One registration/rule motion may communicate readiness.

Rules:
- one composition only;
- no changing loading messages;
- no fake percentage;
- no duplicate loader;
- short;
- resolves directly into the scene.

Target duration:
approximately 1–1.5 seconds after resources are ready.

---

## S1 — ORIENTATION

Purpose:
Tell a new visitor what Change Proof actually does before showing an unexplained machine.

LEFT:

CHANGE PROOF

Prove that a test
catches the change.

Change Proof replays the same evidence
against BASE and HEAD and shows exactly
where behavior diverges.

Micro line:
ONE RECORDED CHANGE / ONE SELECTED TEST

CENTER:
Machine in neutral closed state.

RIGHT:
Minimal Evidence Console shell.

STATUS:
WAITING FOR RECORDED CHANGE

Action:
No click yet.

Transition:
Editorial content resolves into the recorded change.

---

## S2 — RECORDED CHANGE

Purpose:
Explain the concrete example before asking the user to investigate it.

LEFT:

01 / RECORDED CHANGE

One boundary changed.

BASE
> 5000

HEAD
>= 5000

At exactly 5000,
the behavior is different.

CENTER:
Shipping region becomes perceptually identifiable, but not covered by a large blue overlay.

RIGHT / EVIDENCE CONSOLE:

SHIPPING / CHANGE 01

REVISION

BASE
> 5000
recorded

HEAD
>= 5000
current

TRACE

01 Change
located

02 Implementation
—

03 Selected Test
—

04 BASE Replay
—

05 Verdict
—

STATUS
CHANGE LOCATED

Transition:
After reading time, interaction becomes available.

---

## S3 — TRACE READY

Purpose:
Transfer control clearly to the visitor.

LEFT:

01 / RECORDED CHANGE

Question:

Will this test
catch the change?

Status:
READY TO TRACE

CENTER:

A short cobalt registration line grows from the Shipping region.

Then:

TRACE SHIPPING →

appears as the primary local action.

The complete CTA remains visible.

It does not collapse.

RIGHT:

TRACE

01 Change
✓

02 Implementation
ready

STATUS
READY TO TRACE

Action:
TRACE SHIPPING →

---

## S4 — TRACE / IMPLEMENTATION

Purpose:
Move from the recorded change to the implementation that produced it.

CENTER:
Existing Shipping mechanical transition begins.

The motion communicates:

Shipping
→ implementation
→ selected boundary
→ selected test

LEFT progresses through short authored steps:

02 / TRACE EVIDENCE

Isolate Shipping.

Open implementation.

Locate the selected test.

RIGHT console progresses live:

01 Change
✓

02 Implementation
active → ✓

03 Selected Test
active

The console progression must synchronize with the machine rather than update randomly.

---

## S5 — HEAD OBSERVATION

Purpose:
Show what the current revision actually does at the exact changed boundary.

LEFT:

03 / HEAD

Current revision.

At the recorded boundary:

input
5000

observed
true

CENTER:
OPEN evidence surface.

Visible implementation relation:

subtotalCents
= 5000

FREE_SHIPPING_THRESHOLD_CENTS
= 5000

operator
>=

result
true

Selected test remains physically associated with the evidence surface.

RIGHT:

REVISION
HEAD / CURRENT

OBSERVATION

input
5000

expected
true

HEAD
true

BASE
—

TRACE

01 Change
✓

02 Implementation
✓

03 Selected Test
✓

04 BASE Replay
—

05 Verdict
—

STATUS
HEAD REPRODUCED

Primary action:

REVIEW SELECTED TEST →

---

## S6 — SELECTED TEST

Purpose:
Explain why this exact test matters before replaying it.

This replaces the current legacy INSPECT screen.

LEFT:

04 / SELECTED TEST

One test.
One boundary expectation.

test/checkout.test.js

input
5000

expected
true

Question:

Does the same test
reject BASE behavior?

CENTER:
Do not introduce a completely unrelated full-screen composition.

The selected test remains the same persistent evidence object already exposed by the machine.

It becomes the perceptual invariant for the next operation.

RIGHT:

SELECTED TEST

test/checkout.test.js

input
5000

expected
true

HEAD observed
true

BASE observed
—

STATUS
READY TO REPLAY

Primary action:

REPLAY AGAINST BASE →

---

## S7 — RE-REGISTER AGAINST BASE

Purpose:
Demonstrate Change Proof's central operation.

The SAME selected test/evidence region must visibly leave HEAD registration and register against BASE.

This must not look like loading another test.

LEFT:

05 / BASE REPLAY

Same test.
Earlier revision.

Replaying the exact boundary
against BASE.

CENTER:

The selected test is perceptually persistent.

HEAD registration releases.

The evidence object travels/re-registers against BASE.

BASE implementation becomes active:

subtotalCents
> FREE_SHIPPING_THRESHOLD_CENTS

Input remains:

5000

RIGHT:

REVISION

BASE
active

HEAD
reproduced

TRACE

01 Change
✓

02 Implementation
✓

03 Selected Test
✓

04 BASE Replay
active

STATUS
REPLAYING BASE

No new user action during the core replay motion.

---

## S8 — MISMATCH

Purpose:
Reveal the exact behavioral divergence.

LEFT:

06 / MISMATCH

Same input.
Same expected behavior.
Different observation.

expected
true

HEAD
true

BASE
false

CENTER:

BASE operator:

>

At:

5000

Result:

false

The mismatch should be visually obvious but precise.

Color semantics:
- cobalt = HEAD/current/selected;
- green = confirmed observation/pass;
- magenta = behavioral mismatch.

Do not turn the entire scene red.

RIGHT:

OBSERVATION

input
5000

expected
true

HEAD
true

BASE
false

DELTA
true → false

TRACE

04 BASE Replay
✓

05 Verdict
active

STATUS
BEHAVIOR DIVERGED

---

## S9 — VERDICT

Purpose:
Answer the original question explicitly.

LEFT:

07 / VERDICT

Caught.

This test catches
the exact recorded
boundary change.

Supporting text:

At 5000, HEAD returns true.
BASE returns false.
The selected test expects true.

CENTER:
Machine reaches a stable resolved configuration.

HEAD and BASE evidence relationships are understandable at a glance.

No unnecessary celebratory animation.

RIGHT:

CHANGE PROOF

VERDICT
CHANGE DETECTED

CHANGE
> 5000 → >= 5000

TEST
test/checkout.test.js

BOUNDARY
5000

EXPECTED
true

HEAD
true

BASE
false

STATUS
PROOF COMPLETE

Primary action:

VIEW PROOF PACKET →

Secondary:
REPLAY

---

## S10 — PROOF PACKET

Purpose:
Show that the conclusion is backed by inspectable evidence rather than cinematic storytelling alone.

This is a structured summary, not another cinematic chapter.

Include:

RECORDED CHANGE
BASE revision
HEAD revision

IMPLEMENTATION
function/file
changed operator

SELECTED TEST
path
input
expected

OBSERVATIONS
HEAD true
BASE false

VERDICT
selected test catches recorded boundary change

Potential future actions:
- copy proof reference;
- inspect raw evidence;
- open revision;
- replay experience.

This state must eventually be able to consume real Change Proof output rather than hardcoded presentation values.

---

# Evidence data contract

All visible evidence must originate from one structured data object.

Do not independently hardcode factual values across unrelated React components.

Conceptual schema:

EvidenceCase {
  id

  change {
    area
    boundary
    baseOperator
    headOperator
  }

  base {
    revision
    implementationPath
    observed
  }

  head {
    revision
    implementationPath
    observed
  }

  test {
    path
    input
    expected
  }

  verdict {
    catchesChange
  }
}

For the current demo:

area:
Shipping

boundary:
5000

baseOperator:
>

headOperator:
>=

test.path:
test/checkout.test.js

test.input:
5000

test.expected:
true

head.observed:
true

base.observed:
false

verdict.catchesChange:
true

---

# Color semantics

Neutral:
white / graphite / industrial gray

Cobalt:
current HEAD state
selected evidence
interactive registration

Green:
confirmed observation
successful reproduction

Magenta:
behavioral mismatch between revisions

Do not use color decoratively when it has no semantic job.

---

# Motion principles

Every animation must represent one of:

- reveal;
- registration;
- transfer;
- comparison;
- observation;
- resolution.

Avoid:
- decorative scanning;
- endless pulsing;
- generic glow;
- gratuitous parallax;
- dashboard animation;
- motion without semantic meaning.

Persistent evidence objects are preferred over replacing one card with another.

---

# Media plan

Current 16:9 media is temporary.

Final media pass happens only after the complete experience is locked.

Final Blender goals:

- genuine wide overscan;
- target master width approximately 3840×1440, subject to final viewport validation;
- preserve the approved central composition;
- native 60 fps;
- playbackRate 1;
- retain animated camera/lens behavior;
- final Shipping material/highlight treatment;
- exact IDLE → transition → OPEN registration;
- production encoding after render.

No further CSS mirror/feather/fake-overscan work.

---

# Current implementation status

Keep from V6:

- one boot owner;
- explicit interactionReady;
- current intro foundation;
- persistent TRACE DOM structure;
- one keyboard-accessible Shipping action;
- invariant IDLE / VIDEO / OPEN geometry;
- readiness fallbacks;
- cleaned CSS cascade.

Temporary / replace later:

- gutter matte;
- Proof Map;
- current TRACE visual weight;
- current OPEN-to-INSPECT progression.

Delete/replace conceptually:

- legacy INSPECT presentation.

---

# Acceptance principle

A first-time visitor who has never heard of Change Proof must be able to answer after one complete run:

1. What changed?
2. Which revisions were compared?
3. Which test was selected?
4. What input was replayed?
5. What did HEAD observe?
6. What did BASE observe?
7. Why does that prove the test catches the change?

If the experience cannot answer all seven clearly, it is not finished.