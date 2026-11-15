import { wire } from '../ui/dom.js';
import { state } from '../core/state.js';

export default {
  mount(el, _params, go) {
    el.innerHTML = `
      <section class="screen center title-screen">
        <svg class="logo" viewBox="0 0 640 220" role="img" aria-label="Hardware Hunters 4052">
          <defs>
            <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#E8ECF5"/><stop offset="1" stop-color="#2EC4B6"/></linearGradient>
          </defs>
          <circle cx="320" cy="110" r="96" fill="none" stroke="#2EC4B6" stroke-opacity=".25" stroke-width="2"/>
          <circle cx="320" cy="110" r="70" fill="none" stroke="#D9622B" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 10"/>
          <text x="320" y="98" text-anchor="middle" font-family="Nunito, system-ui" font-weight="900" font-size="58" fill="url(#lg)" letter-spacing="2">HARDWARE</text>
          <text x="320" y="152" text-anchor="middle" font-family="Nunito, system-ui" font-weight="900" font-size="58" fill="url(#lg)" letter-spacing="2">HUNTERS</text>
          <text x="320" y="196" text-anchor="middle" font-family="Space Mono, monospace" font-size="22" fill="#F2B134" letter-spacing="10">4052</text>
        </svg>
        <p class="lede">Play the Numans' rhythm games. Shatter asteroids. Scan real NASA machines into the Archive.</p>
        <div class="stack">
          <button class="btn btn-big" data-act="start" autofocus>Start</button>
          <button class="btn btn-ghost" data-go="credits">Credits</button>
        </div>
        <p class="hint">🎧 Headphones recommended</p>
      </section>`;
    wire(el, go, {
      start: () => go(state.seenIntro ? 'hub' : 'intro'),
    });
  },
};
