/**
 * Solfeggio arcana palette — the audio-polish batch (DESIGN.md "Sound design",
 * repitched per the user's direction: light, airy, solfeggio).
 *
 * Pitch material: 396 / 417 / 528 / 639 / 741 / 852 Hz (+ octaves ×0.5/×2).
 * Every clip draws ONLY from this set — it replaces the old C-pentatonic as
 * the "one key, one family" system, so overlapping sounds always harmonize.
 *
 * Timbre: struck crystal + breath — glassy FM partials with SOFT attacks
 * (≥3 ms fade-ins, no clicky transients), shimmering decays, minimal low end.
 * Hierarchy by brightness/loudness stays runtime-side (playTrackAt volumes).
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE;

// ── Family voices ────────────────────────────────────────────────────────────

/** Airy struck-crystal partial at f Hz: low-index FM, soft attack, ringing decay. */
function glass(f, dur, opts = {}) {
    const b = audio.osc_models.fmOperator(f, dur, 2,
        opts.index !== undefined ? opts.index : 1.1,
        (t) => Math.exp(-(opts.damp !== undefined ? opts.damp : 5) * t));
    audio.adsrExp(b, opts.atk !== undefined ? opts.atk : 0.012,
        dur * 0.2, opts.sus !== undefined ? opts.sus : 0.3, dur * 0.6, 2.5);
    audio.fadeOut(b, 0.012);
    return b;
}

/** Soft band-passed breath wash. */
function breath(dur, center, g) {
    const n = audio.whiteNoise(dur, 0.5);
    audio.adsrExp(n, 0.05, dur * 0.2, 0.5, dur * 0.5, 2);
    return audio.mix_bus.applyFx(n, { bpf: { center: center, Q: 1.4 }, gain: g });
}

/** Staggered glass arpeggio. */
function arp(freqs, noteDur, stagger, totalDur, gains, damp) {
    const out = new Float32Array(Math.floor(totalDur * SR));
    for (let i = 0; i < freqs.length; i++) {
        audio.addInto(out, glass(freqs[i], noteDur, { damp: damp !== undefined ? damp : 6 }),
            Math.floor(i * stagger * SR), gains[i]);
    }
    return out;
}

/** Loop splice: crossfade the tail into the head so a looped clip has no seam. */
function loopSplice(buf, seconds) {
    const n = Math.floor(seconds * SR);
    for (let i = 0; i < n; i++) {
        const w = i / n;
        const tail = buf.length - n + i;
        buf[tail] = buf[tail] * (1 - w) + buf[i] * w;
    }
}

// ── Clips ────────────────────────────────────────────────────────────────────

// 1) twinkle — airier glint: 528+639 (+1056 sparkle), soft attack, long shimmer.
function twinkle() {
    const out = new Float32Array(Math.floor(0.9 * SR));
    audio.addInto(out, glass(528, 0.8, { damp: 4 }), 0, 0.55);
    audio.addInto(out, glass(639, 0.7, { damp: 5 }), Math.floor(0.05 * SR), 0.42);
    audio.addInto(out, glass(1056, 0.5, { damp: 7 }), Math.floor(0.02 * SR), 0.2);
    audio.addInto(out, breath(0.4, 3000, 0.08), 0, 1.0);
    return audio.mix_bus.applyFx(out, { hpf: 300, reverb: 'smallRoom', gain: 0.8 });
}

// 2) gazehum — breathy 396 pad, LOOP-SAFE: whole-second duration = integer
//    cycles for integer-Hz partials; wobble LFOs are loop-periodic (k/dur);
//    NO reverb (a tail would wrap across the seam); loopSplice blends the
//    stochastic breath layer.
function gazehum() {
    const dur = 4.0;
    const a = audio.sine(396, dur, 0.5);
    const b = audio.sine(792, dur, 0.16);
    const c = audio.sine(528, dur, 0.12);
    const pad = audio.mix([a, b, c], [0.55, 0.3, 0.22]);
    for (let i = 0; i < pad.length; i++) {
        const t = i / SR;
        pad[i] *= 1 + 0.16 * Math.sin(2 * Math.PI * (2 / dur) * t)
                    + 0.07 * Math.sin(2 * Math.PI * (5 / dur) * t + 1.3);
    }
    const n = audio.whiteNoise(dur, 0.4);
    const br = audio.mix_bus.applyFx(n, { bpf: { center: 1100, Q: 0.8 }, gain: 0.1 });
    const out = audio.mix([pad, br], [0.85, 1.0]);
    return audio.mix_bus.applyFx(out, { hpf: 120, lpf: 2600, gain: 0.8 });   // no reverb
}

