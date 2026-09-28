# Final implementation, visual calibration, and review

Updated: 2026-09-20. Branch: `feat/interactive-demo`. Baseline and final HEAD: `0bafe9f`.

## Gate and source audit

Before changes, the branch, clean working tree, expected HEAD, and absence of remotes all matched the required gate.

Read the complete handoff, interactive spec/brief, product truth, visual system, interaction/experience specs, motion spec, semantic anatomy/instrument documents, storyboard manifest, timing contract, README, and ignore rules. Visually inspected all five locked storyboard images. Read the actual Run 002 report and inspected the accepted V2 film through extracted review frames. Used the committed Ubuntu typography and the final handoff's semantic priority over older color/stack/verdict proposals.

The accepted blend, final working blend, and original V2 film retain their handoff SHA256 values. The demo's V2 copy is byte-identical to its source. No Blender process or HQ render was used.

## Implemented product

The complete application is under `apps/demo/`. React, TypeScript, Vite, pnpm, ESLint, and Vitest; no backend or runtime external requests. Truth, reducer state, media timing, and presentation are separate. See `README.md` for the exact stage-to-film mapping and local commands.

WATCH is an integrated silent-film transport with play/pause, progress, semantic chapter selection, replay, and return to preserved RUN progress. Context follows semantic chapters rather than per-frame React renders. It never calls the historical film exchange State A.

RUN is the exact nine-stage ordered walkthrough. Seek-and-pause anchors give deterministic accepted machine views. A uses a neutral hold with explicit documentary context. A is BASE + BASE tests → PASS; B is HEAD + HEAD tests → PASS; C is exact BASE + selected HEAD test → expected TRUE / actual FALSE / TEST_ASSERTION_FAILURE. The exact final human verdict is retained. Evidence and selected identity survive Previous, and Restart clears both.

The calibration changed presentation only: `proof.css`, one structural `proof-transport` wrapper in `App.tsx`, and the documentation. `proofData.ts`, `proofStages.ts`, `controller.ts`, `watchTimeline.ts`, `Context.tsx`, and `MachineStage.tsx` remain unchanged.

## Actual browser QA

Used the already-installed local **Chrome 153.0.8010.12** through Puppeteer. No browser download was required.

The final calibration was captured twice: once from the development server and once from the production build. Each pass produced 56 viewport/state screenshots (112 final captures total):

| Width | Browser viewport height | Captured and inspected states |
| ---: | ---: | --- |
| 1920 | 1080 | All nine RUN stages + WATCH |
| 1600 | 900 | IDLE, CHANGE, SELECTED TEST, STATE C, EVIDENCE, VERDICT, WATCH |
| 1440 | 900 | IDLE, CHANGE, SELECTED TEST, STATE C, EVIDENCE, VERDICT, WATCH |
| 1280 | 900 | IDLE, CHANGE, SELECTED TEST, STATE C, EVIDENCE, VERDICT, WATCH |
| 1024 | 900 | IDLE, CHANGE, STATE C, VERDICT, WATCH |
| 768 | 1024 | IDLE, CHANGE, STATE C, VERDICT, WATCH |
| 430 | 844 | IDLE, CHANGE, STATE C, VERDICT, WATCH |
| 390 | 844 | IDLE, CHANGE, STATE C, VERDICT, WATCH |
| 360 | 844 | IDLE, CHANGE, STATE C, VERDICT, WATCH |

Inspected wide contact sheets plus full-size desktop IDLE/CHANGE/SELECTED TEST/STATE C/VERDICT/WATCH, tablet CHANGE/STATE C/VERDICT, and mobile CHANGE/STATE C/VERDICT/WATCH renders. Compared the final 1920px states directly with the pre-calibration captures. This was actual rendered browser review, not a CSS-only check.

Artifacts outside tracked source:

- `/tmp/change-proof-baseline/`: pre-calibration 1920×1080 stage captures and metrics.
- `/tmp/change-proof-final-qa/qa.json`: development-build metrics, interaction assertions, console/network results, and 56 screenshots.
- `/tmp/change-proof-production-qa/qa.json`: matching production-build results and 56 screenshots.
- `/tmp/change-proof-final-qa/contact-{viewport}.jpg`: reviewed responsive contact sheets.
- `/tmp/change-proof-final-qa.cjs`: viewport, interaction, reduced-motion, media-fallback, touch-target, console, and overflow harness.

Automated browser assertions passed:

- Every RUN stage reached in exact order at 1920×1080 and the required key states rendered at all eight additional viewports.
- Selected-test identity absent before selection, present afterward, and retained during backward navigation.
- No future evidence before observation; A/B/C accumulate exactly; Restart resets to IDLE.
- Previous, contextual Next, Restart, mode switching, and Enter/Space keyboard operation.
- WATCH play/pause and semantic chapter seeking in both development and production builds.
- Reduced motion replaces RUN video presentation with accepted stills, hides the RUN video, removes CSS animation, and retains zero overflow.
- Zero horizontal overflow at all nine widths. Mobile buttons remain at least 44px high.
- V2 loads with intrinsic 540×960 dimensions and 39-second duration. Successful local media, fonts, script, style, and favicon requests. No external runtime requests.
- No JavaScript console errors, page errors, or failed requests in normal sessions.
- With the MP4 deliberately blocked in a separate session, the accepted still fallback appears and all RUN stages remain usable through VERDICT.

