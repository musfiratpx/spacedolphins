import { wire, esc } from '../ui/dom.js';
import { getMachine, machinesIn } from '../core/data.js';
import { unlock, recordBest, state } from '../core/state.js';
import { sfx } from '../audio/sfx.js';
import { judging } from '../core/config.js';
import { loadRadio } from '../core/data.js';
import { save } from '../core/state.js';
import { tag } from '../ui/dom.js';

export default {
  mount(el, params, go) {
    const { result } = params;
    const machine = getMachine(params.machine);
    const best = recordBest(result.song, result.difficulty, result);
    const already = Boolean(state.unlocked[machine.id]);
    let isNew = false;
    if (result.cleared) isNew = unlock(machine.id, result);

    const pct = (result.accuracy * 100).toFixed(1);
    // Earth's shield (Story): cleared +5, each Numan pulse +2, failed -10. Never game over.
    const shieldBefore = state.shield ?? 50;
    const shieldDelta = (result.cleared ? 5 : -10) + 2 * (result.shattered?.length || 0);
    state.shield = Math.max(0, Math.min(100, shieldBefore + shieldDelta)); save();
    const nextTarget = machinesIn(machine.region).find((m) => !state.unlocked[m.id] && m.id !== machine.id);
    el.innerHTML = `
      <section class="screen center results-screen">
        <div class="panel results">
          <p class="eyebrow">${result.cleared ? 'Round cleared' : 'Not quite'}</p>
          <div class="grade grade-${result.grade}">${result.grade}</div>
          <p class="acc"><span class="acc-num" data-to="${pct}">0.0</span>% accuracy ${best.improved && best.prev ? '<span class="new-best">New best!</span>' : ''}</p>
          ${result.score != null ? `<p class="score-line">${result.score.toLocaleString('en-US')} points${result.holds ? ` · ${result.holdsDone}/${result.holds} holds` : ''}</p>` : ''}
          <ul class="counts">
            <li><b>${result.counts.perfect}</b> Perfect</li>
            <li><b>${result.counts.great}</b> Great</li>
            <li><b>${result.counts.good}</b> Good</li>
            <li><b>${result.counts.miss}</b> Miss</li>
            <li><b>${result.maxCombo}</b> Best combo</li>
          </ul>
          ${result.shattered?.length ? `<p class="eyebrow" style="margin-top:12px">Asteroids shattered by Numan pulses ${tag('real')}</p>
            <ul class="shattered">${result.shattered.map((a) => `<li><a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.name)}</a> · about ${Math.round(a.minM).toLocaleString('en-US')}–${Math.round(a.maxM).toLocaleString('en-US')} m wide · ${Math.round(a.kph).toLocaleString('en-US')} km/h</li>`).join('')}</ul>` : ''}
          <div class="shield-change">
            <span class="sc-label">Earth's shield ${tag('story')}</span>
            <span class="sc-bar"><i style="width:${shieldBefore}%" data-to="${state.shield}"></i></span>
            <span class="sc-num ${shieldDelta >= 0 ? 'up' : 'down'}">${state.shield}% (${shieldDelta >= 0 ? '+' : ''}${shieldDelta})</span>
          </div>
          ${state.shield === 0 ? '<p class="hint">Shield critical! Mission Control says: any cleared round patches it. The game never ends.</p>' : ''}
          <p class="radio-strip" aria-live="polite"><span class="led"></span><span class="rs-who"></span> <span class="rs-text"></span></p>
          <p class="result-msg">${result.cleared
            ? (isNew ? `Signal locked. ${esc(machine.name)} is ready to scan.` : `${esc(machine.name)} is already in the Archive. Nice run!`)
            : `You need ${Math.round(judging.clear[result.difficulty] * 100)}% to scan. The machine isn't going anywhere. Try again!`}</p>
          <div class="stack row">
            ${result.cleared
              ? `<button class="btn btn-big" data-go="card" data-params='${JSON.stringify({ id: machine.id, fresh: isNew })}'>${isNew || !already ? 'Scan machine' : 'View card'}</button>`
              : `<button class="btn btn-big" data-go="round" data-params='${JSON.stringify({ region: params.region, machine: params.machine, difficulty: params.difficulty })}'>Retry</button>
                 ${result.difficulty !== 'easy' ? `<button class="btn btn-ghost" data-go="round" data-params='${JSON.stringify({ region: params.region, machine: params.machine, difficulty: 'easy' })}'>Try on Easy</button>` : ''}`}
            ${result.cleared ? `<button class="btn btn-ghost" data-go="round" data-params='${JSON.stringify({ region: params.region, machine: params.machine, difficulty: params.difficulty })}'>Play again</button>` : ''}
            ${result.cleared && nextTarget ? `<button class="btn btn-ghost" data-go="preround" data-params='${JSON.stringify({ region: params.region, machine: nextTarget.id })}'>Next target →</button>` : ''}
            <button class="btn btn-ghost" data-go="hub">Hub</button>
          </div>
        </div>
      </section>`;
    if (result.cleared) setTimeout(() => sfx.unlock(), 150);
    loadRadio().then((radio) => {
      const kind = !result.cleared ? 'fail' : (result.grade === 'S' || result.grade === 'A') ? 'great' : 'ok';
      const pool = radio.reactions?.[kind] || [];
      if (!pool.length) return;
      let idx = Math.floor(Math.random() * pool.length);
      if (pool.length > 1 && state.lastReaction === `${kind}:${idx}`) idx = (idx + 1) % pool.length;
      state.lastReaction = `${kind}:${idx}`; save();
      const line = pool[idx];
      const strip = el.querySelector('.radio-strip'); if (!strip) return;
      strip.querySelector('.rs-who').innerHTML = `${line.who}: ${tag(line.tag)}`;
      const t = strip.querySelector('.rs-text'); let c = 0;
      strip.classList.add('on');
      const step = () => { if (!t.isConnected) return; t.textContent = line.text.slice(0, ++c); if (c < line.text.length) setTimeout(step, 20); };
      setTimeout(step, 500);
    }).catch(() => {});
    // numbers count up instead of jumping
    const num = el.querySelector('.acc-num');
    const to = Number(num.dataset.to);
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      num.textContent = (to * (1 - Math.pow(1 - k, 3))).toFixed(1);
      if (k < 1 && num.isConnected) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // shield bar slides to its new value
    setTimeout(() => { const bar = el.querySelector('.sc-bar i'); if (bar) bar.style.width = `${bar.dataset.to}%`; }, 500);
    window.__hhWorld?.setShield(state.shield);
    wire(el, go);
  },
};
