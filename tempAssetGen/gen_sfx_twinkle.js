/**
 * twinkle.wav — sparse crystalline glint twinkle (Explore mode, DESIGN.md
 * "Glint (distant anchor) | sparse twinkle, nearest-N capped").
 *
 * Crystal/glass family, same pentatonic-friendly register as the existing set
 * (place / vaporize / gazehum): two tiny high bell partials (A6 + E7, both in
 * C pentatonic) staggered 45 ms, a breath of glassy dust, small-room air.
 */
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);
const fs = require('fs');
const path = require('path');

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function render() {
    // Bell partials — natural mallet decay (anti-synthetic: pitched body rings out).
    const body = audio.synth_voices.bell(93, 0.5, 110, 240);    // A6 — the "tink"
    const sparkle = audio.synth_voices.bell(100, 0.38, 90, 260); // E7 — the shimmer answer

    const out = new Float32Array(Math.floor(0.7 * audio.SAMPLE_RATE));
    audio.addInto(out, body, 0, 0.62);
    audio.addInto(out, sparkle, Math.floor(0.045 * audio.SAMPLE_RATE), 0.4);

    // A tiny puff of glassy dust under the attack.
    const dust = audio.whiteNoise(0.12, 0.5);
    audio.adsrExp(dust, 0.001, 0.03, 0, 0.08, 4);
    const dustF = audio.mix_bus.applyFx(dust, { hpf: 6000, gain: 0.12 });
    audio.addInto(out, dustF, 0, 1.0);

    audio.fadeOut(out, 0.02);
    // smallRoom air keeps it intimate — a distant anchor, not a doorbell.
    return audio.mix_bus.applyFx(out, { hpf: 500, reverb: 'smallRoom', gain: 0.8 });
}

const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'twinkle.wav'));
console.log('twinkle.wav written to ' + PROJECT_ASSETS_SFX);
