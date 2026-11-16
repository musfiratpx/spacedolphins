// Hardwaredex: simple grid (family tree view comes later behind features.familyTree).
import { wire, esc, tag } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';
import { renderThumbs } from '../three/thumbs.js';
import { allPhotos, photoTile, wirePhotos } from '../ui/photos.js';

/** 1969 → 2026: every machine at the year it arrived. Still-talking machines pulse. */
function timeline(regions, machines) {
  const y0 = 1965; const y1 = 2028;
  const color = Object.fromEntries(regions.map((r) => [r.id, r.color]));
  const placed = [];   // [left %, level]: each mark takes the lowest row with room for its label
  const marks = [...machines].sort((a, b) => a.arrived - b.arrived).map((m) => {
    const u = state.unlocked[m.id];
    const left = ((m.arrived - y0) / (y1 - y0)) * 100;
    let level = 0;
    while (placed.some(([l, lv]) => lv === level && Math.abs(l - left) < 6)) level++;
    placed.push([left, level]);
    const label = u ? `${m.name}, ${m.arrived}${m.alive ? ', still active as of 2026' : ''}` : `Unscanned machine, ${m.arrived}`;
    const inner = `<span class="tl-dot ${m.alive ? 'alive' : ''}" style="--c:${color[m.region]}">${u ? '' : '?'}</span>`;
    return u
      ? `<button class="tl-mark" style="left:${left}%;--lvl:${level}" data-go="card" data-params='${JSON.stringify({ id: m.id })}' title="${esc(label)}" aria-label="${esc(label)}">${inner}<span class="tl-name">${esc(m.short || m.name)}</span></button>`
      : `<span class="tl-mark locked" style="left:${left}%;--lvl:${level}" title="${esc(label)}" aria-label="${esc(label)}">${inner}</span>`;
  }).join('');
  const ticks = [1970, 1980, 1990, 2000, 2010, 2020].map((y) => `<span class="tl-tick" style="left:${((y - y0) / (y1 - y0)) * 100}%">${y}</span>`).join('');
  return `<section class="panel timeline" aria-label="Timeline of the machines">
    <header class="tl-head"><h2>Abandoned, not forgotten</h2><p class="muted">Every machine at the year it arrived.</p></header>
    <p class="tl-key muted" aria-label="Key"><span><span class="tl-dot alive" style="--c:var(--muted)"></span> Green glowing ring = still active as of 2026</span><span><span class="tl-dot" style="--c:var(--muted);box-shadow:none"></span> Plain dot = mission over</span><span><span class="tl-dot" style="--c:transparent;border:2px dashed var(--muted);box-shadow:none"></span> Dashed = not scanned yet</span></p>
    <div class="tl-track">${ticks}${marks}</div>
  </section>`;
}

/** Real photos the machines took. Scanning a machine unlocks its photos. */
function gallery() {
  const photos = allPhotos();
  if (!photos.length) return '';
  const open = photos.filter((p) => state.unlocked[p.machine]).length;
  return `<section class="panel gallery" aria-label="Photo gallery">
    <header class="tl-head"><h2>📷 Photo gallery ${tag('real')}</h2><p class="muted">Real pictures taken by the machines themselves. ${open} of ${photos.length} unlocked. Scan a machine to add its photos.</p></header>
    <div class="photo-row">${photos.map((p) => photoTile(p, { locked: !state.unlocked[p.machine] })).join('')}</div>
  </section>`;
}

export default {
  mount(el, _params, go) {
    const { regions, machines } = getHardware();
    const got = machines.filter((m) => state.unlocked[m.id]).length;
    el.innerHTML = `
      <section class="screen dex-screen">
        <header class="hub-head">
          <div><p class="eyebrow">Hardwaredex</p><h1>${Math.round((got / machines.length) * 100)}% complete</h1></div>
          <div class="stack row"><button class="btn btn-ghost" data-go="map">🗺 Where are they now?</button><button class="btn" data-go="hub">← Hub</button></div>
        </header>
        ${timeline(regions, machines)}
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
        ${gallery()}
      </section>`;
    wire(el, go);
    wirePhotos(el);
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
