/**
 * forge.wav — the waiting loop. DESIGN.md event map: "Conjure accepted /
 * forging | furnace-shimmer loop on gem (quiet, positional)". Plays for the
 * whole 10–90 s generation window, so it must be SUBTLE — felt more than
 * heard — and seam-free.
 *
 * Loop discipline (proven by gazehum): whole-second duration + integer-Hz
 * partials = integer cycles, wobble LFOs at k/dur are loop-periodic, NO
 * reverb (a tail would wrap across the seam), and the stochastic breath
 * layer is loopSpliced. Solfeggio family: 396/528 fundamentals + 792 octave.
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE;

/** Crossfade the tail into the head so a looped clip has no seam. */
function loopSplice(buf, seconds) {
    const n = Math.floor(seconds * SR);
    for (let i = 0; i < n; i++) {
        const w = i / n;
        const tail = buf.length - n + i;
        buf[tail] = buf[tail] * (1 - w) + buf[i] * w;
    }
}

function forge() {
    const dur = 4.0;   // whole seconds — integer cycles for integer-Hz partials

    // Warm shimmer pad: 396 + 528 + 792, gently beating against each other.
    const a = audio.sine(396, dur, 0.4);
    const b = audio.sine(528, dur, 0.22);
    const c = audio.sine(792, dur, 0.14);
    const pad = audio.mix([a, b, c], [0.5, 0.34, 0.22]);

    // Furnace breathing: two loop-periodic wobbles (k/dur Hz), one slow and
    // deep, one faster and shallow — reads as heat, not as a siren.
    for (let i = 0; i < pad.length; i++) {
        const t = i / SR;
        pad[i] *= 1 + 0.22 * Math.sin(2 * Math.PI * (3 / dur) * t)
                    + 0.08 * Math.sin(2 * Math.PI * (7 / dur) * t + 0.9);
    }

    // Spark hiss: quiet high band-passed noise, its own shimmer wobble.
    const n = audio.whiteNoise(dur, 0.4);
    const hiss = audio.mix_bus.applyFx(n, { bpf: { center: 3400, Q: 1.1 }, gain: 0.07 });
    for (let i = 0; i < hiss.length; i++) {
        const t = i / SR;
        hiss[i] *= 1 + 0.5 * Math.sin(2 * Math.PI * (5 / dur) * t + 2.1);
    }

    const out = audio.mix([pad, hiss], [0.85, 1.0]);
    // No reverb (seam), no fades (loop) — just filter and level.
    return audio.mix_bus.applyFx(out, { hpf: 150, lpf: 4200, gain: 0.7 });
}

const result = forge();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
loopSplice(result, 0.08);
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'forge.wav'));
console.log('forge.wav written');
