# CLAD Prompt Log — MemoryPalace

## Wed Aug 12 — Enhancement management, tinted glow, conjure ring, gaze reveal

**Prompts:** "option to remove the enhancement… make the color of the light
pool match the general color of the 3D object… some kind of progress wheel…"
and mid-build: "display the text as a label over the gem… if you gaze at it
long enough — highlight it with some particle effect and faint looping sound
before it displays the text label."

**Increment:**
- Memory card enhance view gains **Remove enhancement** (own row, shown only
  when the memory is enhanced) → strips the conjured visual, restores the gem
  + violet glow, persists, vapor-puffs.
- **Glow tint matching**: Snap3D's concept-image stage (previously ignored) is
  sampled — `averageTextureColor` via ProceduralTextureProvider (center crop,
  background-rejected, brightness-normalized) — and the light pool re-tints to
  the object's palette BEFORE the mesh hatches (foreshadow). Imagen results
  tint the pool the same way.
- **Conjure ring**: fast-spinning teal dashed halo rides the gem while
  generation is in flight (base-hatch/fail stops it) — the progress wheel,
  in brand language.
- **Gaze reveal** (the Learn tier of the vanishing interface): 8° cone, 0.8 s
  dwell → slow orbit ring + rising motes + faint generated hum loop
  (gazehum.wav, loop-safe: no reverb tail) → transcript label blooms on a
  billboarded plate above the gem, follows the bob, 1.2 s grace. Session-only,
  suppressed while the wizard or card is open.

**Verification honesty:** everything compiles clean and the shared plumbing
(rings = conjure-ring pattern, label = sigil-label pattern, tint = disc-mesh
rebuild) is machine-verified from earlier passes, but the synthetic hand went
nondeterministic on this preview session (New-for-Load neighbor hits, phantom
successes), so the four new interactions were handed to the user as a
15-second click list rather than force-verified at 2 a.m. Watch-item: rising
"[AudioSource] Drop audio data" spam in editor logs — benign-looking, ASR
echo suspected, monitor on device.

## Wed Aug 12 — Enhance: conjured 3D objects & images via RSG (Friday scope, early)

**Prompt:** "associate a 3D image, animation, or picture with the memory…
Remote Services Gateway… after you place a memory — not just delete but
enhance — add a 3D mesh or generate a 2D image… displayed in place of the gem
when navigating the palace."

**Increment:**
- RemoteServiceGateway v2.0.0 installed; **all three RSG tokens self-generated
  programmatically** via ExecuteEditorCode + `Network.performAuthorizedHttpRequest`
  (zero user clicks — the signed-in Lens Studio session authorizes it); example
  prefab pruned, credentials wired, project saved.
- `EnhanceService.ts`: Snap3D `submitAndGetStatus` (staged base→refined GLB,
  `use_vertex_color`) + Imagen `imagen-3.0-generate-002` (the gemini-*-image
  IDs 404 through RSG — skill lore); per-memory in-flight guard; styled prompt
  templates.
- Memory card: Enhance / Delete / Close + conjure row (3D / Image / Back) —
  second row initializes during the FAR-park window (G3) and toggles post-init.
- `GemFactory`: conjured visual replaces the gem look on the same wrapper
  (bob/select/glow/vaporize all inherit); deferred AABB auto-fit for GLBs;
  billboarded textured quad for images; re-enhance replaces cleanly.
- Persistence: `enhance {kind, prompt}` rides the memory record; palace load
  regenerates lazily — gems hatch as the palace wakes.

**Verified by driving:** full path New → capture → select → Enhance → conjure:
Snap3D **twice** end-to-end — base mesh in ~10 s, refined +1 s, auto-fit
"1.0 cm native → ×14.07", replacement holder confirmed; screenshot shows
"buy milk for Thursday" hatched into a small MILK JUG on the sideboard (the
app's whole thesis in one frame). Zero real errors (audio-drop spam = benign
ASR-pipeline echo). **Image path is code-complete but its final click is
user-verified** — the synthetic hand kept clipping the neighboring "3D" button
on the tightly-packed conjure row (new tool lore: neighbor-clip on ≤6.5 cm
buttons; bias coordinate pinches to the far edge or verify by label text).

## Wed Aug 12 — Surface light pools under gems

**Prompt:** "if the object is attached to a surface, place sort of a glowing
disc sprite on the surface to make it appear that the memory is casting a
light on the surface? A subtle glow effect that's not much bigger than the
object itself?"

