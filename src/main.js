import './core/bus.js';
import { emit } from './core/bus.js';
import { loadManifest } from './core/manifest.js';
import { loadHardware } from './core/data.js';
import { startStars } from './ui/stars.js';
import { debug } from './core/config.js';

import title from './screens/title.js';
import intro from './screens/intro.js';
import hub from './screens/hub.js';
import preround from './screens/preround.js';
import round from './screens/round.js';
import results from './screens/results.js';
import card from './screens/card.js';
import dex from './screens/dex.js';
import credits from './screens/credits.js';

// ---- Screen registry -------------------------------------------------------
const screens = new Map();
let current = null;
const app = document.getElementById('app');

export function registerScreen(id, screen) { screens.set(id, screen); }

let navigating = false;

export async function go(id, params = {}) {
  const next = screens.get(id);
  if (!next) { console.error(`[screens] unknown screen ${id}`); return; }
  if (navigating) return;          // ignore double clicks while a screen is mounting
  navigating = true;
  try { await swap(id, next, params); } finally { navigating = false; }
}

async function swap(id, next, params) {
  if (current?.screen.unmount) current.screen.unmount();
  app.classList.remove('fade-in');
  app.innerHTML = '';
  app.dataset.screen = id;
  current = { id, screen: next };
  await next.mount(app, params, go);
  void app.offsetWidth;            // restart the fade animation
  app.classList.add('fade-in');
  app.focus({ preventScroll: true });
  emit('screen:change', { id, params });
}

for (const [id, s] of Object.entries({ title, intro, hub, preround, round, results, card, dex, credits })) {
  registerScreen(id, s);
}

// Global debug keys (F2 click track works inside rounds; F3 reserved for hotspots)
window.addEventListener('keydown', (e) => {
  if (e.key === 'F3') { e.preventDefault(); debug.hotspotCoords = !debug.hotspotCoords; }
});

// ---- Boot -----------------------------------------------------------------
(async function boot() {
  startStars(document.getElementById('stars'));
  try {
    await Promise.all([loadManifest(), loadHardware()]);
  } catch (err) {
    app.innerHTML = `<div class="screen center"><div class="panel"><h2>Couldn't load game data</h2>
      <p>Run the game from a web server (npm run dev), not by double-clicking index.html.</p>
      <pre>${String(err)}</pre></div></div>`;
    throw err;
  }
  go('title');
})();
