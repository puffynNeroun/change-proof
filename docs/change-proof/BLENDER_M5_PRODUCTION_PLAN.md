# Blender M5 production plan — M5A forensic audit

Status: **M5A complete; production proposal only. Stop before M5B implementation or rendering.**

Audit: `20260927T183752Z` (UTC). Repository: `<repo-root>`.
Locked Web snapshot: `.cp-tmp/v9-full-web-lock/20260927T213440`.
Evidence directory: `.cp-tmp/blender-m5-audit/20260927T183752Z/`.
Companion: [event contract](BLENDER_M5_EVENT_CONTRACT.md). Full object and animation inventories: [forensic inventory](BLENDER_M5_FORENSIC_INVENTORY.md).

## 1. Verified source and isolation

| Item | Verified value |
| --- | --- |
| Authoritative source | `blender/production/web/cinematic/change_proof_WEB_SHIPPING_TRANSITION_FINAL.blend` |
| SHA-256 | `f4cd9a8e872dc9386afb8508ab3c1f4697c4226aa528cc71e7d9acb63cbe1b3d` |
| Size | 1,964,207 bytes |
| Modification timestamp | `2026-09-22T01:13:55.625782286Z` (filesystem nanoseconds: `1790039635625782286`) |
| M5 working copy | `blender/production/web/cinematic/m5/change_proof_WEB_M5_WORKING.blend` |
| Copy state | Byte-identical copy, same SHA-256 and preserved modification timestamp; never saved through Blender in M5A |
| Blender executing the audit | 5.2.1 LTS, Windows build `9e2066aef7ef`, built 2026-08-25 |
| Stored file version | Blender data version `(5, 2, 44)`; distinct from runtime release string |

Hashes, sizes and timestamps were recorded **before** opening the copy or performing any in-memory projection experiment. Blender opened the byte-identical copy with `--disable-autoexec`; embedded source scripts were not executed. Inspection scripts contain no render or blend-save operation. Camera/resolution experiments existed only in the disposable Blender process. The source and copy remain unchanged.

The repository was already dirty, including Web files. `protected-before.json` and `protected-after.json` cover the source, locked snapshot, current Web source and production media. `integrity-result.json` records the final comparison. Existing edits were preserved. No commit, push, PR, deployment or Web integration was performed.

## 2. Render configuration verified in the file

| Setting | Value |
| --- | --- |
| Scene / active layer | `Scene` / `ViewLayer`; one enabled layer, no material override |
| Engine / device request | Cycles / GPU (physical device/backend availability must be rechecked at production time) |
| Dimensions / percentage / pixel aspect | 2560 × 1440 / 100% / 1:1 |
| FPS / base | 24 / 1.0 |
| Saved start / end / step / current | 107 / 279 / 1 / 107 |
| Time remapping | 100:100 |
| Samples | 48; adaptive sampling on, threshold 0.01, minimum 0 (automatic) |
| Denoising | OpenImageDenoise; HIGH quality, ACCURATE prefilter, RGB + albedo + normal; GPU denoise off |
| Bounces | Maximum 12; diffuse 4; glossy 4; transmission 12; transparent 8; volume 0 |
| Light tree / caustics | Light tree on; reflective and refractive caustics on |
| Color | AgX, Look None, exposure 0, gamma 1; sRGB display; no curve mapping or white balance |
| Film | Opaque; film exposure 1; transparent glass off |
| Motion blur | Off; dormant shutter value 0.5, centered |
| Pixel filter / randomness | Blackman-Harris, width 1.5; seed 0; animated seed off; pixel jitter off |
| Image output | PNG, RGB, 8 bit, compression 15, follows scene color management |
| Render border / cropping | Both off |
| Simplify / persistent data | Both off |
| Compositor / sequencer | Render toggles on, but no compositor node graph and no sequencer strips |
| World | `Studio atmosphere`; Background color `(0.4, 0.48, 0.56)`, strength 0.25 |

The saved output path points to an obsolete preview in Windows Downloads. M5B must override it with an explicit M5 run directory before any render. There are no external image dependencies. Three DejaVu fonts are packed, despite their old external source paths; Bfont is built in.

## 3. Camera: exact ownership and animation

Object: **`CP_SHIPPING_V5_1_CORRECTED_CAMERA`**.
Camera data: `CP_SHIPPING_V5_1_CORRECTED_CAMERA_DATA`.
Perspective; VERTICAL sensor fit; 36 × 24 mm sensor; clip 0.1–1000; shift X/Y 0/0 in the source. DOF disabled (dormant distance 10, f/2.8); no parent or constraints; scale `(1,1,1)`.

| Frame | Location XYZ | Rotation quaternion WXYZ | Lens |
| --- | --- | --- | --- |
| 107 | `(15.596451, -31.422789, 11.038825)` | `(0.73771650, 0.62928337, 0.15867096, 0.18601187)` | 58 mm |
| 279 | `(8.300000, -25.000000, 11.500000)` | `(0.77958643, 0.60337543, 0.10275192, 0.13275978)` | 60 mm |

