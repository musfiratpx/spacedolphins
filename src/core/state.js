// Game progress, saved to localStorage after every change.
import { emit } from './bus.js';

const KEY = 'hh4052.save.v1';

const fresh = () => ({
  seenIntro: false,
  unlocked: {},          // id -> { date, grade, accuracy }
  best: {},              // `${songId}:${difficulty}` -> { grade, accuracy }
  shield: 50,            // hook for planned-later shield meter
  lastScreen: 'hub',
});

function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return fresh(); }
}

export const state = load();

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function isUnlocked(id) { return Boolean(state.unlocked[id]); }

export function unlock(id, result) {
  const isNew = !state.unlocked[id];
  if (isNew) {
    state.unlocked[id] = {
      date: new Date().toLocaleDateString('en-CA'),   // local YYYY-MM-DD
      grade: result.grade,
      accuracy: result.accuracy,
    };
    save();
    emit('unlock', { id });
  }
  return isNew;
}

export function recordBest(songId, difficulty, result) {
  const k = `${songId}:${difficulty}`;
  const prev = state.best[k];
  if (!prev || result.accuracy > prev.accuracy) {
    state.best[k] = { grade: result.grade, accuracy: result.accuracy };
    save();
  }
}

export function resetProgress() {
  Object.assign(state, fresh());
  save();
}
