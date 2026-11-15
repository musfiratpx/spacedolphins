// Generates the note chart from the same score the sequencer plays.
import { expandScore, stepSeconds } from './score.js';
import { features } from '../core/config.js';

const RANK = { easy: 0, normal: 1, hard: 2 };

const RULES = {
  // keep notes on these step multiples, and keep at least this gap (ms) per lane / overall
  easy:   { grid: 4, laneGapMs: 380, anyGapMs: 300, chords: false },
  normal: { grid: 2, laneGapMs: 200, anyGapMs: 130, chords: false },
  hard:   { grid: 1, laneGapMs: 150, anyGapMs: 0,   chords: true },
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
    if (RANK[difficulty] < RANK[spec.from || 'easy']) continue;
    if (ev.step % rule.grid !== 0) continue;
    if (spec.onlyAccents && ev.velocity < 1) continue;

    let lane = spec.lane;
    if (lane === 'alt') {
      altCounters[ev.track] = (altCounters[ev.track] || 0) + 1;
      lane = altCounters[ev.track] % 2 ? 'L' : 'R';
    }
    const note = { t: Math.round(ev.time * 1000), lane, track: ev.track, priority: order.indexOf(ev.track) };
    if (spec.hold && features.holdNotes && ev.duration >= stepSeconds(song) * 2) {
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
      candidates.push({ t, lane: i++ % 2 ? 'R' : 'L', track: 'dataBreak', priority: -1 });
    }
  }

  candidates.sort((a, b) => a.t - b.t || a.priority - b.priority);

  const notes = [];
  const lastByLane = { L: -Infinity, R: -Infinity };
  let lastAny = -Infinity;
  for (const n of candidates) {
    const sameTime = notes.length && notes[notes.length - 1].t === n.t;
    if (sameTime) {
      const prev = notes[notes.length - 1];
      if (prev.lane === n.lane || !rule.chords) continue;   // no duplicates; chords on Hard only
    } else {
      if (n.t - lastAny < rule.anyGapMs) continue;
    }
    if (n.t - lastByLane[n.lane] < rule.laneGapMs) continue;
    notes.push({ t: n.t, lane: n.lane, track: n.track, ...(n.hold ? { hold: n.hold } : {}) });
    lastByLane[n.lane] = n.t + (n.hold || 0);
    lastAny = n.t;
  }

  if (opts.oneLane) for (const n of notes) n.lane = 'L';
  return { notes, lengthMs: Math.round(lengthSec * 1000), bpm: song.bpm, song: song.id, difficulty };
}
