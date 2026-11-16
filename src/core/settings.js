import { emit } from './bus.js';

const KEY = 'hh4052.settings.v1';

const prefersReducedMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const defaults = {
  volumes: { master: 0.9, music: 0.8, sfx: 0.8, radio: 0.9 },
  noteSpeed: 1.0,        // multiplier; 1 = notes take ~1.6 s to fall
  audioOffsetMs: 0,      // + means player hears audio late (Bluetooth)
  reducedMotion: prefersReducedMotion,
  oneLane: false,
  captions: true,
  quality: 'auto',       // auto | low | medium | high
  colorblind: false,
  dyslexiaFont: false,   // 'easy-read' font: plain sans-serif with extra spacing
  readAloud: false,      // speak radio lines with the browser's speech voice
  bgMusic: true,         // background ship ambience on menus (round music is separate)
};

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...defaults, ...saved, volumes: { ...defaults.volumes, ...(saved.volumes || {}) } };
  } catch {
    return structuredClone(defaults);
  }
}

export const settings = load();

export function setSetting(path, value) {
  const parts = path.split('.');
  let obj = settings;
  while (parts.length > 1) obj = obj[parts.shift()];
  obj[parts[0]] = value;
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
  emit('settings:change', { path, value });
}
