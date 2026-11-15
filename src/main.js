import './core/bus.js';
import { emit } from './core/bus.js';
import { loadManifest } from './core/manifest.js';
import { loadHardware, getMachine, loadAsteroids } from './core/data.js';
import { startWorld, getWorld } from './three/world.js';
import { startStars } from './ui/stars.js';
import { startHearingPopups } from './ui/hearing.js';
import { startAmbience } from './audio/ambience.js';
import { startPaperViewer } from './ui/paper.js';
import { debug } from './core/config.js';
import { settings } from './core/settings.js';
import { on } from './core/bus.js';

import title from './screens/title.js';
import intro from './screens/intro.js';
import hub from './screens/hub.js';
import preround from './screens/preround.js';
import round from './screens/round.js';
import results from './screens/results.js';
import card from './screens/card.js';
import dex from './screens/dex.js';
import credits from './screens/credits.js';
import records from './screens/records.js';
import radiolog from './screens/radiolog.js';

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

function regionOf(params) {
  const id = params.id || params.machine;
  return params.region || (id && getMachine(id)?.region) || 'mars';
}

async function swap(id, next, params) {
  if (current?.screen.unmount) current.screen.unmount();
  // cards open instantly over whatever view you're on (no flight to the machine's planet)
  const flight = id === 'card' ? 0 : getWorld()?.setShot(id, { region: regionOf(params) }) || 0;
  // on long flights, the new screen's UI arrives as the ship does
  app.style.setProperty('--enter-delay', `${flight > 1.8 && !settings.reducedMotion ? Math.round(flight * 420) : 0}ms`);
  app.classList.remove('fade-in');
  app.innerHTML = '';
  app.scrollTop = 0;            // every screen opens at the top
  app.dataset.screen = id;
  current = { id, screen: next };
  await next.mount(app, params, go);
  void app.offsetWidth;            // restart the fade animation
  app.classList.add('fade-in');
  app.focus({ preventScroll: true });
  emit('screen:change', { id, params });
}

window.__hhGo = (id, params) => go(id, params);   // handy in the browser console for debugging/testing

for (const [id, s] of Object.entries({ title, intro, hub, preround, round, results, card, dex, credits, records, radiolog })) {
  registerScreen(id, s);
}

// Global debug keys (F2 click track works inside rounds; F3 reserved for hotspots)
window.addEventListener('keydown', (e) => {
  if (e.key === 'F3') { e.preventDefault(); debug.hotspotCoords = !debug.hotspotCoords; }
  // Esc = back (rounds and the intro handle Esc themselves; inspect closes first)
  if (e.key === 'Escape' && !['round', 'intro', 'title'].includes(current?.id) && !document.body.classList.contains('inspect-open') && !document.querySelector('dialog[open], .paper-view')) {
    const back = app.querySelector('.hub-head [data-go]');
    if (back) { e.preventDefault(); back.click(); }
  }
});

// CSS animations follow the in-game Reduced motion setting too
const syncMotion = () => {
  document.body.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
  document.body.classList.toggle('easy-read', Boolean(settings.dyslexiaFont));
};
syncMotion();
on('settings:change', ({ path }) => { if (path === 'reducedMotion' || path === 'dyslexiaFont') syncMotion(); });

// ---- Boot -----------------------------------------------------------------
(async function boot() {
  const sky = document.getElementById('stars');
  try {
    await Promise.all([loadManifest(), loadHardware(), loadAsteroids()]);
    // 3D world behind every screen; falls back to the 2D starfield without WebGL
    if (!startWorld(sky)) startStars(sky);
    startHearingPopups();
    startAmbience();
    startPaperViewer();
  } catch (err) {
    app.innerHTML = `<div class="screen center"><div class="panel"><h2>Couldn't load game data</h2>
      <p>Run the game from a web server (npm run dev), not by double-clicking index.html.</p>
      <pre>${String(err)}</pre></div></div>`;
    throw err;
  }
  go('title');
})();
