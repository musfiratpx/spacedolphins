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
const PERSPECTIVE = 3.2;   // how strongly the track recedes into the distance
const LANE_KEYS = { a: 'L', arrowleft: 'L', d: 'R', arrowright: 'R' };

export function gradeFor(acc) {
  return judging.grades.find(([, min]) => acc >= min)[0];
}

export class Round {
  constructor(container, { song, prep = {}, difficulty = 'normal', onEnd, onQuit }) {
    this.container = container;
    this.song = song;
    this.prep = prep;
    this.difficulty = difficulty;
    this.onEnd = onEnd;
    this.onQuit = onQuit;
    this.oneLane = settings.oneLane && features.oneLaneMode;
    this.chart = generateChart(song, difficulty, { oneLane: this.oneLane, dataBreak: prep.dataBreak });
    this.notes = this.chart.notes.map((n) => ({ ...n, judged: null }));
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.combo = 0; this.maxCombo = 0; this.score = 0;
    this.lanePress = { L: -1, R: -1 };
    this.feedback = null;  // { text, sub, time, color }
    this.bursts = [];      // hit rings on the track
    this.sparks = [];      // pooled hit sparks (capped)
    this.misses = [];      // missed tiles that crack and fade
    this.streaks = Array.from({ length: 34 }, () => ({ side: Math.random() < 0.5 ? -1 : 1, off: Math.random(), p: Math.random(), len: 0.03 + Math.random() * 0.05 }));
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
      <div class="round-milestone hidden" aria-live="polite"></div>
      <div class="round-countdown hidden" aria-live="assertive"></div>
      <div class="round-pause hidden" role="dialog" aria-label="Paused">
        <div class="panel">
          <h2>Paused</h2>
          <button class="btn" data-act="resume">Resume</button>
          <button class="btn" data-act="restart">Restart <kbd>R</kbd></button>
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
    this.seq = new Sequencer(this.song, this.prep);
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
    if (this.paused) { if (k === 'r' && !this.counting) { this.destroy(); this.onQuit?.('restart'); } return; }
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
      if (!settings.reducedMotion) this.misses.push({ lane: note.lane, time: performance.now() });
    } else {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      sfx.hit(j, this.combo);
      emit('note:hit', { judgement: j, lane: note.lane, offsetMs: offset });
      if (j === 'perfect') { fx.hitStop(40); fx.burst(); }
      this.bursts.push({ lane: note.lane, time: performance.now(), color: j === 'perfect' ? '#2EC4B6' : '#E8ECF5' });
      if (!settings.reducedMotion) this.spawnSparks(note.lane, j === 'perfect' ? 14 : 8, j === 'perfect' ? '46,196,182' : '232,236,245');
      if ([25, 50, 100, 150, 200].includes(this.combo)) {
        emit('combo', { combo: this.combo });
        sfx.milestone();
        const m = this.el.querySelector('.round-milestone');
        m.textContent = `${this.combo} combo!`;
        m.classList.remove('hidden', 'pop'); void m.offsetWidth; m.classList.add('pop');
        clearTimeout(this.msTimer);
        this.msTimer = setTimeout(() => m.classList.add('hidden'), 1100);
        this.comboEl.classList.remove('bump'); void this.comboEl.offsetWidth; this.comboEl.classList.add('bump');
      }
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

  /** Resume after a 3-2-1 countdown so players can get their fingers ready. */
  async resume() {
    if (!this.paused || this.counting) return;
    this.pauseEl.classList.add('hidden');
    this.counting = true;
    const cd = this.el.querySelector('.round-countdown');
    for (const n of ['3', '2', '1']) {
      cd.textContent = n; cd.classList.remove('hidden', 'pop'); void cd.offsetWidth; cd.classList.add('pop');
      try { sfx.click(); } catch { /* audio suspended */ }
      await new Promise((r) => setTimeout(r, 650));
      if (this.ended) return;
    }
    cd.classList.add('hidden');
    this.counting = false;
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
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = this.el.clientWidth || window.innerWidth;
    const h = this.el.clientHeight || window.innerHeight;
    this.canvas.width = w * dpr; this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
    this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lanes = this.oneLane ? 1 : 2;
    const laneW = Math.min(w * 0.4, 230);
    // laneX/laneW describe the lanes AT the hit line (used for tap input).
    this.layout = { w, h, laneW, lanes, laneX: (w - laneW * lanes) / 2, hitY: h * 0.8, horizon: h * 0.02, cx: w / 2 };
    this.buildVignette(w, h);
  }

  spawnSparks(lane, n, rgb) {
    const { laneW, lanes } = this.layout;
    const li = lane === 'L' || this.oneLane ? 0 : 1;
    const c = this.proj(0, -(laneW * lanes) / 2 + li * laneW + laneW / 2);
    const now = performance.now();
    for (let i = 0; i < n; i++) {
      if (this.sparks.length > 160) this.sparks.shift();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 3 + Math.random() * 6;
      this.sparks.push({ x: c.x, y: c.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: now, rgb });
    }
  }

  /** Edge vignette, rendered once per resize and stamped each frame (cheap). */
  buildVignette(w, h) {
    const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w / 2)); cv.height = Math.max(1, Math.round(h / 2));
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(cv.width / 2, cv.height * 0.6, Math.min(cv.width, cv.height) * 0.35, cv.width / 2, cv.height * 0.6, Math.max(cv.width, cv.height) * 0.75);
    g.addColorStop(0, 'rgba(46,196,182,0)'); g.addColorStop(1, 'rgba(46,196,182,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, cv.width, cv.height);
    this.vignette = cv;
  }

