// The rhythm round: two lanes, falling notes (Piano Tiles style), judging, scoring.
// All timing reads the audio clock. Pausing suspends the AudioContext, which
// freezes the clock, so music and notes stay locked together.
import { Sequencer } from '../audio/sequencer.js';
import { generateChart } from '../audio/charts.js';
import { unlockAudio, getContext, getAudioTime, getOutputLatency } from '../audio/clock.js';
import { sfx } from '../audio/sfx.js';
import { settings } from '../core/settings.js';
import { judging, debug, features } from '../core/config.js';
import { emit } from '../core/bus.js';
import { fx } from '../core/fx.js';

const BASE_TRAVEL_SEC = 1.6;
const LANE_KEYS = { a: 'L', arrowleft: 'L', d: 'R', arrowright: 'R' };

export function gradeFor(acc) {
  return judging.grades.find(([, min]) => acc >= min)[0];
}

export class Round {
  constructor(container, { song, difficulty = 'normal', onEnd, onQuit }) {
    this.container = container;
    this.song = song;
    this.difficulty = difficulty;
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.oneLane = settings.oneLane && features.oneLaneMode;
    this.chart = generateChart(song, difficulty, { oneLane: this.oneLane });
    this.notes = this.chart.notes.map((n) => ({ ...n, judged: null }));
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.combo = 0; this.maxCombo = 0; this.score = 0;
    this.lanePress = { L: -1, R: -1 };
    this.feedback = null;  // { text, sub, time, color }
    this.paused = false;
    this.ended = false;
    this.missCursor = 0;

    this.el = document.createElement('div');
    this.el.className = 'round';
    this.el.innerHTML = `
      <canvas class="round-canvas" aria-label="Rhythm lanes"></canvas>
      <div class="round-hud">
        <div class="hud-block"><span class="hud-label">Accuracy</span><span class="hud-acc">100.0%</span></div>
        <div class="hud-block hud-combo-wrap"><span class="hud-combo">0</span><span class="hud-label">combo</span></div>
        <button class="btn btn-small hud-pause" aria-label="Pause (Esc)">❚❚</button>
      </div>
      <div class="round-help">${this.oneLane ? 'Press <kbd>A</kbd>, <kbd>D</kbd>, an arrow key, or tap' : '<kbd>A</kbd>/<kbd>←</kbd> left lane · <kbd>D</kbd>/<kbd>→</kbd> right lane · or tap a lane'}</div>
      <div class="round-pause hidden" role="dialog" aria-label="Paused">
        <div class="panel">
          <h2>Paused</h2>
          <button class="btn" data-act="resume">Resume</button>
          <button class="btn" data-act="restart">Restart</button>
          <button class="btn btn-ghost" data-act="quit">Quit to hub</button>
        </div>
      </div>`;
    container.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.g = this.canvas.getContext('2d');
    this.accEl = this.el.querySelector('.hud-acc');
    this.comboEl = this.el.querySelector('.hud-combo');
    this.pauseEl = this.el.querySelector('.round-pause');

    this.onKey = this.onKey.bind(this);
    this.onPointer = this.onPointer.bind(this);
    this.onResize = this.resize.bind(this);
    this.onVisibility = () => { if (document.hidden && !this.ended) this.pause(); };
    this.frame = this.frame.bind(this);

    window.addEventListener('keydown', this.onKey);
    this.canvas.addEventListener('pointerdown', this.onPointer);
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.el.querySelector('.hud-pause').addEventListener('click', () => this.pause());
    this.pauseEl.addEventListener('click', (e) => {
      const act = e.target.dataset?.act;
      if (act === 'resume') this.resume();
      if (act === 'restart') { this.destroy(); this.onQuit?.('restart'); }
      if (act === 'quit') { this.destroy(); this.onQuit?.('quit'); }
    });
    this.resize();
  }

  async start() {
    await unlockAudio();
    this.seq = new Sequencer(this.song);
    this.seq.setClickTrack(this.notes.map((n) => n.t / 1000));
    this.seq.start();
    emit('round:start', { song: this.song.id, difficulty: this.difficulty, notes: this.notes.length });
    this.raf = requestAnimationFrame(this.frame);
    window.__hhRound = this;   // handy in the browser console for debugging/testing
  }

  /** Song time the player is hearing right now, in ms (includes output latency + offset setting). */
  heardMs() {
    const pos = getAudioTime() - this.seq.startTime;
    return (pos - getOutputLatency()) * 1000 - settings.audioOffsetMs;
  }

