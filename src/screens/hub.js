// Ship hub. Phase 2 restyles this as a cockpit screen (features.cockpitHub).
import { wire, esc, tag, toast } from '../ui/dom.js';
import { getHardware, machinesIn, getAsteroids, getAsteroidSnapshot } from '../core/data.js';
import { state, save, resetProgress } from '../core/state.js';
import { settings, setSetting } from '../core/settings.js';
import { features } from '../core/config.js';
import { showReward } from '../ui/reward.js';

function regionUnlocked(region, regions) {
  if (region.id === 'mars' || region.id === 'moon') return true;   // Moon (tutorial) and Mars are open from the start
  if (region.id === 'moon' && !features.moonRegion) return false;
  if (region.id === 'deep' && !features.deepSpaceRegion) return false;
  const idx = regions.findIndex((r) => r.id === region.id);
  const prev = regions[idx - 1];
  if (!prev) return true;
  return machinesIn(prev.id).filter((m) => state.unlocked[m.id]).length >= 3;
}

let neoTimer = 0;

export default {
  unmount() { clearInterval(neoTimer); },
  mount(el, _params, go) {
    const { regions, machines } = getHardware();
    const total = machines.length;
    const got = machines.filter((m) => state.unlocked[m.id]).length;

    el.innerHTML = `
      <section class="screen hub-screen">
        <header class="hub-head">
          <div>
            <p class="eyebrow">Recovery ship · Year 4052</p>
            <h1>Ship hub</h1>
          </div>
          <div class="archive-meter" aria-label="Archive ${got} of ${total} machines">
            <span class="eyebrow">Archive</span>
            <span class="big">${got}/${total}</span>
          </div>
        </header>
        <div class="neo-strip" aria-live="polite">
          <span class="neo-label">📡 Near-Earth watch ${tag('real')}</span>
          <span class="neo-count"></span>
          <span class="neo-card"></span>
        </div>

        <div class="hub-grid">
          <div class="panel explore">
            <h2>Explore</h2>
            <p>Pick a region, then a machine to hunt.</p>
            <ul class="regions">
              ${regions.map((r) => {
                const open = regionUnlocked(r, regions);
                const n = machinesIn(r.id).filter((m) => state.unlocked[m.id]).length;
                return `<li>
                  <button class="region ${open ? '' : 'locked'}" style="--accent:${r.color}" ${open ? `data-go="preround" data-params='${JSON.stringify({ region: r.id })}'` : 'disabled'}>
                    <span class="region-name">${esc(r.name)}</span>
                    <span class="region-sub">${open ? `${n}/${machinesIn(r.id).length} scanned` : '🔒 Scan 3 Mars machines to unlock'}</span>
                  </button></li>`;
              }).join('')}
            </ul>
          </div>

          <div class="panel side">
            <h2>Ship systems</h2>
            <div class="side-grid">
              <button class="btn" data-go="dex">Hardwaredex</button>
              <button class="btn btn-ghost" data-go="records">Records</button>
              <button class="btn btn-ghost" data-go="intro">Radio</button>
              <button class="btn btn-ghost" data-act="settings">⚙ Settings</button>
            </div>
            <button class="link-btn side-credits" data-go="credits">Credits</button>
          </div>
        </div>
            <dialog class="settings-dialog panel" aria-label="Settings">
              <form method="dialog" class="quick-settings">
              <header class="dialog-head"><h2>Settings</h2><button class="tool" value="close" aria-label="Close settings">✕</button></header>
              <label>Master volume <output>${Math.round(settings.volumes.master * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${settings.volumes.master}" data-set="volumes.master" data-fmt="pct"></label>
              <label>Music volume <output>${Math.round(settings.volumes.music * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${settings.volumes.music}" data-set="volumes.music" data-fmt="pct"></label>
              <label>Effects volume <output>${Math.round(settings.volumes.sfx * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${settings.volumes.sfx}" data-set="volumes.sfx" data-fmt="pct"></label>
              <label>Radio volume <output>${Math.round(settings.volumes.radio * 100)}%</output><input type="range" min="0" max="1" step="0.05" value="${settings.volumes.radio}" data-set="volumes.radio" data-fmt="pct"></label>
              <label>Note speed <output>${settings.noteSpeed.toFixed(1)}×</output><input type="range" min="0.6" max="1.8" step="0.1" value="${settings.noteSpeed}" data-set="noteSpeed" data-fmt="x"></label>
              <label>Audio offset (ms) <span class="hint">Raise it if notes feel early with Bluetooth headphones</span><input type="number" min="-300" max="300" step="5" value="${settings.audioOffsetMs}" data-set="audioOffsetMs"></label>
              <label>Graphics
                <select data-set="quality" data-type="string">
                  ${['auto', 'low', 'medium', 'high'].map((q) => `<option value="${q}" ${settings.quality === q ? 'selected' : ''}>${q[0].toUpperCase() + q.slice(1)}${q === 'auto' ? ' (recommended)' : ''}</option>`).join('')}
                </select></label>
              <label class="check"><input type="checkbox" ${settings.oneLane ? 'checked' : ''} data-set="oneLane"> One-lane mode (any key hits every note)</label>
              <label class="check"><input type="checkbox" ${settings.reducedMotion ? 'checked' : ''} data-set="reducedMotion"> Reduced motion</label>
              <button type="button" class="btn btn-ghost btn-small danger" data-act="reset">Reset progress…</button>
              </form>
            </dialog>
      </section>`;

    // Real asteroids from NASA's NeoWs snapshot, one at a time
    const rocks = getAsteroids();
    const snap = getAsteroidSnapshot();
    const neo = el.querySelector('.neo-strip');
    if (!rocks.length) neo.remove();
    else {
      const fmt = (n) => Math.round(n).toLocaleString('en-US');
      el.querySelector('.neo-count').textContent = `${rocks.length} passed Earth${snap?.range ? ` ${snap.range.start} → ${snap.range.end}` : ' this week'}`;
      const card = el.querySelector('.neo-card');
      let i = 0;
      const show = () => {
        const a = rocks[i++ % rocks.length];
        card.innerHTML = `<a class="neo-name" href="${esc(a.nasaUrl)}" target="_blank" rel="noopener" title="Open JPL record">${esc(a.name)}</a>${a.hazardous ? ' <span class="neo-haz">Potentially hazardous</span>' : ''}
          <span class="neo-facts">${fmt(a.diameterMinM)}–${fmt(a.diameterMaxM)} m wide · ${fmt(a.speedKph)} km/h · missed Earth by ${fmt(a.missDistanceKm)} km</span>`;
        card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
      };
      show();
      neoTimer = setInterval(show, 6000);
    }

    el.querySelectorAll('[data-set]').forEach((input) => {
      const apply = () => {
        const v = input.type === 'checkbox' ? input.checked : input.dataset.type === 'string' ? input.value : Number(input.value);
        setSetting(input.dataset.set, v);
        const out = input.parentElement.querySelector('output');
        if (out) out.textContent = input.dataset.fmt === 'pct' ? `${Math.round(v * 100)}%` : `${Number(v).toFixed(1)}×`;
        if (input.dataset.set === 'quality') toast('Graphics change applies after a reload');
      };
      input.addEventListener(input.type === 'range' ? 'input' : 'change', apply);
    });
    const dlg = el.querySelector('.settings-dialog');
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });   // click outside closes
    wire(el, go, {
      settings: () => dlg.showModal(),
      reset: () => {
        if (!confirm('Erase all scanned machines and scores? Settings are kept.')) return;
        resetProgress();
        toast('Progress reset');
        go('title');
      },
    });

    // A Numan plushie joins the dashboard for every fully scanned region (Story).
    state.plushies ||= [];
    const fresh = regions.filter((r) => {
      const ms = machinesIn(r.id);
      return ms.length && ms.every((m) => state.unlocked[m.id]) && !state.plushies.includes(r.id);
    });
    if (fresh.length) {
      state.plushies.push(...fresh.map((r) => r.id)); save();
      // full reward reveal, one region at a time
      (async () => { for (const r of fresh) await showReward(r); })();
    }
  },
};
