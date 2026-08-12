// Gaze hum — faint loopable shimmer-pad heard while dwelling on a memory.
// A-pentatonic family (A4 + E5 detuned pair), NO reverb (loop seam), edge
// fades matched, very quiet. Loops via AudioComponent.play(-1).
const fs = require('fs');
const path = require('path');
const ENGINE = 'C:/Users/User/.claude/plugins/cache/ls-extensions/ls-clad/1.0.0/skills/build-sfx/tools';
const audio = require(ENGINE);

const PROJECT_ASSETS_SFX = 'C:/Users/User/Documents/Snap/SPECS/CLAD/MemoryPalace/Assets/GeneratedSFX';
fs.mkdirSync(PROJECT_ASSETS_SFX, { recursive: true });

function render() {
  const DUR = 2.0;
  const a1 = audio.sine(220, DUR, 0.4);            // A3... A4=440? A4 is 440.
  const a2 = audio.sine(440, DUR, 0.32);           // A4
  const a3 = audio.sine(440 * 1.004, DUR, 0.26);   // detune shimmer
  const e5 = audio.sine(659.25, DUR, 0.14);        // E5 whisper
  const breath = audio.whiteNoise(DUR, 0.05);
  audio.lowPass2 ? null : null;
  const mix = audio.mix([a1, a2, a3, e5, breath], [0.25, 0.4, 0.34, 0.2, 0.1]);
  audio.humanize.ampWobble(mix, 0.5, 0.12);
  audio.fadeIn(mix, 0.06);
  audio.fadeOut(mix, 0.06);
  const out = audio.mix_bus.applyFx(mix, { hpf: 120, lpf: 2400, gain: 0.6 });
  return out;
}

const result = render();
audio.mix_bus.masterChain(result, { normalize: 'peak' });
if (result.left) {
  for (let i = 0; i < result.left.length; i++) { result.left[i] *= 0.3; result.right[i] *= 0.3; }
} else {
  for (let i = 0; i < result.length; i++) { result[i] *= 0.3; }
}
audio.WavBuilder.write(result, path.join(PROJECT_ASSETS_SFX, 'gazehum.wav'));
console.log('WROTE gazehum.wav');
