// Ship ambience: a quiet engine hum + faint cabin air, made with Web Audio (no files).
// Fades in on menus, out during rounds and record playback so it never fights the music.
import { getContext, getBus } from './clock.js';
import { on } from '../core/bus.js';

let nodes = null;
let want = 0;

function build() {
  const ctx = getContext();
  const out = ctx.createGain(); out.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180;
  for (const [f, g] of [[55, 0.5], [82.4, 0.25], [110.3, 0.12]]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    const og = ctx.createGain(); og.gain.value = g;
    o.connect(og).connect(lp); o.start();
  }
  // slow wobble so the hum feels alive
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.13;
  const lfoG = ctx.createGain(); lfoG.gain.value = 40;
  lfo.connect(lfoG).connect(lp.frequency); lfo.start();
  // cabin air: soft filtered noise
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 3; }
  const air = ctx.createBufferSource(); air.buffer = buf; air.loop = true;
  const airF = ctx.createBiquadFilter(); airF.type = 'bandpass'; airF.frequency.value = 500; airF.Q.value = 0.4;
  const airG = ctx.createGain(); airG.gain.value = 0.35;
  air.connect(airF).connect(airG).connect(out); air.start();
  lp.connect(out);
  out.connect(getBus('music'));
  return { out };
}

function apply() {
  const ctx = getContext();
  if (ctx.state !== 'running') return;
  if (!nodes) nodes = build();
  nodes.out.gain.setTargetAtTime(want, ctx.currentTime, 0.6);
}

export function startAmbience() {
  on('screen:change', ({ id }) => { want = id === 'round' ? 0 : 0.05; apply(); });
  on('round:start', () => { want = 0; apply(); });
  on('records:play', (playing) => { want = playing ? 0 : 0.05; apply(); });
  // the AudioContext only starts after a click; pick up the hum then
  window.addEventListener('pointerdown', () => setTimeout(apply, 50), { passive: true });
}
