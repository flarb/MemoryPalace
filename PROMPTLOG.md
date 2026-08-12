# CLAD Prompt Log — MemoryPalace

Agentic build log for the CLAD Summer Hackathon (Week 1: "Organize").
Each entry: the prompt/brief given to the agent, and the working increment it produced.

## Tue Aug 11 — Scene bootstrap + start modal + sigil v0 + wizard v0

**Prompt:** "ok. let's go! Build it!" — build the MemoryPalace experience per
DESIGN.md, Tuesday milestone scope (Branding/STYLE.md as visual north star;
frame-draw stubbed as gaze reticle; SFX/persistence/WorldQuery deferred).

**Sub-run:** `mesh-builder-scripting` fork built `MemoryGemMesh.ts` — procedural
kite-cut faceted gem, brand-gradient vertex colors, verified in preview.

**Increment produced (agent: specs-experience-builder, Claude Code):**
- Specs project bootstrap: Spectacles target, Perspective camera +
  DeviceTracking (World), stereo Interactive preview, SIK v2.0.0 + UIKit
  v2.0.0 installed, SIK prefab at root.
- Branding pipeline: `Branding/logo-memorypalace-transparent.svg` graphic
  elements rasterized via resvg (SVG `<text>` doesn't survive conversion →
  wordmark rendered as UIKit text per DESIGN.md fallback);
  Montserrat Light/Medium imported via Editor API.
- `MemoryPalaceUI.ts` (SpectaclesUIKit): branded start modal (Keystone logo,
  tracked wordmark, Capture/Explore/Train, hand hint, coming-soon line),
  transcript card (mic + streaming body + "pinch to finish"), billboarded
  "New Memory" sigil label. Event-bus API to the main script.
- Sigil v0: counter-rotating additive violet/teal ribbon swirl + glow disc on
  the back of the LEFT hand (SIK hand keypoints, viewer-facing normal flip),
  Interactable on unit-scale wrapper; editor park position for mouse testing.
- Capture wizard v0 (`MemoryPalace.ts` state machine): sigil tap / Capture →
  gaze reticle (dashed teal orbit ring, -12° tilt; 2.5 s auto-confirm in
  editor, pinch on device) → ASR Module streaming (silence auto-stop 1.2 s,
  pinch stop; canned "buy milk for Thursday" preview fallback) → faceted gem
  drops free-floating at the anchor (in-session).
- Verified: clean compile, zero runtime errors, wizard driven end-to-end in
  preview (logs show MODAL→AIMING→LISTENING→captured), screenshots reviewed.

**Fixes along the way:** FlexLayout `addItems` pre-init throw → deferred via
`onInitialized` (ReplayEvent, duplicates ignored); `uiHud` @input wired by
SceneObject ref read back null → re-wired to the ScriptComponent UUID.

## Tue Aug 11 (later) — User bug report: "can't capture anything" + scene mess

**Prompt:** hero gem obscured by the modal; "New Memory" floating in the back;
Capture appears to do nothing ("probably because I can't use hands in the
simulator?").

**Root cause (systematic-debugging, log-tail evidence):** the click path WORKED —
the user's own session log shows `captured "buy milk for Thursday"` — but the
wizard gave near-zero feedback: silent 2.5 s aim phase, transcript card at a
world-fixed boot-time position (off-screen if the view rotated), and a blank
IDLE end state. It ran invisibly; the user reasonably concluded it was broken
(four rapid lens resets in the log immediately after).

**Increment (agent: Claude Code, inline):**
- Removed the hero gem (was clipping behind the modal top).
- Sigil is now device-only; in editor the modal is the affordance and the hint
  copy switches to "press Capture, then hold the view steady".
- AIMING now shows a billboarded status line riding under the reticle with a
  live countdown ("placing memory in 3…"); auto-confirm stretched to 3.0 s.
- Transcript card lands at the user's CURRENT gaze (billboarded), not the
  boot-time forward direction.
- Editor capture ends by returning the modal with a "✓ memory placed — N total"
  toast instead of dropping into a blank IDLE.

**Verification — real click path this time, no instrumentation:** discovered the
Capture button Interactable via QueryRuntimeSceneTool, drove it with
PreviewInteractTool (SIK synthetic hand pinch; note: the tool exists at the
main-agent tool surface — the builder subagent couldn't see it), watched the
log trace pinch → aim(3 s) → fallback → `captured (1 memories)` → modal return,
and runtime-queried the status panel positioned at the reticle point mid-aim.
Second driven run: 2 memories. Learned: editor auto-recompile resets the
preview and mints new runtime UIDs — always re-discover before interacting.

## Tue Aug 11 (later) — Follow panel + credit

**Prompt:** "the memory palace main interface doesn't follow you — it should be
one of those UIKit panels that follows you around. Also on the bottom right put
FLARB LLC for the credit."

**Increment (agent: Claude Code, inline, per /specs-build-ui):** StartModal
converted from static BackPlate to UIKit **Frame** with head-follow
(`setUseFollow(true)` / `setFollowing(true)`, close + follow buttons hidden) —
the AppLauncherDock reference pattern. Content now builds under
`frame.contentTransform` inside `frame.onInitialized` (ReplayEvent; the
contentTransform getter is unsafe pre-init), `innerSize` driven by
`flex.onLayoutComplete`, and the editor-hint copy is buffered because the main
script's OnStart can race the frame's init. "FLARB LLC" caption added
bottom-right (flexRow justify-End). Compiled first-try; verified by yawing the
preview camera 120° with MovePreviewCamera — panel chased into the new view,
billboarded, credit intact.

## Tue Aug 11 (later) — Vertical gaze-follow + copy casing

**Prompt:** "the panel should follow your gaze as you look up and down as well.
Make sure you capitalize the body text properly."

**Increment:** read the UIKit Frame source (`Frame.ts` + `modules/SmoothFollow.ts`)
and found the built-in: `frame.useTiltMode = true` switches the follow to
gaze-tracking once camera pitch passes thresholds (25° up / 35° down defaults) —
one line, no hand-rolled follower. Sentence-case sweep across every user-facing
string (hint, status, toasts, card captions) and a new STYLE.md rule: UI copy is
sentence case; all-caps is display-only. Verified with the preview camera pitched
~89° at the ceiling — panel centered in view, copy capitalized.

## Tue Aug 11 (later) — Surface-snapped placement + pinch-to-place

**Prompt:** placement reticle "doesn't align to the surface", label unreadable,
"it just seems to auto place when you stop moving? It should require a pinch."

**Increment (per /specs-world-query):** ReticleController now casts a WorldQuery
ray along gaze each frame (HitTestSession, filtered, one request in flight):
on hit the dashed ring snaps to the surface and aligns to the hit normal (flat
on tables/floors, flush on walls; brand tilt only in float fallback), and the
gem spawns offset along the normal. Auto-confirm deleted — placement requires
an explicit gesture: pinch on device, click/TapEvent in editor ("Pinch to
place" / "Click to place"). Status label bumped Caption→Body, distance-scaled
for 150 cm, lavender on plate. Confirmed: WorldQueryModule works against the
simulated preview room — screenshot shows the ring lying flat on the sideboard.
Driven end-to-end: coordinate-targeted pinch (panel had followed the user's
preview camera across the room — follow working as designed; uniqueId-targeted
pinch timed out on the moving far target), wizard HELD in AIMING ~40 s of
inspection, placed only on injected tap, captured, modal returned.
