// Ship tour: a spotlight walks through every hub button the first time you reach
// the hub. "Skip tour" (or Esc) ends it at any step. Replay it from Settings.
import { esc } from './dom.js';
import { settings } from '../core/settings.js';
import { state, save } from '../core/state.js';

const STEPS = [
  { sel: null, title: 'Welcome aboard!', text: 'This is your ship hub. Let me show you what every button does. It takes about a minute.' },
  { sel: '.explore', title: 'Where to?', text: 'Pick a place to explore. Each one has a rhythm round and four real NASA machines to scan.' },
  { sel: '.region:not(.locked)', title: 'Start here', text: 'Click a region, choose a machine and a difficulty, then play the round.' },
  { sel: '.shield-meter', title: "Earth's shield", text: 'Clearing rounds makes the shield stronger. Failing a round weakens it a little. You can always try again.' },
  { sel: '.archive-meter', title: 'Archive', text: 'How many machines you have scanned so far. Try to collect them all!' },
  { sel: '[data-go="dex"]', title: 'Hardwaredex', text: 'Every machine you scanned, with its 3D model, its story and real photos it took.' },
  { sel: '[data-go="map"]', title: 'Map', text: 'See where each machine is today, on the Moon, on Mars or far out in space.' },
  { sel: '[data-go="records"]', title: 'Records', text: 'Replay the songs you have unlocked, just to listen.' },
  { sel: '[data-go="radiolog"]', title: 'Radio log', text: 'Every radio message from your crew, saved so you can read it again.' },
  { sel: '.side [data-act="tutorial"]', title: 'How to play', text: 'Forgot the keys? This shows how the rhythm rounds work.' },
  { sel: '.side [data-act="settings"]', title: 'Settings', text: 'Volume, note speed, audio timing, easier one-lane mode, reduced motion and an easy-read font.' },
  { sel: '#music-toggle', title: 'Music on or off', text: 'Turns the background music on the menus on or off.' },
  { sel: '#help-toggle', title: 'Need help?', text: 'This button opens How to play from any screen. Good luck, Hunter!' },
];

let active = null;

export function startTour({ onDone } = {}) {
  active?.end(false);
  let i = 0;
  const shade = document.createElement('div');
  shade.className = 'tour';
  shade.innerHTML = '<div class="tour-spot" aria-hidden="true"></div><div class="tour-card" role="dialog" aria-live="polite"></div>';
  document.body.appendChild(shade);
  const spot = shade.querySelector('.tour-spot');
  const card = shade.querySelector('.tour-card');

  const visible = (el) => el && el.getBoundingClientRect().width > 0;
  const place = () => {
    const s = STEPS[i];
    const target = s.sel ? document.querySelector(s.sel) : null;
    if (!visible(target)) {
      spot.style.cssText = 'left:50%;top:50%;width:0;height:0;';
      card.style.cssText = `left:50%;top:50%;transform:translate(-50%,-50%);width:${Math.min(360, window.innerWidth - 32)}px;max-height:${window.innerHeight - 24}px;overflow-y:auto;`;
      return;
    }
    target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const r = target.getBoundingClientRect(); const pad = 8;
    spot.style.cssText = `left:${r.left - pad}px;top:${r.top - pad}px;width:${r.width + pad * 2}px;height:${r.height + pad * 2}px;`;
    // card below the target if there's room, else above; kept on screen
    const cw = Math.min(360, window.innerWidth - 32);
    let left = Math.max(16, Math.min(window.innerWidth - cw - 16, r.left + r.width / 2 - cw / 2));
    // measure the card, then put it below the target, else above, else wherever it fits:
    // always fully on screen (never cut off at the top)
    card.style.cssText = `left:${left}px;width:${cw}px;top:0;visibility:hidden;`;
    const ch = card.offsetHeight; const vh = window.innerHeight; const gap = 18; const edge = 12;
    let top;
    if (r.bottom + gap + ch <= vh - edge) top = r.bottom + gap;
    else if (r.top - gap - ch >= edge) top = r.top - gap - ch;
    else {
      // no room above or below: sit beside the target (right side first), centred on it
      top = Math.max(edge, Math.min(vh - ch - edge, r.top + r.height / 2 - ch / 2));
      if (r.right + gap + cw <= window.innerWidth - edge) left = r.right + gap;
      else if (r.left - gap - cw >= edge) left = r.left - gap - cw;
    }
    card.style.cssText = `left:${left}px;width:${cw}px;top:${Math.round(top)}px;max-height:${vh - edge * 2}px;overflow-y:auto;`;
  };
  const render = () => {
    const s = STEPS[i];
    const last = i === STEPS.length - 1;
    card.innerHTML = `
      <p class="eyebrow">Ship tour · ${i + 1} of ${STEPS.length}</p>
      <h2>${esc(s.title)}</h2>
      <p>${esc(s.text)}</p>
      <div class="tut-nav">
        <button class="link-btn" data-tour="skip">${last ? '' : 'Skip tour'}</button>
        <span class="tut-nav-r">
          ${i ? '<button class="btn btn-ghost btn-small" data-tour="back">←</button>' : ''}
          <button class="btn btn-small" data-tour="next">${last ? "Let's go!" : 'Next →'}</button>
        </span>
      </div>`;
    if (last) card.querySelector('[data-tour="skip"]').remove();
    place();
    card.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  };
  const end = (finished = true) => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', place);
    shade.classList.add('closing');
    setTimeout(() => shade.remove(), settings.reducedMotion ? 0 : 180);
    state.seenTour = true; save();
    active = null;
    if (finished !== false) onDone?.();
  };
  const step = (d) => { i += d; if (i >= STEPS.length) { end(); return; } i = Math.max(0, i); render(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); end(); }
    else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); step(-1); }
  };
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('resize', place);
  shade.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tour]')?.dataset.tour;
    if (t === 'next') step(1); else if (t === 'back') step(-1); else if (t === 'skip') end();
  });
  active = { end };
  render();
}
