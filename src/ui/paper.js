// Enlarged view of a note or photo from the cockpit: the paper's own art redrawn
// big, plus a short caption. Close with the X, Escape, or a click outside.
import { on } from '../core/bus.js';
import { settings } from '../core/settings.js';
import { esc, tag } from './dom.js';

export function startPaperViewer() {
  on('paper:open', ({ draw, aspect, title, text, kind = 'story' }) => {
    document.querySelector('.paper-view')?.remove();
    const el = document.createElement('div');
    el.className = 'paper-view';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <div class="paper-card">
        <button class="tool paper-x" aria-label="Close">✕</button>
        <canvas class="paper-art" aria-hidden="true"></canvas>
        <h2>${esc(title)} ${tag(kind)}</h2>
        <p>${esc(text)}</p>
      </div>`;
    document.body.appendChild(el);
    // redraw the paper's art at full size (not a blurry stretch of the small texture)
    const cv = el.querySelector('.paper-art');
    const w = 520; const h = Math.round(w * aspect);
    cv.width = w; cv.height = h;
    cv.style.aspectRatio = `${w} / ${h}`;
    draw(cv.getContext('2d'), w, h);
    const close = () => {
      window.removeEventListener('keydown', onKey, true);
      el.classList.add('closing');
      setTimeout(() => el.remove(), settings.reducedMotion ? 0 : 180);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.closest('.paper-x')) close(); });
    el.querySelector('.paper-x').focus();
  });
}
