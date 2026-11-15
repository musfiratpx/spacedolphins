// Pre-round: pick a machine to hunt and a difficulty.
import { wire, esc } from '../ui/dom.js';
import { getRegion, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';

let choice = { difficulty: 'normal' };

export default {
  mount(el, params, go) {
    const region = getRegion(params.region || 'mars');
    const machines = machinesIn(region.id);
    const firstLocked = machines.find((m) => !state.unlocked[m.id]) || machines[0];
    choice = { ...choice, region: region.id, machine: params.machine || choice.machine || firstLocked.id };
    if (!machines.some((m) => m.id === choice.machine)) choice.machine = firstLocked.id;

    const render = () => {
      el.innerHTML = `
        <section class="screen pre-screen" style="--accent:${region.color}">
          <header class="hub-head">
            <div><p class="eyebrow">${esc(region.name)}</p><h1>Choose your target</h1></div>
            <button class="btn btn-ghost" data-go="hub">← Hub</button>
          </header>
          <div class="machine-list" role="radiogroup" aria-label="Machine">
            ${machines.map((m) => {
              const got = state.unlocked[m.id];
              return `<button role="radio" aria-checked="${choice.machine === m.id}" class="machine-pick ${choice.machine === m.id ? 'on' : ''}" data-act="pick" data-id="${m.id}">
                <span class="mp-name">${got ? esc(m.name) : '???'}</span>
                <span class="mp-teaser">${got ? '✔ In the Archive' : esc(m.teaser)}</span>
              </button>`;
            }).join('')}
          </div>
          <div class="panel pre-bottom">
            <div>
              <p class="eyebrow">Song</p>
              <p class="song-name">${esc(region.songTitle)} <span class="muted">· ${region.bpm} BPM</span></p>
            </div>
            <div role="radiogroup" aria-label="Difficulty" class="diff">
              ${['easy', 'normal', 'hard'].map((d) => `<button role="radio" aria-checked="${choice.difficulty === d}" class="chip ${choice.difficulty === d ? 'on' : ''}" data-act="diff" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
            </div>
            <button class="btn btn-big" data-act="start">Start round</button>
          </div>
          <p class="hint">Clear with ${choice.difficulty === 'easy' ? '60' : '70'}% accuracy to scan the machine.</p>
        </section>`;
      wire(el, go, {
        pick: (b) => { choice.machine = b.dataset.id; render(); },
        diff: (b) => { choice.difficulty = b.dataset.d; render(); },
        start: () => go('round', { region: region.id, machine: choice.machine, difficulty: choice.difficulty }),
      });
    };
    render();
  },
};
