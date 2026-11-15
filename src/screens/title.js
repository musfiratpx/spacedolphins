// Title: one focal point. The wordmark and a single primary action sit on the
// left third; Earth and its failing shield fill the right third (3D world).
import { wire } from '../ui/dom.js';
import { state } from '../core/state.js';
import { getHardware } from '../core/data.js';

export default {
  mount(el, _params, go) {
    const scanned = Object.keys(state.unlocked).length;
    const total = getHardware().machines.length;
    el.innerHTML = `
      <section class="screen title-screen">
        <div class="title-block">
          <p class="eyebrow t-in" style="--d:0">Year 4052 · Earth's shield is failing</p>
          <h1 class="wordmark t-in" style="--d:1">
            <svg class="logo" viewBox="128 6 384 208" role="img" aria-label="Hardware Hunters 4052">
              <defs>
                <linearGradient id="lg" x1="0" x2="1"><stop offset="0" stop-color="#E8ECF5"/><stop offset="1" stop-color="#2EC4B6"/></linearGradient>
              </defs>
              <circle cx="320" cy="110" r="96" fill="none" stroke="#2EC4B6" stroke-opacity=".25" stroke-width="2"/>
              <circle class="logo-orbit" cx="320" cy="110" r="70" fill="none" stroke="#D9622B" stroke-opacity=".35" stroke-width="2" stroke-dasharray="6 10"/>
              <text x="320" y="98" text-anchor="middle" font-family="Nunito, system-ui" font-weight="900" font-size="58" fill="url(#lg)" letter-spacing="2">HARDWARE</text>
              <text x="320" y="152" text-anchor="middle" font-family="Nunito, system-ui" font-weight="900" font-size="58" fill="url(#lg)" letter-spacing="2">HUNTERS</text>
              <text x="320" y="196" text-anchor="middle" font-family="Space Mono, monospace" font-size="22" fill="#F2B134" letter-spacing="10">4052</text>
            </svg>
          </h1>
          <p class="tagline t-in" style="--d:2">Play the Numans' rhythm games. Shatter asteroids. Scan real NASA machines into the Archive.</p>
          <div class="title-actions t-in" style="--d:3">
            <button class="btn btn-big btn-hero" data-act="start" autofocus>${state.seenIntro ? 'Continue' : 'Start mission'}</button>
            <button class="link-btn" data-go="credits">Credits</button>
          </div>
          ${state.seenIntro ? `<p class="title-progress t-in" style="--d:4"><span class="tp-bar"><span style="width:${Math.round((scanned / total) * 100)}%"></span></span> ${scanned} of ${total} machines in the Archive</p>` : ''}
        </div>
        <p class="title-foot t-in" style="--d:5">🎧 Headphones recommended · Built with NASA 3D Resources and NeoWs data</p>
      </section>`;
    wire(el, go, {
      start: () => go(state.seenIntro ? 'hub' : 'intro'),
    });
  },
};