Rotation mode is **QUATERNION**. The object's stored Euler properties are stale and must not be used to reproduce its evaluated orientation. Evaluated world Euler XYZ at 107 is `(1.41248393, 0.00000003, 0.49399388)` radians; at 279 `(1.31733084, 0.00000002, 0.33735400)`.

The layered action `WEB_HERO_CAM_V3_WIDEДействие.001` has multiple slots. The active camera object's slot is `OBCP_SHIPPING_V5_1_CORRECTED_CAMERA`; its seven channels are XYZ location and WXYZ quaternion. Each has 173 keys, every integer frame 107–279, BEZIER interpolation with AUTO_CLAMPED handles. Camera data owns lens and shift X/Y in slot `CAWEB_HERO_CAM_V3_WIDE`, also 173 keys/channel with those settings. Older camera slots coexist in this action. Do not flatten all action curves and accidentally apply a different slot.

Lens is 58 through 175, approximately 58.5 at 217, 59.2 at 250, and 60 at 279. Preserve the whole animated curve. Source shifts are keyed zero. Full keys, values and handles are in `animation-channels.json`; slot-aware ownership is also in the CSV.

## 4. Shipping hierarchy and semantic objects

```text
CP_COMMERCE_ROOT
├── CP-L0-PRODUCT-SURFACE                 upper product screens / Display crown
├── CP-L1-COMMERCE-BODY                   chassis, perimeter, Foundation
│   ├── CATALOG / CART / CHECKOUT / PAYMENTS / ORDERS
│   └── SHIPPING
│       ├── Shipping pan / upper shell / cutaway cheeks / retained runners
│       ├── Shipping fascia hinge
│       │   ├── Shipping face / Shipping inset face
│       │   └── Shipping name / engraved icon / index / execution contact
│       └── QUOTE_LAYER • src/shipping/quote.js
│           ├── CP-E0-EVIDENCE • retained evidence leaf
│           └── ELIGIBILITY_INSPECTION_ANCHOR • immutable revision frame
│               ├── CP-T0-SELECTED-HEAD-TEST
│               │   ├── Selected test rail / Selected test rail core
│               │   └── Selected test path / origin / expectation
│               └── ELIGIBILITY_LAYER • src/shipping/eligibility.js
│                   ├── ASSERTION_INTERFACE
│                   └── FUNCTION_STAGE • qualifiesForFreeShipping()
│                       ├── INPUT_SUBTOTAL / INPUT_THRESHOLD
│                       ├── COMPARATOR_SOCKET • CP-M0-BOUNDARY-JUNCTION
│                       │   ├── HEAD_OPERATOR / BASE_OPERATOR
│                       │   ├── Run02 retained exchange lift
│                       │   └── Run02 service bay hinge
│                       └── RESULT_PATH
└── INSPECTION
    ├── INSPECTION_DOCK
    └── CHANGE_PROOF_MODULE               excluded from Shipping production
```

Machine body meshes include `Continuous ivory perimeter`, `Recessed structural bed`, `Structural side spine` and `.001`, `Upper manifold`, `Lower structural sill`, `Cartridge surround`, `Foundation`, and `Foundation reveal`. The full parent/child list, including surrounds and support hardware, is in the inventory and raw audit.

| Meaning | Exact object(s) / content |
| --- | --- |
| Implementation frame | `ELIGIBILITY_LAYER • src/shipping/eligibility.js`; `Eligibility heading`; `FUNCTION_STAGE • qualifiesForFreeShipping()` |
| HEAD operator | `HEAD_OPERATOR symbol`, FONT body `>=`, under `HEAD_OPERATOR` |
| BASE operator | `BASE_OPERATOR symbol`, FONT body `>`, under matching parked `BASE_OPERATOR` |
| HEAD result | `Result true`, FONT body `true`, under `RESULT_PATH` |
| Existing BASE result | `Run02 actual false`, FONT body `false`, under the **same** `RESULT_PATH`, hidden in Shipping |
| Input / threshold | `INPUT_SUBTOTAL 5000` / `INPUT_THRESHOLD 5000`, both FONT body `= 5000` |
| Test identity | `Selected test path`: `test/checkout.test.js` |
| Test input / origin | `Selected test origin`: `SELECTED HEAD  /  INPUT 5000` |
| Test expectation | `Selected test expectation`: `expected true` |
| Revision identity | `HEAD identity`: `HEAD  3daeb8c`; hidden `Run02 BASE identity`: `BASE 9bc771b` |
| Intermediate revision label | Hidden `Run02 exchange identity`: `RECONSTRUCTING` |
| Other HEAD wording | `Boundary registration`: `SELECTED HEAD  /  IMPLEMENTATION`, under INSPECTION; this identifies test origin, not current evaluated revision |

**The selected HEAD test remains a selected HEAD test when replayed on BASE.** Keep its path, input, expected true, green rail, typography, geometry and parent chain. Change the implementation revision label, not the test-origin label. Physical hashes are authored labels; this audit verifies their presence, not their relationship to an external Git repository. The locked Web evidence case names HEAD and BASE without asserting revision hashes.

