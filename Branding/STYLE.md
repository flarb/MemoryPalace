# MemoryPalace Visual Style Guide

**North star: the Keystone lockup** (`logo-memorypalace-card.svg`). Every panel, particle, and letterform in the app should look like it lives inside that image.

## Palette

**Core tokens:**

| Token | Hex | Use |
|---|---|---|
| Void indigo | `#100822` | Deepest background, vignette edges |
| Palace indigo | `#170d31` | Panel/base background |
| Twilight | `#241548` | Panel gradient top, highlights |
| Violet | `#7c6cf0` | Primary interactive, glows |
| Light violet | `#a88bff` | Gem gradient top, highlights |
| Teal | `#4dd6c1` | Accent, progress, orbit rings |
| Lavender text | `#ede9ff` | Primary text |
| Muted lavender | `#9a8be8` | Secondary text, line-art strokes, dividers |

**Semantic:**

| Meaning | Color | Notes |
|---|---|---|
| Mastery / success | Teal `#4dd6c1` | Recall correct, journey complete |
| Active / interactive | Violet `#7c6cf0` | Buttons, hover glow |
| Overdue / decay | Amber `#ffb054` | **The only warm note in the app** — reserved exclusively for "needs review," so it pops instantly (inherited from Concept 3, which now has a job) |
| Destructive | Soft rose `#ff7a9a` | Delete memory; never alarm-red |

**Gradients:** gem = `#a88bff → #7c6cf0 → #4dd6c1` at 45°; accent text/chips = `#8f7bff → #4dd6c1` horizontal.

## Typography

**Voice:** feather-light, tracked-out, celestial. But: *the logo may whisper; functional UI must speak* — AR text sits over the real world, not a controlled background.

- **Typeface:** one light geometric sans family — target **Montserrat** (Light 300 / Regular 400 / Medium 500), or closest match from `FontSelector` at build time.
- **Display** (titles, mode names): UPPERCASE, Light 300, letter-spacing +8–12%, lavender `#ede9ff`.
- **The rule-line divider motif** (from the "— AR —" lockup): small tracked uppercase label centered between two thin rules — the standard section header on panels.
- **Body** (cards, transcripts): Regular 400, sentence case.
- **Caption/meta** (dates, counts): Regular 400, muted lavender.
- **UI copy is sentence case** — every user-facing string starts with a capital ("Pinch to finish", "Placing memory in 3…"). The tracked-out all-caps treatment is reserved for display type (wordmark, mode titles).

**AR legibility rules (non-negotiable):**
1. Functional text is weight ≥ 400; Light 300 only for large display type.
2. Panels behind text render at 92–96% opacity — the "background" is someone's sunlit kitchen.
3. Pure white `#ffffff` is reserved for sparkles, never text fills.
4. No yellow anywhere — Snap OS owns yellow for system targeting feedback.

## Shape & imagery language

- **Thin line-art** (2–3px at panel scale), rounded caps: arches, underlines, dividers.
- **The arch/portal** frames things: modal borders, empty states, the Train-mode "enter journey" moment.
- **Faceted low-poly gems**: flat-shaded facets via white/black opacity overlays — never smooth glossy PBR.
- **The orbit ring** (dashed teal ellipse, ~-12° tilt) is the app-wide focus/selection indicator: hovered gem, active locus, selected list item — everything focused earns an orbit.
- **4-point sparkles + dust motes**: sparingly, delight moments only.
- **Glows** are radial-gradient fades (additive in-lens), never blur filters — perf.
- **Rounded rects**: corner radius ≈ 5.5% of width (the 44/800 of the lockup).

## Materials (in-lens)

| Material | Recipe |
|---|---|
| Gem | Unlit violet→teal gradient + fresnel rim boost + subtle emissive; hard facet normals |
| Line/arch | Emissive unlit, muted lavender at 40–55% opacity |
| Panels | UIKit panel tinted Palace indigo, vignette toward Void indigo, 92–96% opacity |
| SIK targeting | Restyle cursor/outline glow from system yellow to **teal** (SIK supports custom feedback styling) |

## Motion tie-in

Slow orbits, gentle bobs, sine ease-in-out everywhere; nothing snaps except the hatch. Particles tinted violet/teal; amber particles only on decayed anchors. Panel transitions: fade + rise 8–12cm over 250–350ms.

## Don'ts

No hard drop shadows · no saturated red · no yellow · no pure-white fills outside sparkles · no heavy display weights · at most one amber element in view outside review contexts.
