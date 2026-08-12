// Place SFX — "gem landing: low thump + crystal settle + dust" per the
// DESIGN.md sound map. Same A-pentatonic family as vaporize, one octave down
// (A4/E5) for groundedness. Quiet, warm, magical.
const fs = require('fs');
const path = require('path');
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function render() {
  const SR = audio.SAMPLE_RATE;

  // Soft felt landing.
  const thump = audio.transient_designer.designImpact({
    attack: { kind: 'click', durationMs: 4, lpHz: 1600, gain: 0.18 },
    body:   { kind: 'thump', freq: 115, decay: 0.2, lpHz: 480, gain: 0.45 },
  });

  // Crystal settle — grounded register (A4, E5).
  const bellA = audio.synth_voices.bell(69, 0.55, 55, 200);
  const bellE = audio.synth_voices.bell(76, 0.5, 45, 200);

  const mono = new Float32Array(Math.floor(0.95 * SR));
  audio.addInto(mono, thump, 0, 0.8);
  audio.addInto(mono, bellA, Math.floor(0.03 * SR), 0.3);
  audio.addInto(mono, bellE, Math.floor(0.11 * SR), 0.2);
  audio.fadeOut(mono, 0.05);

  const wet = audio.mix_bus.applyFx(mono, { hpf: 70, reverb: 'smallRoom', gain: 0.8 });

  // A pinch of settling dust.
  const dust = audio.granular.grainCloud({
    source: 'pink', duration: 0.3, grainSizeMs: 16, density: 60, ampJitter: 0.5,
    filter: { type: 'hp', freq: 3200, Q: 0.7 }, panSpread: 0.5,
  });

  const len = Math.max(wet.left.length, dust.left.length + Math.floor(0.02 * SR));
  const out = { left: new Float32Array(len), right: new Float32Array(len) };
  for (let i = 0; i < wet.left.length; i++) { out.left[i] += wet.left[i]; out.right[i] += wet.right[i]; }
  const off = Math.floor(0.02 * SR);
  for (let i = 0; i < dust.left.length; i++) {
    const fade = 1 - i / dust.left.length;
    out.left[i + off] += dust.left[i] * 0.12 * fade;
    out.right[i + off] += dust.right[i] * 0.12 * fade;
  }
  return out;
}

const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
for (let i = 0; i < result.left.length; i++) { result.left[i] *= 0.5; result.right[i] *= 0.5; }
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'place.wav'));
console.log('WROTE place.wav');
