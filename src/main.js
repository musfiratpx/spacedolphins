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
import { state } from './core/state.js';
import { on } from './core/bus.js';
import { loadPhotos } from './ui/photos.js';
import * as THREE from 'three';
import { openTutorial } from './ui/tutorial.js';
import { setSetting } from './core/settings.js';
import { unlockAudio } from './audio/clock.js';

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
import map from './screens/map.js';

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
  app.style.setProperty('--enter-delay', `${flight > 1.8 && !settings.reducedMotion ? Math.min(600, Math.round(flight * 250)) : 0}ms`);   // never keep the player waiting long
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

for (const [id, s] of Object.entries({ title, intro, hub, preround, round, results, card, dex, credits, records, radiolog, map })) {
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

// Corner tools on every screen (hidden in rounds): How to play + background music on/off
const musicBtn = document.getElementById('music-toggle');
const syncMusic = () => {
  const onNow = settings.bgMusic !== false;
  musicBtn.setAttribute('aria-pressed', String(onNow));
  musicBtn.setAttribute('aria-label', `Background music ${onNow ? 'on' : 'off'}`);
  musicBtn.title = `Background music: ${onNow ? 'on' : 'off'}`;
  musicBtn.classList.toggle('off', !onNow);
};
syncMusic();
musicBtn.addEventListener('click', async () => { await unlockAudio(); setSetting('bgMusic', settings.bgMusic === false); });
on('settings:change', ({ path }) => { if (path === 'bgMusic') syncMusic(); });
document.getElementById('help-toggle').addEventListener('click', () => openTutorial());

// CSS animations follow the in-game Reduced motion setting too
const syncMotion = () => {
  document.body.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
  document.body.classList.toggle('easy-read', Boolean(settings.dyslexiaFont));
};
syncMotion();
on('settings:change', ({ path }) => { if (path === 'reducedMotion' || path === 'dyslexiaFont') syncMotion(); });

// ---- Boot -----------------------------------------------------------------
// A loading screen with a real percentage: data files + every texture/model the
// first screen needs (tracked by three.js's loading manager), then the GPU shaders
// are compiled up front so the first camera flight doesn't stutter.
const boot = document.getElementById('boot');
// Fun facts while you wait. Only facts verified in CLAUDE.md ("Facts" section).
const BOOT_FACTS = [
  'Opportunity was planned to work for 90 Martian days. It kept going for almost 15 years.',
  'Opportunity drove about 28 miles (45 km) across Mars.',
  'InSight detected more than 1,300 marsquakes. The biggest was about magnitude 5.',
  'Ingenuity made the first powered, controlled flight on another planet, on April 19, 2021.',
  "Ingenuity carried a small piece of fabric from the Wright brothers' 1903 Flyer.",
  'Ingenuity flew 72 times on Mars.',
  'Viking 1 was the first US spacecraft to land on Mars and send back pictures from the surface.',
  "InSight's seismometer sat under a dome that shielded it from wind and heat.",
];
let factTimer = 0;
if (boot) {
  const factEl = boot.querySelector('.boot-fact');
  let f = Math.floor(Math.random() * BOOT_FACTS.length);
  const showFact = () => { factEl.innerHTML = `<b>Fun fact</b> <span class="tag tag-real">Real</span><br>${BOOT_FACTS[f++ % BOOT_FACTS.length]}`; };
  showFact();
  factTimer = setInterval(showFact, 4000);
}
let dataDone = 0; const DATA_STEPS = 5;
let assetsLoaded = 0; let assetsTotal = 0; let shown = 0; let booting = true;
function showProgress() {
  if (!boot || !booting) return;
  const pct = Math.round(((dataDone + assetsLoaded) / (DATA_STEPS + Math.max(assetsTotal, 6))) * 100);
  shown = Math.max(shown, Math.min(99, pct));        // never jumps backwards
  boot.querySelector('.boot-bar i').style.width = `${shown}%`;
  boot.querySelector('.boot-pct').textContent = `Loading… ${shown}%`;
  boot.setAttribute('aria-valuenow', String(shown));
}
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => { assetsLoaded = loaded; assetsTotal = total; showProgress(); };
const step = (p) => p.then((v) => { dataDone++; showProgress(); return v; });
const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);
const allAssets = () => new Promise((resolve) => {
  const check = () => (assetsTotal && assetsLoaded >= assetsTotal ? resolve() : setTimeout(check, 100));
  check();
});

(async function bootGame() {
  const sky = document.getElementById('stars');
  try {
    await Promise.all([
      step(loadManifest()), step(loadHardware()), step(loadAsteroids()), step(loadPhotos()),
      step(timeout(document.fonts?.ready || Promise.resolve(), 2500)),
    ]);
    // 3D world behind every screen; falls back to the 2D starfield without WebGL
    if (!startWorld(sky)) startStars(sky);
    const world = getWorld();
    world?.setShield(state.shield ?? 50);
    // wait for textures + the title-screen models (never longer than 12 s on a slow line)
    await timeout(Promise.all([world?.showcaseReady, allAssets()]), 12000);
    try { world?.renderer.compile(world.scene, world.camera); world?.renderer.compile(world.cockpitScene, world.cockpitCam); } catch { /* optional warm-up */ }
    startHearingPopups();
    startAmbience();
    startPaperViewer();
  } catch (err) {
    boot?.remove();
    app.innerHTML = `<div class="screen center"><div class="panel"><h2>Couldn't load game data</h2>
      <p>Run the game from a web server (npm run dev), not by double-clicking index.html.</p>
      <pre>${String(err)}</pre></div></div>`;
    throw err;
  }
  booting = false;
  clearInterval(factTimer);
  if (boot) {
    boot.querySelector('.boot-bar i').style.width = '100%';
    boot.querySelector('.boot-pct').textContent = 'Ready';
    boot.classList.add('done');
    setTimeout(() => boot.remove(), settings.reducedMotion ? 0 : 450);
  }
  go('title');
})();
