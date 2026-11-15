import { wire, esc } from '../ui/dom.js';
import { getMachine, machinesIn } from '../core/data.js';
import { unlock, recordBest, state } from '../core/state.js';
import { sfx } from '../audio/sfx.js';
import { judging } from '../core/config.js';

export default {
  mount(el, params, go) {
    const { result } = params;
    const machine = getMachine(params.machine);
    const best = recordBest(result.song, result.difficulty, result);
    const already = Boolean(state.unlocked[machine.id]);
    let isNew = false;
    if (result.cleared) isNew = unlock(machine.id, result);

    const pct = (result.accuracy * 100).toFixed(1);
    const nextTarget = machinesIn(machine.region).find((m) => !state.unlocked[m.id] && m.id !== machine.id);
    el.innerHTML = `
      <section class="screen center results-screen">
        <div class="panel results">
          <p class="eyebrow">${result.cleared ? 'Round cleared' : 'Not quite'}</p>
          <div class="grade grade-${result.grade}">${result.grade}</div>
          <p class="acc"><span class="acc-num" data-to="${pct}">0.0</span>% accuracy ${best.improved && best.prev ? '<span class="new-best">New best!</span>' : ''}</p>
          <ul class="counts">
            <li><b>${result.counts.perfect}</b> Perfect</li>
            <li><b>${result.counts.great}</b> Great</li>
            <li><b>${result.counts.good}</b> Good</li>
            <li><b>${result.counts.miss}</b> Miss</li>
            <li><b>${result.maxCombo}</b> Best combo</li>
          </ul>
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
    wire(el, go);
  },
};
