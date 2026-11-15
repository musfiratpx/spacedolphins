// "Where are they now?" Moon and Mars globes with each machine at its real landing
// site, and a deep-space list for the machines out past the planets.
import { wire, esc, tag } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';
import { MapView } from '../three/mapview.js';

let view = null;
let tab = 'moon';

function statusText(m) {
  if (m.alive) return '<span class="status-chip alive"><span class="pulse"></span> Still talking to Earth</span>';
  if (m.monument) return `<span class="status-chip monument">🗿 Monument since ${esc(m.quietSince)}</span>`;
  if (m.quietSince) return `<span class="status-chip quiet">💤 Quiet since ${esc(m.quietSince)}</span>`;
  return '<span class="status-chip quiet">Status being checked</span>';
}

export default {
  mount(el, params, go) {
    if (params.tab) tab = params.tab;
    const { regions } = getHardware();
    const signals = getHardware().signals || {};
    const render = () => {
      const region = regions.find((r) => r.id === tab);
      const ms = machinesIn(tab);
      const name = (m) => (state.unlocked[m.id] ? m.short || m.name : '???');
      const list = ms.map((m) => {
        const pinned = m.lat != null || m.id === 'lro';
        return `<li><button class="map-item ${pinned ? '' : 'unpinned'}" data-act="pick" data-id="${m.id}" ${pinned || tab === 'deep' ? '' : 'disabled'}>
          <span class="mi-dot ${m.alive ? 'alive' : m.monument ? 'monument' : 'quiet'}"></span>
          <span class="mi-name">${esc(name(m))}</span>
          <span class="mi-sub">${tab === 'deep' ? esc(m.place) : pinned ? (m.id === 'lro' ? 'In orbit' : esc(m.place.split(',')[0])) : 'Location being checked'}</span>
        </button></li>`;
      }).join('');
      el.innerHTML = `
        <section class="screen map-screen">
          <header class="hub-head">
            <div><p class="eyebrow">Hardwaredex</p><h1>Where are they now?</h1></div>
            <div class="stack row"><button class="btn btn-ghost" data-go="dex">Hardwaredex</button><button class="btn" data-go="hub">Hub</button></div>
          </header>
          <div class="map-tabs" role="tablist">
            ${regions.map((r) => `<button role="tab" aria-selected="${tab === r.id}" class="chip ${tab === r.id ? 'on' : ''}" data-act="tab" data-tab="${r.id}" style="--accent:${r.color}">${esc(r.name.split(':')[0])}</button>`).join('')}
          </div>
          <div class="map-grid">
            <div class="panel map-globe-wrap" data-tilt="off">
              ${tab === 'deep' ? `<div class="deep-view">
                  <p class="deep-sun">☀️ <span>The Sun</span></p>
                  ${ms.map((m, i) => `<div class="deep-row" style="--i:${i}"><span class="mi-dot ${m.alive ? 'alive' : 'quiet'}"></span><b>${esc(name(m))}</b><span>${esc(m.place)}</span>${m.signal && signals[m.signal] ? `<span class="muted">Signal: ${esc(signals[m.signal].text)}</span>` : ''}</div>`).join('')}
                </div>`
                : '<div class="map-globe" aria-label="Globe with machine locations. Drag to spin, scroll to zoom."></div><p class="hint map-hint">Drag to spin · scroll to zoom · click a pin</p>'}
            </div>
            <div class="panel map-side">
              <h2>${esc(region.name)}</h2>
              <p class="map-legend"><span><span class="mi-dot alive"></span> still talking</span><span><span class="mi-dot quiet"></span> quiet</span><span><span class="mi-dot monument"></span> monument</span></p>
              <ul class="map-list">${list}</ul>
              <div class="map-info" aria-live="polite"><p class="hint">Pick a machine to see where it is now.</p></div>
            </div>
          </div>
        </section>`;
      const info = el.querySelector('.map-info');
      const show = (m) => {
        el.querySelectorAll('.map-item').forEach((b) => b.classList.toggle('on', b.dataset.id === m.id));
        const got = state.unlocked[m.id];
        const coords = m.lat != null ? `${m.lat}°, ${m.lon}°${m.coordsVerified ? '' : ' (approximate)'}` : '';
        info.innerHTML = `<h3>${esc(got ? m.name : 'Unscanned machine')}</h3>
          ${statusText(m)}
          <p><b>${esc(m.place)}</b>${coords ? ` · ${esc(coords)}` : ''} ${tag('real')}</p>
          ${got ? `<button class="btn btn-small" data-go="card" data-params='${JSON.stringify({ id: m.id })}'>Open its card</button>` : `<p class="hint">${esc(m.teaser)} Scan it to learn more.</p>`}`;
        wire(info, go);
      };
      view?.dispose(); view = null;
      if (tab !== 'deep') {
        view = new MapView(el.querySelector('.map-globe'), (m) => show(m));
        view.setBody(tab, ms);
      }
      wire(el, go, {
        tab: (b) => { tab = b.dataset.tab; render(); },
        pick: (b) => { const m = ms.find((x) => x.id === b.dataset.id); if (view) view.focus(m.id); else show(m); },
      });
    };
    render();
  },
  unmount() { view?.dispose(); view = null; },
};
