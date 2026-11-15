// Synth backbone instruments, all made with Web Audio (no files needed).
// Every voice is scheduled at an exact audio-clock time.
import { getContext } from './clock.js';

const NOTE_INDEX = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6,
  G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

export function noteToFreq(note) {
  const m = /^([A-G][#b]?)(-?\d)$/.exec(note);
  if (!m) return 440;
  const midi = NOTE_INDEX[m[1]] + (Number(m[2]) + 1) * 12;
  return 440 * 2 ** ((midi - 69) / 12);
}

let noiseBuffer = null;
function noise() {
  const ctx = getContext();
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  return src;
}

function env(gainNode, t, peak, attack, decay) {
  const g = gainNode.gain;
  g.setValueAtTime(0.0001, t);
  g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack);
  g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

const voices = {
  kick(t, { velocity = 1, tone }, out) {
    const ctx = getContext();
    if (tone === 'soft' || tone === 'punch') {
      const soft = tone === 'soft';
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(soft ? 110 : 200, t);
      o.frequency.exponentialRampToValueAtTime(soft ? 38 : 48, t + (soft ? 0.16 : 0.07));
      env(g, t, (soft ? 0.85 : 1.05) * velocity, soft ? 0.006 : 0.001, soft ? 0.42 : 0.26);
      let chain = g;
      if (!soft) {
        // a little drive so it punches through the breakbeat
        const ws = ctx.createWaveShaper(); ws.curve = driveCurve(); chain = ws; g.connect(ws);
      }
      o.connect(g); chain.connect(out);
      o.start(t); o.stop(t + 0.5);
      if (!soft) {
        const c = noise(); const cg = ctx.createGain(); const hp = ctx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 2500;
        env(cg, t, 0.4 * velocity, 0.001, 0.012);
        c.connect(hp).connect(cg).connect(out); c.start(t); c.stop(t + 0.03);
      } else {
        // muffled lo-fi thump: lowpassed noise body
        const c = noise(); const cg = ctx.createGain(); const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 400;
        env(cg, t, 0.25 * velocity, 0.002, 0.05);
        c.connect(lp).connect(cg).connect(out); c.start(t); c.stop(t + 0.08);
      }
      return;
    }
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.1);
    env(g, t, 1.0 * velocity, 0.002, 0.36);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.4);
    // click transient so the kick cuts through on laptop speakers
    const c = noise(); const cg = ctx.createGain(); const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 1500;
    env(cg, t, 0.25 * velocity, 0.001, 0.015);
    c.connect(hp).connect(cg).connect(out);
    c.start(t); c.stop(t + 0.03);
  },

  snare(t, { velocity = 1, tone }, out) {
    const ctx = getContext();
    if (tone === 'gated' || tone === 'break') {
      const gated = tone === 'gated';
      const n = noise(); const f = ctx.createBiquadFilter(); const g = ctx.createGain();
      f.type = gated ? 'bandpass' : 'highpass'; f.frequency.value = gated ? 1800 : 900; f.Q.value = gated ? 0.5 : 0.7;
      if (gated) {
        // 80s gated snare: loud burst held, then cut sharply
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7 * velocity, t + 0.004);
        g.gain.setValueAtTime(0.5 * velocity, t + 0.16);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      } else env(g, t, 0.75 * velocity, 0.001, 0.12);
      n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + 0.3);
      const o = ctx.createOscillator(); const og = ctx.createGain();
      o.type = gated ? 'triangle' : 'square'; o.frequency.setValueAtTime(gated ? 190 : 240, t);
      o.frequency.exponentialRampToValueAtTime(gated ? 140 : 170, t + 0.06);
      env(og, t, (gated ? 0.4 : 0.22) * velocity, 0.001, gated ? 0.1 : 0.05);
      o.connect(og).connect(out); o.start(t); o.stop(t + 0.15);
      return;
    }
    if (tone === 'rim') {
      // dry rimshot click for lo-fi beats
      const n = noise(); const bp = ctx.createBiquadFilter(); const g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2.5;
      env(g, t, 0.5 * velocity, 0.001, 0.07);
      n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + 0.1);
      const o = ctx.createOscillator(); const og = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 820;
      env(og, t, 0.18 * velocity, 0.001, 0.03); o.connect(og).connect(out); o.start(t); o.stop(t + 0.05);
      return;
    }
    const n = noise(); const bp = ctx.createBiquadFilter(); const g = ctx.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.7;
    env(g, t, 0.55 * velocity, 0.002, 0.18);
    n.connect(bp).connect(g).connect(out);
    n.start(t); n.stop(t + 0.25);
    const o = ctx.createOscillator(); const og = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    env(og, t, 0.35 * velocity, 0.002, 0.09);
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.15);
  },

  hat(t, { velocity = 1, open = false, tone }, out) {
    const ctx = getContext();
    if (tone === 'shaker') {
      const n = noise(); const bp = ctx.createBiquadFilter(); const g = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 6200; bp.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13 * velocity, t + 0.02);   // soft attack, like a shaker
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      n.connect(bp).connect(g).connect(out); n.start(t); n.stop(t + 0.12);
      return;
    }
    if (tone === 'metal') {
      // 808-style metallic hat: six detuned squares through a high band
      const g = ctx.createGain(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 10000;
      for (const f of [205, 304, 369, 522, 540, 800]) { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f * 2; o.connect(bp); o.start(t); o.stop(t + 0.08); }
      bp.connect(hp).connect(g).connect(out);
      env(g, t, 0.09 * velocity, 0.001, open ? 0.2 : 0.035);
      return;
    }
    const n = noise(); const hp = ctx.createBiquadFilter(); const g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 7500;
    const pk = ctx.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 10500; pk.gain.value = 6; pk.Q.value = 1.2;
    env(g, t, 0.2 * velocity, 0.001, open ? 0.22 : 0.04);
    n.connect(hp).connect(pk).connect(g).connect(out);
    n.start(t); n.stop(t + (open ? 0.3 : 0.08));
  },

  bass(t, { note = 'C2', velocity = 1, duration = 0.2, tone }, out) {
    const ctx = getContext();
    const f = noteToFreq(note);
    if (tone === 'reese' || tone === 'sub') {
      const g = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
      const end = t + duration;
      const oscs = tone === 'reese' ? [[-14, 'sawtooth'], [14, 'sawtooth'], [0, 'sine']] : [[0, 'sine'], [0, 'triangle']];
      for (const [det, type] of oscs) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(end + 0.06); }
      lp.frequency.setValueAtTime(tone === 'reese' ? 300 : 500, t);
      if (tone === 'reese') lp.frequency.linearRampToValueAtTime(900, t + duration * 0.6);
      const lvl = (tone === 'reese' ? 0.3 : 0.45) * velocity;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(lvl, t + 0.01);
      g.gain.setValueAtTime(lvl, Math.max(t + 0.012, end - 0.03));
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
      lp.connect(g).connect(out);
      return;
    }
    const o = ctx.createOscillator(); const o2 = ctx.createOscillator();
    const lp = ctx.createBiquadFilter(); const g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    o2.type = 'square'; o2.frequency.value = f / 2;
    lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + Math.min(0.25, duration));
    const g2 = ctx.createGain(); g2.gain.value = 0.5;
    const end = t + duration;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.42 * velocity, t + 0.008);
    g.gain.setValueAtTime(0.42 * velocity, Math.max(t + 0.01, end - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.04);
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(out);
    o.start(t); o2.start(t); o.stop(end + 0.06); o2.stop(end + 0.06);
  },

  lead(t, { note = 'C4', velocity = 1, duration = 0.2, tone }, out) {
    const ctx = getContext();
    const f = noteToFreq(note);
    if (tone === 'acid') {
      // squelchy acid line: square through a resonant filter that snaps shut every note
      const o = ctx.createOscillator(); const lp = ctx.createBiquadFilter(); const g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.Q.value = 14;
      lp.frequency.setValueAtTime(3800, t);
      lp.frequency.exponentialRampToValueAtTime(320, t + Math.min(0.22, duration + 0.05));
      const end = t + duration;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.1 * velocity, t + 0.004);
      g.gain.setValueAtTime(0.1 * velocity, Math.max(t + 0.006, end - 0.02));
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
      o.connect(lp).connect(g).connect(out); o.start(t); o.stop(end + 0.08);
      return;
    }
    if (tone === 'keys') {
      // soft electric-piano: sine + quiet triangle overtone, bell-like decay
      const o = ctx.createOscillator(); const o2 = ctx.createOscillator(); const g = ctx.createGain(); const g2 = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f * 2; g2.gain.value = 0.18;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const end = t + Math.max(duration, 0.25);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2 * velocity, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.06 * velocity, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.25);
      o.connect(g); o2.connect(g2).connect(g); g.connect(lp).connect(out);
      for (const x of [o, o2]) { x.start(t); x.stop(end + 0.3); }
      return;
    }
    const o = ctx.createOscillator(); const o2 = ctx.createOscillator();
    const lp = ctx.createBiquadFilter(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = f;
    o2.type = 'sawtooth'; o2.frequency.value = f; o2.detune.value = 9;
    const mix2 = ctx.createGain(); mix2.gain.value = 0.55;
    lp.type = 'lowpass'; lp.Q.value = 3;
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(1800, t + 0.18);
    // gentle vibrato that fades in on long notes
    const lfo = ctx.createOscillator(); const lfoG = ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoG.gain.setValueAtTime(0, t); lfoG.gain.linearRampToValueAtTime(duration > 0.3 ? 9 : 0, t + Math.min(0.35, duration));
    lfo.connect(lfoG); lfoG.connect(o.detune); lfoG.connect(o2.detune);
    const end = t + duration;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12 * velocity, t + 0.008);
    g.gain.setValueAtTime(0.12 * velocity, Math.max(t + 0.012, end - 0.04));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.1);
    o.connect(lp); o2.connect(mix2).connect(lp); lp.connect(g).connect(out);
    for (const x of [o, o2, lfo]) { x.start(t); x.stop(end + 0.12); }
  },

  pad(t, { note = 'C3', velocity = 1, duration = 2, tone }, out) {
    const ctx = getContext();
    const f = noteToFreq(note);
    if (tone === 'warm' || tone === 'supersaw' || tone === 'dark') {
      const g = ctx.createGain(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      const end = t + duration;
      const level = { warm: 0.07, supersaw: 0.035, dark: 0.06 }[tone] * velocity;
      const voicesSpec = {
        warm: [[1, -4, 'triangle'], [1.5, 3, 'triangle'], [2, 0, 'sine'], [3, 2, 'sine']],          // with a soft major-ish color
        supersaw: [[1, -18, 'sawtooth'], [1, -7, 'sawtooth'], [1, 0, 'sawtooth'], [1, 7, 'sawtooth'], [1, 18, 'sawtooth'], [2, 5, 'sawtooth'], [1.5, -5, 'sawtooth']],
        dark: [[0.5, 0, 'square'], [1, -9, 'sawtooth'], [1, 9, 'sawtooth'], [1.5, 0, 'triangle']],
      }[tone];
      lp.frequency.setValueAtTime(tone === 'supersaw' ? 1800 : tone === 'dark' ? 380 : 900, t);
      if (tone === 'supersaw') lp.frequency.linearRampToValueAtTime(3200, t + Math.min(1, duration * 0.4));
      if (tone === 'dark') lp.frequency.linearRampToValueAtTime(700, t + duration * 0.8);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(level, t + Math.min(tone === 'supersaw' ? 0.05 : 0.5, duration / 3));
      g.gain.setValueAtTime(level, Math.max(t + 0.06, end - 0.35));
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.3);
      lp.connect(g).connect(out);
      // tape wobble for the lo-fi pad
      let wob = null;
      if (tone === 'warm') { wob = ctx.createOscillator(); wob.frequency.value = 0.6; const wg = ctx.createGain(); wg.gain.value = 9; wob.connect(wg); wob.start(t); wob.stop(end + 0.35); wob.wg = wg; }
      for (const [mult, det, type] of voicesSpec) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * mult; o.detune.value = det;
        if (wob) wob.wg.connect(o.detune);
        o.connect(lp); o.start(t); o.stop(end + 0.35);
      }
      return;
    }
    const g = ctx.createGain(); const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(500, t);
    lp.frequency.linearRampToValueAtTime(1300, t + Math.min(1.5, duration * 0.6));
    const end = t + duration;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06 * velocity, t + Math.min(0.6, duration / 3));
    g.gain.setValueAtTime(0.06 * velocity, Math.max(t + 0.61, end - 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, end + 0.3);
    lp.connect(g).connect(out);
    // chord: root, fifth, octave, slightly detuned
    for (const [mult, det] of [[1, -7], [1, 7], [1.5, 5], [2, -3]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth'; o.frequency.value = f * mult; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(end + 0.35);
    }
  },

  riser(t, { velocity = 1, duration = 2 }, out) {
    const ctx = getContext();
    const n = noise(); const bp = ctx.createBiquadFilter(); const g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(6000, t + duration);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18 * velocity, t + duration * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration + 0.05);
    n.loop = true;
    n.connect(bp).connect(g).connect(out);
    n.start(t); n.stop(t + duration + 0.1);
  },

  crackle(t, { velocity = 1, duration = 0.2 }, out) {
    // a few random vinyl pops across the step
    const ctx = getContext();
    const pops = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < pops; i++) {
      const at = t + Math.random() * duration;
      const n = noise(); const hp = ctx.createBiquadFilter(); const g = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2500 + Math.random() * 3000;
      env(g, at, (0.03 + Math.random() * 0.05) * velocity, 0.0005, 0.004 + Math.random() * 0.01);
      n.connect(hp).connect(g).connect(out); n.start(at, Math.random() * 0.5); n.stop(at + 0.03);
    }
  },

  click(t, { velocity = 1, high = false }, out) {
    const ctx = getContext();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'square'; o.frequency.value = high ? 2000 : 1200;
    env(g, t, 0.25 * velocity, 0.001, 0.03);
    o.connect(g).connect(out);
    o.start(t); o.stop(t + 0.05);
  },
};

let _drive = null;
function driveCurve() {
  if (_drive) return _drive;
  const n = 1024; _drive = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; _drive[i] = Math.tanh(x * 2.2); }
  return _drive;
}

/** Play a synth voice. type is 'kick' | 'snare' | 'hat' | 'bass' | 'lead' | 'pad' | 'riser' | 'click'. */
export function playSynth(type, time, params, out) {
  const v = voices[type];
  if (!v) { console.warn(`[synth] unknown voice ${type}`); return; }
  v(time, params || {}, out);
}
