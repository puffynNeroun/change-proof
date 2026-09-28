# Blender M5 event contract — proposed in M5A

Status: **unbuilt contract**. No event below has a verified final frame number. Do not import the M5A draft into Web production.

Source: `change_proof_WEB_SHIPPING_TRANSITION_FINAL.blend`, SHA-256 `f4cd9a8e872dc9386afb8508ab3c1f4697c4226aa528cc71e7d9acb63cbe1b3d`.
Audit artifacts: `.cp-tmp/blender-m5-audit/20260927T183752Z/`.
See [production plan](BLENDER_M5_PRODUCTION_PLAN.md) for object ownership, exact proposed retiming and the four-still approval gate.

## Clock and indexing

* Delivery fps is the rational `60/1`; expected playbackRate is 1.0 **only when the new media is eventually integrated**. Locked V9 remains at .86.
* `blenderFrame` is one-based in each proposed film scene. `frameIndex` is zero-based in that film's encoded media. For a sequence beginning at Blender frame1, `frameIndex = blenderFrame − 1`.
* Frame presentation time is `frameIndex / 60`. Store rational time `{numerator: frameIndex, denominator: 60}` as canonical, plus optional seconds for convenience.
* `end` means the **exclusive** media boundary: `frameIndex = frameCount`, `time = frameCount/60`, `blenderFrame = null`. `lastFrameIndex` is `frameCount−1`. Do not confuse last-frame presentation with media end.
* Start is structural frameIndex0. Even structural fields stay null in this M5A draft until the actual sequence is exported; proposed timing is stored separately.
* Proposed Shipping budget: 291 frames / 4.85 seconds; proposed HEAD arrival at Blender274 / media273 / 4.55 seconds. These are targets from the measured source mapping, not final event numbers.
* Proposed HEAD→BASE budget: 192 frames / 3.2 seconds. Event numbers are assigned after mechanics, visibility and typography are actually authored.

## Events and evidence predicates

### Shipping

| Event name | Required visible state / evidence | Timing guidance |
| --- | --- | --- |
| `shipping.start` | Exact IDLE still state; source107 equivalent | First sample |
| `shipping.activation` | Shipping cobalt/contact activation visibly begins | Source material/contact changes begin 108; identify perceptible onset in authored 60 fps samples |
| `shipping.drawer_motion` | Same SHIPPING assembly begins visible extraction along its rail | Source first integer Y change134; use evaluated motion/visibility, not a guessed timer |
| `shipping.implementation_visible` | Eligibility panel and source identity are exposed and readable | After actual unfold/occlusion clears; source changes213–222 do not by themselves prove readability |
| `shipping.selected_test_visible` | Same green strip, path, input and expectation are exposed and readable | Must inspect authored samples; no source event frame claimed |
| `shipping.head_stable` | Open drawer; >=; true; selected test; both 5000 values; corrected camera at approved endpoint; all settle velocities zero | Source279 equivalent plus a held native state; target around4.55 s |
| `shipping.end` | Exclusive media end; no geometry/color jump to HEAD still | Target4.85 s |

Source changes are forensic evidence only. The old UI's 1.20 and 2.65 source-video landmarks are provisional Web cues and must not be copied into the M5 manifest without scene verification.

### HEAD → BASE

| Event name | Required visible state / evidence | Approximate design window |
| --- | --- | --- |
| `head_base.start_head_stable` | Exact corrected HEAD still, including selected test and camera | 0 s |
| `head_base.registration_release` | Current registration visibly unlocks; old result withdraws | .35–.60 s |
| `head_base.base_registration` | BASE insert/identity engages the common receiver after HEAD stows | 1.25–1.65 s |
| `head_base.operator_gt_available` | Only `>` is readable in the comparator, fully seated | 1.65–1.95 s |
| `head_base.evaluation_start` | Evaluation route engages with input5000, threshold5000 and registered `>` | 1.95–2.25 s |
| `head_base.false_observable` | Only neutral false is clearly readable in the existing result window | 2.25–2.65 s |
| `head_base.base_stable` | BASE, >, false settled; same selected test, input5000, expected true; no camera/evidence drift | 2.65–3.20 s |
| `head_base.end` | Exclusive media end and exact BASE still handoff | Target3.20 s |

