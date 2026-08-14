/**
 * forge.wav v2 — the waiting loop, seam repair.
 *
 * v1 had an audible blip at the wrap (user-reported). Root cause: the biquad
 * filters (bpf on the hiss, hpf/lpf on the mix) start from zero state, so the
 * first ~50 ms of the buffer is a warm-up transient — the loop jumped from
 * steady-state tail into warm-up head every 4 s. masterChain's endpoint
 * processing was a second suspect.
 *
 * v2 discipline:
 *  - Render 6 s, KEEP ONLY THE LAST 4 s — filters are in steady state for the
 *    whole kept window.
 *  - Every periodic component sits on the n/4 Hz grid (396/528/792 partials;
 *    0.75 / 1.75 / 1.25 Hz wobbles), so ANY 4-second window loops exactly.
 *  - No masterChain: removeDC + hand peak-normalize only — nothing that
 *    treats the buffer's endpoints specially.
 *  - The stochastic hiss still gets a 0.15 s loopSplice (noise isn't
 *    periodic), now splicing steady-state into steady-state.
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });
const SR = audio.SAMPLE_RATE;

const LOOP_S = 4.0;      // shipped loop length
const RENDER_S = 6.0;    // rendered length; first 2 s discarded as warm-up

// (v1's splice blended the tail toward buf[0..X] — which makes the LAST
// sample equal head[X], not head[0], leaving a step at the wrap. The correct
// target is the source material immediately PRECEDING the head, so the tail
// flows into head[0]. Done inline in forge() where the long buffer is still
// in scope.)

function forge() {
    // Pad: 396/528/792 (integer Hz ⇒ every 4 s window is whole cycles).
    const a = audio.sine(396, RENDER_S, 0.4);
    const b = audio.sine(528, RENDER_S, 0.22);
    const c = audio.sine(792, RENDER_S, 0.14);
    const pad = audio.mix([a, b, c], [0.5, 0.34, 0.22]);

    // Furnace breathing on the n/4 Hz grid: 0.75 and 1.75 Hz.
    for (let i = 0; i < pad.length; i++) {
        const t = i / SR;
        pad[i] *= 1 + 0.22 * Math.sin(2 * Math.PI * 0.75 * t)
                    + 0.08 * Math.sin(2 * Math.PI * 1.75 * t + 0.9);
    }

    // Spark hiss, wobble at 1.25 Hz (also on the grid).
    const n = audio.whiteNoise(RENDER_S, 0.4);
    const hiss = audio.mix_bus.applyFx(n, { bpf: { center: 3400, Q: 1.1 }, gain: 0.07 });
    for (let i = 0; i < hiss.length; i++) {
        const t = i / SR;
        hiss[i] *= 1 + 0.5 * Math.sin(2 * Math.PI * 1.25 * t + 2.1);
    }

    const full = audio.mix([pad, hiss], [0.85, 1.0]);
    const filtered = audio.mix_bus.applyFx(full, { hpf: 150, lpf: 4200, gain: 0.7 });

    // Keep the steady-state tail: [RENDER_S - LOOP_S, RENDER_S).
    const start = Math.floor((RENDER_S - LOOP_S) * SR);
    const L = Math.floor(LOOP_S * SR);
    const out = new Float32Array(L);
    for (let i = 0; i < L; i++) out[i] = filtered[start + i];

    // Seam repair: crossfade the tail into the source samples immediately
    // BEFORE the head (filtered[start-X .. start)), so out[L-1] continues
    // into out[0] exactly. Those samples exist and are steady-state (the
    // warm-up ends well before 2 s).
    const X = Math.floor(0.15 * SR);
    for (let i = 0; i < X; i++) {
        const w = i / X;
        out[L - X + i] = out[L - X + i] * (1 - w) + filtered[start - X + i] * w;
    }

    // Endpoint-neutral mastering: DC removal + hand peak-normalize.
    if (audio.removeDC) audio.removeDC(out);
    let peak = 0;
    for (let i = 0; i < L; i++) peak = Math.max(peak, Math.abs(out[i]));
    if (peak > 1e-6) {
        const k = 0.9 / peak;
        for (let i = 0; i < L; i++) out[i] *= k;
    }
    return out;
}

audio.WavBuilder.write(forge(), path.join(PROJECT_ASSETS_SFX, 'forge.wav'));
console.log('forge.wav v2 written (steady-state 4 s loop)');
