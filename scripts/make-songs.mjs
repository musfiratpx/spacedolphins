// Generates data/songs/moon-calm.json and data/songs/deep-signal.json.
// Usage: node scripts/make-songs.mjs   (Mars has its own script: make-mars-song.mjs)
// Every song stays under 45 seconds and layers real NASA sounds under a synth backbone.
import fs from 'node:fs';

const hold = (note, steps) => [note, ...Array(steps - 1).fill('_')];
const bars = (...chunks) => chunks.flat();

// ------------------------------------------------- Moon: lo-fi chillhop (calm)
const moonProg = ['C2', 'A1', 'F1', 'G1'];
const moon = {
  id: 'moon-calm', title: 'Nearest Neighbors', region: 'moon', bpm: 96, stepsPerBar: 16, swing: 0.18, key: 'C major', genre: 'lo-fi chillhop',
  instruments: {
    kick:    { type: 'synth.kick',  gain: 0.8,  role: 'backbone', ducker: true },
    snare:   { type: 'synth.snare', gain: 0.75, role: 'backbone', tone: 'rim', send: { reverb: 0.25 } },
    hat:     { type: 'synth.hat',   gain: 0.32, role: 'backbone' },
    bass:    { type: 'synth.bass',  gain: 0.8,  role: 'backbone', tone: 'sub', duck: 0.35 },
    pad:     { type: 'synth.pad',   gain: 0.7,  role: 'pad', duck: 0.4, send: { reverb: 0.6 } },
    lead:    { type: 'synth.lead',  gain: 0.9,  role: 'lead', tone: 'keys', send: { reverb: 0.45, delay: 0.25 } },
    crackle: { type: 'synth.crackle', gain: 0.5, role: 'pad' },
    // NASA layer (no vocals): the Atlas V launch roar, low and far away, as a slow swell
    launch:  { type: 'sample.atlas-launch', gain: 0.22, role: 'riser', trim: true, durationSteps: 32, fadeSteps: 14, send: { reverb: 0.5 }, nasa: 'Atlas V: Launch' },
  },
  patterns: {
    kick:  { bap: 'o.....o...o.....', soft: 'o.......o.......' },
    snare: { rim: '....o.......o...' },
    hat:   { lazy: 'x.x.x.x.x.x.x.x.' },
    bass:  { root: bars(...moonProg.map((n) => [n, '_', '_', '_', '_', '_', '-', n, '_', '_', '-', '-', n.replace(/\d/, (d) => String(+d + 1)), '_', '-', '-'])) },
    pad:   { prog: bars(hold('C3', 16), hold('A2', 16), hold('F2', 16), hold('G2', 16)) },
    lead: {
      keys: bars(
        ['E4', '_', '-', 'G4', '-', 'B4', '_', '_', '-', '-', 'G4', '-', 'E4', '_', '_', '-'],
        ['C4', '_', '-', 'E4', '-', 'G4', '_', '_', '-', '-', 'E4', '-', 'C4', '_', '_', '-'],
        ['A3', '_', '-', 'C4', '-', 'E4', '_', '_', '-', '-', 'C4', '-', 'A3', '_', '_', '-'],
        ['B3', '_', '-', 'D4', '-', 'F4', '_', '_', 'G4', '_', 'F4', '-', 'D4', '_', '_', '-'],
      ),
      sparse: bars(
        ['E4', '_', '_', '_', '-', '-', '-', '-', 'G4', '_', '_', '_', '-', '-', '-', '-'],
        ['C4', '_', '_', '_', '-', '-', '-', '-', 'E4', '_', '_', '_', '-', '-', '-', '-'],
        ['A3', '_', '_', '_', '-', '-', '-', '-', 'C4', '_', '_', '_', '-', '-', '-', '-'],
        ['B3', '_', '_', '_', '-', '-', '-', '-', 'D4', '_', '_', '_', '-', '-', '-', '-'],
      ),
    },
    crackle: { on: 'x.x.x.x.x.x.x.x.' },
    launch: { swell: 'x' + '.'.repeat(31) },
  },
  // 17 bars at 96 BPM = 42.5 s
  sections: [
    { name: 'intro',  bars: 2, play: { pad: 'prog', crackle: 'on', lead: 'sparse', launch: 'swell', kick: 'soft' } },
    { name: 'groove', bars: 4, play: { kick: 'bap', snare: 'rim', hat: 'lazy', bass: 'root', pad: 'prog', crackle: 'on' } },
    { name: 'keys',   bars: 6, play: { kick: 'bap', snare: 'rim', hat: 'lazy', bass: 'root', pad: 'prog', lead: 'keys', crackle: 'on' } },
    { name: 'drift',  bars: 2, play: { kick: 'soft', pad: 'prog', crackle: 'on', launch: 'swell', lead: 'sparse' } },
    { name: 'outro',  bars: 3, play: { kick: 'bap', snare: 'rim', hat: 'lazy', bass: 'root', pad: 'prog', lead: 'keys', crackle: 'on' } },
  ],
  chart: {
    kick:  { lane: 'L', from: 'easy' },
    snare: { lane: 'R', from: 'easy' },
    lead:  { lane: 'alt', from: 'normal', hold: true },
    hat:   { lane: 'alt', from: 'hard' },
  },
  dataBreak: null,   // the Moon is the tutorial: no data break
};

