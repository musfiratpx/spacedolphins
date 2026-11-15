// Hardwaredex: simple grid (family tree view comes later behind features.familyTree).
import { wire, esc } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';

export default {
  mount(el, _params, go) {
    const { regions, machines } = getHardware();
    const got = machines.filter((m) => state.unlocked[m.id]).length;
    el.innerHTML = `
      <section class="screen dex-screen">
        <header class="hub-head">
          <div><p class="eyebrow">Hardwaredex</p><h1>${Math.round((got / machines.length) * 100)}% complete</h1></div>
          <button class="btn" data-go="hub">← Hub</button>
        </header>
        ${regions.map((r) => `
          <h2 class="dex-region" style="--accent:${r.color}">${esc(r.name)}</h2>
          <div class="dex-grid">
            ${machinesIn(r.id).map((m) => {
              const u = state.unlocked[m.id];
              return u
                ? `<button class="dex-card" data-go="card" data-params='${JSON.stringify({ id: m.id })}' style="--accent:${r.color}">
                     <span class="dex-name">${esc(m.name)}</span><span class="dex-sub">${esc(m.place)} · ${m.arrived}</span>
                     <span class="dex-grade">${esc(u.grade)}</span></button>`
                : `<div class="dex-card locked" aria-label="Locked machine"><span class="dex-name">???</span><span class="dex-sub">${esc(m.teaser)}</span></div>`;
            }).join('')}
          </div>`).join('')}
      </section>`;
    wire(el, go);
  },
};
