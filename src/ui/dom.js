// Small DOM helpers shared by screens.
import { sfx } from '../audio/sfx.js';
import { unlockAudio } from '../audio/clock.js';
import { applyTilt } from './tilt.js';

export function html(strings, ...values) {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? values[i] : ''), '');
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Wire up every [data-go] button in el, plus click sounds. */
export function wire(el, go, handlers = {}) {
  // Listen on the screen's own root (replaced on every render), never on #app itself,
  // or listeners pile up and one click fires several times.
  const root = el.id === 'app' ? el.firstElementChild : el;
  applyTilt(root);
  // sounds play on click only (no hover sounds)
  let busy = false;
  root.addEventListener('click', async (e) => {
    if (busy) return;
    const btn = e.target.closest('[data-go], [data-act]');
    if (!btn || btn.disabled) return;
    await unlockAudio();
    if (btn.dataset.go) { busy = true; sfx.click(); go(btn.dataset.go, btn.dataset.params ? JSON.parse(btn.dataset.params) : {}); }
    else if (handlers[btn.dataset.act]) { sfx.click(); handlers[btn.dataset.act](btn, e); }
  });
}

let toastTimer = 0;
/** Short status message at the bottom of the screen (also read by screen readers). */
export function toast(msg, ms = 2400) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function tag(kind) {
  return `<span class="tag tag-${kind}" title="${kind === 'real' ? 'A real fact from NASA' : 'Part of the game story'}">${kind === 'real' ? 'Real' : 'Story'}</span>`;
}