// 3) place — gem landing, much lighter: chime-settle at 528 over a gentle 396
//    (no thump — the low note is a soft glass fundamental, not a kick).
function place() {
    const out = new Float32Array(Math.floor(0.85 * SR));
    audio.addInto(out, glass(528, 0.7, { atk: 0.008, damp: 5 }), 0, 0.5);
    audio.addInto(out, glass(396, 0.8, { atk: 0.02, damp: 3.5, index: 0.8 }), Math.floor(0.04 * SR), 0.4);
    audio.addInto(out, glass(1056, 0.35, { damp: 8 }), Math.floor(0.09 * SR), 0.15);
    audio.addInto(out, breath(0.5, 1600, 0.09), 0, 1.0);
    return audio.mix_bus.applyFx(out, { hpf: 150, reverb: 'smallRoom', gain: 0.85 });
}

// 4) vaporize — airy reverse-shimmer dissolve: 639/741/852 partials swell in
//    (reverse envelope) under a rising breath sweep, then release softly.
function vaporize() {
    const dur = 0.9;
    const out = new Float32Array(Math.floor(dur * SR));
    const parts = [639, 741, 852, 1278];
    for (let i = 0; i < parts.length; i++) {
        const p = audio.sine(parts[i], dur * 0.8, 0.3);
        for (let j = 0; j < p.length; j++) {
            const t = j / p.length;
            p[j] *= t * t;   // swells in — the memory unwinds upward
        }
        audio.fadeOut(p, 0.06);
        audio.addInto(out, p, Math.floor(i * 0.03 * SR), 0.3 - i * 0.05);
    }
    const n = audio.whiteNoise(dur * 0.85, 0.5);
    audio.lowPassSweep(n, 900, 6500, dur * 0.85, 'exponential');
    for (let j = 0; j < n.length; j++) { const t = j / n.length; n[j] *= t; }
    audio.fadeOut(n, 0.08);
    audio.addInto(out, n, 0, 0.25);
    return audio.mix_bus.applyFx(out, { hpf: 250, reverb: 'plate', gain: 0.8 });
}

// 5) shutter — crystalline "etch" ping at 852 (+1704 sparkle): the snapshot
//    moment's sound. Brief; 3-4 ms attacks keep it crisp but unclicky.
function shutter() {
    const out = new Float32Array(Math.floor(0.35 * SR));
    audio.addInto(out, glass(852, 0.28, { atk: 0.004, damp: 11 }), 0, 0.6);
    audio.addInto(out, glass(1704, 0.2, { atk: 0.003, damp: 14 }), Math.floor(0.012 * SR), 0.3);
    return audio.mix_bus.applyFx(out, { hpf: 400, reverb: 'smallRoom', gain: 0.7 });
}

// 6) cardopen — bloom-open arpeggio 396→528→639.
function cardopen() {
    const out = arp([396, 528, 639], 0.45, 0.09, 0.8, [0.4, 0.45, 0.5]);
    return audio.mix_bus.applyFx(out, { hpf: 200, reverb: 'smallRoom', gain: 0.75 });
}

// 7) cardclose — the reverse, shorter and quieter.
function cardclose() {
    const out = arp([639, 528, 396], 0.3, 0.07, 0.55, [0.35, 0.3, 0.28]);
    return audio.mix_bus.applyFx(out, { hpf: 200, reverb: 'smallRoom', gain: 0.6 });
}

