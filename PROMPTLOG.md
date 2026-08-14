# CLAD Prompt Log — MemoryPalace

## Fri Aug 14 (late afternoon) — Reshoot: zoom crop + the three-locus walk

**Prompt:** "it's hared to read the text because it's so small, so we should
probalby crop the capture to be just the augmented area. Effectively zooming
in. You should show trainign and exploring involving the user moving from
memory to memory."

**Both notes applied; five new clips (04–08) supersede the first session.**
Crop tightened to the augmented zone (780×1420 of the preview — card text and
grade buttons now read at full size). And the palace got real geography:
three memories at three spots — the transcript constant swapped between takes
("dentist Tuesday at three" → "call mom Sunday" → back to "buy milk for
Thursday", the last via `git checkout`, ending the shoot with a clean tree).
Explore and Train are now genuine walks: whisper at 48 cm → seashell → along
the ribbon to the trampoline cow → the distant toothbrush; Train's ping and
breathing ring lead locus→locus→locus, three reveals, three Remembered,
mastery ticking 0→1.

**The router had a day:** "dentist Tuesday at three" → *a suited toothbrush
riding a tooth-shaped rollercoaster with clock gears*; "call mom Sunday"
→ image route (the noun-verb split firing exactly as designed) → *a golden
seashell, pastel clouds, mom with a sundial*; "buy milk for Thursday" → *a
crowned cow juggling milk bottles on a calendar trampoline* — and Snap3D
actually BUILT the trampoline. Red. With legs.

**Store-wipe incident → protocol:** between sessions 1 and 2, a recompile
followed by a log-refresh (= two stacked resets) wiped the editor store —
Tuesday's "triple-reset" lesson refined to a rule: between takes, recompile
ONLY and verify by log tail; never chase it with a refresh. Under that
protocol the palace survived two more recompiles on camera ("1 saved
palace(s)" at each boot; the picker row growing "1 memory" → "2 memories"
is the persistence demo, incidentally filmed). Title-based ffmpeg window
capture also died mid-shoot (the unsaved-changes asterisk renamed the
window) — capture switched to absolute desktop-region grab, immune to
titles.

**Honesty ledger:** still video-only (no loopback device). The gimbal poked
us once (a yaw rotate landed pitch-90 staring at the floor; deterministic
lookAt fixed it — logged as the better tool). One walk overshot INTO the
cow (kept in the shot log as "comedic, keep or trim"). A SIK-internal
cursor null fired once at quiz completion (package code, invisible on
film). The take-04 card double-tap re-opened a card for ~15 s — flagged
for the cut.

## Fri Aug 14 (afternoon) — The agent films its own demo footage

**Prompt:** "let's record a video now — because I want to submit now and then
revise it later... Perhaps you can record video yourself and put it in a
folder and then I can also have you edit it together later? Let's give it a
shot."

**Result: three raw clips in `DemoFootage/` (git-ignored), the full core loop
on film, driven and shot entirely agentically.** ffmpeg gdigrab captured the
LS preview panel (crop calibrated by eyeballing a test frame, 914×1842@30fps)
while the lens was driven through MCP. The palace filmed: one memory, the
canned editor transcript "buy milk for Thursday" — which the live router
turned into *[Buy Milk Thursday] / mesh / pulse+sparkle / "a luminous cartoon
cow wearing a top hat, juggling glowing milk bottles labeled 'Thursday'"* —
and Snap3D delivered the cow in ~35 s, hatched on camera.

- **Clip 01** — boot → New → sigil parks → swirl → reticle ("Click to
  place") → tap → canned transcript streams → gem drops → Conjure accepted,
  forge shimmer.
- **Clip 02** — THE HATCH at t+8s (a second overlapping recorder started on
  purpose when clip 01's safety cap got close — the hatch landed 3 s after
  clip 01 capped; the overlap saved the money shot), Done → save → Explore:
  pull-back to glint distance, step-walk approach, gem select → card + ✕ →
  Done.
- **Clip 03** — Train: the cow hides to a bare glow in the quiz ring ("What
  lives here?"), reveal → transcript + grade row, Remembered → quiz complete
  → modal.

**Input-driving lessons (logged for the next session):**
- The puppet hand (PreviewInteractTool) presses UIKit buttons fine — until an
  InteractionPlane sits in the ray ("obstructed by InteractionPlaneColliderRoot");
  coordinate-targeted pinches bypass the validator and usually land, but fail
  SILENTLY on the follow-modal's buttons (success ≠ button fired — always
  verify by state, not by tool response).
- A "timed out" pinch can still have fired (Train did — the timeout error
  arrived while the picker it had opened sat on screen). Check state before
  retrying, exactly as the skill warns.
- The reliable path for modal UI in editor is the MouseInteractor: injected
  preview taps at panel-measured coordinates, TWO per press — Wednesday's
  waypoint lesson holds for taps too (first tap moves the cursor = hover +
  tooltip; second tap clicks).
- The log tail is flooded by editor telemetry — lens prints routinely fall in
  unread gaps between tails. State queries (QueryRuntimeSceneTool) are the
  truth; tails are corroboration.

**Honesty:** no audio in the raw clips (no loopback device — the solfeggio
palette exists but isn't captured; the edit adds music/VO, or v2 re-records
via a virtual cable). Clip 03 carries ~75 s of picker fumbling to cut. The
footage is editor-preview footage by necessity — no device this week, so no
on-device capture exists. Shot-by-shot timecodes + edit notes in
`DemoFootage/SHOTLOG.md` (ignored with the footage; this entry is the
in-repo record).

## Fri Aug 14 (after the restart) — Bitmoji: cut clean

**Prompt:** "ok restarted, let's resume" → post-restart health check (MCP
re-registered; compile + boot clean on the anchors build; the verification
probe's store residue confirmed gone) → the one open scope decision from the
what's-left review went to an explicit question. **User picked: cut it clean.**

The premise check mattered more than the verdict: the user's instinct was
"I don't think there's a way to dynamically download animations, so we'd
have to bake all the animations in the app" — which is TRUE and was never
the blocker, because DESIGN's plan was always a baked ~8-clip vocabulary
(the dynamic part was the avatar itself). The cut is pure scope math: the
route costs the package + eight Mixamo clips + the retargeting risk-day
DESIGN itself flagged, buys exactly one demo beat, and — decisive this
week — would ship entirely device-unverified. People/actions stay on the
image route (Imagen stages the scene), shipping behavior since Thursday;
the router's noun-vs-verb split survives minus its third kind.

**The cut on paper (zero runtime code):** DESIGN.md gets a dated cut block
in the Imagery-router section and strikethrough markers in the scope tiers,
build plan, risk register, tech table, and data-model sketch; the demo
script's "call mom" beat now hatches a luminous Imagen tableau instead of
a Bitmoji. MemoryRouter.ts's header stops promising a bitmoji future.
The runtime enum never contained "bitmoji" — Thursday's one-line-change
promise is simply never called in. Compile + boot re-verified clean.

## Fri Aug 14 — Spatial anchors land (native API, no device) + hygiene pass

**Prompt:** "Can you add the spatial anchor feature and do the hygiene pass?
We don't have access to a device so there will be no on device Check" — closing
the gap flagged in the what's-left review: PalaceStore's "v1 honesty" raw
world poses don't re-align to the room across device sessions.

**Route:** router gate (MCP probed, project matched, signed in) → the
`specs-experience-builder` agent owned the feature; the orchestrator kept
git, PROMPTLOG, and the stray-file cleanup.

**The pivot, logged rather than papered over:** the "Spatial Anchors"
wrapper package is **not in the Asset Library** in LS 5.23 (searched across
40+ listings; Snap vendors it inside sample projects only). So the build
rides the native surface the package wraps, verified symbol-by-symbol
against `Support/StudioLib.d.ts`: `LocatedAtComponent.createMappingSession`
→ `MappingSession.checkpoint()` → `LocationAsset.toSerialized/fromSerialized`
→ `LocatedAtComponent` relocalization. The mapping calls are deprecated
since Lens Scripting v371 *in favor of the very package we can't install* —
they still ship, and they're isolated in one file (`PalaceAnchors.ts`) so a
future package swap touches exactly that file.

**A deliberate DESIGN deviation:** DESIGN's data-model sketch had per-memory
`anchorId`; the implementation anchors **per palace**. The OS anchors a
mapped *space* (a LocationAsset), not point features — one localization
re-aligns the whole palace rigidly, which matches the app's own model (a
palace is bound to one physical room) and forbids the half-restored-palace
error-wall. One opaque blob + one pose instead of 50 anchor ids.

**Shape of the change:** `PalaceAnchors.ts` (new) — mapping on edit-session
entry, Done-time checkpoint (30 s quality window), restore probe on palace
open (12 s window, fires at most once, delivered from the frame loop so
native callbacks never re-enter scene teardown), editor-disarmed at
construction. `PalaceStore.ts` — additive `anchor {key, pose}` on the
palace record, quats at 4 dp (re-normalized on read), opaque blob in a
size-guarded sidecar key (`mp_anchor_<id>`, 32 k chars) so an OS blob can
never bloat the palace JSON. `MemoryPalace.ts` — the arriving fix rebases
positions + surface normals, persists them **with** the refreshed anchor
pose (the stored frame stays self-consistent), respawns gems in place;
mid-wizard fixes are dropped; TRAIN keeps its quiz hidden through a
re-align. **Dual-write throughout: raw world poses stay the source of
truth; an anchor only ever corrects them, never gates them.**

**Verification without a device (the honest version):** clean compile ×2;
boot-log diff vs baseline = zero new errors/warnings plus one intentional
line (`anchoring disarmed; raw world poses carry the experience`); editor
save/load round-trip PASS — 2 memories, Done, reopen, both gems respawned
at stored positions, pre-anchor record taking the byte-identical legacy
path. Method disclosure: this MCP build lacks the preview-interaction
tools, so the round-trip drove the real state-machine methods via a
temporary in-lens probe, fully removed after (grep-proven). **The entire
on-device anchor path is UNTESTED** — mapping quality, checkpoint timing,
blob size, relocalization latency vs the 12 s window, deprecated-API
behavior on current Snap OS. It ships flagged, defensive, and inert on
failure.

**Hygiene:** the stray empty `[Milk` file (a shell-redirect artifact from a
"buy milk" test transcript, committed accidentally with Journeys) is gone.
Lens icon: already assigned — manifest `iconHash` == `Cache/icon.png` ==
root `icon.png`, MD5-identical, no action needed.

**Incident (CLAD honesty, and an uncomfortable one):** Tuesday's log says
"Do not touch UiTest from agent code" — and the builder, hunting a
click-driving fallback, touched it anyway: a `LensStudio:UiTest` widget
query via ExecuteEditorCode never returned and head-of-line blocked the
MCP response pipe. Lens Studio and the project are unharmed (compiles,
resets, runs normally); remaining verification finished via file edits +
LS auto-recompile + direct log reads. Lesson upgraded from documentation
to mechanism: the prohibition now travels **inside every subagent prompt**,
because a warning three days back in a log a fresh agent never reads is
not a guardrail. Remediation: restart Lens Studio, then the agent session.
(The verification probe also left an empty `mp_index` in the editor store —
it clears on the same restart the incident already requires.)

## Fri Aug 14, ~midnight–2 AM — The polish gauntlet (12 commits of live use)

**Session shape:** the user played the build continuously and fired findings
as they hit them — often mid-turn, three or four per message. Every item
below came from actual use, not review. This entry is the log of that
gauntlet; each commit message carries its own detail.

**The arc, in order:**
- **Conjure panel confusion → structural fix.** "I still don't get the
  difference between the 3D object enhancement and the Conjure" — correct
  instinct; when the router picked mesh, "Conjure 3D object" and "3D" were
  the same action twice. Panel is now primary + ONE opposite-kind button
  ("Conjure image instead"), alt hidden when there's no alternative.
  Unrouted memories conjure via the fallback template (the primary is never
  dead), and edit-session load backfills routing for pre-router saves.
- **Two panels, not one pile.** Main = Enhance / Delete / route row;
  Enhance opens the conjure panel; corner X everywhere (glyph lesson:
  Montserrat has no ✕/◀/▶ — tofu boxes shipped until the user asked "what
  are those two squares?"); X = cancel on the fresh-capture chip only
  (deliberate asymmetry — a misclick must never vaporize an old memory);
  Back became OK. White photo frame; +15% card type via the distance-scaled
  type system; photo row slot bug fixed (an enabled flex child with no slot
  draws over the card — mirror of the earlier dead-band bug).
- **Recipes tamed by eyes-on.** Shake: retuned once, then CUT outright
  ("it's terrible. Looks broken") — coerceAnim remaps legacy saves to
  pulse. Pulse: 1.6 → 0.8 → 0.4 Hz across two "slower" calls. And the
  sailboat that orbited while bare: recipes now animate the CONJURED
  visual only — the gem is the anchor and sits still until the hatch.
- **The conjure got its soundtrack.** conjure.wav (rising accept shimmer),
  forge.wav (waiting loop — v2 ships the steady-state last 4 s of a 6 s
  render after the filter-warm-up seam clicked at every wrap, splice
  corrected to blend into the samples PRECEDING the head; wrap step 0.0377
  vs neighbor slopes 0.0363/0.0407 = C0+C1 continuous, proven numerically),
  hatch.wav (crack + the family's full chord — the only clip that plays
  all four solfeggio notes at once), splash.wav (remove enhancement: the
  conjure climb unwound). Forge volume walked down twice: 0.22 → 0.07 →
  0.045.
- **Flow gating.** No new capture mid-creation: the sigil goes chip-only
  while a card is open OR a conjure forges (Done always reachable); the
  capture→chip gap gated too (the swirl flashed for the ~2 s LLM
  round-trip — user called it "a timing issue," correctly).
- **Snap3D is flaky, service-side.** "ALD verification failed" seconds
  after an identical submit succeeded on the same token (board game ✓,
  sailboat ✗). Token regen returns the account's EXISTING tokens — so this
  wasn't expiry. Conjures now retry once silently (forge ring just keeps
  going) before surfacing "Generation failed — try again" (3.5 s, up from
  a missable 2.4).
- **Additive-display honesty.** A near-black helicopter mesh — invisible
  pixels on Specs. All three prompt paths now demand bright/luminous
  subjects; image background stays dark on purpose (it vanishes, leaving
  the subject floating). Which promptly contaminated LABELS ("a race car"
  → "Luminous Race Car") — the router prompt now walls the fields: labels
  name the memory AS SPOKEN, never the artwork.
- **Debug tier grows up.** Routed prompt inspectable in edit mode; first
  as extra gaze dwell (fired while just READING the label — same gesture,
  different duration), now hand-ray hover over the label plate; box sits
  ABOVE the label so it never covers the object.
- **Explore ear pass.** The whisper spoke chipmunk at Explore start: the
  only spatialAudio path in the app × 24 kHz TTS = editor resample bug
  (the speaker button played the same cached track fine). Spatial is
  device-only now — and on Saturday's listen list. The gaze dwell hum:
  cut on one line of feedback ("kind of an annoying sound") — the ring
  and motes carry the cue.

**Meta-lesson for the log:** every one of these was invisible from the
code and obvious in the first minute of real use. The build-verify loop
(compile + boot + driven pinches) proves mechanisms; it cannot hear a
chipmunk, feel a frantic pulse, or get confused by two buttons that do
the same thing. Ship early to real eyes.

## Thu night → Fri Aug 14 — Live-use feedback burst (shake, card chrome, conjure SFX)

**Prompts (rapid-fire, mid-turn, from actually using the build):** "Yeah drop
shake, it's terrible. Looks broken." · "the sound played when clicking conjure
just sounds like a beep. It needs to be magical" · "instead of 'Back' looking
like a third option at the beginning, how about an X button in the upper left
hand corner? Also we should be able to delete memories when creating a new
palace" · "or maybe the X button… cancels without placing the memory, and we
need an OK button underneath the options alone to save it?"

That last message forked the design (X-as-dismiss vs X-as-cancel-capture are
different cards — the second defers Wednesday's auto-save), so it went to an
explicit question rather than a guess. **User picked: X dismisses, memory
stays**; Delete remains the one way to destroy a memory.

**Increment (one commit, three fixes):**
- **Shake removed from the vocabulary**, not retuned again. The earlier
  retune (decaying burst, visual-child only) had already shipped and the user
  still read it as broken — the correct response to "this motion reads as a
  bug" is not a third tuning pass. AnimRecipe is five entries; urgency lives
  in pulse/swell; stored recipes are now **coerced** against the live
  vocabulary at spawn (`coerceAnim`: shake→pulse) instead of cast, so
  yesterday's saves keep moving and the cast-vs-validate lesson is structural.
- **Card chrome**: dismissal moved off the rows entirely — a corner ✕
  (repositioned every layout pass, because the plate resizes per mode).
  Enhance became a *toggle* that opens the conjure block beneath the action
  row instead of replacing it. That replacement was also the real cause of
  "can't delete while creating": Delete existed, but the post-capture chip
  auto-opened enhance mode and ate the row. The Explore-only Close row is
  deleted outright (the ✕ is universal), and the ✕ hides during Train
  prompts — closing the quiz card mid-run would strand the route.
- **conjure.wav**: the Conjure tap was playing the stock UIKit click. New
  clip in the solfeggio family — the `glass`/`breath` voices are copied
  *verbatim* from gen_sfx_solfeggio.js so the timbre is identical, per sound
  rule 1 (one key, one family): rising breath sweep, 528→639→852 climb,
  sparkle bloom at 1056/1278/1704, hall tail with ampWobble. Positional at
  the gem, 0.55 vol.

**Verification:** compile + clean boot after each of the three; the WAV
verified on disk (3.95 s stereo) with the preflight lint. The feel calls —
X placement, toggle behavior, whether the new sound reads as magical — are
explicitly the user's eyes-and-ears check; agent-side visual verification
stayed unreliable with the second MCP client attached to the same editor.

## Thu Aug 13 — Thursday's three: router, recipes, journeys

**Prompt:** "ok let's resume, what do we have left to do?" → a what's-left
review against DESIGN.md → "ok let's do all of thursday's stuff--if we
finish, we can move on to friday's stuff but let's do 1, 2, and 3 on
thursday's scope" (1 = imagery router, 2 = journeys, 3 = anim/VFX recipes).

**Two decisions taken to the user before writing code** (both would have
changed the build, so neither was guessed):
- *Router trigger* → **auto-label + one-tap conjure**. Every capture routes
  for a label + recipes; generation still waits for a "Conjure imagery?"
  chip. (Alternatives offered: fully automatic — burns a Snap3D generation
  per capture and can't be declined; or Enhance-tap-only — no auto-labels.)
- *Journey scope* → **route polish on the implicit journey** (persisted
  order, ribbon, next-locus glow, reordering) rather than full named
  multi-routes with a membership UI, which is most of a day on its own and
  would have eaten the other two.

**Increment 1 — the mnemonic router (`MemoryRouter.ts`).** One RSG
chat-completions call (`gpt-4.1-nano`, temp 0.9 — mnemonics want surprise,
not the median answer) turns the transcript into `{label, kind, prompt,
animRecipe, vfxRecipe}`. The system prompt encodes DESIGN's noun→mesh /
verb→image split and demands bizarre-vivid imagery. Tolerant JSON extraction
(models fence and preamble), every enum clamped to its allowed set, and a
local fallback on any failure — offline, expired token, garbage reply — that
is *still animated*, because a static mnemonic is a worse mnemonic. The
router **offers** imagery (`routeKind`/`routePrompt`); `enhance` remains the
accepted request that regenerates on load. That split is why a decline costs
nothing and a reload doesn't silently spend Snap3D credits.

DESIGN's third kind, **bitmoji**, stays Friday scope — the package isn't
installed. Until then people/actions route to `image`. Logged here rather
than quietly dropped: the enum change is one line when the package lands.

**Increment 2 — motion + VFX recipes (`GemFactory`).** Six transform recipes
(spin, bob, pulse, orbit, shake, swell) layered *on top of* the baseline idle
every gem keeps, per DESIGN's "at least idle bob + slow spin". Four particle
recipes (sparkle, smoke, burst, rain) reuse the existing additive puff family
rather than adding a second particle system — DESIGN's VFX perf risk note,
honored. Emission is rate-based with a fractional accumulator (frame-rate
independent) and triple-gated: resolved gems only, within 5 m, under a global
140-particle ceiling, plus a per-gem per-frame budget.

*The trap worth logging:* scale recipes and the Snap3D auto-fit both want to
own `localScale`. Writing scale outright would have silently undone the fit —
and Snap3D natives are tiny (measured **0.8 cm → ×16.83** this session), so
"pulse" would have shrunk a conjured object back to a speck. Fixed by storing
a per-gem `visualBase` (one for a gem, the fitted scale for a mesh, the aspect
box for an image) that recipes *multiply*. Conjured images keep billboarding,
so spin/orbit degrade to a livelier bob instead of rotating the picture away
from the reader.

**Increment 3 — journeys.** `order` persists on the memory; `routeOrder` /
`normalizeRoute` / `moveInRoute` live in PalaceStore, and records without an
order keep their capture position — old saves walk exactly as before. The
ribbon (`buildPathDashMesh`) is a dashed polyline of **crossed quads**, so it
reads from any angle without billboarding, running violet→teal so route
direction is legible at a glance; it rebuilds only on route change, never per
frame. The next locus wears a slow teal orbit ring that breathes — content-free
by construction, so Train can ring a bare glow without leaking the answer. The
memory card gains a journey row ("Locus 2 of 2" between two arrows, edit
sessions only), and Train now consumes `routeOrder()` instead of capture order.

**Verification (real preview, real network, driven via SIK puppet-hand
pinches — not asserted from the code):**
- RSG tokens regenerated first (~1 h TTL), so this exercised the live API.
- Capture → `MemoryRouter: "buy milk for Thursday" → [Milk for Thursday]
  kind=mesh anim=pulse vfx=sparkle prompt="A giant carton of milk with a
  clock face, Thursday stamped on it, being hoisted by a muscular octopus
  with a milk mustache."` — DESIGN's own example, transformed.
- Recipes applied (`GemFactory: recipes … anim=pulse vfx=sparkle`), and the
  **pulse proven live**: the gem visual read `localScale` 1.179 then 0.920
  across two runtime queries — inside the designed ±18 % band, which a static
  screenshot could never have shown.
- One-tap Conjure → `conjuring mesh` → `refined mesh swapped in` → `fitted
  enhanced mesh (0.8 cm native → ×16.83)`. The chip really does produce a 3D
  object from the router's own prompt, no typing.
- Gaze label flipped from the raw transcript to **"Milk for Thursday"** once
  routing landed.
- Second capture → `journey ribbon drawn — 2 loci`; an orthographic runtime
  capture confirms the dashed violet→teal gradient between the two gems.
- Reorder ◀ → `route move … → position 1`, saved; then Train opened on that
  memory (`next locus → mmssixemb_3huu`), proving the route order — not
  capture order — drives the walk.
- Recipes and order both survive the save/load round trip (restored from the
  store on the Train entry).

**Incidents:**
- `ExecuteEditorCode` token generation failed twice before landing: top-level
  `import` is rejected (use `await import(...)`), `resp.body` is a Buffer (not
  a string), and the Editor API's SceneObject exposes `.children`, not
  `getChildrenCount()`. The credentials component is also findable only by
  SceneObject *name* — its `type` is the bare `"ScriptComponent"`.
- Preview puppet-hand targeting went unreliable after a mid-session recompile:
  pinches by `uniqueId` timed out on the head-following start modal (the hand
  landed on the neighbouring row). Pinching by **world position** worked. The
  modal moving under a tool that resolves a position once is the likely cause;
  worth remembering before blaming a button.
- Train's teal next-locus ring is proven by log + by the ring renderer working
  elsewhere in the same capture, not by a screenshot of Train itself — the
  puppet-hand issue above ate the attempt. One manual Train run is the visual
  check.

## Wed Aug 12, ~9:30 PM — The speaker breathes while it thinks

**Prompt:** "can we have some kind of progress animation when we hit
speaker while it's loading the speech? Maybe make the spearer icon
pulsate somehow until it plays?"

**Increment:** `setSpeakerLoading(on)` on the UI — while a TTS fetch is
in flight the speaker icon breathes (±16% scale + 0.65→1.0 alpha, 2 Hz
sine, riding the existing UpdateEvent) and hard-resets to rest scale /
full alpha the moment speech plays OR the fetch fails (both promise
branches in `speakGazedMemory` flip it off; the failure path still shows
the existing "Couldn't speak that" flash). Cached memories resolve
immediately, so repeat taps never flicker. Works identically for the
Train-reveal speak path, which shares the same button and flow.

**Verification:** compile + boot clean. The pulse itself wasn't driven
live tonight — RSG tokens were hours expired, so only the instant
failure path was reachable; the animation is a sine on scale/alpha with
a state-reset that is correct by construction. One real speaker tap
(fresh tokens) is the visual check. **User check same night: "works
perfectly" — increment closed.** Day wrap (user): "check everything in,
we'll work on the remaining features tomorrow when fable resets."

## Wed Aug 12, ~9:25 PM — The speaker button comes inside

**Prompt:** "Can this speaker button fit inside the panel? as you can see
it's kind of floating on top of and outside of it" (screenshot: gaze
label, speaker chip hanging off the plate's top-left corner)

**Increment:** size disagreement in buildGazeLabel — the BackPlate hugs
the outer flex column (width 15) but the row inside carries speaker 2.8 +
gap 0.6 + text 13 in a 17-wide slot, needing 18.8 with padding: the
overflow pushed the chip out of the plate. Column widened to 19 (the slot
+ 2×padX, now documented in-line). Audited every other hugged plate for
the same class: transcript/memory cards, sigil and Done labels all
consistent (Done is exact at 5.0); only the gaze label disagreed.

**Verification:** drove Load → "Palace 1" (leftover harness palace) into
a session, aimed the camera at its gem from 150 cm, let the 0.8 s dwell
fire — capture shows the same "buy milk for Thursday" label as the
user's screenshot with the speaker chip INSIDE the plate, left of the
text, vertically centered. Compile + boot clean.

## Wed Aug 12, ~9:20 PM — Status pills clear the gaze label

**Prompt:** "the 'memory placed' panel is overlapped by the text label on
the memory. Can you fix that positioning? The sounds are great, BTW"
(solfeggio palette: user-approved ✓)

**Increment:** guaranteed collision — the "Memory placed (N)" pill
anchored at gem +12 cm while the gaze-reveal label blooms at +11, and you
are always gazing at the gem you just placed, so the label rose straight
into the pill. All three gem-anchored flash sites (placement, conjuring,
enhancement-removed — same +12 pattern) now use `FLASH_GEM_LIFT = 26`,
clearing the label plate + bob with ~9 cm of air while staying visually
attached to the gem. Compile + boot clean; geometry is deterministic
(pill bottom ≈ +23 vs label top ≈ +14) — one-glance user check on the
next placement.

## Wed Aug 12, later still — The palace retunes itself (solfeggio audio)

**Prompt:** "ok let's do the audio polish. I think we should aim for
somethiing more light, airy and solfreggio" (+ links to the
HowStuffWorks solfeggio-frequencies article and a solfeggio music video)

**Increment:** the entire SFX family regenerated from one script
(`tempAssetGen/gen_sfx_solfeggio.js`) around two shared voices — struck
crystal (low-index FM, 3–40 ms soft attacks) and band-passed breath —
with pitch material drawn ONLY from **396/417/528/639/741/852 Hz +
octaves**, replacing C-pentatonic as the "one key, one family" system.
Four reworks by same-filename swap (`twinkle` shimmer, `gazehum` breathy
396 pad — loop-safe by construction: integer-cycle duration,
loop-periodic LFOs, spliced noise tail — `place` chime-settle with no
thump, `vaporize` reverse-shimmer) and eight NEW cues wired positionally:
`shutter` (852 etch at the crop instant — the snapshot finally sounds),
`cardopen`/`cardclose` arpeggio pair (close only on user taps;
programmatic teardowns stay silent), Train `reveal` bloom, the grade
trio (Remembered 528+639+852 triad · Almost plain 417 · **Forgot soft
warm 396+198, the quietest — never punishing**), and `complete`, the
rising 396→528→639→852 phrase seeding DESIGN's mastery-melody. Gazehum
loop corrected to LowPower per the ambient rule. Volumes 0.22–0.5 per
the brightness hierarchy. Nothing cut.

**Verification:** one driven pass with AudioPlayer open-lines as
evidence — shutter at the exact crop instant, landing, card open/close,
reveal, both driven grades each followed by the completion motif.
Compile + boot clean. **Timbre judgment deliberately left to the user's
ears** — logs prove the right clip fires at the right moment, not that
it sounds airy.

## Wed Aug 12, late night — Memories get photographs (2D snapshot capture)

**Prompt:** "ok do the 2d snapshot cpature" (after a what's-left review
that ranked it the top core gap — it was the "if time allows" item from
Wednesday's milestone).

**Increment:** new `SnapshotService.ts` — a continuous CameraModule
`requestCamera` texture (editor-friendly; `requestImage` is device-only)
spins up lazily at wizard start, and the reticle confirm (which IS the
FRAME gesture — v1 keeps DESIGN's pinch-drag rectangle folded into
AIMING) captures a square crop, 40% of frame height, centered on the
anchor's screen projection: `cropped 636×636 @ (376,474) of 1392×1590 →
192 px + 16 px tiny`. The 192 px JPEG feeds a new photo row on BOTH
memory cards (edit + read-only, async-decoded on palace load); the 16 px
twin's bilinear upscale is a free gaussian-ish blur that completes the
vanishing interface: **Train mastery 2 now shows the blurred snapshot at
the locus** (16 cm billboarded quad, hidden on reveal), mastery 3 stays
bare glow — the Learn/Practice/Recall/Mastered ladder is fully populated.
Photos persist as base64 pairs (~3 KB each) under a 40 K-char per-palace
budget; over budget they stay in-session-only with a log line (DESIGN's
risk note allows exactly that degrade).

**Cut:** amber inclusion (photo inside the gem shell) deferred — not a
one-try win against the faceted gem material; the card photo + blurred
hint carry the value. On-device parallax between render and RGB cameras
accepted for a centered crop. `ProceduralTextureProvider.create`
deprecation warning noted for a later migrate-to-`createWithFormat`.

**Verification:** builder pass — crop dims + persistence chars logged,
card photo screenshot shows the aimed potted plant, blurred-hint tier
log-verified via forced mastery 2, one organic end-to-end run with real
mic ASR while the capture path was live. Orchestrator re-verified compile
+ clean boot. Leftover harness palaces sit in the editor store until LS
restarts.

## Wed Aug 12, night — Button tooltips + the "?" help view

**Prompt:** "make that line display what each button does as you
highlight it… If no button on the main menu is highlighted then there's
no text… Basically a tooltip. Also in the lower left corner let's have a
small circular help button with a ? icon… brings up a help menu… X button
active in the upper left hand corner… title bar says INSTRUCTIONS and the
body text will explain what the app does and its modes. I can be a
scrollable text field."

**Increment:**
- **Tooltips**: the modal hint line is now a hover tooltip slot — empty
  when idle, per-button copy on hover (New "Press New to start a palace",
  Load "Load and edit an existing palace", Explore "Walk your palace and
  relive its memories", Train "Quiz your recall, locus by locus", help
  chip "How Memory Palace works"). Wired via UIKit Element's public
  onHoverEnter/onHoverExit on each Button; cleared on view swaps (hover
  exit doesn't fire across a swap). The old always-on first-run hint and
  its editor-mode override are retired.
- **Help**: teal circular "?" chip lower-left (Material question_mark via
  IconSelector, paired with the FLARB credit in a SpaceBetween row) opens
  a third modal view — X button upper-left (Material close) back to main,
  tracked-out INSTRUCTIONS title, and body copy covering the app + all
  four modes, one flex row per paragraph, left-aligned.
- **ScrollWindow post-mortem (honest)**: the scrollable-field version was
  built first — UIKit ScrollWindow masks correctly once you size
  `windowSize`, and the fade-mask ghosting over the title traced to an
  under-estimated content height — but its pinch-drag scroll input loses
  to the Frame's whole-panel InteractionPlane (the drag grabs the panel
  move affordance instead; a bare Text also needs a collider before
  ScrollWindow will even hit-test it). Parked scroll; the full text fits
  a taller panel today ("can be scrollable" read as permissive). Revisit
  only if the copy outgrows the panel.

**Verification:** synthetic hand was flaky again, so the whole loop ran
on the editor's real mouse-interactor path via injected preview taps:
captures show the tooltip live over the chip ("How Memory Palace works"
in the hint slot), the INSTRUCTIONS view with every paragraph visible and
cleanly stacked, and the X returning to the main view. Boot clean each
cycle.

## Wed Aug 12, evening — The menu follows your gaze downhill

**Prompt:** "the main menu doesn't seem super responsive to the vertical
follow, shouldn't it move towards my gaze over time at least So if I
stopped looking here, it should slide into view?" (screenshot: modal
stranded high, only its bottom edge in frame while looking at the couch)

**Increment:** root cause read straight out of UIKit's source
(Cache/…/Frame/modules/SmoothFollow.ts): inside the tilt band (±25° up /
35° down pitch) SmoothFollow does NO vertical follow at all — its own doc
says it "doesn't affect positioning when the user looks up and down" —
and past the thresholds, tilt mode gaze-tracks but then RESTORES the
pre-tilt elevation on exit. Looking at the couch (~15–20° down) sits in
the dead band forever. Fix: `updateModalVerticalAssist()` in
MemoryPalaceUI — inside the dead band, ease the frame's world-Y toward
the gaze line at the panel's distance (7° wake deadzone, 2° rest, ~0.5 s
time constant, ±38 cm elevation clamp to stay inside SmoothFollow's
band). It's cooperative, not a fight: SmoothFollow's neutral branch
adopts current Y as its target, so the two writers converge. Steep
pitches still belong to UIKit tilt mode; drags yield via the frame's
public onTranslationStart/End.

**Verification:** isolated the assist from UIKit tilt with a controlled
preview test — reset camera to level (panel glides back), then pitch
-15°, squarely inside the dead band UIKit ignores: capture shows the
modal centered in the lowered view (pre-fix it stayed stranded high, as
in the user's screenshot). Boot + logs clean.

## Wed Aug 12, later still — UI sizing audit: the pill learns to wrap

**Prompts:** "make sure every UI element is properly sized. Look at this
one — when I Start train mode, the text spills out." (screenshot: the
Training "Verify Palace" — follow the ping toast overflowing its plate)
— then mid-fix: "Make the text wrap".

**Increment:** root cause — the status pill's plate hugged a flex child
fixed at 15 cm (sized for wizard captions like "Hold steady…") while its
Text rendered at natural width (Body@150 ≈ 0.64 cm/char → Train's 42-char
message ≈ 27 cm: spill). Fix: the status text gets a real wrap box
(24 cm, the same textIn wrap branch the gaze label already proves out)
and `setStatusText` becomes the plate's single writer — snug single line
for short captions, wrapped 2–3 lines for long toasts, 68-char ellipsis
cap; over-estimation biased tall (centered text in a roomy pill, never
spill). Audit of every text surface: modal toast line ellipsized at 46
(its slot is deliberately layout-stable — wrap would collide with the
credit row), picker rows ellipsize palace names at 20 chars ("name — N
memories" in a 17 cm row; names are user-authored and unbounded),
transcript/memory-card/gaze-label already wrap, static labels sized at
build. Compile + boot clean. The synthetic hand went nondeterministic on
the modal again (two pinch timeouts on a label-verified Train button —
same episode class as the 2 a.m. note below), so the visual leg is the
user's 5-second click: press Train, the pill should wrap to two lines.

## Wed Aug 12, later afternoon — Train mode v1 (recall quiz), on a shoestring

**Prompt:** "ok can we build train mode with what little usage we have left?
My fable usage resets tomorrow but I wonder if we can squeak by with a 1st
pass at train mode?"

**Increment:** the Train button goes live. New `TrainController.ts` +
`TRAIN` state: journey v1 = the active palace in capture order; every
locus hides as a bare glow (Explore's glint rendering, auto-resolve off,
gaze reveal excluded — no answer leaks); the current target pings
positionally (twinkle.wav reused — spatial wayfinding); within 260 cm the
prompt card blooms ("What lives here?" → Reveal, or pinch the gem when
it's tangible); reveal obeys the **vanishing interface** by mastery
(0 gem+words · 1 gem only · 2+ bare glow; blurred-snapshot tier deferred —
no 2D snapshots yet); self-grade Remembered/Almost/Forgot (muted, never
punishing) walks the mastery ladder ±1 clamped 0–3, persisted per grade
(PalaceStore `mastery`, schema-safe on old saves); completion toast
"Route complete — X/N remembered" → modal. Chip-only sigil exits, as in
Explore.

**Budget craft (the actual story):** usage nearly gone, so instead of a
fresh builder re-reading the codebase (~375k tokens for Explore), the
*same* builder agent was resumed with its context intact and a
pre-scoped brief: explicit cut list, no asset generation, verification
capped. It finished in 34 tool calls (vs 124), cut only grade SFX, and
proved the ladder organically: three quiz cycles across lens resets —
mastery 0→1→2 shown as words→gem→glow, forgot-floor 0→0, reload
masteries `2,0`. Orchestrator re-verified compile + clean boot, then
committed. Deferred honestly: grade SFX, blurred-snapshot tier,
pinch-reveal on bare-glow targets (button-only at mastery ≥2), journey
editing, encoding walk.

## Wed Aug 12, afternoon — Explore mode (walk your palace)

**Prompt:** "Ok, let's build 'explore' mode"

**Increment:** the Explore button stops being a coming-soon stub. New
`ExploreController.ts` drives the view-only palace walk per DESIGN.md:
distant anchors render as anonymous additive **glints** (violet core, teal
halo, shimmer-pulse; collider/gaze/content hidden — nothing leaks at range)
that **resolve** into the gem/conjured object on approach (260/330 cm
hysteresis); ONE **proximity whisper** at a time (nearest wins) opens at
3 m — *before* visual resolution, so you hear memories before you see
them — with a distance-driven volume ramp (0→0.42 by 0.9 m), sourced from
the per-memory TTS cache (no recorded-audio persistence yet, by design);
sparse **twinkles** on the nearest-3 glints (2.5–7 s cadence, 0.9 s global
cooldown, new crystal-family `twinkle.wav`). EXPLORE state in
MemoryPalace.ts resolves the active palace (graceful "Nothing to explore
yet" when empty), suppresses all edit affordances — sigil shows only the
teal **Done chip** as the exit — and the memory card opens **read-only**
(Close only). Gaze reveal + TTS speak button carry over. Runtime
AudioListener added to the camera (spatial audio prereq).

**Verification:** builder self-test via seeded 3-anchor harness (removed
after), then an independent QA pass on the *real* path: synthetic pinch on
the label-verified Explore button → glint/twinkle/whisper/resolve/exit all
proven from logs (ramp math exact: vol=0.31 at 147 cm) + captures (glints,
resolved gem with label, restored modal). Two bugs caught mid-build:
track-less AudioComponent property-write crash, missing AudioListener.
Remaining user click-leg: gem select → read-only card. "Verify Palace"
(3 memories) left in the editor store for manual testing; gone on LS
restart. RSG-token caveat: whisper TTS falls back to silent glint after
the ~1 h token expiry.

## Wed Aug 13 — The palace speaks (TTS on the gaze label)

**Prompt:** "put like a 'speaker' button next to the text label on a memory.
If you click on that, it will speak the text in the label?"

**Increment:** the gaze label gains a teal volume_up icon button beside the
text. Tap → `OpenAI.speech({model: "tts-1", voice: "shimmer"})` via RSG
resolves directly to an AudioTrackAsset (no decode plumbing needed) → played
positionally at the gem (one-shot host TTL raised to 12 s for speech length).
Per-memory TTS cache so repeat taps are instant and free. Voice "shimmer" —
the closest to the arcana palette. Compile-clean; the click itself is
user-verified (synthetic hand retired for the night).

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

---

# Design phase (Tue Aug 11, before any build)

## Ideation
**Prompt:** "I'm competing in this hackathon: https://lenslist.co/clad-summer-hackathon
Give me some ideas for the week 1 theme 'organize'"
→ Fetched the brief (themes, 50/25/25 judging, submission format), generated an
idea slate; **AR Memory Palace** selected.

## Method-of-loci research
**Prompt:** "how do memory palaces work in real life and how can we adapt and
improve it for SPECS?"
→ Cognitive-science grounding (Krokos et al. 2018: HMD palaces +8.8% recall;
VR MoL feasibility ~22%), core design tension named (spatial sticky notes vs.
training wheels that fade), encode/walk/recall loop proposed.

## Design synthesis
**Prompt:** "ok let's design and plan this. Check out this design that Codex
made, let's incorporate the best ideas from this…" (+ user's multimedia-anchor
concept: audio + 3D + 2D snap per memory, persistent anchors, outdoor)
→ DESIGN.md v1: Capture + Train pillars, memory-anchor data model, LLM mnemonic
transformer, hint ladder, spatial-audio whisper, decay, journeys.

## Capture-flow UX
**Prompt:** capture wizard questions — start modal? hand UI? gem placeholder?
"animation of some sort" for abstract concepts? "use bitmoji optionally?"
→ KB-verified: Snap3D outputs STATIC GLB (→ LLM-tagged procedural animation
recipes), Bitmoji 3D confirmed on Specs (Mixamo clips via Animation Player).
Designed Frame → Speak → Place → Conjure with the gem-hatch pattern.

## The Sigil
**Prompt:** "How can we have the interface on your palm if there's already an
interface on your palm? The global Snap OS interface?" (+ ethereal swirl +
ambient aura ask)
→ Docs: OS reserves only its small system button; rest of the hand is the
Lens's. Non-dominant back-of-hand swirl per official hand-menu guidelines;
audio ducking during recording designed in.

## Sound design
**Prompt:** "We should also have sound design on other events to give juicy
feedback on interactions."
→ Full event→SFX map: one pentatonic key, hierarchy by brightness, spatial
wayfinding pings, mastery melody, never-punish rule.

## Branding
**Prompt:** "We should also design a logo… Can you generate logos or should I
provide one?" → three hand-built vector concepts (Keystone / Sigil / Amber);
**"Wow, I love these! Let's use concept 1"** → Keystone locked, production
variants generated.
**Prompt:** "yes let's use that design as the visual north star for the app —
both in imagery and typography" → Branding/STYLE.md doctrine (palette tokens,
AR-legibility type rules, orbit-ring = focus indicator, semantic amber).

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
