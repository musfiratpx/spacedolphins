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
  genre: 'synthwave',
  instruments: {
    // send = { reverb, delay } amounts; duck = dips under the kick so the beat stays clear
    kick:  { type: 'synth.kick',  gain: 1.0,  role: 'backbone', ducker: true, nasaLayer: 'marsquake (sub hit on downbeats, once downloaded)' },
    snare: { type: 'synth.snare', gain: 0.8,  role: 'backbone', tone: 'gated', send: { reverb: 0.45 } },
    hat:   { type: 'synth.hat',   gain: 0.5,  role: 'backbone', send: { delay: 0.05 } },
    bass:  { type: 'synth.bass',  gain: 0.8,  role: 'backbone', duck: 0.5, nasaLayer: 'ingenuity-hum drone (once downloaded)' },
    pad:   { type: 'synth.pad',   gain: 0.75, role: 'pad', tone: 'supersaw', duck: 0.6, send: { reverb: 0.5 }, nasaLayer: 'mars-wind (once downloaded)' },
    lead:  { type: 'synth.lead',  gain: 0.8,  role: 'lead', send: { reverb: 0.25, delay: 0.22 } },
    riser: { type: 'synth.riser', gain: 0.6,  role: 'riser', send: { reverb: 0.3 } },
    // NASA layers (real recordings; they sit under the backbone, never mask it)
    // NASA layer (no vocals): Stardust's comet-flyby sonification as the whoosh into the drop
    wind:  { type: 'sample.mars-wind', gain: 0.4, role: 'pad', trim: true, durationSteps: 32, fadeSteps: 10, send: { reverb: 0.25 }, nasa: 'Perseverance: First Sounds from Mars' },
    rotor: { type: 'sample.ingenuity-hum', gain: 0.22, role: 'pad', trim: true, durationSteps: 64, fadeSteps: 12, nasa: 'Ingenuity in flight' },
    comet: { type: 'sample.stardust-comet', gain: 0.6, role: 'riser', trim: true, durationSteps: 32, fadeSteps: 6, send: { reverb: 0.3 }, nasa: 'Stardust: Passing Comet Tempel 1' },
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
    riser: { up: bars(hold('C4', 64)), up2: bars(hold('C4', 32)) },
    comet: { once: 'x' + '.'.repeat(31) },
    wind: { once: 'x' + '.'.repeat(31) },
    rotor: { once: 'x' + '.'.repeat(63) },
  },
  // 20 bars at 112 BPM = about 43 seconds (every song stays under 45 s)
  sections: [
    { name: 'intro',     bars: 2, play: { kick: 'half', hat: 'quarter', pad: 'prog', wind: 'once' } },
    { name: 'groove',    bars: 4, play: { kick: 'four', snare: 'back', hat: 'eighth', bass: 'drive', pad: 'prog' } },
    { name: 'build',     bars: 2, play: { kick: 'four', snare: 'ghost', hat: 'sixteen', bass: 'long', riser: 'up2', comet: 'once' } },
    { name: 'drop',      bars: 4, play: { kick: 'four', snare: 'back', hat: 'sixteen', bass: 'drive', pad: 'prog', lead: 'hook', rotor: 'once' } },
    { name: 'data break', bars: 3, play: { kick: 'half', hat: 'quarter', pad: 'prog' }, dataBreak: true },
    { name: 'final',     bars: 4, play: { kick: 'four', snare: 'back', hat: 'sixteen', bass: 'drive', pad: 'prog', lead: 'answer' } },
    { name: 'outro',     bars: 1, play: { kick: 'half', pad: 'prog', wind: 'once' } },
  ],
  chart: {
    snare: { lane: 'R', from: 'easy' },
    kick:  { lane: 'L', from: 'easy' },
    lead:  { lane: 'alt', from: 'normal', hold: true },
    bass:  { lane: 'alt', from: 'hard' },
  },
  // Bars are 1-indexed. Uses the InSight marsquake once it's downloaded; until then the
  // Kepler star sound (the Numans' "voice"). Backbone drops out; notes sit on the peaks.
  dataBreak: { startBar: 13, bars: 3, sample: 'marsquake', fallbackSample: 'kepler-star', gain: 0.9, lanes: 'alt' },
};
fs.writeFileSync(process.argv[2], JSON.stringify(song, null, 2) + '\n');
console.log('wrote', process.argv[2]);
