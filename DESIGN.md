# MemoryPalace (working title — alt: "Loci")

**CLAD Summer Hackathon — Week 1: Organize**

> Turn any real place into a memory system. Speak a memory, pin it to the world as sound + image + 3D scene, then walk your palace to relive it — or train until you don't need the Lens at all.

## The two pillars

1. **Capture** (spatial memory recorder) — pin multimedia memories to real locations, indoor or outdoor. External memory: organize your thoughts in space. *(Ralph's design)*
2. **Train** (method of loci) — an optional layer that quizzes you along a route and progressively removes assistance until the memory is internal. *(Codex design, recast on top of the capture pipeline)*

## UI & modes

- **Start modal** (house pattern): floating SpectaclesUIKit panel on launch with three buttons — **Capture · Explore · Train** — plus a first-run hint showing a hand icon ("glance at your hand to capture"), per Snap's hand-menu guideline that users won't find hand UI without a hint.
- **The Sigil — back-of-hand summon.** Snap OS reserves only its small persistent system button on the hand; the rest of the hand is explicitly ours ("Space on the Hand" guideline). Our affordance: glance at the **back of your non-dominant hand** → an **ethereal particle swirl** blooms above the knuckles (VFX Graph, attached via SIK `ObjectTracking3D` hand keypoints) with a floating **"New Memory"** label. Tap/pinch it with the dominant hand → capture wizard starts. Non-dominant placement follows the official guideline (dominant hand stays free for targeting); back-of-hand keeps clear of the system button's spot; SIK's hand occluder lets particles wrap behind fingers for free ethereality.
- **Sigil availability:** always-on in Capture and Explore (capture-anywhere is the app's point); suppressed during Train quizzes to prevent accidental captures.
- **Aura sound:** the sigil emits a quiet looping new-age ambient pad — positional, anchored to the hand — with an intensity ramp on hover and a chime on select. One "arcana" audio/VFX family reused everywhere: sigil swirl → gem forging shimmer → hatch burst share one particle system restyled, which keeps the aesthetic coherent *and* the particle budget Specs-friendly.
- All capture steps happen **diegetically at the location** — no modal walls once the wizard starts.
- **Branding (locked):** the **Keystone** mark — faceted gem inside a palace arch with orbit ring, "MEMORY PALACE / AR" wordmark. Assets in `Branding/` (`logo-memorypalace-card.svg` for README/video title card, `logo-memorypalace-transparent.svg` for the start modal). Brand palette: deep indigo `#170d31`, violet `#7c6cf0`, teal `#4dd6c1`, lavender text `#ede9ff`. **The in-lens gem uses the logo's violet→teal gradient material** — one material story from logo to hand sigil to placed gems. Pipeline: `ConvertSvgToTexture` for the modal texture (if `<text>` doesn't survive conversion, rasterize the lockup and import as PNG); `GenerateLensIcon` in matching style for the lens icon. **The Keystone lockup is the visual north star for the entire app — imagery and typography. Full doctrine: [Branding/STYLE.md](Branding/STYLE.md)** (palette tokens, type scale + AR legibility rules, shape language, materials, motion). All UI work — mine or subagents' — follows STYLE.md.

## Capture flow (the wizard)

**Step 1 — FRAME (required).** Pinch-drag to draw a rectangle over the area you're memorializing (the crop-sample pattern). On release, CameraModule captures a still cropped to that region. **Two-fer:** the frame's center ray also seeds the anchor position — framing and placement are one gesture.

**Step 2 — SPEAK.** Mic + ASR start automatically on frame confirm (no extra pinch). Transcript streams onto a floating card beneath the frame. Auto-stop on ~1.2s silence, or pinch to stop. Audio buffer is kept. **All lens audio (aura loop, ambience) ducks to silence while recording** — keeps the saved clip clean, helps ASR, and doubles as the "we're listening" cue.

**Step 3 — PLACE (optional surface pin).** Default: the memory anchors free-floating at the frame center — works outdoors, on windows, mid-air. Or tap **"Pin to surface"**: hand-ray reticle with a live WorldQuery preview (a ghost gem snapping to surfaces, aligned to the normal); pinch to confirm. The gem drops with a land-thunk and dust puff.

**Step 4 — CONJURE (optional generation).** A chip appears above the gem: **"Conjure imagery?"** Accept → the imagery router runs (below); the gem shimmers ("forging") while generation runs async. When the asset arrives — 20–60s later, you may have walked away — the gem **cracks open and the object hatches** with particles. Decline or fail → the gem simply remains the permanent marker.

## The gem

The gem **is** the default POI marker — one object, three jobs:

- **Amber inclusion:** the 2D snapshot is embedded *inside* the crystal, visible through its facets. Memories trapped in amber.
- **On select (any mode):** the gem blooms open into the memory card — photo, text, audio playback, re-conjure button. This stays true even after hatching (the conjured object stands on a small gem base; selecting either opens the card).
- **State display:** bright = fresh · shimmering = forging · hatched = conjured · dusty/faded = review overdue (decay, stretch).

## Imagery router (one RSG LLM call)

When the user conjures, a single LLM call (Remote Service Gateway → Gemini/OpenAI) transforms the literal transcript into mnemonic direction and returns JSON:

```
{ label,                       // 2–4 word punchy title
  kind: "mesh" | "bitmoji" | "gem",
  meshPrompt?,                 // bizarre vivid imagery prompt for Snap3D
  bitmojiAnim?,                // clip id from our bundled set
  animRecipe,                  // spin | bob | pulse | orbit | shake | swell | none
  vfxRecipe }                  // sparkle | smoke | burst | rain | none
```

**Routing rule the prompt encodes:**
- Objects / concepts / things (nouns) → **mesh**: Snap3D generates from `meshPrompt` ("buy milk" → "cartoon cow doing a handstand spraying a milk fountain").
- People / actions / events (verbs, social) → **bitmoji**: *your own avatar* acts out the memory ("call mom" → your Bitmoji miming a phone call on the kitchen counter). Near-instant download vs Snap3D's long generation.
- Offline / generation failure → **gem** stays (never block, never error-wall).

**Animation is mandatory, not decoration.** Verified: Snap3D returns **static GLB** — and mnemonic research says static imagery underperforms for abstract content (formulas, events). So motion is ours:
- 6–8 procedural transform recipes (tween-driven: spin, bob, pulse, orbit, shake, swell) + 3–4 VFX prefabs from the Asset Library (sparkle, smoke, burst, rain). The LLM tags every memory with `animRecipe` + `vfxRecipe`.
- Every conjured object gets at least idle bob + slow spin; abstract concepts get aggressive motion + VFX (the motion carries the encoding).
- Bitmoji: verified pattern — import Mixamo-compatible FBX/GLB clips, play via Animation Player ("Adapt to Mixamo" toggle; Animation State Manager for blending). We bundle ~8 clips (phone-call, wave, point, dance, facepalm, lift, run-in-place, shrug) as the LLM's fixed vocabulary.

## Sound design (the arcana palette)

**System rules:**
1. **One key, one family.** Every SFX is crystal/glass/breath/pad timbre, pitched in a single pentatonic key — overlapping sounds always harmonize, never clash.
2. **Hierarchy by brightness/loudness:** hover < select < commit < milestone. Small sounds for small acts.
3. **Positional by default** — sounds emit from the thing (gem, locus, hand). `LowLatency` audio mode for interaction feedback; `LowPower` for ambient loops.
4. **Ducking:** full duck of all lens audio during mic recording (the silence *is* the "listening" cue); partial duck of ambience while a memory's audio plays.
5. **Concurrency caps:** nearest-N glint twinkles only; one proximity whisper at a time (nearest wins). A palace of 30 memories must never become a wind-chime shop.
6. **Never punish.** Wrong recall = soft low felt tone, not a buzzer. This app is a kindness.

**Event map:**

| Event | Sound |
|---|---|
| Sigil bloom / hover / select | shimmer-in · aura swell · chime |
| Frame drag / snapshot confirm | granular etch loop while dragging · crystalline glass-ping "shutter" |
| Recording start / stop | full duck + one low bell · resolve bell |
| Ghost gem surface hover | soft hum, pitch eases as it snaps |
| Gem landing | low thump + crystal settle + dust (THE placement juice) |
| Conjure accepted / forging | furnace-shimmer loop on gem (quiet, positional) |
| **Hatch** | crack + particle burst + harmonic bloom — the screen-record moment |
| Conjure fail / decline | soft fizzle, non-punishing |
| Glint (distant anchor) | sparse twinkle, nearest-N capped |
| Proximity whisper | memory's own audio, low-pass filtered + faint, unfilters as you near |
| Gem bloom-open / card close | unfold arpeggio · short reverse |
| Journey start / next-locus guide | rising motif · periodic soft ping **from the target's direction** (spatial audio as wayfinding) |
| Reveal / self-grade | bloom · Remembered = bright triad, Almost = neutral tone, Forgot = soft low felt |
| **Mastery level-up** | each tier adds a note to the palace's melody — a fully mastered journey plays the complete phrase on completion. Your palace becomes an instrument. |
| Save confirm / error | subtle tick · muted felt tone |

**Sourcing & scope:** ~15-clip MVP set generated in one `/build-sfx` batch (same prompt family for timbre coherence); ambient pad from the licensed music library if generation falls short. Core juice (gem landing, snapshot ping, hatch) ships *with* its feature — juice exposes interaction bugs early and the demo needs it; the full map lands Saturday polish day.

## Data model

```
MemoryAnchor {
  id, createdAt
  anchorId                 // Spatial Anchors API handle
  transcript, label
  audioRef                 // in-session buffer (MVP); Snap Cloud ref (stretch)
  snapRef                  // 2D snapshot — required, captured at frame step
  mediaKind                // gem | mesh | bitmoji
  meshRef?, bitmojiAnim?
  animRecipe, vfxRecipe
  journeyId?, order?       // route membership ("spatial inbox" if null)
  mastery                  // 0 Learn · 1 Practice · 2 Recall · 3 Mastered
  lastReview, nextReview   // SM-2 lite (stretch)
}
```

## Explore mode (walk your palace)

- Distant anchors render as soft **glints**; resolve into gem/object as you approach.
- **Spatial audio whisper**: within a few meters the memory's audio plays faint and positional — you hear memories before you see them. Select for full playback + card.
- Outdoor: beyond mapped-space reliability, fall back to GPS + heading proximity (coarse "~20m north" arrows), labeled experimental.

## Train mode (method of loci)

- **Journeys**: organize inbox captures into a named, ordered route; ribbon connects loci; next locus glows. (Organizing your memories — the theme, literally.)
- **Encoding walk**: guided tour in order; object animates hard on approach; user speaks the connection aloud.
- **Recall quiz**: media hidden. Say what lives at each locus, pinch to reveal, self-grade (Remembered / Almost / Forgot). Stretch: auto-grade via transcript keyword overlap or LLM judge.
- **Vanishing interface** (assistance shrinks as mastery grows):

| Mastery | What you see |
|---|---|
| Learn | Object + text + audio |
| Practice | Object only |
| Recall | **Blurred snapshot** hint |
| Mastered | Bare glow |

- **Memory decay** (stretch): overdue anchors dust over (shader driven by timestamp); reviewing restores vibrancy. The palace shows you what you're about to forget.

## Feature → API map

| Feature | Spectacles capability |
|---|---|
| Frame-draw snapshot | CameraModule still capture + crop pattern |
| Surface pin | WorldQueryModule hit test + normal alignment |
| Persistence | Spatial Anchors API + persistentStorageSystem metadata |
| Speech → text | ASR Module (not deprecated VoiceML) |
| Audio record/playback | AudioComponent + mic (Voice profile); positional playback |
| Mnemonic router | Remote Service Gateway → Gemini/OpenAI (JSON out) |
| Text → 3D | RSG → Snap3D (static GLB, long latency — always async) |
| Avatar memories | Bitmoji 3D package (LS 5.15+ / OS 5.63+) + Animation Player + bundled Mixamo-style clips |
| Object motion | Tween recipes + Asset Library VFX prefabs |
| Hand sigil | VFX Graph swirl + SIK `ObjectTracking3D` hand-keypoint attachment + hand occluder |
| Blob storage (stretch) | Snap Cloud (Supabase) storage |
| Outdoor coarse mode | GeoLocation (GPS + heading) |
| Hands/UI | SIK (palm button, hand ray) + SpectaclesUIKit |

## Scope tiers

**Core (must ship, Tue–Thu):** start modal + palm trigger; full capture wizard (frame-snap → speak → optional pin) with gem; anchor + metadata persistence; Explore select → card with photo/text/audio (in-session audio OK); one journey with recall quiz + self-grading + mastery ladder.

**Wow (should ship, Thu–Sat):** imagery router + Snap3D hatch + prop/animation recipes; Bitmoji route; spatial-audio whisper; blurred-snapshot hint tier; placement/hatch juice.

**Stretch:** Snap Cloud blobs; decay shader + spaced repetition; outdoor GPS mode; palm mini-map; multiple palaces; voice trigger; LLM auto-grading.

## Build plan (Tue Aug 11 → Sun Aug 16 PT)

| Day | Milestone |
|---|---|
| Tue | Scene bootstrap (camera, SIK, UIKit); git init + first commit; start modal + palm button; wizard v0: frame-draw → ASR card → gem drop (free-float). |
| Wed | Surface-pin step; snapshot capture wired into gem inclusion; anchor + metadata persistence; Explore select → memory card + audio. |
| Thu | Journeys + recall quiz + mastery ladder. RSG wiring + imagery router (LLM JSON). **Core feature freeze.** |
| Fri | Snap3D async hatch + anim/VFX recipes; Bitmoji route + bundled clips. |
| Sat | Spatial-audio whisper, blurred hint, SFX/particles, lens icon; on-device passes; decay shader if cheap. |
| Sun | Demo video, README, CLAD prompt log cleanup, submit. |

**CLAD discipline (50% of judging):** build agentically, commit each working increment, keep the prompt log in-repo (`PROMPTLOG.md`).

## Risks

- **Snap3D latency/failure** → gem-first design; hatch is a bonus, never a gate.
- **Bitmoji clip retargeting** → known gotchas (blend mode Default, parent scale) per docs; test one clip end-to-end early Friday before bundling eight.
- **Permissions**: camera + mic + internet (RSG) triggers the sensitive-data permission flow — test the prompt path on device Saturday, and keep the capture wizard functional in preview with simulated inputs.
- **Audio/photo blob persistence** → MVP persists transcript + pose + params; audio in-session; Snap Cloud is stretch.
- **ASR in noisy env** → self-grading avoids ASR-dependent scoring; typing fallback in preview; lens audio ducks during recording.
- **VFX perf on device** → one shared particle-system family (sigil/forge/hatch) with low counts, restyled per use, not three bespoke systems.

## Demo script (submission video)

Cold open: Simonides banquet story (10s). "Your brain is great at places, terrible at lists." Frame a bookshelf, speak "dentist Tuesday" — gem drops, then cracks open into a molar wearing a wristwatch, spinning. Speak "call mom" at the kitchen counter — your own Bitmoji hatches out miming a phone call. Walk the route once. Train mode: everything hidden, deliver all six from bare glows. Tag: *"Organize your mind in the world it already knows."*
