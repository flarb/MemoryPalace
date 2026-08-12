# CLAD Prompt Log — MemoryPalace

Chronological log of the AI-assisted (CLAD) workflow building this entry. Agent: Claude Code (Fable 5) + Lens Studio MCP toolkit. Appended after each working increment.

## Phase 0 — Ideation (Tue Aug 11)

- **Prompt:** *"I'm competing in this hackathon… Give me some ideas for the week 1 theme 'organize'"*
  → Agent fetched the hackathon brief (themes, judging weights, submission requirements), generated idea slate. Memory-palace concept selected.
- **Prompt:** *"how do memory palaces work in real life and how can we adapt and improve it for SPECS?"*
  → Agent researched method-of-loci cognitive science (Krokos et al. 2018 HMD recall study; VR MoL feasibility studies), identified the core design tension (spatial sticky notes vs. actual memory training → "training wheels that fade"), proposed the encode/walk/recall loop.

## Phase 1 — Design (Tue Aug 11)

- **Prompt:** *"ok let's design and plan this. Check out this design that Codex made, let's incorporate the best ideas…"* + user's multimedia-anchor concept (audio + 3D + 2D snap per memory, persistent anchors, outdoor)
  → Agent synthesized both designs into DESIGN.md: Capture pillar (spatial memory recorder) + Train pillar (method of loci), added LLM mnemonic transformer, blurred-snapshot hint tier, spatial-audio whisper, decay visualization, journeys/spatial inbox.
- **Prompt:** capture-flow UX questions (start modal? hand UI? gem placeholder? animation for abstract concepts? Bitmoji?)
  → Agent verified against LS knowledge base: Snap3D = static GLB (→ procedural animation recipes tagged by LLM), Bitmoji 3D confirmed on Specs (Mixamo-clip animation via Animation Player). Designed the 4-step capture wizard (Frame → Speak → Place → Conjure) with gem-hatch pattern.
- **Prompt:** palm-UI collision with Snap OS system button
  → Agent verified "Space on the Hand" + hand-menu guidelines; designed the Sigil (back-of-hand, non-dominant, ethereal swirl + aura loop, audio ducking during recording).
- **Prompt:** *"We should also have sound design on other events"*
  → Full event→SFX map: single pentatonic palette, hierarchy, spatial wayfinding pings, mastery melody, concurrency caps.

## Phase 2 — Branding (Tue Aug 11)

- **Prompt:** *"We should also design a logo… Can you generate logos or should I provide one?"*
  → Agent authored three vector concepts (Keystone / Sigil / Amber). User selected **Keystone**; production variants generated; Keystone locked as the app-wide visual north star (Branding/STYLE.md: palette tokens, AR-legibility typography rules, orbit-ring focus indicator, semantic amber).

## Phase 3 — Build (Tue Aug 11 → )

- **Prompt:** *"ok. let's go! Build it!"*
  → Router gate (project/MCP/sign-in), git init + design-phase commit, spawn specs-experience-builder: scene bootstrap, branded start modal, Sigil v0, capture wizard skeleton.
