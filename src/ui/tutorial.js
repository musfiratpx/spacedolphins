// "How to play": a short illustrated walkthrough. Opens from the ? button (every
// screen except rounds), the title screen, the hub and once before the first round.
import { esc, tag } from './dom.js';
import { settings } from '../core/settings.js';
import { judging } from '../core/config.js';

const lane = (shape) => `<svg viewBox="0 0 120 120" class="tut-art" aria-hidden="true">
  <rect x="20" y="4" width="80" height="112" rx="10" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="3"/>
  <line x1="20" y1="92" x2="100" y2="92" stroke="currentColor" stroke-width="4"/>
  ${shape === 'circle' ? '<circle cx="60" cy="50" r="17" fill="var(--mars)"/>' : '<rect x="47" y="37" width="26" height="26" transform="rotate(45 60 50)" fill="var(--teal)"/>'}
  <path d="M60 72 v10 m-6 -6 l6 6 l6 -6" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`;

const STEPS = [
  { title: 'Two lanes', kind: 'real', art: `<div class="tut-pair">${lane('circle')}${lane('diamond')}</div>`,
    text: 'Notes slide down two lanes. Left notes are circles. Right notes are diamonds.' },
  { title: 'Your keys', kind: 'real', art: '<p class="tut-keys"><kbd>A</kbd> <kbd>←</kbd> left · right <kbd>D</kbd> <kbd>→</kbd></p>',
    text: 'Press A or ← for the left lane, D or → for the right. On a phone or tablet, tap the lane.' },
  { title: 'Hit on the line', kind: 'real', art: '<p class="tut-keys"><span class="tut-j p">Perfect</span> <span class="tut-j g">Great</span> <span class="tut-j">Good</span> <span class="tut-j m">Miss</span></p>',
    text: 'Press just as a note touches the line. The closer you are, the better your score. Way too early or late is a Miss.' },
  { title: 'Long notes', kind: 'real', art: '<p class="tut-keys"><kbd class="tut-hold">hold</kbd></p>',
    text: 'Some notes have a tail. Keep the key held down until the tail ends.' },
  { title: 'Numan pulse', kind: 'story', art: '<p class="tut-keys">◎ ◎ ◎</p>',
    text: 'Perfect and Great hits fill the Numan meter. When it is full, a pulse shatters an asteroid and doubles your points for a while.' },
  { title: 'Scan a machine', kind: 'real', art: '<p class="tut-keys">📡 → 🗂️</p>',
    text: `Clear the round to scan a real NASA machine. You need ${Math.round(judging.clear.easy * 100)}% accuracy on Easy, ${Math.round(judging.clear.normal * 100)}% on Normal and Hard.` },
  { title: 'Tips', kind: 'real', art: '<p class="tut-keys"><kbd>Esc</kbd> pause</p>',
    text: 'Esc pauses. If hits feel late, open ⚙ Settings in the hub and try the Audio offset or a slower note speed.' },
];

export function openTutorial({ onClose } = {}) {
  document.querySelector('.tutorial')?.remove();
  let i = 0;
  const el = document.createElement('div');
  el.className = 'paper-view tutorial';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'How to play');
  document.body.appendChild(el);
  const render = () => {
    const s = STEPS[i];
    el.innerHTML = `
      <div class="paper-card tut-card">
        <button class="tool paper-x" aria-label="Close">✕</button>
        <p class="eyebrow">How to play · ${i + 1} of ${STEPS.length}</p>
        <div class="tut-stage">${s.art}</div>
        <h2>${esc(s.title)} ${tag(s.kind)}</h2>
        <p>${esc(s.text)}</p>
        <div class="tut-nav">
          <span class="tut-nav-l">
            <button class="btn btn-ghost btn-small" data-t="back" ${i === 0 ? 'disabled' : ''}>← Back</button>
            ${i < STEPS.length - 1 ? '<button class="link-btn" data-t="skip">Skip tutorial</button>' : ''}
          </span>
          <span class="tut-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
          <button class="btn btn-small" data-t="next">${i === STEPS.length - 1 ? 'Got it!' : 'Next →'}</button>
        </div>
      </div>`;
    el.querySelector('[data-t="next"]').focus();
  };
  const close = () => {
    window.removeEventListener('keydown', onKey, true);
    el.classList.add('closing');
    setTimeout(() => { el.remove(); onClose?.(); }, settings.reducedMotion ? 0 : 180);
  };
  const go = (d) => { i += d; if (i >= STEPS.length) { close(); return; } i = Math.max(0, i); render(); };
  const onKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go(-1); }
  };
  window.addEventListener('keydown', onKey, true);
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('.paper-x')) close();
    const t = e.target.closest('[data-t]')?.dataset.t;
    if (t === 'next') go(1); if (t === 'back') go(-1); if (t === 'skip') close();
  });
  render();
}
