// "What you're hearing" pop-up: the first time each NASA sound plays, name it and
// say whether it's a real recording or data turned into sound (space is silent).
import { on } from '../core/bus.js';
import { getSound } from '../core/manifest.js';
import { features } from '../core/config.js';
import { esc, tag } from './dom.js';

const KIND = {
  sonification: 'Space is silent. This is real mission data turned into sound.',
  microphone: 'Recorded by a real microphone.',
  recording: 'A real recording.',
  'radio tone': 'A real sound from NASA mission radio.',
};

export function startHearingPopups() {
  const box = document.createElement('aside');
  box.className = 'hearing';
  box.setAttribute('role', 'status');
  box.setAttribute('aria-live', 'polite');
  document.body.appendChild(box);
  let timer = 0;
  on('sample:firstPlay', ({ id }) => {
    if (!features.whatYoureHearing) return;
    const { entry } = getSound(id);
    if (!entry) return;
    box.innerHTML = `<p class="eyebrow">What you're hearing ${tag('real')}</p>
      <p class="hearing-title">${esc(entry.title || id)}</p>
      <p class="hearing-sub">${esc(entry.mission ? `${entry.mission} · ` : '')}${esc(KIND[entry.kind] || 'A NASA sound.')}</p>`;
    box.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => box.classList.remove('show'), 5000);
  });
}
