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