## 5. Materials and nodes

All slots below are **slot 0**, linked to DATA, and use node `Principled BSDF` linked to `Material Output`. Color tuples below are scene-linear RGB.

| Owner | Material / controlling sockets |
| --- | --- |
| `Shipping face`, `Shipping inset face` | `Shipping • stateful ceramic`: animated `Base Color`, source 107 ≈ `(0.71336,0.69905,0.66250)`, HEAD `(0.014,0.085,0.55)`; metallic .05, roughness .34 |
| Shipping name / index / engraved icon | `Run02 • Shipping inscription state`: animated Base Color from dark to `(0.86,0.88,0.84)` |
| `HEAD_OPERATOR symbol` | `Run03 • HEAD_OPERATOR inscription light`: Base Color `(0.86,0.88,0.84)`, metallic .1, roughness .28; emission strength 0 |
| `BASE_OPERATOR symbol` | `Run03 • BASE_OPERATOR inscription light`: presently dark `(0.035,0.045,0.05)` at HEAD; later legacy animation exists. M5B must explicitly author legible neutral porcelain lettering when registered |
| `Result true`, `Run02 actual false`, `Result caption` | `02 • porcelain enamel`; same neutral result lettering, no magenta required |
| `Selected test rail`, `Selected test rail core` | `09 • selected HEAD continuity`: `(0.32,0.62,0.35)`, metallic .05, roughness .45, emission strength 0 |
| Test labels / both 5000 values / revision labels | `06 • charcoal lettering` |
| Shipping execution contact | `FINAL execution Shipping execution contact`: cobalt Base Color; Emission Color `(0.015,0.21,0.95)`, strength .25 at HEAD |
| `Boolean output linkage` | `FINAL execution Boolean output linkage`; Base Color and Emission Color/Strength available for evaluation cue |
| Input routed paths | `Run03 • causal INPUT_SUBTOTAL routed input`, `Run03 • causal INPUT_THRESHOLD routed input`: Base Color and Emission Color/Strength |
| Assertion route | `Run03 • causal Actual into assertion`; keep dormant for this physical replay unless separately justified |

Node socket indices in this file are Base Color `inputs[0]`, Emission Color `inputs[28]`, Emission Strength `inputs[29]`. Use socket names when authoring; audit records retain exact paths. Existing materials `FINAL localized assertion magenta` and `Run02 • localized assertion magenta` belong to legacy disagreement apparatus. Do not activate that apparatus or recolor the BASE machine magenta. Cobalt continues to identify the selected Shipping route; green preserves the selected HEAD observation/test provenance; result false remains neutral.

## 6. Animation ownership and source hazards

The file has **548 objects, 149 actions, 154 animated datablock owners, and 590 bound F-curves**. Evaluating the bound curves at every integer source frame finds **79 changing channels across 24 owners** in 107–279, including inactive cameras and excluded apparatus. The full channel inventory includes static keyed properties, keyframe positions, values, interpolation, handles and out-of-window keys. The raw action-level dump includes multiple slots; use `animation-channels.json` for binding-correct owner attribution. It distinguishes local animation from inherited movement.

Principal source movement (ranges below identify integer sample changes, not Web event declarations):

| Owner | Changing properties / source frames | Interpolation |
| --- | --- | --- |
| Active camera object | Location + quaternion, 108–279 | BEZIER |
| Active camera data | Lens, 176–279 | BEZIER |
| SHIPPING | Local Y, 134–195; microscopic Z variation 154–155 | LINEAR baked keys |
| Shipping intermediate channel / `.001` | Y, 134–195 | LINEAR |
| Shipping execution contact | XYZ scale, 108–117 | LINEAR |
| Shipping retention tongue | Z, 119–132 | LINEAR |
| Shipping upper shell | Y/Z and X rotation, 195–206 | LINEAR |
| Shipping fascia hinge | Y/Z, 202–279; X scale, 246–279 | LINEAR |
| Shipping cutaway cheek / `.001` | Y/Z scale, 202–279 | LINEAR |
| QUOTE_LAYER | Y 205–279; Z 205–216; X rotation 213–222; XYZ scale 220–279 | LINEAR |
| Run02 captive anatomy strut 0 / 1 | Location, rotation and Z scale following unfolding, 205–279 | LINEAR |
| Shipping ceramic / inscription node trees | Base Color RGB, 108–120 | LINEAR in this window; mixed legacy interpolation outside it |
| CHANGE_PROOF_MODULE (excluded) | Y 165–188 | LINEAR |
| Run02 dock retained approach tongue (excluded) | Y and Y scale 161–188; visibility switch at 161 | LINEAR / CONSTANT visibility |

`CP-T0-SELECTED-HEAD-TEST` has no own action; its world pose follows its anchor and quote frame. Operator and result inscriptions have visibility animation even though their Shipping state is constant. Material node actions, inactive cameras, and later text-data animation exist; retiming only transform actions would be incomplete.

