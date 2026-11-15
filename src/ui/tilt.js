// Hologram tilt: panels and cards lean toward the pointer in 3D and catch a
// moving highlight. Off when reduced motion is on. Large panels tilt less so
// text stays easy to read.
import { settings } from '../core/settings.js';

const SELECTOR = '.panel, .dex-card, .machine-pick, .region';

export function applyTilt(root) {
  if (!root) return;
  root.querySelectorAll(SELECTOR).forEach((el) => {
    if (el.dataset.tilt === 'off' || el.__tilt) return;
    el.__tilt = true;
    el.classList.add('tilt');
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      if (settings.reducedMotion || e.pointerType === 'touch') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        const max = r.width > 520 ? 2.5 : 8;
        el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
        el.style.setProperty('--mx', `${((x + 0.5) * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${((y + 0.5) * 100).toFixed(1)}%`);
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(raf);
      el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
    });
  });
}
