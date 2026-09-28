# Change Proof — Interactive Demonstration

Self-contained React / TypeScript / Vite application. No backend, external runtime service, analytics, authentication, or WebGL. Package dependencies are locked with pnpm.

From the repository root:

```sh
pnpm --dir apps/demo install --frozen-lockfile
pnpm --dir apps/demo dev --port 4173
```

Open **http://localhost:4173**. Node 22.13+ or Node 24 and pnpm 11.6.0 are suitable for the locked toolchain.

```sh
pnpm --dir apps/demo lint
pnpm --dir apps/demo typecheck
pnpm --dir apps/demo test
pnpm --dir apps/demo build
pnpm --dir apps/demo preview --port 4174
```

## Architecture and truth

- `src/data/proofData.ts`: exact fixture, selected-test identity, recorded revision IDs, A/B/C outcomes, and bounded conclusion.
- `src/proof/proofStages.ts`: the nine ordered manual stages, context roles, explanatory copy, film anchors, and forward actions.
- `src/proof/controller.ts`: deterministic reducer; Previous retains observed evidence and selection; Restart clears both. Switching modes preserves manual progress.
- `src/data/watchTimeline.ts`: contiguous semantic chapters across the accepted 39-second V2 film. No cinematic interval is called State A. A/B recorded evidence appears only when the film opens the evidence mechanism.
- `src/components/Context.tsx`: contextual technical instruments and accumulated evidence, with selected-test identity separate from the comparator.
- `src/components/MachineStage.tsx`: one shared portrait aperture, metadata preload, deterministic RUN seeking, WATCH transport, accepted-frame fallback, and reduced-motion stills. Transport time updates use refs; React receives chapter changes rather than per-frame updates.
- `src/App.tsx`: semantic layout, mode controls, live stage announcement, and bounded supporting narrative.
- `src/styles/`: local font definitions, semantic palette, responsive composition, and short contextual transitions.
- `tests/proof.test.ts`: ten semantic/state/timeline tests.

The authoritative sources are `docs/FINAL_RUN03_HANDOFF.md`, `docs/INTERACTIVE_DEMO_SPEC.md`, and the recorded Run 002 evidence. Earlier documents' red-mismatch language, broader verdict, Next.js/WebGL proposals, and older film duration are superseded by the final handoff and current implementation brief.

This application walks through recorded evidence; it does not execute repository tests in the browser.

## RUN mapping

RUN deliberately uses seek-and-pause anchors, avoiding timer-dependent bounded playback. The accepted physical machine is never recreated in CSS or WebGL.

| Stage | Film anchor | Context / observed evidence |
| --- | ---: | --- |
| IDLE | 0.8s | The missing proof; no results |
| REQUEST | 4.9s | Mechanical Keyboard, $50, shipping question |
| CHANGE | 10.5s | Shipping source path; `>` versus `>=` |
| SELECTED TEST | 12.9s | HEAD test, input 5000, expected TRUE |
| STATE A | 0.8s | Neutral machine hold; BASE + BASE tests → PASS |
| STATE B | 15.5s | HEAD + HEAD tests → PASS |
| STATE C | 26.0s | Exact BASE + selected HEAD test; expected TRUE / actual FALSE; TEST_ASSERTION_FAILURE |
| EVIDENCE | 28.7s | Retained A PASS / B PASS / C TEST_ASSERTION_FAILURE |
| VERDICT | 38.4s | THE SELECTED TEST / CATCHES THE CHANGE |

State A has no fabricated film segment. Its caption explicitly identifies the neutral machine view and recorded control. The selected HEAD test stays identified but is explicitly held aside in A.

## WATCH and interaction

WATCH starts paused. Play/pause, keyboard-operable range seeking, a semantic chapter selector, replay after the ending, and return to RUN share the same video element. The silent film uses `muted`, `playsInline`, `preload="metadata"`, and `object-fit: contain`. There is no alternate-cut download.

The selected test stays identified from selection through the verdict. RUN evidence records the furthest observed stage, so moving backward never loses observations or invents future ones. WATCH evidence instead follows the current time, including backwards seeking. No operational error color is used for a successful proof.

Wide desktop uses a fluid 370–420px film inside a 1380px evidence field, with contextual left/right regions registered toward the machine. Tablet combines the two contexts into one column beside the film. Mobile keeps the accepted 310px maximum and reorders the machine above the context, test/comparator, evidence, and 44px-or-larger proof controls. All film frames retain their original 9:16 aspect ratio and stay below the 540px source width.

Motion uses 220–320ms small reveals and operator seating. `prefers-reduced-motion` removes those animations and uses accepted stills for RUN; WATCH remains paused until explicitly played. Buttons, a skip link, visible focus, native range/select elements, and a restrained live stage announcement support keyboard and assistive technology. No global key handlers override browser behavior.

## Asset provenance

- `public/media/change-proof-v2.mp4` is a byte-identical copy of `renders/final/CHANGE_PROOF_FINAL_REVIEW_V2.mp4`.
- Film SHA256: `7624d4a53dbbedd6dd4260309394bf2b9322a186a45608c543d674a45cff93a2`.
- The nine JPEG anchors were extracted directly from V2 at the times above. No replacement imagery was generated.
- `public/fonts/Ubuntu-Variable.ttf` is the committed `Ubuntu-B.ttf` (identical to the committed `Ubuntu-M.ttf`), consolidated into one local variable-font payload.
- `public/fonts/UbuntuMono-R.ttf` and `LICENSE-Ubuntu.txt` are copied from committed production fonts.
- `public/mark.svg` is a small interface mark; it does not replace or simulate the Proof Machine.

The V2 film is 540×960, 24fps, 936 frames, 39 seconds, silent. The app displays it at or below native resolution. A future HQ file can replace the public asset without changing the application architecture; chapter timings must remain consistent or be updated in the dedicated timeline.

## Review evidence

See `QA_REPORT.md` for the actual local browser review and engineering results. Temporary screenshots and executable browser-review scripts are outside source at `/tmp/change-proof-demo-review/`.

Only `apps/demo/` is changed. Production source assets and repository history are untouched.
