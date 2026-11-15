// Generates the note chart from the same score the sequencer plays.
import { expandScore, stepSeconds } from './score.js';
import { features } from '../core/config.js';

const RANK = { easy: 0, normal: 1, hard: 2 };

// Charting rules (from common rhythm-game charting practice):
// - every note sits on a real sound in the score (readable, never random)
// - lower difficulties: wider grid, even spacing, no fast same-lane repeats ("jacks")
// - holds only on sustained melody notes; shorter holds allowed as difficulty rises
// - chords (both lanes at once) only on Hard
const RULES = {
  // grid: allowed step multiples · gaps (ms) per lane / overall · jackMs: min gap for same-lane repeats
  easy:   { grid: 4, laneGapMs: 380, anyGapMs: 300, chords: false, holdMinSteps: 4, jackMs: 650 },
  normal: { grid: 2, laneGapMs: 290, anyGapMs: 130, chords: false, holdMinSteps: 3, jackMs: 300 },
  hard:   { grid: 1, laneGapMs: 150, anyGapMs: 0,   chords: true,  holdMinSteps: 3, jackMs: 0 },
};

/**
 * @param song  score JSON
 * @param difficulty 'easy' | 'normal' | 'hard'
 * @param opts { oneLane?: boolean, dataBreak?: { startSec, endSec, peaksMs } }
 * @returns {{ notes: Array<{t:number, lane:'L'|'R', hold?:number, track:string}>, lengthMs:number }}
 */
export function generateChart(song, difficulty = 'normal', opts = {}) {
  const { events, lengthSec } = expandScore(song);
  const rule = RULES[difficulty] || RULES.normal;
  const order = Object.keys(song.chart || {});
  const altCounters = {};
  let candidates = [];

  for (const ev of events) {
    const spec = song.chart?.[ev.track];
    if (!spec) continue;
    // lower difficulties still get the LONG sustained notes from higher tracks, as gentle holds to learn on
    const longHold = spec.hold && features.holdNotes && ev.duration >= stepSeconds(song) * rule.holdMinSteps;
    if (RANK[difficulty] < RANK[spec.from || 'easy'] && !longHold) continue;
    if (ev.step % rule.grid !== 0) continue;
    if (spec.onlyAccents && ev.velocity < 1) continue;

    let lane = spec.lane;
    if (lane === 'alt') {
      altCounters[ev.track] = (altCounters[ev.track] || 0) + 1;
      lane = altCounters[ev.track] % 2 ? 'L' : 'R';
    }
    const note = { t: Math.round(ev.time * 1000), lane, track: ev.track, priority: order.indexOf(ev.track), flex: spec.lane === 'alt' };
    if (spec.hold && features.holdNotes && ev.duration >= stepSeconds(song) * rule.holdMinSteps) {
      note.hold = Math.round(ev.duration * 1000);
    }
    candidates.push(note);
  }

  // Data break: notes sit on the recording's loudest peaks instead of the backbone.
  // opts.dataBreak = { startSec, endSec, peaksMs } from sampler.prepareSong.
  const db = features.dataBreaks ? opts.dataBreak : null;
  if (db) {
    const s0 = db.startSec * 1000; const s1 = db.endSec * 1000;
    candidates = candidates.filter((n) => {
      const role = song.instruments?.[n.track]?.role;
      return !(role === 'backbone' && n.t >= s0 && n.t < s1);
    });
    let i = 0;
    for (const t of db.peaksMs) {
      candidates.push({ t, lane: i++ % 2 ? 'R' : 'L', track: 'dataBreak', priority: -1, flex: true });
    }
  }

  candidates.sort((a, b) => a.t - b.t || a.priority - b.priority);

  const notes = [];
  const lastByLane = { L: -Infinity, R: -Infinity };
  let lastAny = -Infinity;
  for (const n of candidates) {
    let sameTime = notes.length && notes[notes.length - 1].t === n.t;
    if (sameTime) {
      const prev = notes[notes.length - 1];
      // a sustained note beats a plain tap at the same moment (holds belong on sustained sounds)
      if (n.hold && !prev.hold && (!rule.chords || prev.lane === n.lane)) {
        notes.pop();
        lastByLane[prev.lane] = prev.prevLaneT;
        lastAny = prev.prevAny;
        sameTime = false;
      } else if (prev.lane === n.lane || !rule.chords) continue;   // no duplicates; chords on Hard only
    }
    if (!sameTime) {
      if (n.t - lastAny < rule.anyGapMs) continue;
    }
    // flow: a flexible note that would repeat the same lane too fast moves to the other hand
    if (n.flex && !sameTime && rule.jackMs && notes.length) {
      const prev = notes[notes.length - 1];
      const other = n.lane === 'L' ? 'R' : 'L';
      if (prev.lane === n.lane && n.t - prev.t < rule.jackMs && n.t - lastByLane[other] >= rule.laneGapMs) n.lane = other;
    }
    if (n.t - lastByLane[n.lane] < rule.laneGapMs) continue;
    notes.push({ t: n.t, lane: n.lane, track: n.track, ...(n.hold ? { hold: n.hold } : {}), prevLaneT: lastByLane[n.lane], prevAny: lastAny });
    lastByLane[n.lane] = n.t + (n.hold || 0);
    lastAny = n.t;
  }

  for (const n of notes) { delete n.prevLaneT; delete n.prevAny; }
  if (opts.oneLane) for (const n of notes) n.lane = 'L';
  return { notes, lengthMs: Math.round(lengthSec * 1000), bpm: song.bpm, song: song.id, difficulty };
}
