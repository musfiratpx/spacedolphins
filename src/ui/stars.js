// Background starfield (original, made in code). Slight mouse parallax unless
// reduced motion is on. Phase 3 replaces this with region shader skies.
import { settings } from '../core/settings.js';
import { on } from '../core/bus.js';

export function startStars(canvas) {
  const g = canvas.getContext('2d');
  let stars = [];
  let w = 0; let h = 0;
  let mx = 0; let my = 0;
  let pulse = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 4500);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      z: Math.random() * 0.9 + 0.1,
      tw: Math.random() * Math.PI * 2,
    }));
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mx = (e.clientX / w - 0.5); my = (e.clientY / h - 0.5);
  });
  // hook: music-reactive twinkle (Phase 3 makes this richer)
  on('beat', () => { pulse = 1; });
  resize();

  function frame(t) {
    requestAnimationFrame(frame);
    g.clearRect(0, 0, w, h);
    const still = settings.reducedMotion;
    pulse *= 0.92;
    for (const s of stars) {
      const px = still ? 0 : mx * 18 * s.z;
      const py = still ? 0 : my * 12 * s.z;
      const tw = still ? 0.8 : 0.6 + 0.4 * Math.sin(t * 0.002 * s.z + s.tw);
      g.globalAlpha = Math.min(1, tw * s.z + pulse * 0.15 * s.z);
      g.fillStyle = '#C2DDE4';
      const r = s.z * 1.4;
      g.fillRect(s.x + px, s.y + py, r, r);
    }
    g.globalAlpha = 1;
  }
  requestAnimationFrame(frame);
}
