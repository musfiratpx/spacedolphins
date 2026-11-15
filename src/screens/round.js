import { Round } from '../rhythm/round.js';
import { loadSong, getRegion } from '../core/data.js';

let round = null;

export default {
  async mount(el, params, go) {
    const region = getRegion(params.region || 'mars');
    const song = await loadSong(region.song);
    const wrap = document.createElement('section');
    wrap.className = 'screen round-screen';
    el.appendChild(wrap);
    round = new Round(wrap, {
      song,
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
