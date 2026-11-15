// Ship hub. Phase 2 restyles this as a cockpit screen (features.cockpitHub).
import { wire, esc } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state } from '../core/state.js';
import { settings, setSetting } from '../core/settings.js';
import { features } from '../core/config.js';

function regionUnlocked(region, regions) {
  if (region.id === 'mars') return true;                // Phase 1: Mars is the playable region
  if (region.id === 'moon' && !features.moonRegion) return false;
  if (region.id === 'deep' && !features.deepSpaceRegion) return false;
  const idx = regions.findIndex((r) => r.id === region.id);
  const prev = regions[idx - 1];
  if (!prev) return true;
  return machinesIn(prev.id).filter((m) => state.unlocked[m.id]).length >= 3;
}

export default {
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
                    <span class="region-sub">${open ? `${n}/${machinesIn(r.id).length} scanned` : esc(r.lockedText || 'Locked')}</span>
                  </button></li>`;
              }).join('')}
            </ul>
          </div>

          <div class="panel side">
            <button class="btn" data-go="dex">Hardwaredex</button>
            <button class="btn btn-ghost" data-go="intro">Replay radio</button>
            <button class="btn btn-ghost" data-go="credits">Credits</button>
            <details class="quick-settings">
              <summary>Settings</summary>
              <label>Music volume <input type="range" min="0" max="1" step="0.05" value="${settings.volumes.music}" data-set="volumes.music"></label>
              <label>Effects volume <input type="range" min="0" max="1" step="0.05" value="${settings.volumes.sfx}" data-set="volumes.sfx"></label>
              <label>Note speed <input type="range" min="0.6" max="1.8" step="0.1" value="${settings.noteSpeed}" data-set="noteSpeed"></label>
              <label>Audio offset (ms) <input type="number" min="-300" max="300" step="5" value="${settings.audioOffsetMs}" data-set="audioOffsetMs"></label>
              <label class="check"><input type="checkbox" ${settings.reducedMotion ? 'checked' : ''} data-set="reducedMotion"> Reduced motion</label>
            </details>
          </div>
        </div>
      </section>`;

    el.querySelectorAll('[data-set]').forEach((input) => {
      input.addEventListener('change', () => {
        const v = input.type === 'checkbox' ? input.checked : Number(input.value);
        setSetting(input.dataset.set, v);
      });
    });
    wire(el, go);
  },
};