  /** Perspective: p = 0 at the hit line, 1 at the far end of the track. */
  proj(p, xOff) {
    const { hitY, horizon, cx } = this.layout;
    const s = 1 / (1 + PERSPECTIVE * p);
    return { x: cx + xOff * s, y: horizon + (hitY - horizon) * s, s };
  }

  quad(p0, p1, x0, x1) {
    const a = this.proj(p0, x0); const b = this.proj(p0, x1);
    const c = this.proj(p1, x1); const d = this.proj(p1, x0);
    const g = this.g;
    g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.lineTo(c.x, c.y); g.lineTo(d.x, d.y); g.closePath();
    return { a, b, c, d };
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
    const { w, h, laneW, lanes, hitY } = this.layout;
    const travel = (BASE_TRAVEL_SEC / settings.noteSpeed) * 1000;
    const half = (laneW * lanes) / 2;
    const NEAR = -0.14;
    const wall = performance.now();
    g.clearRect(0, 0, w, h);

    const still = settings.reducedMotion;
    const beatMsFx = 60000 / (this.song.bpm || 120);
    const phase = (((now % beatMsFx) + beatMsFx) % beatMsFx) / beatMsFx;
    const beatPulse = still || now < 0 ? 0 : Math.pow(1 - phase, 3);            // 1 on the beat, eases to 0
    const db = this.prep?.dataBreak;
    const inBreak = db && now >= db.startSec * 1000 && now < db.endSec * 1000;
    // rail color climbs with your combo: teal -> amber (50) -> pink (100)
    const railRGB = this.combo >= 100 ? '255,122,200' : this.combo >= 50 ? '242,177,52' : '46,196,182';

    // speed streaks rushing past both sides of the track (faster with a bigger combo)
    if (!still) {
      const speed = 0.9 + Math.min(this.combo, 100) / 60;
      const dtS = Math.min(0.05, (wall - (this.lastWall || wall)) / 1000);
      g.lineCap = 'round';
      for (const st of this.streaks) {
        st.p -= dtS * speed * 0.8;
        if (st.p < -0.1) { st.p = 1; st.off = Math.random(); st.side = Math.random() < 0.5 ? -1 : 1; }
        const x = st.side * (half + 40 + st.off * w * 0.45);
        const a = this.proj(st.p, x); const b = this.proj(st.p + st.len, x);
        g.strokeStyle = `rgba(${inBreak ? '160,130,255' : '200,225,255'},${(0.35 * (1 - st.p)).toFixed(3)})`;
        g.lineWidth = Math.max(1, 2.2 * a.s);
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
    }
    this.lastWall = wall;

    // track bed
    const bed = this.quad(NEAR, 1, -half - 10, half + 10);
    const grad = g.createLinearGradient(0, bed.d.y, 0, bed.a.y);
    grad.addColorStop(0, 'rgba(11,16,38,0)');
    grad.addColorStop(0.5, 'rgba(11,16,38,0.55)');
    grad.addColorStop(1, 'rgba(11,16,38,0.85)');
    g.fillStyle = grad; g.fill();
    if (inBreak) {
      this.quad(NEAR, 1, -half - 10, half + 10);
      g.fillStyle = `rgba(123,108,246,${(0.16 + beatPulse * 0.08 + (still ? 0 : Math.sin(wall / 300) * 0.04)).toFixed(3)})`; g.fill();
    }

    // lanes (light up on press)
    for (let i = 0; i < lanes; i++) {
      const lane = this.oneLane ? 'L' : i === 0 ? 'L' : 'R';
      const x0 = -half + i * laneW; const x1 = x0 + laneW;
      const since = wall - this.lanePress[lane];
      const lit = since < 160 ? 1 - since / 160 : 0;
      const q = this.quad(NEAR, 1, x0 + 3, x1 - 3);
      const lg = g.createLinearGradient(0, q.d.y, 0, q.a.y);
      const rgb = lane === 'L' ? '217,98,43' : '46,196,182';
      lg.addColorStop(0, `rgba(${rgb},0)`);
      lg.addColorStop(1, `rgba(${rgb},${0.10 + lit * 0.35})`);
      g.fillStyle = lg; g.fill();
    }

    // beat lines scroll toward the player (bar lines brighter)
    const beatMs = 60000 / (this.song.bpm || 120);
    for (let k = Math.floor((now + NEAR * travel) / beatMs); ; k++) {
      const p = (k * beatMs - now) / travel;
      if (p > 1) break;
      if (p < NEAR) continue;
      const a = this.proj(p, -half); const b = this.proj(p, half);
      const fade = 1 - Math.max(0, p);
      g.strokeStyle = `rgba(232,236,245,${(k % 4 === 0 ? 0.28 : 0.1) * fade})`;
      g.lineWidth = Math.max(1, (k % 4 === 0 ? 2 : 1) * a.s);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }

    // rails and lane dividers
    for (let i = 0; i <= lanes; i++) {
      const x = -half + i * laneW;
      const a = this.proj(NEAR, x); const b = this.proj(1, x);
      const edge = i === 0 || i === lanes;
      // glow = a wide faint stroke under a thin bright one (much cheaper than shadowBlur)
      if (edge) {
        g.strokeStyle = `rgba(${railRGB},${(0.18 + beatPulse * 0.22).toFixed(3)})`; g.lineWidth = 10 + beatPulse * 8;
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
      }
      g.strokeStyle = edge ? `rgba(${railRGB},0.9)` : 'rgba(232,236,245,0.18)';
      g.lineWidth = edge ? 3 : 1.5;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
    }

    // hit bar
    const hl = this.proj(0, -half - 6); const hr = this.proj(0, half + 6);
    g.strokeStyle = 'rgba(46,196,182,0.25)'; g.lineWidth = 14;
    g.beginPath(); g.moveTo(hl.x, hl.y); g.lineTo(hr.x, hr.y); g.stroke();
    g.strokeStyle = 'rgba(232,236,245,0.95)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(hl.x, hl.y); g.lineTo(hr.x, hr.y); g.stroke();

    // notes: piano-tile slabs with the lane's shape on top, drawn far to near
    const visible = [];
    for (let i = this.missCursor; i < this.notes.length; i++) {
      const n = this.notes[i];
      const dt = n.t - now;
      if (dt > travel) break;
      if (!n.judged) visible.push(n);
    }
    const TILE = 0.05;
    for (let i = visible.length - 1; i >= 0; i--) {
      const n = visible[i];
      const p = (n.t - now) / travel;
      const li = n.lane === 'L' || this.oneLane ? 0 : 1;
      const x0 = -half + li * laneW + laneW * 0.1; const x1 = x0 + laneW * 0.8;
      const fill = n.lane === 'L' ? '#D9622B' : '#2EC4B6';
      const dark = n.lane === 'L' ? '#7a3112' : '#16706a';
      const alpha = Math.min(1, (1 - p) * 4);
      g.globalAlpha = alpha;
      // front face (thickness)
      const top = this.quad(p - TILE / 2, p + TILE / 2, x0, x1);
      const thick = 10 * top.a.s;
      g.beginPath();
      g.moveTo(top.a.x, top.a.y); g.lineTo(top.b.x, top.b.y);
      g.lineTo(top.b.x, top.b.y + thick); g.lineTo(top.a.x, top.a.y + thick); g.closePath();
      g.fillStyle = dark; g.fill();
      // top face
      this.quad(p - TILE / 2, p + TILE / 2, x0, x1);
      g.fillStyle = fill; g.fill();
      // highlight strip on the far edge gives the tile a lit, beveled look
      this.quad(p + TILE * 0.28, p + TILE / 2, x0, x1);
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.fill();
      this.quad(p - TILE / 2, p + TILE / 2, x0, x1);
      g.strokeStyle = 'rgba(232,236,245,0.85)'; g.lineWidth = 1.5 * top.a.s; g.stroke();
      // emblem: circle (left) or diamond (right), always readable
      const c = this.proj(p, (x0 + x1) / 2);
      drawShape(g, n.lane, c.x, c.y - 4 * c.s, laneW * 0.11 * c.s, '#0B1026', '#E8ECF5', 2.5 * c.s);
      g.globalAlpha = 1;
    }

    // missed tiles crack in two and fade
    if (this.misses.length) {
      this.misses = this.misses.filter((m) => wall - m.time < 450);
      const TILEm = 0.05;
      for (const m of this.misses) {
        const k = (wall - m.time) / 450;
        const li = m.lane === 'L' || this.oneLane ? 0 : 1;
        const x0 = -half + li * laneW + laneW * 0.1; const x1 = x0 + laneW * 0.8; const mid = (x0 + x1) / 2;
        g.globalAlpha = (1 - k) * 0.8;
        g.fillStyle = m.lane === 'L' ? '#7a3112' : '#16706a';
        const drop = k * 0.04; const spread = k * laneW * 0.12;
        this.quad(-drop - TILEm / 2, -drop + TILEm / 2, x0 - spread, mid - spread); g.fill();
        this.quad(-drop - TILEm / 2, -drop + TILEm / 2, mid + spread, x1 + spread); g.fill();
        const c0 = this.proj(-drop, mid);
        g.strokeStyle = '#F2B134'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(c0.x, c0.y - 10); g.lineTo(c0.x - 6, c0.y - 2); g.lineTo(c0.x + 4, c0.y + 4); g.lineTo(c0.x - 2, c0.y + 12); g.stroke();
      }
      g.globalAlpha = 1;
    }
    if (this.sparks.length) {
      g.globalCompositeOperation = 'lighter';
      const life = 420;
      let alive = 0;
      for (const sp of this.sparks) {
        const age = wall - sp.t;
        if (age > life) continue;
        this.sparks[alive++] = sp;
        const k = age / life; const tt = age / 16;
        const x = sp.x + sp.vx * tt; const y = sp.y + sp.vy * tt + 0.06 * tt * tt;
        g.strokeStyle = `rgba(${sp.rgb},${(1 - k).toFixed(3)})`; g.lineWidth = 2.5 * (1 - k) + 0.5;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - sp.vx * 1.6, y - sp.vy * 1.6); g.stroke();
      }
      this.sparks.length = alive;
      g.globalCompositeOperation = 'source-over';
    }

    // hit targets + key labels
    for (let i = 0; i < lanes; i++) {
      const lane = this.oneLane ? 'L' : i === 0 ? 'L' : 'R';
      const c = this.proj(0, -half + i * laneW + laneW / 2);
      const pressed = wall - this.lanePress[lane] < 100;
      drawShape(g, lane, c.x, c.y, laneW * 0.16, pressed ? 'rgba(46,196,182,.35)' : null, pressed ? '#2EC4B6' : 'rgba(232,236,245,0.7)', 3);
      g.fillStyle = 'rgba(232,236,245,0.6)';
      g.font = '700 16px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(this.oneLane ? 'A / D' : lane === 'L' ? 'A  ←' : 'D  →', c.x, hitY + laneW * 0.16 + 34);
    }

    // hit bursts: rings that spread along the track surface
    if (!settings.reducedMotion) {
      this.bursts = this.bursts.filter((b) => wall - b.time < 320);
      for (const b of this.bursts) {
        const k = (wall - b.time) / 320;
        const li = b.lane === 'L' || this.oneLane ? 0 : 1;
        const c = this.proj(0, -half + li * laneW + laneW / 2);
        g.globalAlpha = 1 - k;
        g.strokeStyle = b.color; g.lineWidth = 4 * (1 - k) + 1;
        g.beginPath(); g.ellipse(c.x, c.y, laneW * (0.2 + k * 0.45), laneW * (0.07 + k * 0.14), 0, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 1;
      }
    }

    // soft beat vignette at the screen edges (low amplitude, never a flash)
    if (this.vignette && !still) {
      g.globalAlpha = 0.18 + beatPulse * 0.14 + (inBreak ? 0.12 : 0);
      g.drawImage(this.vignette, 0, 0, w, h);
      g.globalAlpha = 1;
    }
    if (inBreak) {
      g.fillStyle = 'rgba(11,16,38,0.7)';
      const bw = Math.min(w - 32, 520);
      g.fillRect((w - bw) / 2, 52, bw, 34);
      g.fillStyle = '#c9c0ff'; g.font = '800 16px Nunito, system-ui, sans-serif'; g.textAlign = 'center';
      g.fillText('DATA BREAK · you\'re playing a real NASA recording', w / 2, 74);
    }

    // lead-in countdown
    if (now < 0) {
      const secs = Math.ceil(-now / 1000);
      g.fillStyle = '#E8ECF5';
      g.font = '900 72px Nunito, system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText(secs > 0 ? String(secs) : '', w / 2, h * 0.42);
    }

    // judgement feedback
    if (this.feedback) {
      const age = wall - this.feedback.time;
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
    const prog = Math.max(0, Math.min(1, now / this.chart.lengthMs));
    g.fillStyle = 'rgba(232,236,245,0.15)'; g.fillRect(0, 0, w, 4);
    g.fillStyle = '#2EC4B6'; g.fillRect(0, 0, w * prog, 4);
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
