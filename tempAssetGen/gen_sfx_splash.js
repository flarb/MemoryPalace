/**
 * splash.wav — Remove enhancement. The conjured visual dissolves back into
 * the plain gem; the user asked for "a very subtle 'splash' spot effect".
 *
 * Solfeggio family reading of a splash: a soft watery *plip* (fast noise
 * bloom, band-passed liquid-low), two descending droplet pings (639→528→396,
 * downward = un-making, the mirror of the conjure climb), and a short misty
 * tail. Small and quiet by design — this is tidying-up, not a milestone.
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

function splash() {
    const dur = 0.8;
    const out = new Float32Array(Math.floor(dur * SR));

    // The plip: a fast watery noise bloom, liquid-low band, quick decay.
    const plip = audio.whiteNoise(0.22, 0.6);
    audio.adsrExp(plip, 0.004, 0.05, 0.25, 0.15, 3);
    audio.addInto(out, audio.mix_bus.applyFx(plip,
        { bpf: { center: 950, Q: 1.6 }, gain: 0.5 }), 0, 0.55);

    // A hint of droplet spray above it (brief, high, very quiet).
    const spray = audio.whiteNoise(0.16, 0.5);
    audio.adsrExp(spray, 0.003, 0.04, 0.2, 0.1, 3);
    audio.addInto(out, audio.mix_bus.applyFx(spray,
        { bpf: { center: 4200, Q: 1.2 }, gain: 0.2 }), Math.floor(0.012 * SR), 0.5);

    // Droplets: descending family pings — the conjure climb, unwound.
    audio.addInto(out, glass(639, 0.3, { atk: 0.006, damp: 10 }), Math.floor(0.05 * SR), 0.22);
    audio.addInto(out, glass(528, 0.32, { atk: 0.007, damp: 9 }), Math.floor(0.14 * SR), 0.20);
    audio.addInto(out, glass(396, 0.4, { atk: 0.01, damp: 6, index: 0.8 }), Math.floor(0.24 * SR), 0.18);

    return audio.mix_bus.applyFx(out, { hpf: 220, reverb: 'smallRoom', gain: 0.7 });
}

const result = splash();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'splash.wav'));
console.log('splash.wav written');