No shape keys, constraints, drivers, NLA strips, geometry nodes, particle systems or rigid-body simulations were found. Modifiers are 392 BEVEL, 369 WEIGHTED_NORMAL and one BOOLEAN; no modifier property animation or F-curve modifiers were found. No compositor animation is involved. Embedded text notes are historical documentation, not executable handlers.

### Reopened source does not fully reproduce the render script

`.cp-tmp/shipping_final_hq.py` saved this FINAL file and rendered 87 frames with a runtime override: `CHANGE_PROOF_MODULE` plus all descendants (91 objects total) and `Run02 dock retained approach tongue` hidden (92 exclusions total), `INSPECTION_DOCK` visible. The newly loaded copy has **no frame-change/render-pre handlers**. On frame evaluation, the module's hide flag becomes false and the tongue becomes visible at 161. Parent-empty visibility alone does not hide its renderable children.

M5B must replace those transient overrides with explicit persistent per-object visibility in its derived scene, removing conflicting legacy visibility channels for the exclusion set. Check every descendant at arbitrary frame order and after reopening the M5 file. Keep the inspection dock visible. This is a verified production dependency, not a proposed visual redesign.

Source animation continues beyond 279: the quote frame, fascia and their dependent evidence still change at 280. **279 is the production endpoint, not a globally frozen end of the legacy scene.** Clamp/freeze all inherited state for OPEN holds and BASE replay. Do not extend the render range into old story chapters.

## 7. Endpoint verification and timing provenance

Actual production media inspected: `apps/demo/public/cinematic/shipping-final/idle.png`, `open.png`, `transition.mp4`.

* IDLE PNG has embedded Frame **107**, Scene `Scene`, active corrected camera, 48 samples. It is byte-identical to historical HQ `shot_0000.png`. Visually: closed Shipping, complete upper display and six-service machine.
* OPEN PNG has embedded Frame **279** with the same scene/camera settings. It is byte-identical to `shot_0086.png`. Visually: cobalt Shipping open, implementation visible, **>=**, **true**, both **5000** values, green selected test with **expected true**. This is the authoritative production HEAD endpoint. Do not substitute 277, 278 or 280.
* Existing 3200-wide reference metadata also identifies 279; its script does not restore the original render-time visibility handlers, so it is useful for overscan geometry but cannot alone certify chapter visibility.

`ffprobe` confirms H.264, 2560×1440, 24/1 fps, 100 frames, 4.166667 seconds, no audio, 3,323,072 bytes. The locked component uses playbackRate **0.86**. Matching all decoded video frames to the 87 historical PNGs at 160×90 gives MAE 0.185–0.240 gray levels out of 255:

* Video indices 0–8 match source 107.
* Indices 9–94 match source 109,111,…,279 in order.
* Indices 95–99 match source 279.

Thus the 100-frame file is consistent with **8 added leading samples + 87 STEP=2 samples + 5 added trailing samples**. This correspondence is based on measured image content and the actual rendering script; the original encoding command was not recovered. This decoding analysis did not encode media or render Blender frames.

| Duration definition | Calculation | Seconds |
| --- | --- | --- |
| Authored source endpoint interval | `(279−107)/24` | 7.166667 |
| All 173 source frames as a 24 fps file | `173/24` | 7.208333 |
| Hypothetical endpoint interval at .86 without STEP=2 | `172/(24×.86)` | 8.333333 |
| Actual current MP4 | `100/24` | 4.166667 |
| Actual perceived Web duration | `100/(24×.86)` | **4.844961** |
| Actual perceived motion interval | `86/(24×.86)` | **4.166667** |
| Proposed native 60 fps file | `291/60` | **4.850000** |

Preserving the full legacy 24 fps scene duration and preserving current Web pacing are different goals. Recommendation: preserve **current approved Web pacing**, including holds, because that is the observed production behavior. The source-only duration option would be about 7.2 seconds (or 8.38 at .86), and is not silently substituted.

## 8. Proposed native 60 fps construction

This is an exact **proposed mapping**, not a built timeline or final event manifest.

Create isolated scene `M5_SHIPPING_60` in the M5 derivative. Set fps 60, fps_base 1, frame step 1. Proposed frames **1–291**:

* Frames 1–23: hold the exact source-107 state.
* Frames 24–274: native scene evaluations from source 107 through 279, inclusive.
* Frames 275–291: hold the exact source-279 state.

For output Blender frame `F`, evaluate original source time:

```text
source_frame(F) = clamp(107 + (F − 24) × 86/125, 107, 279)
forward mapping: F = 24 + (source_frame − 107) × 125/86
```

This gives 250 motion intervals at 60 fps = 4.166667 seconds. The proposed lead is .383333 seconds, HEAD first arrives at 4.55 seconds, and it remains displayed through exclusive end 4.85 seconds. Total differs from current perceived playback by 5.04 ms. Those numbers are timing design targets, not final semantic event observations.

