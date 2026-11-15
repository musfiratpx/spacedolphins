// Generates data/songs/mars-drive.json (kept as a script so the score is easy to tweak).
import fs from 'node:fs';
const hold = (note, steps) => [note, ...Array(steps - 1).fill('_')];
const bars = (...chunks) => chunks.flat();
const bassBar = (n) => [n, '-', n, n, '-', n, n, '-', n, '-', n, n, '-', n, n, '-'].map((t, i) => (t === n && i % 4 === 3 ? n.replace(/\d/, (d) => String(Number(d) + 1)) : t));
const prog = ['D2', 'A#1', 'C2', 'A1'];
const song = {
  id: 'mars-drive',
  title: 'The Red Archive',
  region: 'mars',
  bpm: 112,
  stepsPerBar: 16,
  swing: 0,
  key: 'D minor',
  instruments: {
    kick:  { type: 'synth.kick',  gain: 1.0,  role: 'backbone', nasaLayer: 'marsquake (sub hit on downbeats, Phase 2)' },
    snare: { type: 'synth.snare', gain: 0.85, role: 'backbone' },
    hat:   { type: 'synth.hat',   gain: 0.6,  role: 'backbone' },
    bass:  { type: 'synth.bass',  gain: 0.8,  role: 'backbone', nasaLayer: 'ingenuity-hum drone (Phase 2)' },
    pad:   { type: 'synth.pad',   gain: 0.7,  role: 'pad', nasaLayer: 'mars-wind (Phase 2)' },
    lead:  { type: 'synth.lead',  gain: 0.75, role: 'lead' },
    riser: { type: 'synth.riser', gain: 0.8,  role: 'riser' },
  },
  patterns: {
    kick:  { four: 'o...x...o...x...', drive: 'o..x..x.o...x...', half: 'o.......o.......', fill: 'o...x...o.x.x.xx' },
    snare: { back: '....o.......o...', fill: '....o.......o.oo', ghost: '....o..x....o..x' },
    hat:   { eighth: 'x.x.x.x.x.x.x.x.', sixteen: 'xxoxxxoxxxoxxxox', quarter: 'x...x...x...x...' },
    bass: {
      drive: bars(...prog.map(bassBar)),
      long: bars(...prog.map((n) => hold(n, 16))),
    },
    pad: { prog: bars(hold('D3', 16), hold('A#2', 16), hold('C3', 16), hold('A2', 16)) },
    lead: {
      hook: bars(
        ['D4', '_', '-', 'F4', '-', 'A4', '_', '_', 'G4', '_', 'F4', '-', 'E4', '_', 'D4', '-'],
        ['F4', '_', '-', 'A4', '-', 'D5', '_', '_', 'C5', '_', 'A#4', '-', 'A4', '_', '_', '-'],
        ['G4', '_', '-', 'A4', '-', 'C5', '_', '_', 'A#4', '_', 'A4', '-', 'G4', '_', 'E4', '-'],
        ['A4', '_', '_', '_', 'G4', '_', 'F4', '_', 'E4', '_', '_', '_', 'C#4', '_', '_', '-'],
      ),
      answer: bars(
        ['A4', '-', 'A4', '-', 'C5', '_', 'A4', '-', 'G4', '-', 'F4', '_', 'G4', '_', '_', '-'],
        ['F4', '-', 'F4', '-', 'A4', '_', 'F4', '-', 'D4', '-', 'C4', '_', 'D4', '_', '_', '-'],
        ['E4', '-', 'E4', '-', 'G4', '_', 'E4', '-', 'C4', '-', 'E4', '_', 'G4', '_', '_', '-'],
        ['A4', '_', '_', '_', 'C#5', '_', '_', '_', 'E5', '_', '_', '_', 'D5', '_', '_', '-'],
      ),
    },
    riser: { up: bars(hold('C4', 64)) },
  },
  sections: [
    { name: 'intro',     bars: 4, play: { kick: 'half', hat: 'quarter', pad: 'prog' } },
    { name: 'groove',    bars: 8, play: { kick: 'four', snare: 'back', hat: 'eighth', bass: 'drive', pad: 'prog' } },
    { name: 'build',     bars: 4, play: { kick: 'four', snare: 'ghost', hat: 'sixteen', bass: 'long', riser: 'up' } },
    { name: 'drop',      bars: 8, play: { kick: 'drive', snare: 'back', hat: 'sixteen', bass: 'drive', pad: 'prog', lead: 'hook' } },
    { name: 'breakdown', bars: 4, play: { kick: 'half', hat: 'quarter', pad: 'prog' }, dataBreak: true },
    { name: 'final',     bars: 8, play: { kick: 'drive', snare: 'back', hat: 'sixteen', bass: 'drive', pad: 'prog', lead: 'answer' } },
    { name: 'outro',     bars: 2, play: { kick: 'half', pad: 'prog' } },
  ],
  chart: {
    snare: { lane: 'R', from: 'easy' },
    kick:  { lane: 'L', from: 'easy' },
    lead:  { lane: 'alt', from: 'normal', hold: true },
    bass:  { lane: 'alt', from: 'hard' },
  },
  dataBreak: { startBar: 25, bars: 4, sample: 'marsquake', lanes: 'alt', note: 'Bars are 1-indexed. Phase 2: notes from marsquake peaks; backbone drops out.' },
};
fs.writeFileSync(process.argv[2], JSON.stringify(song, null, 2) + '\n');
console.log('wrote', process.argv[2]);
