// Little cockpit sounds for poking things in the world (all made with Web Audio).
// They go through the effects bus, so the Effects volume controls them.
import { getContext, getBus } from './clock.js';

function ready() {
  const ctx = getContext();
  return ctx.state === 'running' ? ctx : null;
}

function tone({ f0, f1 = f0, dur = 0.15, type = 'sine', gain = 0.12, at = 0, vibrato = 0 }) {
  const ctx = ready(); if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  if (vibrato) { const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 18; lg.gain.value = vibrato; l.connect(lg).connect(o.frequency); l.start(t); l.stop(t + dur + 0.05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(getBus('sfx')); o.start(t); o.stop(t + dur + 0.05);
}

function noiseBurst({ dur = 0.2, freq = 2000, q = 1, gain = 0.08, type = 'bandpass', at = 0, sweepTo }) {
  const ctx = ready(); if (!ctx) return;
  const t = ctx.currentTime + at;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(getBus('sfx')); src.start(t);
}

export const foley = {
  squeak(pitch = 1) { tone({ f0: 650 * pitch, f1: 1300 * pitch, dur: 0.16, gain: 0.1, vibrato: 30 }); tone({ f0: 1250 * pitch, f1: 900 * pitch, dur: 0.12, gain: 0.07, at: 0.13, vibrato: 25 }); },
  boing() { tone({ f0: 300, f1: 110, dur: 0.45, type: 'triangle', gain: 0.12, vibrato: 14 }); },
  clink() { tone({ f0: 2600, dur: 0.25, type: 'triangle', gain: 0.07 }); tone({ f0: 3900, dur: 0.18, type: 'sine', gain: 0.04 }); },
  rustle() { noiseBurst({ dur: 0.28, freq: 3500, q: 0.7, gain: 0.06 }); noiseBurst({ dur: 0.2, freq: 5000, q: 0.9, gain: 0.04, at: 0.1 }); },
  paper() { noiseBurst({ dur: 0.16, freq: 4200, q: 1.2, gain: 0.05, type: 'highpass' }); },
  jingle() { [2350, 2900, 3300, 2700].forEach((f, i) => tone({ f0: f, dur: 0.12, type: 'triangle', gain: 0.05, at: i * 0.045 })); },
  ping() { tone({ f0: 1250, dur: 0.6, gain: 0.08 }); tone({ f0: 1250, dur: 0.5, gain: 0.03, at: 0.22 }); },
  chirp() { tone({ f0: 400, f1: 1600, dur: 0.22, type: 'sine', gain: 0.07, vibrato: 60 }); },
  beep(p = 1) { tone({ f0: 880 * p, dur: 0.08, type: 'square', gain: 0.04 }); },
  whoosh() { noiseBurst({ dur: 0.5, freq: 300, q: 0.8, gain: 0.1, sweepTo: 2200 }); tone({ f0: 70, f1: 50, dur: 0.6, type: 'sawtooth', gain: 0.05 }); },
};