Build single-user scene/object actions and camera/material node data where isolation requires it. Resample the evaluated original properties at the formula's fractional source times, or affine-retime bound keys **and their Bezier handles** with identical results. Preserve original interpolation and quaternion orientation; do not replace the lens curve. For a sampled implementation, bake continuous values at every native frame and evaluate fractional-time equivalence before removing source dependencies. Visibility uses CONSTANT steps and explicit ownership. Freeze properties outside the window, including material/visibility state and inherited transforms; retain all necessary dependency owners, not merely the 24 owners that change.

No optical flow, duplicate intermediate motion frames, or 24-to-60 encoder conversion. Static endpoint holds may reuse an identical rendered still, but every changing motion sample must come from Blender's scene evaluation. Motion blur remains off initially, so typography and current appearance remain consistent.

Create separate `M5_HEAD_BASE_60` from the corrected frozen HEAD endpoint. Freeze camera, lens, source parents, selected test, inputs, unrelated drawers and lights; author only the scoped mechanical exchange. Proposed duration **3.2 seconds / 192 frames**, review range 3.0–3.5 seconds (180–210 frames). Do not run legacy source frames 356 onward as the new film: they contain unrelated chapter ownership, camera and assertion behavior.

## 9. Physical HEAD → BASE implementation

**Use the existing matching operator inserts, existing neutral false inscription, and existing revision-label pair.** The scene structure supports this directly.

### Operator and registration

`HEAD_OPERATOR` sits at socket-local `(0,0,0)`. `BASE_OPERATOR` is parked at `(0,2.3,-1.17)`. Their inserts use graphite, titanium mounts and slate mount slots. Both symbols are DejaVu Sans Mono, size .69, extrusion .001. The common socket has physical keyed rails and a recess; the existing exchange lift, guide rails and service bay provide the motion vocabulary.

Legacy keys provide a useful travel reference: HEAD pulls forward toward Y −.55, lowers toward Z −1.17, moves toward X .96 and parks at Y 2.3. BASE comes forward from `(0,2.3,-1.17)` toward `(0,−.55,−1.17)`, rises to Z 0, then seats at `(0,0,0)`. Re-author a short exchange from those waypoints with smooth acceleration and settling. Open the existing service-bay cover only as much as clearance requires. This path is **not yet collision-validated at the frozen OPEN scale**. Inspect the keyed rails, cover, selected-test rail and insert backing during M5B timeline construction; adjust local travel/cover clearance only.

Keep both roots and backing meshes physical. Use explicit CONSTANT visibility only for hidden/occluded stow states and inscription registration. Do not make an exposed insert pop or teleport; do not animate a text body's string. Author a neutral, readable BASE glyph material from the HEAD inscription treatment with independent ownership, because the BASE symbol is currently dark at the Shipping endpoint.

### Result and revision text

`Result true` and `Run02 actual false` already share the same local transform `(0,−.155,−.1)`, font, .3 size, .001 extrusion and `02 • porcelain enamel`. Retain `Result cradle`, `Boolean enamel` and `Result caption`. During release, retract the true inscription just behind the existing opaque slate face; switch its visibility only when occluded. After the operator is seated and the existing input/output linkage conveys evaluation, bring the existing false inscription into the same reading plane and settle it. Avoid changing the whole result apparatus. Confirm the five-letter false fits with comfortable clearance.

Use the existing `HEAD identity` and `Run02 BASE identity` at their shared anchor, matching BASE's size to the HEAD label if needed for equal registration. Reveal BASE at registration; hide HEAD then. Keep physical hash labels only if their authored evidence provenance is accepted; otherwise the eventual authoring decision is to show plain HEAD/BASE consistently, with no invented hash. No label edit is performed in M5A.

### Choreography proposal (timing windows, not final frames)

| Approximate elapsed window | Mechanical meaning |
| --- | --- |
| 0–.35 s | Stable corrected HEAD: >=, true; same test visible |
| .35–.60 s | Registration releases; result retracts, receiver/lift engages |
| .60–1.25 s | HEAD insert stows through the service-bay path; test and both inputs stay fixed |
| 1.25–1.65 s | BASE insert approaches and seats in the same comparator socket; BASE label registers |
| 1.65–1.95 s | `>` fully readable; brief mechanical settling |
| 1.95–2.25 s | Existing routed-input/output accents convey evaluation at 5000; no decorative effects |
| 2.25–2.65 s | Neutral false inscription resolves in the existing result window |
| 2.65–3.20 s | Stable BASE hold: `5000 > 5000 → false`, same selected test still expects true |

The selected test hierarchy and both input plaques are invariants throughout. Quantitatively compare world matrices (maximum element delta ≤1e-6) and text/material identities at every replay frame; invariant projected anchors must remain within 0.5 master pixel. Do not recolor its green strip, replace it with a different card, move the camera during BASE, or preannounce false in Web UI. Semantic events must follow actual observable states.

## 10. Wide master and responsive crop contract

