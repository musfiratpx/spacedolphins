// The one audio clock. ALL timing in the game reads getAudioTime().
// Buses: music / sfx / radio -> master -> limiter -> analyser -> speakers.
import { settings } from '../core/settings.js';
import { on } from '../core/bus.js';

let ctx = null;
let master, limiter, analyser;
const buses = {};

export function getContext() {
  if (!ctx) init();
  return ctx;
}

function init() {
  const AC = window.AudioContext || window.webkitAudioContext;
  ctx = new AC({ latencyHint: 'interactive' });

  master = ctx.createGain();
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 8;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.75;

  for (const name of ['music', 'sfx', 'radio']) {
    buses[name] = ctx.createGain();
    buses[name].connect(master);
  }
  master.connect(limiter).connect(analyser).connect(ctx.destination);
  applyVolumes();
  on('settings:change', ({ path }) => { if (path.startsWith('volumes')) applyVolumes(); });

  // Pause audio with the tab (hook for the "pause on blur" polish item).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });
}

function applyVolumes() {
  if (!ctx) return;
  const v = settings.volumes;
  const t = ctx.currentTime;
  master.gain.setTargetAtTime(v.master, t, 0.02);
  buses.music.gain.setTargetAtTime(v.music, t, 0.02);
  buses.sfx.gain.setTargetAtTime(v.sfx, t, 0.02);
  buses.radio.gain.setTargetAtTime(v.radio, t, 0.02);
}

/** Call from a click/keypress so browsers allow sound. */
export async function unlockAudio() {
  const c = getContext();
  if (c.state !== 'running') await c.resume();
  return c;
}

export function getAudioTime() {
  return ctx ? ctx.currentTime : 0;
}

/** Output latency estimate in seconds (what the player actually hears is this late). */
export function getOutputLatency() {
  if (!ctx) return 0;
  return (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
}

export function getAnalyser() {
  getContext();
  return analyser;
}

export function getBus(name) {
  getContext();
  return buses[name];
}
