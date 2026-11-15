// Radio transmissions as an overlay: typed captions on the ship's radio, static
// between lines, any key or tap to continue, optional read-aloud. Used for region
// briefings, scan confirmations and the radio log.
import { sfx } from '../audio/sfx.js';
import { settings } from '../core/settings.js';
import { emit } from '../core/bus.js';
import { esc, tag } from './dom.js';

function speak(text) {
  if (!settings.readAloud || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.volume = Math.min(1, settings.volumes.radio * settings.volumes.master * 1.1);
  speechSynthesis.speak(u);
}

/** @param {{who:string, tag:string, text:string}[]} lines @returns {Promise<void>} */
export function playRadio(lines, { title = 'Incoming transmission' } = {}) {
  return new Promise((resolve) => {
    if (!lines?.length) { resolve(); return; }
    const el = document.createElement('div');
    el.className = 'radio-overlay';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <div class="radio panel" aria-live="polite">
        <div class="radio-head"><span class="led"></span><span>${esc(title.toUpperCase())}</span><span class="radio-count"></span></div>
        <div class="radio-wave" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <p class="radio-who"></p>
        <p class="radio-text"></p>
        <div class="radio-foot"><span class="hint">Press any key or tap to continue</span><button class="btn btn-ghost btn-small radio-skip">Skip</button></div>
      </div>`;
    document.body.appendChild(el);
    const who = el.querySelector('.radio-who'); const text = el.querySelector('.radio-text'); const count = el.querySelector('.radio-count');
    let i = 0; let typing = null; let full = '';
    const done = () => {
      clearTimeout(typing);
      window.removeEventListener('keydown', onKey, true);
      try { speechSynthesis.cancel(); } catch { /* */ }
      el.classList.add('closing');
      setTimeout(() => { el.remove(); resolve(); }, settings.reducedMotion ? 0 : 200);
    };
    const show = (n) => {
      const line = lines[n];
      try { sfx.static(0.18); } catch { /* audio not started */ }
      who.innerHTML = `${esc(line.who)} ${tag(line.tag || 'story')}`;
      count.textContent = `${n + 1}/${lines.length}`;
      full = line.text; text.textContent = '';
      el.classList.add('talking');
      emit('radio:line', line);
      speak(line.text);
      let c = 0;
      const step = () => {
        if (c >= full.length) { typing = null; el.classList.remove('talking'); return; }
        const ch = full[c++];
        text.textContent += ch;
        if (ch !== ' ' && c % 2) { try { sfx.type(); } catch { /* */ } }
        const delay = settings.reducedMotion ? 6 : ch === '.' || ch === '!' || ch === '?' ? 220 : ch === ',' ? 120 : 22;
        typing = setTimeout(step, delay);
      };
      step();
    };
    const advance = () => {
      if (typing) { clearTimeout(typing); typing = null; text.textContent = full; el.classList.remove('talking'); return; }
      i++;
      if (i >= lines.length) done(); else show(i);
    };
    const onKey = (e) => {
      if (['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Escape') done(); else advance();
    };
    el.addEventListener('pointerdown', (e) => { if (e.target.closest('.radio-skip')) { done(); return; } advance(); });
    window.addEventListener('keydown', onKey, true);
    show(0);
  });
}
