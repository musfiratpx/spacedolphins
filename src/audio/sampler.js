// NASA sample player. Loads sounds listed in assets/manifest.json, schedules them
// on the audio clock, and finds a recording's loudest peaks for data-break notes.
// Missing files return null/false so callers fall back to synths.
import { features } from '../core/config.js';
import { getSound } from '../core/manifest.js';
import { getContext } from './clock.js';
import { emit } from '../core/bus.js';

const buffers = new Map();   // id -> { buf, start }  (start = first non-silent second)
const loading = new Map();
const firstPlayed = new Set();
const warned = new Set();

export function hasSample(id) {
  return features.nasaSamples && !getSound(id).placeholder;
}

export async function loadSample(id) {
  if (!features.nasaSamples) return null;
  if (buffers.has(id)) return buffers.get(id).buf;
  if (loading.has(id)) return loading.get(id);
  const { url, placeholder } = getSound(id);
  if (placeholder) {
    if (!warned.has(id)) { console.info(`[sampler] ${id} missing; using synth fallback`); warned.add(id); }
    return null;
  }
  const p = (async () => {
    try {
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await getContext().decodeAudioData(data);
      buffers.set(id, { buf, start: firstSound(buf) });
      return buf;
    } catch (err) {
      console.warn(`[sampler] couldn't decode ${id} (${url})`, err);
      return null;
    } finally { loading.delete(id); }
  })();
  loading.set(id, p);
  return p;
}

/** Seconds of leading silence, so short chops start on the sound itself. */
function firstSound(buf, threshold = 0.04) {
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > threshold) return Math.max(0, i / buf.sampleRate - 0.005);
  return 0;
}

/**
 * Schedule a sample at an audio-clock time. Returns false if it isn't available
 * (caller should play its fallback).
 * opts: { rate=1, gain=1, loop=false, offset=0, trim=false, duration, fade }
 */
export function playSample(id, time, out, opts = {}) {
  const entry = buffers.get(id);
  if (!features.nasaSamples || !entry) return false;
  const ctx = getContext();
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = entry.buf;
  src.playbackRate.value = opts.rate || 1;
  src.loop = Boolean(opts.loop);
  const peak = opts.gain ?? 1;
  const offset = (opts.trim ? entry.start : 0) + (opts.offset || 0);
  const dur = opts.duration ?? (entry.buf.duration - offset) / (opts.rate || 1);
  const fade = Math.min(opts.fade ?? 0.03, dur / 2);
  // short fades in and out so chops never click
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(peak, time + 0.006);
  g.gain.setValueAtTime(peak, time + dur - fade);
  g.gain.linearRampToValueAtTime(0, time + dur);
  src.connect(g).connect(out);
  src.start(time, offset);
  src.stop(time + dur + 0.02);
  if (!firstPlayed.has(id)) {
    firstPlayed.add(id);
    const delay = Math.max(0, (time - ctx.currentTime) * 1000);
    setTimeout(() => emit('sample:firstPlay', { id, time }), delay);
  }
  return true;
}

/**
 * Loudest peaks of a loaded sample, in ms from where playback starts.
 * Peaks are at least minGapMs apart (CLAUDE.md: >= 150 ms per lane).
 */
export function findPeaks(id, { minGapMs = 150, maxMs = Infinity, count = 64, trim = false } = {}) {
  const entry = buffers.get(id);
  if (!entry) return [];
  const { buf } = entry;
  const d = buf.getChannelData(0);
  const win = Math.floor(buf.sampleRate * 0.02);     // 20 ms RMS windows
  const start = trim ? Math.floor(entry.start * buf.sampleRate) : 0;
  const env = [];
  for (let i = start; i + win < d.length && env.length * 20 < maxMs; i += win) {
    let s = 0;
    for (let j = 0; j < win; j++) s += d[i + j] * d[i + j];
    env.push(Math.sqrt(s / win));
  }
  const max = Math.max(...env, 1e-6);
  const mean = env.reduce((a, b) => a + b, 0) / (env.length || 1);
  const floor = Math.max(mean * 1.2, max * 0.25);
  const cands = [];
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] > floor && env[i] >= env[i - 1] && env[i] > env[i + 1]) cands.push({ ms: i * 20, v: env[i] });
  }
  // keep the loudest, enforcing the gap
  cands.sort((a, b) => b.v - a.v);
  const picked = [];
  for (const c of cands) {
    if (picked.length >= count) break;
    if (picked.every((p) => Math.abs(p.ms - c.ms) >= minGapMs)) picked.push(c);
  }
  return picked.map((p) => p.ms).sort((a, b) => a - b);
}

/**
 * Load every NASA sound a song uses and work out its data break.
 * @returns {Promise<{ dataBreak: null | { sample, startSec, endSec, gain, peaksMs } }>}
 */
export async function prepareSong(song, barSec) {
  const ids = Object.values(song.instruments || {})
    .filter((i) => i.type?.startsWith('sample.')).map((i) => i.type.split('.')[1]);
  const db = song.dataBreak;
  let dbSample = null;
  if (db && features.dataBreaks) {
    dbSample = [db.sample, db.fallbackSample].find((id) => id && hasSample(id)) || null;
    if (dbSample) ids.push(dbSample);
  }
  await Promise.all([...new Set(ids)].map(loadSample));
  if (!dbSample || !buffers.has(dbSample)) return { dataBreak: null };
  const startSec = (db.startBar - 1) * barSec;
  const endSec = startSec + db.bars * barSec;
  const peaks = findPeaks(dbSample, { minGapMs: 150, maxMs: (endSec - startSec) * 1000 - 200, trim: true });
  return {
    dataBreak: {
      sample: dbSample, startSec, endSec, gain: db.gain ?? 0.9,
      peaksMs: peaks.map((ms) => Math.round(startSec * 1000 + ms)),
    },
  };
}
