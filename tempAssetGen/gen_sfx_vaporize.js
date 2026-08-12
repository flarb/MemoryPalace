// Vaporize SFX v2 — QUIETER + GENTLER per user feedback.
// Two soft crystal bells (A5/E6) releasing into a darker, breathier vapor
// whoosh; output attenuated to ~42% after peak normalize.
const fs = require('fs');
const path = require('path');
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function render() {
  const SR = audio.SAMPLE_RATE;
  const DUR = 1.15;

  const bellA = audio.synth_voices.bell(81, 0.8, 70, 200);   // A5, soft
  const bellE = audio.synth_voices.bell(88, 0.6, 50, 200);   // E6, softer

  // Darker vapor: settles 4.2 kHz → 350 Hz, low sustain.
  const vapor = audio.whiteNoise(0.9, 0.5);
  audio.lowPassSweep(vapor, 4200, 350, 0.9, 'exponential');
  audio.adsrExp(vapor, 0.04, 0.2, 0.35, 0.6, 2);

  const mono = new Float32Array(Math.floor(DUR * SR));
  audio.addInto(mono, bellA, 0, 0.32);
  audio.addInto(mono, bellE, Math.floor(0.09 * SR), 0.2);
  audio.addInto(mono, vapor, Math.floor(0.05 * SR), 0.3);
  audio.humanize.ampWobble(mono, 0.25, 0.08);
  audio.fadeOut(mono, 0.08);

  const wet = audio.mix_bus.applyFx(mono, { hpf: 200, reverb: 'plate', gain: 0.7 });

  const dust = audio.granular.grainCloud({
    source: 'pink', duration: 0.8, grainSizeMs: 24, density: 40, ampJitter: 0.5,
    filter: { type: 'hp', freq: 2800, Q: 0.7 }, panSpread: 0.5,
  });

  const len = Math.max(wet.left.length, dust.left.length + Math.floor(0.05 * SR));
  const out = { left: new Float32Array(len), right: new Float32Array(len) };
  for (let i = 0; i < wet.left.length; i++) { out.left[i] += wet.left[i]; out.right[i] += wet.right[i]; }
  const off = Math.floor(0.05 * SR);
  for (let i = 0; i < dust.left.length; i++) {
    const fade = 1 - i / dust.left.length;
    out.left[i + off] += dust.left[i] * 0.18 * fade;
    out.right[i + off] += dust.right[i] * 0.18 * fade;
  }
  return out;
}

const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
for (let i = 0; i < result.left.length; i++) { result.left[i] *= 0.42; result.right[i] *= 0.42; }
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'vaporize.wav'));
console.log('WROTE vaporize.wav (gentle v2)');
