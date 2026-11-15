// Turns a song score (data/songs/*.json) into a flat, timed list of events.
// Both the sequencer (what you hear) and charts.js (what you play) read this,
// so notes and music can never drift apart.

export function stepSeconds(song) {
  const stepsPerBeat = (song.stepsPerBar || 16) / 4;
  return 60 / song.bpm / stepsPerBeat;
}

export function barSeconds(song) {
  return stepSeconds(song) * (song.stepsPerBar || 16);
}

function isDrumPattern(p) { return typeof p === 'string'; }

/**
 * @returns {{ events: Array, bars: number, lengthSec: number, beats: number[], sections: Array }}
 * event = { time, track, bar, step, absStep, note?, duration, velocity }
 * time is seconds from the start of bar 1.
 */
export function expandScore(song) {
  const spb = song.stepsPerBar || 16;
  const step = stepSeconds(song);
  const swing = song.swing || 0;
  const events = [];
  const sections = [];
  let bar = 0;

  for (const section of song.sections) {
    sections.push({ name: section.name, startBar: bar, bars: section.bars, startSec: bar * spb * step });
    for (let b = 0; b < section.bars; b++, bar++) {
      for (const [track, patternName] of Object.entries(section.play || {})) {
        if (!patternName) continue;
        const pattern = song.patterns?.[track]?.[patternName];
        if (!pattern) { console.warn(`[score] ${song.id}: missing pattern ${track}.${patternName}`); continue; }
        const len = pattern.length;
        for (let s = 0; s < spb; s++) {
          const idx = (b * spb + s) % len;
          const absStep = bar * spb + s;
          const swingOffset = (s % 2 === 1) ? swing * step : 0;
          const time = absStep * step + swingOffset;

          if (isDrumPattern(pattern)) {
            const ch = pattern[idx];
            if (ch === 'x' || ch === 'o') {
              events.push({ time, track, bar, step: s, absStep, duration: step, velocity: ch === 'o' ? 1 : 0.78 });
            }
          } else {
            const tok = pattern[idx];
            if (tok && tok !== '-' && tok !== '_') {
              // length = this step plus any following "_" steps (may cross into next bar)
              let n = 1;
              while (n < len && pattern[(idx + n) % len] === '_' && s + n < spb * (section.bars - b)) n++;
              events.push({ time, track, bar, step: s, absStep, note: tok, duration: n * step, velocity: 0.9 });
            }
          }
        }
      }
    }
  }

  events.sort((a, b) => a.time - b.time);
  const lengthSec = bar * spb * step;
  const beats = [];
  const stepsPerBeat = spb / 4;
  for (let i = 0; i < bar * 4; i++) beats.push(i * stepsPerBeat * step);
  return { events, bars: bar, lengthSec, beats, sections };
}
