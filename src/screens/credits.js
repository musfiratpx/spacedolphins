import { wire, esc } from '../ui/dom.js';
import { getManifest } from '../core/manifest.js';
import { getHardware } from '../core/data.js';

export default {
  mount(el, _params, go) {
    const man = getManifest();
    const models = Object.entries(man.models || {});
    const sounds = Object.entries(man.sounds || {});
    const { machines } = getHardware();
    el.innerHTML = `
      <section class="screen credits-screen">
        <header class="hub-head">
          <div><p class="eyebrow">Credits</p><h1>Hardware Hunters 4052</h1></div>
          <button class="btn" data-go="title">← Title</button>
        </header>
        <div class="panel credits">
          <h2>About this game</h2>
          <p><b>Who it's for:</b> space fans ages 10 to 14 (and anyone curious). Short text, plain words, game first.</p>
          <p><b>Three points of view:</b> you, the Recovery Traveler; the machines themselves, telling their real stories in their own words; and the Numans, who talk to you over the radio.</p>
          <p><b>How we check facts:</b> every card fact comes from the NASA page linked on it. Facts are tagged ${'<span class="tag tag-real">Real</span>'}; the year 4052, the Numans and the asteroid danger are tagged ${'<span class="tag tag-story">Story</span>'}. Anything we haven't confirmed yet says so.</p>
          <p><b>Ways to play:</b> keyboard, mouse or touch; one-lane mode; captions on every radio line; read-aloud for radio and machine logs; an easy-read font; reduced motion (no shaking, flashing or sweeping effects); adjustable note speed and audio offset.</p>
          <h2>Team</h2>
          <p>Space Dolphins · NASA Space Apps Challenge 2026</p>
          <h2>NASA data</h2>
          <ul>
            <li>3D models: <a href="https://science.nasa.gov/3d-resources/" target="_blank" rel="noopener">NASA 3D Resources</a></li>
            <li>Asteroids: <a href="https://api.nasa.gov/" target="_blank" rel="noopener">NASA NeoWs API</a> (real asteroids in the hub and the asteroid field)</li>
            ${machines.map((m) => `<li>${esc(m.name)}: <a href="${esc(m.source)}" target="_blank" rel="noopener">NASA mission page</a></li>`).join('')}
          </ul>
          <h2>Models</h2>
          <ul>${models.map(([id, m]) => `<li>${esc(m.title || id)}: ${esc(m.credit || 'NASA')} ${m.present ? '' : '<span class="muted">(not downloaded yet)</span>'}</li>`).join('') || '<li>None yet</li>'}</ul>
          <h2>Sounds</h2>
          <ul>${sounds.map(([id, s]) => `<li>${esc(s.title || id)}: ${esc(s.credit || 'NASA')} ${s.present ? '' : '<span class="muted">(not downloaded yet)</span>'}</li>`).join('') || '<li>None yet</li>'}</ul>
          <h2>Music</h2>
          <p>All music is written as code for this game and played with Web Audio synths, with real NASA sounds layered in (listed above). No vocals.</p>
          <h2>Code and fonts</h2>
          <ul>
            <li>Three.js (MIT License)</li>
            <li>Nunito and Space Mono (SIL Open Font License)</li>
          </ul>
          <p class="muted">NASA does not endorse this game. Real hardware facts are tagged "Real"; the year 4052, the Numans and the asteroid threat are "Story".</p>
        </div>
      </section>`;
    wire(el, go);
  },
};