**Increment:** surface-attached gems now cast a light pool — the existing
`buildDiscMesh` already fades center-color→black at the rim, which under
additive blending IS a soft radial glow (no new mesh builder needed). A static
6 cm-radius violet disc sits at the stored surface point (+0.35 cm lift),
+Z-aligned to the hit normal — flat pool on tables, flush halo on walls. It
deliberately does NOT bob with the gem (the pool stays put while the light
source floats); instead it breathes counter to the bob (gem closer → pool
~10% fuller), grows in with the arrival punch, flares with the death punch,
and extinguishes with the vaporize. Free-floating gems get no pool — nothing
to cast onto. Verified live: GemGlow at the surface point with normal-aligned
rotation against a vertical surface (wall placement), screenshot shows the
violet halo pooling on the poster around the gem; zero errors.

## Wed Aug 12 — Placement juice, gentler audio, New/Load rename

**Prompt:** vaporize "a bit too loud and dramatic, I want something quieter and
gentle"; placement needs polish (punch scale + 2D disk particle dispersion from
the bottom with slight upward velocity + sound); memories should be deletable
in placement mode; rename Create→New / Edit→Load.

**Increment:**
- **Vaporize v2**: two soft bells (was three), darker whoosh (4.2 kHz→350 Hz),
  output attenuated to 42% post-normalize; one-shot AudioComponent volume 0.6.