Do not emit false before it is visible. Registration and operator-available may share a frame if the actual mechanism makes them simultaneous, but evaluation must follow a readable registered operator. Test identity and expectation never change during replay.

## Manifest data structure

Draft JSON is stored at `.cp-tmp/blender-m5-audit/20260927T183752Z/cp-m5-events.proposed.json`. Final path is proposed as `renders/web/m5/v01/delivery/cp-m5-events.v1.json`.

Top-level fields:

| Field | Contract |
| --- | --- |
| `schemaVersion`, `status`, `assetSetVersion` | Version1; draft has status `proposed_unbuilt`; production requires `verified` |
| `source`, `workingBlend` | File names and SHA-256 provenance; final working hash recorded after authoring |
| `render` | Width3840, height1440, square pixels, fps60/1, color settings, seed/samples and device provenance |
| `coreRect` | `{x:640,y:0,width:2560,height:1440}` |
| `cropPolicy` | Core-contain transform; explicit 16:10 vertical presentation margins |
| `evidence` | Test identity/path, input5000, threshold5000, expected true, HEAD >=/true, BASE >/false |
| `assets` | Deterministic filenames, byte sizes, SHA-256, image dimensions or film frame counts/durations |
| `films` | Scene, sequence start, actual frame count, endpoint references, event list and source-time mapping |
| `events[]` | Name, `blenderFrame`, `frameIndex`, rational `time`, optional `seconds`, visibility predicate, verification evidence |
| `anchors` | Final projected polygons/points for operator, result, selected test and Shipping; per endpoint and, if needed, key events |
| `checks` | Native-frame provenance, endpoint equality, fixed-test validation, visibility checks, crop approval and delivery decode checks |

The core rectangle describes overscan mapping. Final anchors must be measured again after the OPEN framing correction. Do not transplant old normalized coordinates and assume they still match.

## Authoring and extraction

1. Construct the proposed timelines in the M5 derivative after plan approval. Use named timeline markers matching the event names.
2. Freeze source279 across the Shipping tail and initialize the BASE scene from that exact corrected state. Check random-access evaluation; previous frame order must not affect geometry or visibility.
3. For each event, evaluate the actual sample and its preceding sample. A visibility switch is not enough if the glyph remains behind a panel or is too small to read. Record the first frame that satisfies the semantic predicate.
4. Verify any stable event across the entire endpoint hold, with zero relevant transform/material/visibility drift. Selected test, input, threshold and expectation data must remain identical throughout BASE replay.
5. Export actual marker frames with 60 fps rational timestamps. Structural end comes from the exported sequence frame count, not a marker guessed before rendering.
6. After eventual encoding, verify frame count, timestamps, dimensions, no audio, checksums, and decoded first/last frames. Check that codec reordering does not change presentation-time event interpretation. Mark final manifest `verified` only after visual and technical acceptance.

## Future Web synchronization behavior

Prefer video presentation time from `requestVideoFrameCallback` where available; use video `currentTime` as fallback. Events are crossed using `previousTime < eventTime <= currentTime`, so delayed callbacks dispatch all crossed landmarks once in order. A seek or replay recomputes state from the manifest rather than relying on previously fired timers. Handle frame0 explicitly. Do not use wall-clock delays for machine semantics.

Pause/buffering must also pause semantic progression. HEAD/BASE stills take over only at the matching stable endpoint; a failed or incomplete BASE film must not label a HEAD image as physical BASE evidence. Reduced-motion presentation should select approved endpoint stills with the same evidence contract. These are later integration requirements; no Web code was changed in M5A.

## Release gates

* Four M5B stills approved: IDLE, overscan control, corrected HEAD, BASE.
* Actual event frames populated, ordered and visually checked; no null final fields.
* First/last film frames match their approved endpoint stills.
* Same selected-test hierarchy and exact input/expectation survive every replay frame.
* No source visibility-handler dependency, later legacy chapter drift or unintended magenta machine state.
* Every delivered asset uses the same approved framing/core mapping, asset-set version and checksum manifest.

**M5A stops with proposed names, structure and timing windows. No final event frame numbers have been fabricated.**