**Retain 3840 × 1440, 100%, square pixels, VERTICAL sensor fit.** At any unchanged camera pose/lens, source point `(x,y)` in 2560×1440 becomes `(x+640,y)` in 3840×1440. The 2560 core is rectangle **x=[640,3200), y=[0,1440)**. Active lens animation does not break this relationship.

The audit projected object bounding boxes at 13 source frames and both widths. The maximum numeric discrepancy over all objects, including distant/offscreen geometry, was **0.01465 px**. This establishes central projection preservation. Thirty rays per endpoint across the new side wings (including near-edge and top/bottom samples) all hit **`Seamless cyclorama`**. There is genuine existing geometry; no compositor, mirrored scenery, 2D extension or extra camera zoom is needed to fill the sides. Ray samples do not certify lighting, finite-geometry edges at every pixel, or render noise; that remains M5B visual acceptance.

Future Web mapping: fit the **2560×1440 core**, with `s=min(W/2560,H/1440)`, and display the full master at `3840s × 1440s`, centered. Use one transform for IDLE, both films and endpoint stills. Do not use cover on the entire 8:3 master, which would change machine scale.

| Viewport | Scale | Visible master X interval | Vertical behavior |
| --- | --- | --- | --- |
| 2560×1320 | 11/12 | `[523.636,3316.364)` | Full 1440 source pixels scaled to 1320; real side overscan fills width |
| 2560×1440 | 1 | `[640,3200)` | Full height |
| 1920×1080 | .75 | `[640,3200)` | Full height |
| 1440×900 | .5625 | `[640,3200)` | Image height 810; 45 px presentation margin above/below |
| 3440×1440 | 1 | `[200,3640)` | Full height; 440 extra source px per side beyond core |

Horizontal overscan cannot create extra vertical scenery for 16:10. Preserve the deliberate presentation field at 1440×900; do not crop away the test/foundation to remove it. The existing Web remains untouched in M5A.

## 11. OPEN top-crop diagnosis and candidate correction

The crop is in the **authored camera composition**, not a consequence of Web responsive cropping. The production open.png cuts through the upper display. At source frame 279, `Display crown` projects to Y **−279.85…141.03**, while `Foundation` reaches Y **1408.30**. No render border is enabled. Locked V9 centers a contained 16:9 media rectangle at each target viewport; it is not removing these 280 pixels. Widening at constant height preserves the same Y values and cannot fix it. The crown is static in machine space; the Shipping camera approaches the evidence.

A pure upward framing translation would push the foundation/Shipping down out of frame: the protected crown-to-foundation span is about **1688 px** in a 1440 px image. Full crown, full base and exact old pixel scale cannot all be preserved simultaneously.

**Proposed M5B candidate:** retain every authored lens value and quaternion; soften the final camera approach with a camera-local backward offset that is zero at source107 and smoothly reaches approximately **6 world units** at source279, plus vertical sensor shift reaching approximately **+0.087835**. This is a quantified fit candidate, not a saved edit. For the evaluated protected bounds, it places crown-to-base around Y **33.65…1406.35**. The protected span becomes about 81% of the old span; foreground evidence becomes approximately 79% of its old size. This is the smallest tested candidate with roughly 32 px top/bottom clearance; a 5-unit offset provides only ~12 px clearance. A 7-unit candidate provides ~54 px but sacrifices more scale.

The correction is for upper identity and frame clearance, not horizontal edge coverage. It must taper through the existing Shipping approach, with zero change at IDLE, then freeze for HEAD and BASE. Verify evidence readability at 100%, especially result and threshold identifiers, before accepting the ~20% reduction. No uncontrolled lens replacement, machine relocation or new BASE camera move. The fit estimate covers specified protected objects, not a final collision/occlusion/lighting approval.

This intentional OPEN reframe changes its registration against **old** open.png. Therefore use two distinct checks: an unchanged-pose overscan control proves exact old registration; the corrected HEAD becomes the approved M5 reference for all subsequent endpoints. Never claim the corrected candidate is pixel-identical to old OPEN. M5B must explicitly approve the readability/identity tradeoff. If it fails, stop that gate and revise the framing proposal; do not silently shrink further or crop evidence.

## 12. M5B validation — four stills maximum

All four renders below are **3840×1440**, Cycles 48 samples with the same color/denoise settings. No animation render before endpoint approval. Reuse existing 2560 references; do not add reference renders beyond this four-still budget.

