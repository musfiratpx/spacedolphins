import { Round } from '../rhythm/round.js';
import { loadSong, getRegion, getMachine } from '../core/data.js';
import { esc, tag } from '../ui/dom.js';
import { prepareSong } from '../audio/sampler.js';
import { barSeconds } from '../audio/score.js';

let round = null;

export default {
  async mount(el, params, go) {
    const region = getRegion(params.region || 'mars');
    // never a blank wait: show a real fact about the target while sounds load
    const m = getMachine(params.machine);
    const fact = m && !String(m.found).includes('TODO') ? m.found : null;
    el.innerHTML = `<section class="screen center loading-screen"><div class="panel loading-card">
      <p class="eyebrow">Tuning to the Numan frequency…</p>
      ${fact ? `<p class="loading-fact"><b>Did you know?</b> ${tag('real')}<br>${esc(fact)}</p>` : ''}
      <div class="gauge"><div class="gauge-fill"></div></div></div></section>`;
    const song = await loadSong(region.song);
    const prep = await prepareSong(song, barSeconds(song));   // loads the NASA sounds this song uses
    el.innerHTML = '';
    const wrap = document.createElement('section');
    wrap.className = 'screen round-screen';
    el.appendChild(wrap);
    round = new Round(wrap, {
      song,
      prep,
      difficulty: params.difficulty,
      onEnd: (result) => go('results', { ...params, result }),
      onQuit: (why) => (why === 'restart' ? go('round', params) : go('hub')),
    });
    await round.start();
  },
  unmount() {
    if (round && !round.ended) round.destroy();
    round = null;
  },
};
