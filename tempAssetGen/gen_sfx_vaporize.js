// Vaporize SFX — a memory releasing into vapor (delete effect).
// Arcana palette: crystal bells (A-pentatonic: A5/D6/E6, suspended — no third),
// breathy downward vapor whoosh, granular shimmer dust, plate reverb.
// Gentle and non-punishing per Branding/STYLE.md sound rules.
const fs = require('fs');
const path = require('path');
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function render() {
  const SR = audio.SAMPLE_RATE;
  const DUR = 1.3;

  // Crystal release — three quick pentatonic bells, fading upward arpeggio.
  const bellA = audio.synth_voices.bell(81, 0.9, 90, 220);   // A5
  const bellD = audio.synth_voices.bell(86, 0.8, 75, 220);   // D6
  const bellE = audio.synth_voices.bell(88, 0.7, 65, 220);   // E6

  // Vapor body — noise settling downward: the "blowing off into vapor".
  const vapor = audio.whiteNoise(1.1, 0.6);
  audio.lowPassSweep(vapor, 6500, 400, 1.1, 'exponential');
  audio.adsrExp(vapor, 0.03, 0.25, 0.5, 0.7, 2);

  const mono = new Float32Array(Math.floor(DUR * SR));
  audio.addInto(mono, bellA, 0, 0.5);
  audio.addInto(mono, bellD, Math.floor(0.06 * SR), 0.4);
  audio.addInto(mono, bellE, Math.floor(0.13 * SR), 0.34);
  audio.addInto(mono, vapor, Math.floor(0.04 * SR), 0.5);
  audio.humanize.ampWobble(mono, 0.3, 0.1);
  audio.fadeOut(mono, 0.08);

  // Plate reverb promotes to stereo — airy, not cavernous.
  const wet = audio.mix_bus.applyFx(mono, { hpf: 150, reverb: 'plate', gain: 0.85 });

  // Shimmer dust — sparse high granular breath, panned wide, faded out by hand.
  const dust = audio.granular.grainCloud({
    source: 'pink', duration: 1.0, grainSizeMs: 22, density: 70, ampJitter: 0.5,
    filter: { type: 'hp', freq: 2600, Q: 0.7 }, panSpread: 0.6,
  });

  const len = Math.max(wet.left.length, dust.left.length + Math.floor(0.05 * SR));
  const out = { left: new Float32Array(len), right: new Float32Array(len) };
  for (let i = 0; i < wet.left.length; i++) {
    out.left[i] += wet.left[i];
    out.right[i] += wet.right[i];
  }
  const dustOff = Math.floor(0.05 * SR);
  for (let i = 0; i < dust.left.length; i++) {
    const fade = 1 - i / dust.left.length;   // dust thins as the object shrinks
    out.left[i + dustOff] += dust.left[i] * 0.3 * fade;
    out.right[i + dustOff] += dust.right[i] * 0.3 * fade;
  }
  return out;
}

const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'vaporize.wav'));
console.log('WROTE', path.join(PROJECT_ASSETS_SFX, 'vaporize.wav'));
