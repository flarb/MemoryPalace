/**
 * conjure.wav — "the palace accepts the request and starts forging".
 *
 * Plays positionally at the gem the instant Conjure is tapped. The default
 * UIKit button click was a flat beep; DESIGN.md's event map wants
 * "furnace-shimmer" here, and rule 1 ("one key, one family") means it must be
 * drawn from the SAME solfeggio set as the other twelve clips — see
 * gen_sfx_solfeggio.js. The `glass` and `breath` voices below are copied from
 * that file deliberately, so the timbres are identical rather than merely
 * similar.
 *
 * Shape: a rising breath sweep under an ascending 528→639→852 arpeggio that
 * blooms into a high sparkle cluster (1056/1278/1704), then a long hall tail.
 * Rising = something is beginning; the tail = it's still working.
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE;

/** Airy struck-crystal partial at f Hz (verbatim from the solfeggio family). */
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

function conjure() {
    const dur = 1.55;
    const out = new Float32Array(Math.floor(dur * SR));

    // Rising breath — the intake before the bloom. Amplitude ramps in so it
    // swells rather than starting on a transient (no beep).
    const rise = audio.whiteNoise(0.75, 0.5);
    audio.lowPassSweep(rise, 700, 7000, 0.75, 'exponential');
    for (let i = 0; i < rise.length; i++) {
        const t = i / rise.length;
        rise[i] *= t * t;            // slow-in: nothing pops at t=0
    }
    audio.fadeOut(rise, 0.07);
    audio.addInto(out, audio.mix_bus.applyFx(rise, { hpf: 400, gain: 0.5 }), 0, 0.3);

    // Warm 396 fundamental under the whole gesture — body, not bass.
    const bed = audio.sine(396, 1.1, 0.4);
    audio.adsrExp(bed, 0.12, 0.25, 0.45, 0.6, 2);
    audio.fadeOut(bed, 0.05);
    audio.addInto(out, bed, 0, 0.22);

    // Ascending arpeggio — the request climbing.
    audio.addInto(out, glass(528, 0.85, { atk: 0.02, damp: 4 }), Math.floor(0.10 * SR), 0.34);
    audio.addInto(out, glass(639, 0.85, { atk: 0.018, damp: 4 }), Math.floor(0.22 * SR), 0.40);
    audio.addInto(out, glass(852, 0.90, { atk: 0.015, damp: 3.5 }), Math.floor(0.34 * SR), 0.48);

    // Bloom: a high sparkle cluster where the swell lands — the "magic" beat.
    const bloom = Math.floor(0.46 * SR);
    audio.addInto(out, glass(1056, 0.55, { atk: 0.006, damp: 7 }), bloom, 0.20);
    audio.addInto(out, glass(1278, 0.50, { atk: 0.005, damp: 8 }), bloom + Math.floor(0.025 * SR), 0.16);
    audio.addInto(out, glass(1704, 0.45, { atk: 0.004, damp: 10 }), bloom + Math.floor(0.05 * SR), 0.12);
    audio.addInto(out, breath(0.7, 3200, 0.09), bloom, 1.0);

    // Shimmer tail — quiet 639/852 still ringing: the forge is working.
    audio.addInto(out, glass(639, 0.7, { atk: 0.06, damp: 2.6, sus: 0.4 }), Math.floor(0.72 * SR), 0.14);
    audio.addInto(out, glass(852, 0.6, { atk: 0.07, damp: 2.8, sus: 0.4 }), Math.floor(0.85 * SR), 0.11);

    // >1 s one-shot: wobble keeps the tail from reading as a static drone.
    audio.humanize.ampWobble(out, 0.4, 0.07);
    audio.fadeOut(out, 0.09);
    return audio.mix_bus.applyFx(out, { hpf: 220, reverb: 'largeHall', gain: 0.82 });
}

const result = conjure();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'conjure.wav'));
console.log('conjure.wav written');
