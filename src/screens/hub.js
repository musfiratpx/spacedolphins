// Ship hub. Phase 2 restyles this as a cockpit screen (features.cockpitHub).
import { wire, esc, tag, toast } from '../ui/dom.js';
import { getHardware, machinesIn } from '../core/data.js';
import { state, save, resetProgress } from '../core/state.js';
import { settings, setSetting } from '../core/settings.js';
import { features } from '../core/config.js';
import { showReward } from '../ui/reward.js';
import { openTutorial } from '../ui/tutorial.js';
import { startTour } from '../ui/tour.js';

let tourTimer = 0;

function regionUnlocked(region, regions) {
  if (region.id === 'mars' || region.id === 'moon') return true;   // Moon (tutorial) and Mars are open from the start
  if (region.id === 'moon' && !features.moonRegion) return false;
  if (region.id === 'deep' && !features.deepSpaceRegion) return false;
  const idx = regions.findIndex((r) => r.id === region.id);
  const prev = regions[idx - 1];
  if (!prev) return true;
  return machinesIn(prev.id).filter((m) => state.unlocked[m.id]).length >= 3;
}

export default {
  unmount() { clearTimeout(tourTimer); },
  mount(el, _params, go) {
    const { regions, machines } = getHardware();
    const total = machines.length;
    const got = machines.filter((m) => state.unlocked[m.id]).length;

    el.innerHTML = `
      <section class="screen hub-screen">
        <header class="hub-head">
          <div>
            <p class="eyebrow">Recovery ship · <b>Year 4052</b></p>
            <h1>Ship hub</h1>
          </div>
          <div class="head-meters">
            <div class="meter shield-meter ${(state.shield ?? 50) < 30 ? 'low' : ''}" aria-label="Earth's shield ${state.shield ?? 50} percent">
              <span class="eyebrow">Earth's shield ${tag('story')}</span>
              <span class="big">${state.shield ?? 50}%</span>
              <span class="sm-bar"><i style="width:${state.shield ?? 50}%"></i></span>
            </div>
            <div class="meter archive-meter" aria-label="Archive ${got} of ${total} machines">
              <span class="eyebrow">Archive</span>
              <span class="big">${got}/${total}</span>
              <span class="sm-bar"><i style="width:${Math.round((got / total) * 100)}%"></i></span>
            </div>
          </div>
        </header>
        <div class="hub-grid">
          <div class="panel explore">
            <h2>Where to?</h2>
            <ul class="regions">
              ${regions.map((r) => {
                const open = regionUnlocked(r, regions);
                const n = machinesIn(r.id).filter((m) => state.unlocked[m.id]).length;
                return `<li>
                  <button class="region ${open ? '' : 'locked'}" style="--accent:${r.color}" ${open ? `data-go="preround" data-params='${JSON.stringify({ region: r.id })}'` : 'disabled'}>
                    <span class="region-name">${esc(r.name)}</span>
                    <span class="region-sub">${open ? `${n}/${machinesIn(r.id).length} scanned` : '🔒 Scan 3 Mars machines'}</span>
                  </button></li>`;
              }).join('')}
            </ul>
          </div>

          <nav class="panel side" aria-label="Ship">
            <button class="btn" data-go="dex">Hardwaredex</button>
            <div class="side-grid">
              <button class="btn btn-ghost" data-go="map">Map</button>
              <button class="btn btn-ghost" data-go="records">Records</button>
              <button class="btn btn-ghost" data-go="radiolog">Radio log</button>
              <button class="btn btn-ghost" data-act="tutorial">How to play</button>
            </div>
            <div class="side-foot">
              <button class="link-btn" data-act="settings">⚙ Settings</button>
              <button class="link-btn" data-go="credits">Credits</button>
            </div>
          </nav>
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
              <label class="check"><input type="checkbox" ${settings.dyslexiaFont ? 'checked' : ''} data-set="dyslexiaFont"> Easy-read font (extra spacing)</label>
              <label class="check"><input type="checkbox" ${settings.readAloud ? 'checked' : ''} data-set="readAloud"> Read radio lines aloud</label>
              <label class="check"><input type="checkbox" ${settings.bgMusic !== false ? 'checked' : ''} data-set="bgMusic"> Background music on menus</label>
              <label>Tester code <span class="hint">For playtesting: unlocks every region, machine and song</span>
                <span class="tester-row"><input type="text" class="tester-code" autocomplete="off" spellcheck="false" aria-label="Tester code"><button type="button" class="btn btn-small" data-act="tester">Unlock</button></span></label>
              <button type="button" class="btn btn-ghost btn-small" data-act="tour">Replay the ship tour</button>
              <button type="button" class="btn btn-ghost btn-small danger" data-act="reset">Reset progress…</button>
              </form>
            </dialog>
      </section>`;

    window.__hhWorld?.setShield(state.shield ?? 50);

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
      tutorial: () => openTutorial(),
      tour: () => { dlg.close(); startTour(); },
      tester: () => {
        const code = el.querySelector('.tester-code').value.trim().toLowerCase();
        if (code !== 'nasa') { toast('That code didn\'t work'); return; }
        // playtest unlock: every machine scanned, every song in the record library, every region open
        const today = new Date().toLocaleDateString('en-CA');
        for (const m of machines) if (!state.unlocked[m.id]) state.unlocked[m.id] = { date: today, grade: '—', accuracy: 0 };
        for (const r of regions) state.best[`${r.song}:normal`] ||= { grade: '—', accuracy: 0 };
        state.tester = true; save();
        dlg.close();
        toast('Tester mode: everything unlocked', 3000);
        go('hub');
      },
      reset: () => {
        if (!confirm('Erase all scanned machines and scores? Settings are kept.')) return;
        resetProgress();
        toast('Progress reset');
        go('title');
      },
    });

    // First time in the hub: a guided tour of every button (skippable).
    if (!state.seenTour) tourTimer = setTimeout(() => { if (el.isConnected) startTour(); }, settings.reducedMotion ? 200 : 1400);

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
