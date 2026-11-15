// Pre-round: pick a machine to hunt and a difficulty.
import { wire, esc } from '../ui/dom.js';
import { getRegion, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';
import { judging } from '../core/config.js';
import { HardwareViewer } from '../three/viewer.js';

let choice = { difficulty: 'normal' };
let viewer = null;
let holder = null;
let shown = null;
let onEnter = null;

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
          <div class="pre-grid">
          <div class="panel target-panel" data-tilt="off">
            <div class="target-slot" aria-hidden="true"></div>
            <p class="target-label"><span class="eyebrow">Target</span>${state.unlocked[choice.machine] ? esc(machines.find((m) => m.id === choice.machine).name) : 'Unknown signal'}</p>
          </div>
          <div class="machine-list" role="radiogroup" aria-label="Machine">
            ${machines.map((m) => {
              const got = state.unlocked[m.id];
              return `<button role="radio" aria-checked="${choice.machine === m.id}" class="machine-pick ${choice.machine === m.id ? 'on' : ''}" data-act="pick" data-id="${m.id}">
                <span class="mp-name">${got ? esc(m.name) : '???'}</span>
                <span class="mp-teaser">${got ? '✔ In the Archive' : esc(m.teaser)}</span>
              </button>`;
            }).join('')}
          </div>
          </div>
          <div class="panel pre-bottom">
            <div>
              <p class="eyebrow">Song</p>
              <p class="song-name">${esc(region.songTitle)} <span class="muted">· ${region.bpm} BPM</span></p>
            </div>
            <div role="radiogroup" aria-label="Difficulty" class="diff">
              ${['easy', 'normal', 'hard'].map((d) => `<button role="radio" aria-checked="${choice.difficulty === d}" class="chip ${choice.difficulty === d ? 'on' : ''}" data-act="diff" data-d="${d}">${d[0].toUpperCase() + d.slice(1)}</button>`).join('')}
            </div>
            <button class="btn btn-big" data-act="start">Start round <kbd>Enter</kbd></button>
          </div>
          <p class="hint">Clear with ${Math.round(judging.clear[choice.difficulty] * 100)}% accuracy to scan the machine.</p>
        </section>`;
      // keep one 3D viewer alive across re-renders; just move it into the new slot
      el.querySelector('.target-slot').appendChild(holder);
      viewer.resize();
      const target = machines.find((m) => m.id === choice.machine);
      const key = `${target.id}:${Boolean(state.unlocked[target.id])}`;
      if (shown !== key) { shown = key; viewer.show(target.model, { silhouette: !state.unlocked[target.id] }); }
      wire(el, go, {
        pick: (b) => { choice.machine = b.dataset.id; render(); },
        diff: (b) => { choice.difficulty = b.dataset.d; render(); },
        start: () => go('round', { region: region.id, machine: choice.machine, difficulty: choice.difficulty }),
      });
    };
    onEnter = (e) => {
      if (e.key === 'Enter' && !e.target.closest?.('button')) { e.preventDefault(); el.querySelector('[data-act="start"]')?.click(); }
    };
    window.addEventListener('keydown', onEnter);
    holder = document.createElement('div');
    holder.className = 'target-view';
    viewer = new HardwareViewer(holder, { interactive: false, spin: 0.008 });
    shown = null;
    render();
  },
  unmount() { viewer?.dispose(); viewer = null; holder = null; shown = null; window.removeEventListener('keydown', onEnter); },
};