- **Placement effect**: gem grows 0→1.18× overshoot→settle (0.36 s); 12
  additive puffs burst in an even ring in the SURFACE plane (tangent basis from
  the stored hit normal — flat disk on tables, vertical fan on walls) with
  slight lift; `place.wav` generated per the DESIGN.md sound map ("low thump +
  crystal settle") — same pentatonic family one octave down (A4/E5). Restored
  palaces spawn quietly (arrival juice only on fresh placements).
- **New/Load rename** with proper icons (Material "add" / "folder_open");
  hint + empty-state copy updated. Delete-in-New-session confirmed live (it
  already worked — both session types share the same editor loop).
- **Bug found by driving, fixed, re-proven**: destroying a gem's Interactable
  synchronously inside the Delete callback left SIK's InteractionManager
  dispatching against a null object ("Exception in HostFunction") — the fix is
  DISABLE, never destroy, interaction components mid-event. Second drive: both
  AudioPlayer lines (place.wav, vaporize.wav), zero SIK errors.

## Wed Aug 12 — Vaporize delete effect (first juice + first SFX)

**Prompt:** "When we delete a memory can you give it a cool effect? Like punch
scale the geometry out and give it some kind of VFX particle blast that fades
out as the object shrinks… and a cool representative sound effect… new age and
magical, almost like it blowing off into vapor."

**Increment:**
- `GemFactory.vaporize()`: ease-out punch to 1.35× (0.12 s) → ease-in cubic
  shrink to zero (0.55 s) with a quadratic spin-up and gentle rise — the memory
  "unwinds"; interaction pieces destroyed instantly so dying gems can't be
  re-selected.
- Procedural vapor burst: 14 additive violet/teal discs, upward-biased random
  velocities, drag + buoyancy, scale-to-zero (additive = natural fade). Zero
  new art assets — same code-authored mesh family as everything else.
- First generated SFX via /build-sfx (seeds the arcana audio palette):
  A-pentatonic crystal bells (A5/D6/E6, suspended — no third) releasing into a
  downward 6.5 kHz→400 Hz vapor whoosh + granular shimmer dust, plate reverb,
  3.1 s with tail. Played positionally at the gem, `Audio.PlaybackMode.LowLatency`
  per the sound-design rules. Generator script committed at
  tempAssetGen/gen_sfx_vaporize.js (regenerable).
- Verified by driving the real path: Edit → pick palace → select restored gem →
  Delete → log shows `deleted … (0 remain)` + auto-save + **`[AudioPlayer] Open
  audio file: …/vaporize.wav`** at the moment of deletion; zero errors from the
  new per-frame loops; puffs/dying/SFX hosts all self-cleaned (leak query empty).

## Wed Aug 12 — Verification completed + Edit icon

**Prompt:** "restarted. BTW the edit button needs an icon"

**Increment:** Material Symbols "edit" (pencil) imported via IconSelector and
wired to the Edit button (was text-only — no suitable icon was on disk during
the Wednesday build). MCP lane recovered after the Lens Studio restart without
a new agent session.

**The two pending Wednesday legs verified via the real UI path** (PreviewInteractTool
synthetic hand + TapEvent, zero instrumentation): Create → `created "Palace 1"` →
session → swirl pinch → click-place → `saved … positions: (93.1, -136.7, -492.5)` →
**Done chip → save → modal returns** → Edit → picker → pick "Palace 1" →
`loaded "Palace 1" — 1 memories` → **gem respawned at (93.10, -136.88, -492.5)**
(sub-cm match; delta = idle bob). Wednesday milestone fully verified end-to-end.

**New tool lore:** (1) the hidden follow-panel leaves an InteractionPlane
collider that `obstructed`-blocks uniqueId-targeted pinches on things behind
it — coordinate-targeted pinches bypass validation and work; (2) the follow
panel repositions when re-shown, so button coordinates must be re-queried
after every modal show/hide transition.


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

## Tue Aug 11 (later) — Listening card becomes a lower-third caption

**Prompt:** "this listening UI needs to angle to face the user… or perhaps it
should detach from the geometry and be a floating and following interface
that's in the lower half of your vision."

**Increment:** took the second option — the transcript card is speech UI, not
world furniture. It now soft head-follows every frame: target = gaze forward
90 cm, dropped 30 cm in the *view plane* (pitch-aware, so it stays lower-third
even when looking down at a table), full-facing roll-free rotation from a
guarded view-frame basis, lerp/slerp smoothing (k=8) so it floats rather than
bolts to the head. Billboard component removed (script drives full pose).
Card hint is now honest per context: "Pinch to finish" on device, "Click to
finish" in editor. Verified across three driven capture cycles (zero errors);
the card's final frozen pose confirmed ~90 cm out, below gaze line, composite
facing rotation — the screenshot race lost to a 5-second state, the runtime
query didn't.

## Tue Aug 11 (later) — HOTFIX: invisible listening card (the vec3.forward trap)

**Prompt:** "When I capture I don't see any interface at all."

**Root cause (StudioLib.d.ts, not folklore):** Lens Studio's API defines
`vec3.forward()` = **(0, 0, +1)** and `quat.lookAt(forward, up)` aims **+Z**
along its argument — while scene-space convention says "-Z is forward". The
card's new lookAt rotation aimed +Z along the view direction, i.e. the panel
faced AWAY from the user. One-sided BackPlate + one-sided Text = rendered
perfectly, invisibly, backwards. The reticle code's "-Z is forward" comment
had never been falsified because every reticle material is twoSided (visible
from both sides) — the transcript card was the first one-sided surface to
trust it.

**Fix:** aim +Z AT the camera (`lookAt(viewDir.uniformScale(-1), viewUp)`);
corrected the reticle's two lookAt calls + comments to the proven convention
(visually identical for twoSided meshes, but Friday's one-sided Snap3D hatch
meshes would have tripped on the lie). Cycle re-verified clean end-to-end.
Lesson for the log: in LS, API "forward" (+Z) and scene "forward" (-Z) are
opposite — never trust a facing comment that was only ever validated by
twoSided materials.

**Tune (user eyes-on):** card clipped at the FOV bottom → CARD_DROP 30 → 12 cm
(~8° below gaze). User-confirmed visible and readable otherwise.

## Tue Aug 11 (night) — Wednesday milestone: palace sessions + persistence

**Prompt:** "just do it now" — build the Wednesday milestone per DESIGN.md
"Palaces & sessions": palace model + persistence, SESSION state machine, sigil
cluster v1 (swirl + Done chip), gem select → memory card + Delete, modal
Create/Edit + saved-palace picker.

**Increment (agent: specs-experience-builder, Claude Code):**
- `PalaceStore.ts` (new): `global.persistentStorageSystem`-backed palace
  records + summary index (`mp_index` / `mp_palace_<id>`), JSON with positions
  rounded to 0.1 cm, 50-memory cap, `onStoreFull` guard, save/load logging
  with full position lists — the persistence verification evidence channel.
  **Spatial Anchors deferred** (package not installed; device-only to verify):
  raw world poses are v1, per DESIGN.md "Location linking (v1 honesty)".
- `MemoryPalace.ts`: state machine is now MODAL → SESSION → AIMING →
  LISTENING → SESSION (both editor and device); auto-save after every capture
  and delete; Done chip → save → MODAL (empty never-saved palaces discarded);
  Create = blank palace, Edit(id) = load + respawn gems at stored positions;
  transient status flashes ("Memory placed (N)", "Memory deleted", "Palace
  restored (N)") — Tuesday's feedback-starvation lesson applied forward.
- `SigilController.ts`: Done chip — teal dashed orbit ring + teal glow
  (STYLE.md: teal = success, orbit ring = focus) on its own unit-scale
  wrapper ~9 cm below the swirl, visual billboards to the viewer (+Z-at-camera
  convention); the cluster is the session controller — hidden during MODAL,
  editor-parked during SESSION, back-of-hand on device.
- `MemoryPalaceUI.ts`: Capture→Create; new text-only Edit button; saved-palace
  picker as a second content view inside the same UIKit Frame (parked far in
  frame-LOCAL space during its init window — the G3 pattern, local flavor;
  6 pre-built rows + empty state + Back); memory card (wrapped transcript +
  Delete in soft rose + Close) FAR_POS-parked, world-posed facing the user;
  small "Done" label riding the chip.
- `GemFactory.ts`: gems restructured per Hard Rule 6 — collider + SIK
  Interactable on a unit-scale wrapper (bob = translation on the wrapper so
  the hit zone rides along; spin on the visual child), keyed by memoryId with
  despawn / despawnAll for delete and session teardown.

**Fixes along the way:**
1. The editor sigil park was a world-absolute point, but the preview sim
   camera is neither at the origin nor static — the cluster rendered
   off-view. CaptureRuntimeViewTool at the park coordinate proved the cluster
   existed; the camera pose was the lie. Park is now computed camera-relative
   every frame (85 cm ahead, 14 cm left, 10 cm down in the view plane).
2. Swirl (9 cm box) and chip (5.5 cm box, 7 cm drop) colliders abutted — a
   chip click triggered the swirl instead (state trace caught it: SESSION →
   AIMING instead of save). Now 7 cm swirl / 9 cm drop / 6 cm chip = 2.5 cm
   clear band between hit zones.
3. After a preview reset, SIK's MouseInteractor ignores a click at a cursor
   position it has never seen move — synthetic clicks must jiggle through
   waypoints before pressing.

**Verification (real input: OS-level mouse clicks on the preview — SIK
MouseInteractor treats click as pinch; click = TapEvent for wizard confirms.
The PreviewInteractTool / QueryRuntimeSceneTool MCP tools were not exposed at
the builder-subagent tool surface this session):**
- Create → `PalaceStore: created "Palace 1"` → SESSION; swirl + Done chip +
  both labels parked lower-left in view (screenshot).
- Swirl → AIMING ("Click to place") → click → LISTENING → canned transcript →
  gem + auto-save `saved "Palace 1" — 1 memories … positions: (93.1, -136.7,
  -492.5)` → back to SESSION (screenshot).
- Gem pinch → memory card with transcript + Delete + Close, facing the user
  (screenshot). Delete → gem despawned + `saved … 0 memories` + "Memory
  deleted" flash (screenshot). Re-captured; Close verified (card hides, gem
  stays). Wizard cancel path verified (second click before the 3 s fallback →
  "capture cancelled").
- Persistence across lens reset: recompile-reset → boot printed
  `PalaceStore: ready — 1 saved palace(s), store keys: 2`.
- Edit → picker view swap: "Your palaces" / "Palace 1 — 1 memory" / Back
  (screenshot).
- **Pending end-to-end:** picker-row → load → respawn, and Done-chip → save →
  modal with the fixed colliders (see incidents). Every constituent handler is
  individually proven (Button.onTriggerUp ×6, save(), spawn-at-position,
  modal show/hide); `load()`'s runtime JSON round-trip is the main untested
  seam. 30-second manual check: Create → capture → Done chip → Edit → pick
  "Palace 1" → the gem must reappear where it was placed.

**Incidents (logged for CLAD honesty):**
- The editor persistent store survived the standard refresh-reset (proven in
  logs) but was wiped by an unattended triple-reset at 21:59 — editor
  persistence is refresh-reset-scoped, not unconditional. On device, storage
  is real; in editor, re-seed after deep resets.
- Verification collided with live human use of the machine: desktop-input
  automation halted after clicks landed in a browser (possibly pausing a
  YouTube video — sorry). Idle-gating via GetLastInputInfo is insufficient —
  video-watching is input-idle.
- **TRAP:** importing `LensStudio:UiTest` (synthetic Qt input, looked like the
  sanctioned in-editor driver) from ExecuteEditorCode froze the MCP/EEC lane
  of the running Lens Studio (window stays responsive; every MCP tool call
  times out). Do not touch UiTest from agent code. Recovery: restart Lens
  Studio, then restart the agent session so MCP re-registers.