// 8) reveal — Train reveal: soft 528+852 bloom with breath.
function reveal() {
    const out = new Float32Array(Math.floor(0.95 * SR));
    audio.addInto(out, glass(528, 0.85, { atk: 0.03, damp: 3.5 }), 0, 0.5);
    audio.addInto(out, glass(852, 0.7, { atk: 0.04, damp: 4.5 }), Math.floor(0.06 * SR), 0.35);
    audio.addInto(out, breath(0.6, 2400, 0.1), 0, 1.0);
    return audio.mix_bus.applyFx(out, { hpf: 250, reverb: 'mediumRoom', gain: 0.8 });
}

// 9a) graderemember — bright airy triad 528+639+852 (the moment's milestone).
function graderemember() {
    const out = new Float32Array(Math.floor(1.0 * SR));
    audio.addInto(out, glass(528, 0.9, { damp: 3.5 }), 0, 0.5);
    audio.addInto(out, glass(639, 0.85, { damp: 4 }), Math.floor(0.015 * SR), 0.44);
    audio.addInto(out, glass(852, 0.8, { damp: 4.5 }), Math.floor(0.03 * SR), 0.4);
    audio.addInto(out, breath(0.5, 2800, 0.08), 0, 1.0);
    return audio.mix_bus.applyFx(out, { hpf: 250, reverb: 'mediumRoom', gain: 0.8 });
}

// 9b) gradealmost — a single 417, plain and kind.
function gradealmost() {
    const out = new Float32Array(Math.floor(0.6 * SR));
    audio.addInto(out, glass(417, 0.55, { atk: 0.015, damp: 5 }), 0, 0.55);
    return audio.mix_bus.applyFx(out, { hpf: 180, reverb: 'smallRoom', gain: 0.7 });
}

// 9c) gradeforgot — soft low 396 felt tone, quiet and warm — NEVER punishing
//     (DESIGN.md sound rule 6, verbatim). Pure warmth: 396 + 198 sub, slow
//     attack, low-passed, no bright partials.
function gradeforgot() {
    const dur = 0.75;
    const a = audio.sine(396, dur, 0.5);
    const b = audio.sine(198, dur, 0.3);
    const out = audio.mix([a, b], [0.6, 0.4]);
    audio.adsrExp(out, 0.04, 0.15, 0.4, 0.45, 2.5);
    audio.fadeOut(out, 0.02);
    return audio.mix_bus.applyFx(out, { lpf: 900, reverb: 'smallRoom', gain: 0.7 });
}

// 10) complete — rising 396→528→639→852 phrase (~1.5 s). This is the SEED of
//     DESIGN.md's mastery-melody: "each tier adds a note to the palace's
//     melody" — later, mastery tiers will append notes to this exact phrase.
function complete() {
    const out = arp([396, 528, 639, 852], 0.6, 0.28, 1.6, [0.42, 0.45, 0.48, 0.55], 4);
    audio.addInto(out, breath(0.9, 2400, 0.07), Math.floor(0.6 * SR), 1.0);
    return audio.mix_bus.applyFx(out, { hpf: 200, reverb: 'mediumRoom', gain: 0.8 });
}

// ── Render all ───────────────────────────────────────────────────────────────

const clips = {
    'twinkle.wav': twinkle,
    'gazehum.wav': gazehum,
    'place.wav': place,
    'vaporize.wav': vaporize,
    'shutter.wav': shutter,
    'cardopen.wav': cardopen,
    'cardclose.wav': cardclose,
    'reveal.wav': reveal,
    'graderemember.wav': graderemember,
    'gradealmost.wav': gradealmost,
    'gradeforgot.wav': gradeforgot,
    'complete.wav': complete,
};

for (const name of Object.keys(clips)) {
    const result = clips[name]();
    audio.mix_bus.masterChain(result, { normalize: 'peak' });
    if (name === 'gazehum.wav') loopSplice(result, 0.06);   // seam-free loop
    audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, name));
}
console.log('solfeggio family written: ' + Object.keys(clips).length + ' clips');