// ----------------------------------------------------------- Deep space (intense)
const deepProg = ['E2', 'C2', 'G1', 'D2'];
const deep = {
  id: 'deep-signal', title: 'The Long Signal', region: 'deep', bpm: 140, stepsPerBar: 16, swing: 0, key: 'E minor', genre: 'breakbeat',
  instruments: {
    kick:  { type: 'synth.kick',  gain: 1.0,  role: 'backbone', ducker: true },
    snare: { type: 'synth.snare', gain: 0.85, role: 'backbone', send: { reverb: 0.25 } },
    hat:   { type: 'synth.hat',   gain: 0.5,  role: 'backbone', send: { delay: 0.06 } },
    bass:  { type: 'synth.bass',  gain: 0.9,  role: 'backbone', tone: 'reese', duck: 0.55 },
    pad:   { type: 'synth.pad',   gain: 0.6,  role: 'pad', duck: 0.6, send: { reverb: 0.55 } },
    lead:  { type: 'synth.lead',  gain: 0.8,  role: 'lead', send: { reverb: 0.25, delay: 0.25 } },
    riser: { type: 'synth.riser', gain: 0.6,  role: 'riser', send: { reverb: 0.3 } },
    // NASA layers
    lightning: { type: 'sample.jupiter-lightning', gain: 0.35, role: 'hats', trim: true, durationSteps: 6, fadeSteps: 2, send: { reverb: 0.3 }, nasa: 'Voyager: Lightning on Jupiter' },
  },
  patterns: {
    // broken beats: kick on 1 and the 'and' of 3, snare on 2 and 4, ghost notes in between
    kick:  { drive: 'o.........o.....', two: 'o.....o...o..o..', half: 'o.......o.......', fill: 'o.x.o.x.o.xxo.xx' },
    snare: { back: '....o..x....o..x', roll: '....o.......o.oo' },
    hat:   { sixteen: 'x.xxx.xxx.xxx.xo', eighth: 'x.x.x.x.x.x.x.x.' },
    bass:  { pulse: bars(...deepProg.map((n) => [n, '_', '_', '_', '_', '_', '-', n, '_', '_', '_', '-', n, '_', '_', '-'])), long: bars(...deepProg.map((n) => hold(n, 16))) },
    pad:   { prog: bars(hold('E3', 16), hold('C3', 16), hold('G2', 16), hold('D3', 16)) },
    lead: {
      hook: bars(
        ['E5', '-', 'B4', '-', 'G4', '-', 'B4', '-', 'E5', '_', 'F#5', '-', 'G5', '_', 'F#5', '-'],
        ['E5', '-', 'C5', '-', 'G4', '-', 'C5', '-', 'E5', '_', 'D5', '-', 'C5', '_', 'B4', '-'],
        ['D5', '-', 'B4', '-', 'G4', '-', 'B4', '-', 'D5', '_', 'E5', '-', 'D5', '_', 'B4', '-'],
        ['A4', '_', 'B4', '-', 'D5', '_', 'F#5', '-', 'A5', '_', '_', '_', 'F#5', '_', '_', '-'],
      ),
      answer: bars(
        ['G5', '_', '-', 'F#5', '-', 'E5', '_', '-', 'B4', '_', '-', 'E5', '-', 'F#5', '_', '-'],
        ['G5', '_', '-', 'E5', '-', 'C5', '_', '-', 'G4', '_', '-', 'C5', '-', 'E5', '_', '-'],
        ['F#5', '_', '-', 'D5', '-', 'B4', '_', '-', 'G4', '_', '-', 'B4', '-', 'D5', '_', '-'],
        ['E5', '_', '_', '_', 'F#5', '_', '_', '_', 'G5', '_', '_', '_', 'B5', '_', '_', '-'],
      ),
    },
    riser: { up: bars(hold('C4', 32)) },
    lightning: { crack: '....o...........' + '............o...' },
  },
  // 26 bars at 140 BPM = 44.6 s
  sections: [
    { name: 'intro',      bars: 2, play: { kick: 'half', hat: 'eighth', pad: 'prog' } },
    { name: 'groove',     bars: 4, play: { kick: 'drive', snare: 'back', hat: 'eighth', bass: 'pulse', pad: 'prog' } },
    { name: 'build',      bars: 2, play: { kick: 'fill', snare: 'roll', hat: 'sixteen', bass: 'long', riser: 'up' } },
    { name: 'drop',       bars: 6, play: { kick: 'two', snare: 'back', hat: 'sixteen', bass: 'pulse', pad: 'prog', lead: 'hook', lightning: 'crack' } },
    { name: 'data break', bars: 4, play: { kick: 'half', hat: 'eighth', pad: 'prog' }, dataBreak: true },
    { name: 'final',      bars: 6, play: { kick: 'drive', snare: 'back', hat: 'sixteen', bass: 'pulse', pad: 'prog', lead: 'answer', lightning: 'crack' } },
    { name: 'outro',      bars: 2, play: { kick: 'half', pad: 'prog' } },
  ],
  chart: {
    snare: { lane: 'R', from: 'easy' },
    kick:  { lane: 'L', from: 'easy' },
    lead:  { lane: 'alt', from: 'normal', hold: true },
    bass:  { lane: 'alt', from: 'hard' },
  },
  // Voyager 1's interstellar plasma once downloaded; until then Cassini's Saturn radio emissions
  dataBreak: { startBar: 15, bars: 4, sample: 'voyager-plasma', fallbackSample: 'saturn-radio', gain: 0.95, lanes: 'alt' },
};

for (const song of [moon, deep]) {
  const nBars = song.sections.reduce((a, s) => a + s.bars, 0);
  const secs = (nBars * 4 * 60) / song.bpm;
  if (secs > 45) throw new Error(`${song.id} is ${secs.toFixed(1)} s (max 45)`);
  fs.writeFileSync(`data/songs/${song.id}.json`, JSON.stringify(song, null, 2) + '\n');
  console.log(`wrote data/songs/${song.id}.json (${nBars} bars, ${secs.toFixed(1)} s)`);
}
