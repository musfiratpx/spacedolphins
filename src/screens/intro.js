// Radio intro: Mission Control's lines typed onto the radio display.
// Any key or tap finishes the current line; a second press goes to the next.
import { sfx } from '../audio/sfx.js';
import { state, save } from '../core/state.js';
import { emit } from '../core/bus.js';
import { settings } from '../core/settings.js';
import { esc, tag } from '../ui/dom.js';

let cleanup = null;

export default {
  async mount(el, _params, go) {
    const radio = await (await fetch('data/radio.json', { cache: 'no-store' })).json();
    const lines = radio.intro;
    el.innerHTML = `
      <section class="screen center intro-screen">
        <div class="radio panel" aria-live="polite">
          <div class="radio-head"><span class="led"></span><span>MISSION CONTROL · CH 4052</span><span class="radio-count"></span></div>
          <p class="radio-who"></p>
          <p class="radio-text"></p>
          <div class="radio-foot"><span class="hint">Press any key or tap to continue</span></div>
        </div>
        <button class="btn btn-ghost skip">Skip intro</button>
      </section>`;
    const who = el.querySelector('.radio-who');
    const text = el.querySelector('.radio-text');
    const count = el.querySelector('.radio-count');
    let i = 0; let typing = null; let full = '';

    const finish = () => {
      clearTimeout(typing); typing = null;
      state.seenIntro = true; save();
      go('hub');
    };

    function show(n) {
      const line = lines[n];
      sfx.static(0.22);
      who.innerHTML = `${esc(line.who)} ${tag(line.tag || 'story')}`;
      count.textContent = `${n + 1}/${lines.length}`;
      full = line.text;
      text.textContent = '';
      emit('radio:line', line);
      let c = 0;
      const step = () => {
        if (c >= full.length) { typing = null; return; }
        const ch = full[c++];
        text.textContent += ch;
        if (ch !== ' ' && c % 2) sfx.type();
        // pause briefly at commas and periods
        const delay = settings.reducedMotion ? 8 : ch === '.' || ch === '!' || ch === '?' ? 260 : ch === ',' ? 140 : 26;
        typing = setTimeout(step, delay);
      };
      step();
    }

    const advance = (e) => {
      if (e?.target?.closest?.('.skip')) return;
      if (typing) { clearTimeout(typing); typing = null; text.textContent = full; return; }
      i++;
      if (i >= lines.length) finish(); else show(i);
    };
    const onKey = (e) => { if (['Tab', 'Shift', 'Alt', 'Control', 'Meta', 'F2', 'F3'].includes(e.key)) return; e.preventDefault(); advance(); };

    el.querySelector('.skip').addEventListener('click', finish);
    el.querySelector('.intro-screen').addEventListener('pointerdown', advance);
    window.addEventListener('keydown', onKey);
    cleanup = () => { clearTimeout(typing); window.removeEventListener('keydown', onKey); };
    show(0);
  },
  unmount() { cleanup?.(); cleanup = null; },
};
