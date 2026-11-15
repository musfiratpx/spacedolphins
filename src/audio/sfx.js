// UI and gameplay sound effects, generated with Web Audio (CC0 packs / NASA
// "beeps and bytes" can replace these in Phase 2 via the manifest).
import { getContext, getBus, getAudioTime } from './clock.js';
import { playSynth } from './synth.js';

function tone(freq, dur, type = 'sine', gain = 0.15, bus = 'sfx', glideTo) {
  const ctx = getContext();
  const t = getAudioTime();
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(getBus(bus));
  o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  hover() { tone(1400, 0.04, 'sine', 0.04); },
  click() { tone(900, 0.06, 'square', 0.06); },
  back() { tone(500, 0.08, 'square', 0.05, 'sfx', 350); },
  hit(judgement, combo = 0) {
    const lift = 1 + Math.min(combo, 60) * 0.004;     // up to ~a minor third over a long streak
    if (judgement === 'perfect') tone(1760 * lift, 0.07, 'triangle', 0.12);
    else tone(1320 * lift, 0.06, 'triangle', 0.09);
  },
  milestone() { tone(880, 0.09, 'triangle', 0.08); setTimeout(() => tone(1320, 0.12, 'triangle', 0.08), 90); },
  miss() { tone(120, 0.12, 'sine', 0.12, 'sfx', 80); },   // soft low thud, never harsh
  type() { tone(2200 + Math.random() * 300, 0.015, 'square', 0.02, 'radio'); },
  static(dur = 0.25) {
    const ctx = getContext();
    const t = getAudioTime();
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.value = 0.08;
    src.connect(bp).connect(g).connect(getBus('radio'));
    src.start(t);
  },
  unlock() {
    // 2-second jingle placeholder (Kenney CC0 jingle can replace it)
    const ctx = getContext(); const t = getAudioTime(); const out = getBus('sfx');
    const notes = ['C5', 'E5', 'G5', 'C6'];
    notes.forEach((n, i) => playSynth('lead', t + i * 0.12, { note: n, duration: i === 3 ? 0.6 : 0.1, velocity: 1.2 }, out));
    playSynth('pad', t, { note: 'C4', duration: 1.6, velocity: 1.5 }, out);
    void ctx;
  },
  countdown(final = false) { tone(final ? 1320 : 880, 0.1, 'triangle', 0.12); },
};
