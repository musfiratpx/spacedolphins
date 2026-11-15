import { wire, esc } from '../ui/dom.js';
import { getMachine } from '../core/data.js';
import { unlock, recordBest, state } from '../core/state.js';
import { sfx } from '../audio/sfx.js';

export default {
  mount(el, params, go) {
    const { result } = params;
    const machine = getMachine(params.machine);
    recordBest(result.song, result.difficulty, result);
    const already = Boolean(state.unlocked[machine.id]);
    let isNew = false;
    if (result.cleared) isNew = unlock(machine.id, result);

    const pct = (result.accuracy * 100).toFixed(1);
    el.innerHTML = `
      <section class="screen center results-screen">
        <div class="panel results">
          <p class="eyebrow">${result.cleared ? 'Round cleared' : 'Not quite'}</p>
          <div class="grade grade-${result.grade}">${result.grade}</div>
          <p class="acc">${pct}% accuracy</p>
          <ul class="counts">
            <li><b>${result.counts.perfect}</b> Perfect</li>
            <li><b>${result.counts.great}</b> Great</li>
            <li><b>${result.counts.good}</b> Good</li>
            <li><b>${result.counts.miss}</b> Miss</li>
            <li><b>${result.maxCombo}</b> Best combo</li>
          </ul>
          <p class="result-msg">${result.cleared
            ? (isNew ? `Signal locked. ${esc(machine.name)} is ready to scan.` : `${esc(machine.name)} is already in the Archive. Nice run!`)
            : `You need ${result.difficulty === 'easy' ? 60 : 70}% to scan. The machine isn't going anywhere. Try again!`}</p>
          <div class="stack row">
            ${result.cleared
              ? `<button class="btn btn-big" data-go="card" data-params='${JSON.stringify({ id: machine.id, fresh: isNew })}'>${isNew || !already ? 'Scan machine' : 'View card'}</button>`
              : `<button class="btn btn-big" data-go="round" data-params='${JSON.stringify({ region: params.region, machine: params.machine, difficulty: params.difficulty })}'>Retry</button>`}
            <button class="btn btn-ghost" data-go="hub">Hub</button>
          </div>
        </div>
      </section>`;
    if (result.cleared) setTimeout(() => sfx.unlock(), 150);
    wire(el, go);
  },
};