| Order / filename | Scene / frame specification | Purpose and checks | Registration |
| --- | --- | --- | --- |
| 1 `m5b_01_idle_wide.png` | Proposed `M5_SHIPPING_60`, `shipping.start`; source107 equivalent (proposed F1) | Full identity, closed Shipping, side scenery, no unwanted legacy apparatus | Center crop must align to approved idle.png; no camera correction at IDLE |
| 2 `m5b_02_head_overscan_control.png` | Temporary `M5_OVERSCAN_CONTROL`, source279; original camera/shift/lens, explicit production visibility | Necessary diagnostic: verify genuine horizontal scenery and baseline registration; old top crop is expected in this control | Center crop aligns to approved open.png; inspection dock/tongue exclusions match production |
| 3 `m5b_03_head_open_wide.png` | Proposed `M5_SHIPPING_60`, `shipping.head_stable`; source279 equivalent after candidate framing correction (proposed F274) | Approve crown clearance, readable >=/true/both5000/test, Shipping finish and legibility; inspect five crop windows | Compare to control and record intentional anchor deltas; this becomes M5 HEAD reference |
| 4 `m5b_04_base_wide.png` | Proposed `M5_HEAD_BASE_60`, terminal BASE hold; proposed review F192 for the 192-frame budget, confirmed when authored | > / false, BASE label, neutral machine, same test/input/expectation; no hidden HEAD glyph or result; clean insert seating | Camera, selected test, inputs and unrelated machine align exactly to corrected HEAD |

These symbolic scene/event names describe future authored states; final event frame numbers remain unassigned. Diagnostic #2 is justified by the missing source visibility override and the need to distinguish widening from framing correction. No fifth still is planned. View crops, overlays and magnified details derived from these four images do not require additional renders.

## 13. Measurable registration acceptance

1. Center-crop wide candidates using integer rectangle `(left=640, top=0, width=2560, height=1440)`, i.e. pixels X640–3199, Y0–1439. Compare #1 to existing idle.png (107), #2 to existing open.png (279).
2. Use the same AgX/None/exposure/gamma and display encoding. Match visibility overrides and sample/denoise settings. Produce blink views, a 50% overlay and an edge difference view from existing images.
3. Measure at least eight distributed anchors: crown corners, Shipping face corners, comparator receiver corners, result cradle, both input plaques and selected-test rail corners (visible anchors appropriate to each state). Target unchanged projected anchors within **0.5 source pixel**, with up to **1 pixel** raster edge uncertainty after denoising. No rotation, shear or scale drift accepted for the control. Inspect geometry, glyph baselines and shadow contact manually.
4. Optional image diagnostics for the unchanged-pose control: SSIM ≥ .98 and PSNR ≥ 35 dB on matched, opaque regions are investigation thresholds, not automatic acceptance. Stochastic sampling/denoising can change pixels across resolutions even when projection is identical. A passing full-frame metric must not conceal an incorrect operator, stray tongue or clipped text.
5. Corrected HEAD #3 is compared to #2 with a documented intentional camera delta, not the unchanged-pose thresholds. Export actual corrected evidence anchor coordinates to the final manifest. BASE #4 must match corrected HEAD on all invariant anchors; mask only deliberate operator, result and revision changes for diagnostics.
6. After eventual films exist, first Shipping frame ↔ IDLE, last Shipping frame ↔ HEAD, first BASE film frame ↔ HEAD, last BASE film frame ↔ BASE must share exact camera/state and stable endpoint color. Check decoded delivery handoffs as well as master frames. This is future validation, not an M5A encode.

## 14. Deterministic output set

Authoring stays in `blender/production/web/cinematic/m5/`. Proposed render run root:

```text
renders/web/m5/v01/
  validation/m5b_01_idle_wide.png
  validation/m5b_02_head_overscan_control.png
  validation/m5b_03_head_open_wide.png
  validation/m5b_04_base_wide.png
  masters/stills/cp-m5-idle-3840x1440.png
  masters/stills/cp-m5-head-open-3840x1440.png
  masters/stills/cp-m5-base-3840x1440.png
  masters/shipping/cp-m5-shipping-000001.png
  masters/head-base/cp-m5-head-base-000001.png
  delivery/cp-m5-idle-3840x1440.webp
  delivery/cp-m5-head-open-3840x1440.webp
  delivery/cp-m5-base-3840x1440.webp
  delivery/cp-m5-shipping-3840x1440-60.mp4
  delivery/cp-m5-head-to-base-3840x1440-60.mp4
  delivery/cp-m5-events.v1.json
  delivery/cp-m5-assets.sha256
```

A run version is immutable after approval. Keep all six required assets under the same version with source hash, working blend hash, render settings, native frame provenance and checksums. Use one endpoint frame for both still and film handoff. Do not copy anything into Web public assets in M5A. The proposed manifest structure and events are in the companion contract; final event fields remain null until authored and visually verified.

## 15. Render workload and safe optimizations

Historical PNG metadata from **87 actual HQ source frames** gives 6.18–6.85 seconds/frame, median **6.23**, mean **6.274**, at 2560×1440 / 48 samples. This is better evidence than a generic GPU estimate, but current hardware/backend/load has not been benchmarked. Audit runs requested no renders.

At 3840×1440 the pixel count is 5,529,600, **1.5×** the old render. First-order estimate: **9.41 seconds/frame** under similar conditions. Adaptive sampling, new view coverage, scene setup, PNG writing and different hardware can change this.

