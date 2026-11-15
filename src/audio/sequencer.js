// Lookahead sequencer: a 25 ms timer schedules every note ~120 ms ahead on the
// audio clock (the "two clocks" pattern), so the music never drifts with frame rate.
import { getContext, getAudioTime, getBus } from './clock.js';
import { playSynth } from './synth.js';
import { playSample } from './sampler.js';
import { expandScore, stepSeconds } from './score.js';
import { audio as audioCfg, debug } from '../core/config.js';
import { emit } from '../core/bus.js';

export class Sequencer {
  constructor(song) {
    this.song = song;
    const { events, beats, lengthSec, sections } = expandScore(song);
    this.events = events;
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
    for (const [id, inst] of Object.entries(this.song.instruments || {})) {
      const g = ctx.createGain();
      g.gain.value = inst.gain ?? 1;
      g.connect(this.out);
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

    if (now > this.startTime + this.lengthSec + 1.5) this.stop(false);
  }

  schedule(ev) {
    const inst = this.song.instruments?.[ev.track];
    if (!inst) return;
    const t = this.startTime + ev.time;
    const out = this.trackGains[ev.track];
    const [kind, name] = inst.type.split('.');
    const params = { note: ev.note || inst.note, velocity: ev.velocity, duration: ev.duration, open: inst.open };

    if (kind === 'sample') {
      const ok = playSample(name, t, out, { rate: inst.rate, gain: 1, duration: inst.chop ? stepSeconds(this.song) * 2 : undefined });
      if (!ok && inst.fallback) playSynth(inst.fallback, t, params, out);
    } else {
      playSynth(name, t, params, out);
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
