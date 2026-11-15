// Lookahead sequencer: a 25 ms timer schedules every note ~120 ms ahead on the
// audio clock (the "two clocks" pattern), so the music never drifts with frame rate.
import { getContext, getAudioTime, getBus } from './clock.js';
import { playSynth } from './synth.js';
import { playSample } from './sampler.js';
import { expandScore, stepSeconds } from './score.js';
import { audio as audioCfg, debug } from '../core/config.js';
import { emit } from '../core/bus.js';

export class Sequencer {
  /** @param prep result of sampler.prepareSong (data break info), optional */
  constructor(song, prep = {}) {
    this.song = song;
    const { events, beats, lengthSec, sections } = expandScore(song);
    this.dataBreak = prep.dataBreak || null;
    const db = this.dataBreak;
    // During a data break the backbone drops out so the real recording is heard.
    this.events = db
      ? events.filter((ev) => !(song.instruments?.[ev.track]?.role === 'backbone' && ev.time >= db.startSec - 1e-6 && ev.time < db.endSec - 1e-6))
      : events;
    if (db) {
      this.events.push({ time: db.startSec, track: '__dataBreak' });
      this.events.sort((a, b) => a.time - b.time);
    }
    this.dbState = 0;   // 0 before, 1 during, 2 after
    this.beats = beats;
    this.lengthSec = lengthSec;
    this.sections = sections;
    this.startTime = 0;
    this.timer = null;
    this.nextEvent = 0;
    this.nextBeat = 0;
    this.clickTimes = [];   // debug click track (F2): seconds from song start
    this.nextClick = 0;
    this.trackGains = {};
    this.running = false;
  }

