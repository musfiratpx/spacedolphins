// Real photos taken BY the machines (data/photos.json). Used by the Hardwaredex
// gallery, the hardware card and the dashboard polaroid. Every photo says which
// machine (and camera) took it, and when.
import { esc, tag } from './dom.js';
import { settings } from '../core/settings.js';
import { getMachine } from '../core/data.js';

let data = { photos: [] };

export async function loadPhotos() {
  try {
    const res = await fetch('data/photos.json', { cache: 'no-store' });
    if (res.ok) data = await res.json();
  } catch (err) { console.warn('[photos] data/photos.json missing', err); }
  return data;
}

export function allPhotos() { return data.photos || []; }
export function photosFor(machineId) { return allPhotos().filter((p) => p.machine === machineId); }
export function getPhoto(id) { return allPhotos().find((p) => p.id === id) || null; }
export function dashboardPhoto() { return getPhoto(data.dashboard); }

/** "Taken by Voyager 1 · Sept. 18, 1977" */
export function takenBy(p) {
  const m = getMachine(p.machine);
  return `Taken by ${m?.short || m?.name || p.camera}${p.taken ? ` · ${p.taken}` : ''}`;
}

/** Small clickable photo tile (button). */
export function photoTile(p, { locked = false } = {}) {
  if (locked) {
    return `<div class="photo-tile locked" aria-label="Locked photo"><span class="photo-img" style="background-image:url('${esc(p.file)}')"></span><span class="photo-cap">🔒 Scan ${esc(getMachine(p.machine)?.short || 'this machine')} to see</span></div>`;
  }
  return `<button class="photo-tile" data-photo="${esc(p.id)}" aria-label="${esc(p.title)}. ${esc(takenBy(p))}">
    <img class="photo-img" src="${esc(p.file)}" alt="" loading="lazy" decoding="async"${p.fit === 'contain' ? ' style="object-fit:contain"' : ''}>
    <span class="photo-cap"><b>${esc(p.title)}</b><small>${esc(takenBy(p))}</small></span></button>`;
}

/** Wire every [data-photo] tile inside root to open the big viewer. */
export function wirePhotos(root) {
  root.querySelectorAll('[data-photo]').forEach((b) => b.addEventListener('click', () => openPhoto(getPhoto(b.dataset.photo))));
}

/** Full-size view: the photo, what took it, a short caption and the NASA credit. */
export function openPhoto(p) {
  if (!p) return;
  document.querySelector('.paper-view')?.remove();
  const el = document.createElement('div');
  el.className = 'paper-view photo-view';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', p.title);
  el.innerHTML = `
    <div class="paper-card">
      <button class="tool paper-x" aria-label="Close">✕</button>
      <img class="photo-big" src="${esc(p.file)}" alt="${esc(p.caption)}">
      <h2>${esc(p.title)} ${tag('real')}</h2>
      <p class="photo-by">📷 ${esc(takenBy(p))}</p>
      <p>${esc(p.caption)}</p>
      <p class="hint">Camera: ${esc(p.camera)} · Credit: ${esc(p.credit)} · <a href="${esc(p.source)}" target="_blank" rel="noopener">NASA page ↗</a></p>
    </div>`;
  document.body.appendChild(el);
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('closing');
    setTimeout(() => el.remove(), settings.reducedMotion ? 0 : 180);
  };
  const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.paper-x')) close(); });
  el.querySelector('.paper-x').focus();
}