## Visual self-critique and corrections

| Challenge | Finding / resolution |
| --- | --- |
| Does this look like Change Proof? | Accepted machine, local production typography, quiet ivory/graphite structure, and precise semantic instruments; no card grid, dashboard chrome, or new machine geometry. |
| Is the machine central? | The wide film scales from 370px at 1280/1440 to 400px at 1600 and 420px at 1920. Side regions register inward but remain subordinate. Tablet retains a dedicated film column; mobile keeps the accepted 310px machine-first composition. |
| Is there enough negative space? | At 1920px the active evidence field is 1380px wide. The machine and context use that field confidently while the remaining space frames the instrument. Supporting narrative begins at 1214px and does not leak into the first viewport. |
| Is the boundary immediately legible? | Concise BASE/HEAD expressions isolate `>` and `>=`; the $50 / 5000-cent equality case is stated directly. Narrow-screen code remains readable without scrolling. |
| Is selection invariant? | Same pale-green identity component and exact test path persist from selection onward. A explicitly says that selected HEAD test is held aside. |
| Does C read as useful evidence? | Neutral page, exact pairing, explicit TRUE/FALSE comparator, and one thin magenta rule. No red or alarm treatment. |
| Does evidence feel earned? | Results appear only after the relevant observation. The final claim is bounded and supported by retained A/B/C facts. |
| Does WATCH belong to the same instrument? | Same video element/aperture and contextual presentation. Its wide-screen transport now uses one compact horizontal row so it remains visually attached to the machine. |
| Is mobile intentional? | Machine → context → test/comparator → evidence → controls, with no floating desktop windows. A sticky-control experiment covered the current heading; removed it and rerendered the full matrix. Final controls stay in document flow. |
| Verdict wrapping | The first calibration wrapped the wide verdict into four lines. Reduced it to a bounded two-line statement and rerendered the complete matrix. |
| Proof transport | Grouped evidence and controls under one flat ruled structure, aligned secondary actions, and retained the strongest forward action without adding rounded toolbar chrome. |
| Touch and focus | Expanded mode buttons to 44px. Made the skip link paint only when focused, preventing offscreen rendering in full-page captures while preserving keyboard access. |
| Payload and state correctness | Consolidated identical committed Ubuntu M/B files into one variable-font payload. Corrected the WATCH chapter selector to use React state rather than reading a ref during rendering. |
| Missing-media behavior | Added a source-level error handler and verified accepted-still fallback. An initial test assertion ran before the image decoded; corrected the test to await image readiness. |

## Final engineering results

| Check | Result |
| --- | --- |
| `pnpm --dir apps/demo lint` | PASS, no warnings |
| `pnpm --dir apps/demo typecheck` | PASS |
| `pnpm --dir apps/demo test` | PASS, 10 tests |
| `pnpm --dir apps/demo build` | PASS |
| Built app browser smoke | PASS |
| `git diff --check` | PASS |

Production JS: 245.25 kB / 75.86 kB gzip. CSS: 20.40 kB / 5.01 kB gzip. Fonts and film are local public assets, not runtime CDN dependencies. Only the V2 cut is included.

The first dependency installation was blocked by pnpm's external store permissions; the authorized install completed with esbuild explicitly allowed. ESLint was updated to the supported installed major. The first lint pass identified a ref-read issue in the WATCH selector; fixed before final checks. No failures are being suppressed.

## Limits and repository state

No known blocking visible defect remains in the inspected layouts. The accepted 540×960 film retains its existing softness and framing; no HQ substitute was generated. Verification covers local Chromium and responsive emulation, not physical iOS hardware, Safari, Firefox, or a formal screen-reader audit.

The app demonstrates the recorded experiment; it does not execute a real repository test process in the browser. This is stated in the documentation and identified as recorded Run 002 in the UI.

No commit, remote addition, push, deployment, merge, rebase, reset, Blender modification, HQ render, or FINAL_MASTER creation. All implementation files remain uncommitted. Existing tracked files are unchanged.

`git status --short`:

```text
?? apps/
```

## Exact created-file inventory

All paths below are relative to `apps/demo/`. No existing repository file was modified.

```text
.gitignore
README.md
QA_REPORT.md
eslint.config.js
index.html
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
tsconfig.json
vite.config.ts
public/mark.svg
public/fonts/LICENSE-Ubuntu.txt
public/fonts/Ubuntu-Variable.ttf
public/fonts/UbuntuMono-R.ttf
public/media/change-proof-v2.mp4
public/media/idle.jpg
public/media/request.jpg
public/media/change.jpg
public/media/selected-test.jpg
public/media/state-a.jpg
public/media/state-b.jpg
public/media/state-c.jpg
public/media/evidence.jpg
public/media/verdict.jpg
src/App.tsx
src/main.tsx
src/vite-env.d.ts
src/components/Context.tsx
src/components/MachineStage.tsx
src/data/proofData.ts
src/data/watchTimeline.ts
src/proof/controller.ts
src/proof/proofStages.ts
src/styles/tokens.css
src/styles/proof.css
tests/proof.test.ts
```

`node_modules/` and `dist/` are generated and ignored. Temporary browser artifacts remain under `/tmp/`.