  /** Start bar 1 at audio time `at` (defaults to now + lead-in). Returns that start time. */
  start(at) {
    const ctx = getContext();
    this.out = ctx.createGain();
    this.out.gain.value = 1;
    this.out.connect(getBus('music'));
    // mix buses: a soft reverb and a dotted-eighth delay, shared by every track
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx, 2.2);
    const revGain = ctx.createGain(); revGain.gain.value = 0.9;
    reverb.connect(revGain).connect(this.out);
    const delay = ctx.createDelay(2);
    delay.delayTime.value = (60 / this.song.bpm) * 0.75;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    delay.connect(dlp).connect(fb).connect(delay);
    dlp.connect(this.out);
    this.fx = [reverb, revGain, delay, fb, dlp];
    this.duckers = [];
    for (const [id, inst] of Object.entries(this.song.instruments || {})) {
      const g = ctx.createGain();
      g.gain.value = inst.gain ?? 1;
      g.connect(this.out);
      if (inst.send?.reverb) { const sg = ctx.createGain(); sg.gain.value = inst.send.reverb; g.connect(sg).connect(reverb); }
      if (inst.send?.delay) { const sg = ctx.createGain(); sg.gain.value = inst.send.delay; g.connect(sg).connect(delay); }
      if (inst.duck) this.duckers.push({ g, base: inst.gain ?? 1, depth: inst.duck });
      this.trackGains[id] = g;
    }
    this.clickGain = ctx.createGain();
    this.clickGain.connect(getBus('sfx'));
    this.startTime = at ?? getAudioTime() + audioCfg.leadInSec;
    this.nextEvent = 0; this.nextBeat = 0; this.nextClick = 0;
    this.running = true;
    this.tick();
    this.timer = setInterval(() => this.tick(), audioCfg.lookaheadMs);
    return this.startTime;
  }

  /** Song position in seconds (negative during lead-in). */
  position() { return getAudioTime() - this.startTime; }

  setClickTrack(timesSec) { this.clickTimes = timesSec; this.nextClick = 0; }

  tick() {
    if (!this.running) return;
    const now = getAudioTime();
    const horizon = now + audioCfg.scheduleAheadSec;

    while (this.nextEvent < this.events.length && this.startTime + this.events[this.nextEvent].time < horizon) {
      this.schedule(this.events[this.nextEvent]);
      this.nextEvent++;
    }

    if (debug.clickTrack) {
      while (this.nextClick < this.clickTimes.length && this.startTime + this.clickTimes[this.nextClick] < horizon) {
        const t = this.startTime + this.clickTimes[this.nextClick];
        if (t >= now - 0.01) playSynth('click', t, { high: true }, this.clickGain);
        this.nextClick++;
      }
    } else {
      // keep the pointer in step so turning F2 on mid-song doesn't burst old clicks
      while (this.nextClick < this.clickTimes.length && this.startTime + this.clickTimes[this.nextClick] < now) this.nextClick++;
    }

    // beat events for visuals (music-reactive hooks). Fired when the beat is reached.
    while (this.nextBeat < this.beats.length && this.startTime + this.beats[this.nextBeat] <= now) {
      const beat = this.nextBeat;
      emit('beat', { beat, bar: Math.floor(beat / 4), time: this.startTime + this.beats[beat] });
      if (beat % 4 === 0) emit('bar', { bar: beat / 4 });
      this.nextBeat++;
    }

    const db = this.dataBreak;
    if (db) {
      if (this.dbState === 0 && now >= this.startTime + db.startSec) { this.dbState = 1; emit('dataBreak:start', { sample: db.sample }); }
      if (this.dbState === 1 && now >= this.startTime + db.endSec) { this.dbState = 2; emit('dataBreak:end', { sample: db.sample }); }
    }

    if (now > this.startTime + this.lengthSec + 1.5) this.stop(false);
  }

  schedule(ev) {
    if (ev.track === '__dataBreak') {
      const db = this.dataBreak;
      playSample(db.sample, this.startTime + db.startSec, this.out, { gain: db.gain, trim: true, duration: db.endSec - db.startSec, fade: 0.6 });
      return;
    }
    const inst = this.song.instruments?.[ev.track];
    if (!inst) return;
    const t = this.startTime + ev.time;
    const out = this.trackGains[ev.track];
    const [kind, name] = inst.type.split('.');
    const params = { note: ev.note || inst.note, velocity: ev.velocity, duration: ev.duration, open: inst.open, tone: inst.tone };

    if (kind === 'sample') {
      const step = stepSeconds(this.song);
      const duration = inst.durationSteps ? inst.durationSteps * step : inst.chop ? step * 2 : undefined;
      const ok = playSample(name, t, out, {
        rate: inst.rate, gain: ev.velocity ?? 1, duration, trim: inst.trim,
        offset: inst.offset, fade: inst.fadeSteps ? inst.fadeSteps * step : undefined,
      });
      if (!ok && inst.fallback) playSynth(inst.fallback, t, params, out);
    } else {
      playSynth(name, t, params, out);
    }
    // sidechain-style duck: pad and bass dip for a moment under every kick
    if (inst.ducker) {
      for (const d of this.duckers) {
        d.g.gain.setValueAtTime(d.base * (1 - d.depth), t);
        d.g.gain.linearRampToValueAtTime(d.base, t + 0.16);
      }
    }
  }

  stop(fade = true) {
    if (!this.running) return;
    this.running = false;
    clearInterval(this.timer);
    const ctx = getContext();
    if (this.out) {
      const now = ctx.currentTime;
      this.out.gain.cancelScheduledValues(now);
      this.out.gain.setValueAtTime(this.out.gain.value, now);
      this.out.gain.linearRampToValueAtTime(0, now + (fade ? 0.4 : 0.05));
      const out = this.out;
      setTimeout(() => out.disconnect(), 600);
    }
    emit('song:end', { song: this.song.id });
  }
}

/** Generated stereo reverb tail: decaying noise, a little darker toward the end. */
let irCache = null;
function impulse(ctx, seconds) {
  if (irCache && irCache.sampleRate === ctx.sampleRate) return irCache;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      lp += (Math.random() * 2 - 1 - lp) * (0.6 - k * 0.45);   // gets darker as it fades
      d[i] = lp * Math.pow(1 - k, 2.4) * 0.6;
    }
  }
  irCache = buf;
  return buf;
}
