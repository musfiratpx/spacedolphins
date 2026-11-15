// NASA sample player (Phase 2 fills this in behind features.nasaSamples).
// Phase 1: loads nothing, reports "not available" so the sequencer uses its synth fallback.
import { features } from '../core/config.js';
import { getSound } from '../core/manifest.js';
import { getContext } from './clock.js';
import { emit } from '../core/bus.js';

const buffers = new Map();
const firstPlayed = new Set();
const warned = new Set();

export async function loadSample(id) {
  if (!features.nasaSamples) return null;
  if (buffers.has(id)) return buffers.get(id);
  const { url, placeholder } = getSound(id);
  if (placeholder) {
    if (!warned.has(id)) { console.info(`[sampler] ${id} missing; using synth fallback`); warned.add(id); }
    return null;
  }
  const data = await (await fetch(url)).arrayBuffer();
  const buf = await getContext().decodeAudioData(data);
  buffers.set(id, buf);
  return buf;
}

/**
 * Schedule a sample at an audio-clock time. Returns false if it isn't available
 * (caller should play its fallback).
 * opts: { rate=1, gain=1, loop=false, offset=0, duration }
 */
export function playSample(id, time, out, opts = {}) {
  const buf = buffers.get(id);
  if (!features.nasaSamples || !buf) return false;
  const ctx = getContext();
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  src.buffer = buf;
  src.playbackRate.value = opts.rate || 1;
  src.loop = Boolean(opts.loop);
  g.gain.value = opts.gain ?? 1;
  src.connect(g).connect(out);
  src.start(time, opts.offset || 0, opts.duration);
  if (!firstPlayed.has(id)) {
    firstPlayed.add(id);
    emit('sample:firstPlay', { id, time });
  }
  return true;
}

/** Hook for data breaks: loudest peaks of a sample, in ms from its start (Phase 2). */
export function findPeaks(/* id, minGapMs = 150, count = 16 */) {
  return [];
}
