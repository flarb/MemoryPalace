/**
 * hatch.wav — the gem cracks open and the conjured thing pops into view.
 *
 * DESIGN.md event map: "Hatch — crack + particle burst + harmonic bloom — the
 * screen-record moment." The loudest, brightest clip in the palette (hierarchy
 * rule: milestone tier), but still solfeggio glass/breath — never a boom.
 *
 * Shape: a soft crystalline CRACK (two damped high glass hits, tight),
 * an immediate full-triad harmonic BLOOM (396+528+639+852 together — the
 * family's complete chord), a sparkle spray above it, and a hall tail.
 * Voices copied verbatim from gen_sfx_solfeggio.js (one key, one family).
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE;

/** Airy struck-crystal partial (verbatim from the solfeggio family). */
function glass(f, dur, opts = {}) {
    const b = audio.osc_models.fmOperator(f, dur, 2,
        opts.index !== undefined ? opts.index : 1.1,
        (t) => Math.exp(-(opts.damp !== undefined ? opts.damp : 5) * t));
    audio.adsrExp(b, opts.atk !== undefined ? opts.atk : 0.012,
        dur * 0.2, opts.sus !== undefined ? opts.sus : 0.3, dur * 0.6, 2.5);
    audio.fadeOut(b, 0.012);
    return b;
}

/** Soft band-passed breath wash (verbatim from the solfeggio family). */
function breath(dur, center, g) {
    const n = audio.whiteNoise(dur, 0.5);
    audio.adsrExp(n, 0.05, dur * 0.2, 0.5, dur * 0.5, 2);
    return audio.mix_bus.applyFx(n, { bpf: { center: center, Q: 1.4 }, gain: g });
}

function hatch() {
    const dur = 1.9;
    const out = new Float32Array(Math.floor(dur * SR));

    // CRACK — two tight, heavily damped high glass hits a hair apart. Sharp
    // for this palette (3-4 ms attacks) but still glass, not a snare.
    audio.addInto(out, glass(1704, 0.16, { atk: 0.003, damp: 16 }), 0, 0.5);
    audio.addInto(out, glass(1278, 0.18, { atk: 0.004, damp: 14 }), Math.floor(0.03 * SR), 0.42);

    // BLOOM — the family's full chord lands together right after the crack:
    // the shell gives way and the thing inside arrives.
    const bloom = Math.floor(0.07 * SR);
    audio.addInto(out, glass(396, 1.3, { atk: 0.015, damp: 2.8, index: 0.8 }), bloom, 0.30);
    audio.addInto(out, glass(528, 1.25, { atk: 0.012, damp: 3.0 }), bloom, 0.46);
    audio.addInto(out, glass(639, 1.2, { atk: 0.012, damp: 3.2 }), bloom, 0.42);
    audio.addInto(out, glass(852, 1.15, { atk: 0.01, damp: 3.4 }), bloom, 0.38);

    // Sparkle spray — quick high scatter over the bloom (the particle burst,
    // audible).
    const sprayF = [1056, 1278, 1704, 1056];
    for (let i = 0; i < sprayF.length; i++) {
        audio.addInto(out,
            glass(sprayF[i], 0.4, { atk: 0.004, damp: 9 }),
            bloom + Math.floor((0.04 + i * 0.055) * SR), 0.16 - i * 0.02);
    }

    // Breath swell under the bloom — air rushing out of the opened shell.
    audio.addInto(out, breath(0.9, 2600, 0.10), bloom, 1.0);

    // >1 s one-shot: wobble so the chord tail breathes instead of droning.
    audio.humanize.ampWobble(out, 0.35, 0.06);
    audio.fadeOut(out, 0.1);
    return audio.mix_bus.applyFx(out, { hpf: 200, reverb: 'largeHall', gain: 0.85 });
}

const result = hatch();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'hatch.wav'));
console.log('hatch.wav written');
