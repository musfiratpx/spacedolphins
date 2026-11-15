// Record Library: replay songs you've finished and learn about the real NASA
// sounds inside each one. Uses the same sequencer as the rounds (audio clock).
import { wire, esc, tag } from '../ui/dom.js';
import { getHardware, loadSong } from '../core/data.js';
import { state } from '../core/state.js';
import { getSound } from '../core/manifest.js';
import { Sequencer } from '../audio/sequencer.js';
import { prepareSong } from '../audio/sampler.js';
import { barSeconds, expandScore } from '../audio/score.js';
import { unlockAudio, getAudioTime } from '../audio/clock.js';
import { emit } from '../core/bus.js';

const KIND = {
  sonification: 'Space is silent, so this is real mission data turned into sound.',
  microphone: 'Recorded by a real microphone.',
  recording: 'A real recording.',
  'radio tone': 'A real sound from NASA mission radio.',
};
const ROLE = {
  backbone: 'Keeps the beat', pad: 'Sets the mood', lead: 'Plays the melody', riser: 'Builds energy', hats: 'Adds sparkle',
};

let player = null;   // { seq, raf, songId }

function stop() {
  if (!player) return;
  emit('records:play', false);
  player.seq.stop();
  cancelAnimationFrame(player.raf);
  player = null;
}

function finishedSongs() {
  const done = new Set(Object.keys(state.best || {}).map((k) => k.split(':')[0]));
  return done;
}

function soundCard(id, role, sectionNote) {
  const { entry, placeholder } = getSound(id);
  if (!entry) return '';
  return `<li class="rec-sound ${placeholder ? 'missing' : ''}">
    <div class="rec-sound-head"><b>${esc(entry.title || id)}</b> ${tag('real')}</div>
    <p>${esc(entry.mission ? `${entry.mission}. ` : '')}${esc(KIND[entry.kind] || 'A NASA sound.')}</p>
    <p class="muted">${esc(role)}${sectionNote ? ` · ${esc(sectionNote)}` : ''}${placeholder ? ' · Not downloaded yet' : ''}</p>
    ${entry.source ? `<a href="${esc(entry.source)}" target="_blank" rel="noopener">NASA source ↗</a>` : ''}
  </li>`;
}

async function trackListing(song) {
  const { sections } = expandScore(song);
  const where = (track) => sections.filter((s) => song.sections.find((x) => x.name === s.name)?.play?.[track]).map((s) => s.name);
  const nasa = [];
  const synths = [];
  for (const [id, inst] of Object.entries(song.instruments || {})) {
    if (inst.type.startsWith('sample.')) {
      nasa.push(soundCard(inst.type.split('.')[1], ROLE[inst.role] || 'Layer', `plays in: ${where(id).join(', ')}`));
    } else {
      synths.push(`<li><b>${esc(id[0].toUpperCase() + id.slice(1))}</b> <span class="muted">· ${esc(ROLE[inst.role] || inst.role)} · synth made in code</span></li>`);
    }
  }
  const db = song.dataBreak;
  if (db) {
    const chosen = [db.sample, db.fallbackSample].find((s) => s && !getSound(s).placeholder);
    if (chosen) nasa.unshift(soundCard(chosen, 'Data break: the beat drops out and you play the recording\'s peaks', `bars ${db.startBar}–${db.startBar + db.bars - 1}`));
  }
  return { nasa: nasa.join(''), synths: synths.join('') };
}

export default {
  async mount(el, _params, go) {
    const { regions } = getHardware();
    const done = finishedSongs();
    el.innerHTML = `
      <section class="screen records-screen">
        <header class="hub-head">
          <div><p class="eyebrow">Record Library</p><h1>Songs you've played</h1></div>
          <button class="btn btn-ghost" data-go="hub">← Hub</button>
        </header>
        <p class="hint">Finish a song in a round to add it here. Every track hides real NASA sounds.</p>
        <div class="rec-list"></div>
      </section>`;
    const list = el.querySelector('.rec-list');
    for (const r of regions) {
      const has = done.has(r.song);
      let song = null;
      if (has) { try { song = await loadSong(r.song); } catch { song = null; } }
      const item = document.createElement('article');
      item.className = `panel rec ${song ? '' : 'locked'}`;
      item.style.setProperty('--accent', r.color);
      if (!song) {
        item.innerHTML = `<div class="rec-disc" aria-hidden="true"></div><div><h2>???</h2><p class="muted">${esc(r.name)} · ${r.lockedText ? esc(r.lockedText) : 'Finish this region\'s song to add it'}</p></div>`;
        list.appendChild(item);
        continue;
      }
      const len = expandScore(song).lengthSec;
      const { nasa, synths } = await trackListing(song);
      item.innerHTML = `
        <div class="rec-top">
          <button class="rec-disc" data-act="play" data-song="${esc(song.id)}" aria-label="Play ${esc(song.title)}"><span class="rec-icon">▶</span></button>
          <div class="rec-info">
            <h2>${esc(song.title)}</h2>
            <p class="muted">${esc(r.name)} · ${song.bpm} BPM · ${Math.round(len)} s</p>
            <div class="rec-bar" aria-hidden="true"><div class="rec-fill"></div></div>
            <p class="rec-now muted" aria-live="polite">Press play</p>
          </div>
        </div>
        <h3>Real NASA sounds in this track</h3>
        <ul class="rec-sounds">${nasa || '<li class="muted">None yet</li>'}</ul>
        <details><summary>Instruments made in code</summary><ul class="rec-synths">${synths}</ul></details>`;
      list.appendChild(item);
    }

    wire(el, go, {
      play: async (btn) => {
        const id = btn.dataset.song;
        const card = btn.closest('.rec');
        const wasThis = player?.songId === id;
        stop();
        el.querySelectorAll('.rec').forEach((c) => c.classList.remove('playing'));
        el.querySelectorAll('.rec-icon').forEach((i) => { i.textContent = '▶'; });
        if (wasThis) return;
        await unlockAudio();
        const song = await loadSong(id);
        const prep = await prepareSong(song, barSeconds(song));
        const seq = new Sequencer(song, prep);
        seq.start(getAudioTime() + 0.15);
        const { sections } = expandScore(song);
        player = { seq, songId: id, raf: 0 };
        emit('records:play', true);
        card.classList.add('playing');
        btn.querySelector('.rec-icon').textContent = '❚❚';
        const fill = card.querySelector('.rec-fill');
        const now = card.querySelector('.rec-now');
        const tick = () => {
          if (!player || player.seq !== seq) return;
          const pos = seq.position();
          const p = Math.max(0, Math.min(1, pos / seq.lengthSec));
          fill.style.width = `${(p * 100).toFixed(1)}%`;
          const sec = [...sections].reverse().find((s) => pos >= s.startSec);
          now.textContent = pos < 0 ? 'Starting…' : sec ? `Now playing: ${sec.name}` : '';
          if (!seq.running) { stop(); card.classList.remove('playing'); btn.querySelector('.rec-icon').textContent = '▶'; now.textContent = 'Finished. Play again?'; return; }
          player.raf = requestAnimationFrame(tick);
        };
        tick();
      },
    });
  },
  unmount() { stop(); },
};