  onKey(e) {
    if (e.repeat) return;
    const k = e.key.toLowerCase();
    if (k === 'escape' || k === 'p') { e.preventDefault(); this.paused ? this.resume() : this.pause(); return; }
    if (e.key === 'F2') { e.preventDefault(); debug.clickTrack = !debug.clickTrack; this.toast(`Click track ${debug.clickTrack ? 'on' : 'off'}`); return; }
    if (this.paused) return;
    const lane = LANE_KEYS[k];
    if (lane) { e.preventDefault(); this.press(this.oneLane ? 'L' : lane); }
  }

  onPointer(e) {
    if (this.paused) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const { laneX, laneW } = this.layout;
    if (this.oneLane) return this.press('L');
    if (x >= laneX && x < laneX + laneW) this.press('L');
    else if (x >= laneX + laneW && x < laneX + laneW * 2) this.press('R');
    else this.press(x < rect.width / 2 ? 'L' : 'R');
  }

  press(lane) {
    if (!this.seq || this.ended) return;
    const now = this.heardMs();
    this.lanePress[lane] = performance.now();
    // nearest unjudged note in this lane within the Good window
    let best = null; let bestAbs = Infinity;
    for (let i = this.missCursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - now > judging.goodMs) break;
      if (n.judged || n.lane !== lane) continue;
      const abs = Math.abs(now - n.t);
      if (abs < bestAbs) { best = n; bestAbs = abs; }
    }
    if (!best || bestAbs > judging.goodMs) return;   // stray press: no penalty
    const offset = now - best.t;
    const j = bestAbs <= judging.perfectMs ? 'perfect' : bestAbs <= judging.greatMs ? 'great' : 'good';
    this.judge(best, j, offset);
  }

  judge(note, j, offset = 0) {
    note.judged = j;
    this.counts[j]++;
    if (j === 'miss') {
      this.combo = 0;
      sfx.miss();
      emit('note:miss', { lane: note.lane, t: note.t });
      fx.shake(0.3);
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      sfx.hit(j);
      emit('note:hit', { judgement: j, lane: note.lane, offsetMs: offset });
      if (j === 'perfect') { fx.hitStop(40); fx.burst(); }
      if ([25, 50, 100].includes(this.combo)) emit('combo', { combo: this.combo });
    }
    const sub = j === 'perfect' || j === 'miss' ? '' : (offset < 0 ? 'Early' : 'Late');
    const color = { perfect: '#2EC4B6', great: '#E8ECF5', good: '#A7ADBA', miss: '#F2B134' }[j];
    this.feedback = { text: j === 'perfect' ? 'Perfect!' : j[0].toUpperCase() + j.slice(1), sub, time: performance.now(), color };
    this.updateHud();
  }

  accuracy() {
    const done = this.counts.perfect + this.counts.great + this.counts.good + this.counts.miss;
    if (!done) return 1;
    const w = judging.weights;
    return (this.counts.perfect * w.perfect + this.counts.great * w.great + this.counts.good * w.good) / done;
  }

  finalAccuracy() {
    const w = judging.weights;
    return this.notes.length
      ? (this.counts.perfect * w.perfect + this.counts.great * w.great + this.counts.good * w.good) / this.notes.length
      : 0;
  }

  updateHud() {
    this.accEl.textContent = `${(this.accuracy() * 100).toFixed(1)}%`;
    this.comboEl.textContent = this.combo;
  }

  pause() {
    if (this.paused || this.ended || !this.seq) return;
    this.paused = true;
    getContext().suspend();
    this.pauseEl.classList.remove('hidden');
    this.pauseEl.querySelector('[data-act="resume"]').focus();
  }

  async resume() {
    if (!this.paused) return;
    this.pauseEl.classList.add('hidden');
    await getContext().resume();
    this.paused = false;
    this.canvas.focus?.();
  }

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => t.classList.remove('show'), 1200);
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.el.clientWidth || window.innerWidth;
    const h = this.el.clientHeight || window.innerHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lanes = this.oneLane ? 1 : 2;
    const laneW = Math.min(w * 0.42, 240);
    this.layout = { w, h, laneW, lanes, laneX: (w - laneW * lanes) / 2, hitY: h * 0.8 };
  }

  frame() {
    if (this.ended) return;
    this.raf = requestAnimationFrame(this.frame);
    if (!this.seq) return;
    const now = this.heardMs();

    // auto-miss notes that passed the window
    while (this.missCursor < this.notes.length) {
      const n = this.notes[this.missCursor];
      if (n.judged) { this.missCursor++; continue; }
      if (now - n.t > judging.goodMs) { this.judge(n, 'miss'); this.missCursor++; continue; }
      break;
    }

    this.draw(now);

    if (now > this.chart.lengthMs + 400 && this.missCursor >= this.notes.length) this.finish();
  }

  draw(now) {
    const { g } = this;
    const { w, h, laneW, lanes, laneX, hitY } = this.layout;
    const travel = (BASE_TRAVEL_SEC / settings.noteSpeed) * 1000;
    g.clearRect(0, 0, w, h);

    // lanes
    for (let i = 0; i < lanes; i++) {
      const x = laneX + i * laneW;
      const lane = i === 0 ? 'L' : 'R';
      const since = performance.now() - this.lanePress[lane];
      const lit = since < 120 ? 1 - since / 120 : 0;
      const grad = g.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(46,196,182,0.02)');
      grad.addColorStop(1, `rgba(46,196,182,${0.10 + lit * 0.25})`);
      g.fillStyle = grad;
      g.fillRect(x + 2, 0, laneW - 4, h);
      g.strokeStyle = 'rgba(232,236,245,0.12)';
      g.lineWidth = 1;
      g.strokeRect(x + 2.5, -1, laneW - 5, h + 2);
    }

    // hit line + targets
    g.strokeStyle = 'rgba(232,236,245,0.85)';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(laneX, hitY); g.lineTo(laneX + laneW * lanes, hitY); g.stroke();
    for (let i = 0; i < lanes; i++) {
      const cx = laneX + i * laneW + laneW / 2;
      const lane = i === 0 ? 'L' : 'R';
      const since = performance.now() - this.lanePress[lane];
      const pressed = since < 100;
      drawShape(g, lane, cx, hitY, laneW * 0.19, null, pressed ? '#2EC4B6' : 'rgba(232,236,245,0.6)', 3);
      g.fillStyle = 'rgba(232,236,245,0.55)';
      g.font = '700 16px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(this.oneLane ? 'A / D' : lane === 'L' ? 'A  ←' : 'D  →', cx, hitY + laneW * 0.19 + 30);
    }

    // notes
    for (let i = this.missCursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      const dt = n.t - now;
      if (dt > travel) break;
      if (n.judged) continue;
      const y = hitY - (dt / travel) * hitY;
      const li = n.lane === 'L' || this.oneLane ? 0 : 1;
      const cx = laneX + li * laneW + laneW / 2;
      const fill = n.lane === 'L' ? '#D9622B' : '#2EC4B6';
      drawShape(g, n.lane, cx, y, laneW * 0.17, fill, '#E8ECF5', 2);
    }

    // lead-in countdown
    if (now < 0) {
      const secs = Math.ceil(-now / 1000);
      g.fillStyle = '#E8ECF5';
      g.font = '900 72px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(secs > 0 ? String(secs) : '', w / 2, h * 0.42);
      if (secs !== this.lastCount && secs > 0) { this.lastCount = secs; }
    }

    // judgement feedback
    if (this.feedback) {
      const age = performance.now() - this.feedback.time;
      if (age < 500) {
        const a = 1 - age / 500;
        const rise = settings.reducedMotion ? 0 : age * 0.03;
        g.globalAlpha = a;
        g.fillStyle = this.feedback.color;
        g.font = '900 34px Nunito, system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText(this.feedback.text, w / 2, hitY - 90 - rise);
        if (this.feedback.sub) {
          g.font = '700 18px Nunito, system-ui, sans-serif';
          g.fillText(this.feedback.sub, w / 2, hitY - 64 - rise);
        }
        g.globalAlpha = 1;
      }
    }

    // progress bar
    const p = Math.max(0, Math.min(1, now / this.chart.lengthMs));
    g.fillStyle = 'rgba(232,236,245,0.15)'; g.fillRect(0, 0, w, 4);
    g.fillStyle = '#2EC4B6'; g.fillRect(0, 0, w * p, 4);
  }

  finish() {
    if (this.ended) return;
    this.ended = true;
    this.seq.stop();
    const accuracy = this.finalAccuracy();
    const grade = gradeFor(accuracy);
    const cleared = accuracy >= judging.clear[this.difficulty];
    const result = { accuracy, grade, cleared, counts: { ...this.counts }, maxCombo: this.maxCombo,
      notes: this.notes.length, song: this.song.id, difficulty: this.difficulty };
    emit('round:end', result);
    this.destroy();
    this.onEnd?.(result);
  }

  destroy() {
    this.ended = true;
    cancelAnimationFrame(this.raf);
    this.seq?.stop();
    if (getContext().state === 'suspended') getContext().resume();
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.el.remove();
  }
}

// Left notes are circles, right notes are diamonds, so lanes never depend on color alone.
function drawShape(g, lane, cx, cy, r, fill, stroke, lw) {
  g.beginPath();
  if (lane === 'L') {
    g.arc(cx, cy, r, 0, Math.PI * 2);
  } else {
    g.moveTo(cx, cy - r * 1.15); g.lineTo(cx + r * 1.15, cy);
    g.lineTo(cx, cy + r * 1.15); g.lineTo(cx - r * 1.15, cy); g.closePath();
  }
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}
