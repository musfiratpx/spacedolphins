// Radio log: replay every transmission you've received, plus the ship's log,
// a set of short world-building entries about life in 4052 (all tagged Story).
import { wire, esc } from '../ui/dom.js';
import { getHardware, loadRadio } from '../core/data.js';
import { state } from '../core/state.js';
import { playRadio } from '../ui/radio.js';

// ship's log entries unlock as you play, so there's always something new to read
const LORE_UNLOCK = {
  archive: () => true,
  shield: () => true,
  numans: () => Object.keys(state.unlocked).length >= 1,
  ship: () => Object.keys(state.unlocked).length >= 3,
  monuments: () => Object.keys(state.unlocked).length >= 6,
};
const LORE_HINT = { numans: 'Scan 1 machine', ship: 'Scan 3 machines', monuments: 'Scan 6 machines' };

export default {
  async mount(el, _params, go) {
    const radio = await loadRadio();
    const { regions } = getHardware();
    const briefed = state.briefed || {};
    const row = (id, title, sub, open, icon) => `
      <li><button class="radio-row ${open ? '' : 'locked'}" ${open ? `data-act="play" data-id="${esc(id)}"` : 'disabled'}>
        <span class="rr-icon" aria-hidden="true">${open ? icon : '🔒'}</span>
        <span class="rr-main"><span class="rr-title">${esc(title)}</span><span class="rr-sub">${esc(sub)}</span></span>
        ${open ? '<span class="rr-play" aria-hidden="true">▶</span>' : ''}
      </button></li>`;
    el.innerHTML = `
      <section class="screen radiolog-screen">
        <header class="hub-head">
          <div><p class="eyebrow">Ship radio</p><h1>Radio log</h1></div>
          <button class="btn btn-ghost" data-go="hub">← Hub</button>
        </header>
        <div class="radiolog-grid">
          <div class="panel">
            <h2>Transmissions</h2>
            <ul class="radio-list">
              ${row('intro', 'First contact', 'Mission Control explains the job', true, '📻')}
              ${regions.map((r) => row(`region:${r.id}`, `${r.name} briefing`, briefed[r.id] ? 'Mission Control and the Numans' : `Visit ${r.name.split(':')[0]} to receive it`, briefed[r.id], '🛰')).join('')}
            </ul>
          </div>
          <div class="panel">
            <h2>Ship's log</h2>
            <p class="hint">Notes left in the ship's computer about life in 4052.</p>
            <ul class="radio-list">
              ${(radio.lore || []).map((l) => row(`lore:${l.id}`, l.title, LORE_UNLOCK[l.id]?.() ? `${l.lines.length} entries` : LORE_HINT[l.id] || 'Keep playing', LORE_UNLOCK[l.id]?.() ?? true, '📓')).join('')}
            </ul>
          </div>
        </div>
      </section>`;
    wire(el, go, {
      play: (b) => {
        const id = b.dataset.id;
        if (id === 'intro') { go('intro'); return; }
        if (id.startsWith('region:')) {
          const r = regions.find((x) => x.id === id.slice(7));
          playRadio(radio.regions[r.id], { title: `${r.name} briefing` });
          return;
        }
        const lore = radio.lore.find((l) => l.id === id.slice(5));
        playRadio(lore.lines, { title: `Ship's log: ${lore.title}` });
      },
    });
  },
};
