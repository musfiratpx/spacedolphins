// Hardwaredex: simple grid (family tree view comes later behind features.familyTree).
import { wire, esc } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';
import { renderThumbs } from '../three/thumbs.js';

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
                     <span class="dex-thumb" data-thumb="${m.model}:false"></span>
                     <span class="dex-name">${esc(m.name)}</span><span class="dex-sub">${esc(m.place)} · ${m.arrived}</span>
                     <span class="dex-grade">${esc(u.grade)}</span></button>`
                : `<div class="dex-card locked" aria-label="Locked machine"><span class="dex-thumb" data-thumb="${m.model}:true"></span><span class="dex-name">???</span><span class="dex-sub">${esc(m.teaser)}</span></div>`;
            }).join('')}
          </div>`).join('')}
      </section>`;
    wire(el, go);
    // fill in 3D snapshots of each NASA model (silhouettes for locked ones)
    const slots = [...el.querySelectorAll('[data-thumb]')];
    const jobs = [...new Set(slots.map((s) => s.dataset.thumb))].map((k) => {
      const [model, locked] = k.split(':');
      return { model, locked: locked === 'true', key: k };
    });
    renderThumbs(jobs, (job, url) => {
      if (!url) { el.querySelectorAll(`[data-thumb="${job.key}"]`).forEach((sl) => sl.classList.add('no-img')); return; }
      el.querySelectorAll(`[data-thumb="${job.key}"]`).forEach((s) => {
        s.style.backgroundImage = `url(${url})`;
        s.classList.add('has-img');
      });
    });
  },
};