| Film | Proposed frames | Estimated serial render time |
| --- | --- | --- |
| Shipping | 291 | ~45.6 minutes |
| HEAD → BASE | 192; likely 180–210 | ~30.1 minutes; ~28.2–32.9 |
| Total | 483; range 471–501 | ~75.8 minutes; ~73.9–78.6 |

Budget roughly **1.5–2 hours** for a successful full run including overhead on comparable hardware; failures/revisions are additional. Maximum theoretical 48-sample work is ~128.2 billion pixel-samples for 483 frames, before adaptive termination and path depth. Static-hold reuse may reduce unique rendering work only after state equality is proved. Four validation stills add about 38 seconds of render time plus process/setup costs on the historical speed model.

Safe initial optimizations: enable persistent data within a render process; confirm the intended GPU backend/device; use deterministic checkpointed image sequences and skip verified completed frames; keep the known excluded apparatus persistently hidden; reuse identical static hold frames. Forty-eight samples with denoising is already modest. Do not reduce samples, bevels, normals, shadow quality, transmission, texture fidelity, or the render dimensions merely to lower payload. Caustics/bounce reductions are not presumed safe; leave them as audited unless a specific costly contribution is demonstrated and visually approved.

## 16. Master and Web encoding plan — do not execute in M5A

**Master:** lossless 3840×1440 RGB PNG image sequences at native 60/1. Recommend 16-bit display-referred PNG using the approved AgX→sRGB view for gradients and downstream conversion; compare to the 8-bit source at validation. Preserve the working blend and settings so a linear EXR rerender remains possible; no extra EXR render is required for this pass. Stills come from the exact endpoint samples. Never apply AgX a second time during encoding.

**Delivery film:** H.264 MP4 / `libx264`, High profile, level 5.2 candidate, `yuv420p`, constant 60/1, 3840×1440, square pixels, no audio, `+faststart`, preset slow, start at CRF 18 (review 17–20 only if quality/payload requires it). GOP 60 is a reasonable seek/size starting point. Keep exact sample count and no speed filters or interpolation. FFmpeg documents the [libx264 quality controls](https://ffmpeg.org/ffmpeg-codecs.html#libx264_002c-libx264rgb) and [faststart behavior](https://ffmpeg.org/ffmpeg-formats.html#mov_002c-mp4_002c-ismv).

At 3840×1440 there are 240×90 macroblocks/frame and 1,296,000 macroblocks/second at 60 fps; do not copy the old Level 5.0 limit. Browser/container compatibility does not guarantee 3840-wide 60 fps hardware decoding on every device. Future delivery QA must exercise target Safari/Chrome/Firefox and actual intended hardware; this does not justify shrinking the Blender render.

Perform an explicit color conversion from the display-referred sRGB PNGs to BT.709 video transfer/matrix, limited-range YUV, and tag primaries/transfer/matrix consistently. Do not merely label unchanged sRGB numbers as BT.709. Still/video endpoint color matching must be checked in the browser; current video is tagged sRGB transfer, so inheriting flags blindly is unsafe. Use a documented color-managed conversion and decode back for comparison.

**Delivery stills:** lossless WebP at 3840×1440, sRGB, with PNG masters retained. Lossless keeps fine glyphs and cobalt edges intact; trial near-lossless only if payload demands and the same visual gate passes. All files are opaque.

Planning payload, not an encode prediction: at 12–24 Mbit/s, Shipping is ~7.3–14.6 MB and a 3.2 s BASE film ~4.8–9.6 MB. Prefer a combined film budget around 12–24 MB if CRF quality permits; measure actual output before setting hard caps. A quality failure takes precedence over forcing a bitrate. No final encoding, browser media replacement or playbackRate change occurred in M5A.

## 17. Remaining gates and risks

* **Framing approval:** full upper crown and original OPEN scale cannot both fit. The measured ~20% reduction is a concrete M5B candidate, not approved composition. Small threshold/test text is the main risk.
* **Visibility reproducibility:** source file alone lacks the final render's handler overrides. M5B must persist and reopen-check the production exclusion set.
* **Inherited motion:** source279 is the correct endpoint but descendants drift beyond it; freeze endpoint data before BASE authoring.
* **Mechanical clearance:** existing matching inserts and travel references reduce new modeling, but the shortened path and result inscription reveal still need clearance and occlusion checks in the frozen OPEN scene.
* **BASE text treatment:** the existing `>` material is too dark at source279. Author its registered neutral state explicitly. Existing false uses the correct neutral material; test five-letter fit at full resolution.
* **Timing choice:** recommended mapping preserves measured Web timing, not the much longer unsampled 24 fps source. This distinction is part of plan review.
* **Revision hashes:** source labels contain hashes not validated against external evidence in this audit; use no new fabricated identifiers.
* **Coverage and device performance:** direct geometry projection/rays support the wide master. Four M5B stills and later actual-device film checks remain necessary for visual and playback acceptance.

**M5A stop:** no scene edits were saved, no Blender still or animation was rendered, no final media was encoded, and the locked Web was not changed. Only the working copy, forensic artifacts and production documents were created.
