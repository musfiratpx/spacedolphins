// Hardware card: the machine's story. 3D model + fact fields, a status line
// (still talking / quiet since / monument), the machine's own log typed out
// (with read-aloud), and "Send a hello": a signal with the real light-travel time.
import { wire, esc, tag } from '../ui/dom.js';
import { getMachine, getHardware } from '../core/data.js';
import { state, save } from '../core/state.js';
import { settings } from '../core/settings.js';
import { acquireViewer, releaseViewer } from '../three/viewer.js';
import { getModel } from '../core/manifest.js';
import { sfx } from '../audio/sfx.js';
import { loadRadio } from '../core/data.js';

let viewer = null;
let onKey = null;
let timers = [];

function field(label, value, kind = 'real') {
  if (value == null || value === '') return '';
  const todo = String(value).includes('TODO_VERIFY');
  // unverified facts stay marked, but kids see a friendly line instead of a code word
  const shown = todo ? 'Still being fact-checked by our team.' : value;
  return `<div class="field ${todo ? 'todo' : ''}" ${todo ? 'data-todo="TODO_VERIFY"' : ''}><dt>${label} ${tag(kind)}</dt><dd>${esc(shown)}</dd></div>`;
}

function statusLine(m) {
  if (m.alive) return `<p class="status-chip alive"><span class="pulse" aria-hidden="true"></span> Still talking to Earth</p>`;
  if (m.monument) return `<p class="status-chip monument">🗿 Left in place as a monument since ${esc(m.quietSince)}</p>`;
  if (m.quietSince) return `<p class="status-chip quiet">💤 Quiet since ${esc(m.quietSince)}</p>`;
  return '';
}

function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.pitch = 1;
  u.volume = Math.min(1, (settings.volumes.radio ?? 0.9) * (settings.volumes.master ?? 0.9) * 1.1);
  speechSynthesis.speak(u);
  return true;
}

export default {
  async mount(el, params, go) {
    const m = getMachine(params.id);
    const u = state.unlocked[m.id];
    const tags = m.tags || {};
    const { entry } = getModel(m.model);
    const sig = m.signal ? getHardware().signals?.[m.signal] : null;
    const hellos = state.hellos?.[m.id] || 0;
    el.innerHTML = `
      <section class="screen card-screen">
        <header class="hub-head">
          <div><p class="eyebrow">${params.fresh ? 'New in the Archive' : 'Hardwaredex'}</p><h1>${esc(m.name)}</h1>${statusLine(m)}</div>
          <div class="stack row">
            <button class="btn btn-ghost" data-go="dex">Hardwaredex</button>
            <button class="btn" data-go="hub">Hub</button>
          </div>
        </header>
        ${params.fresh ? '<p class="radio-strip on card-radio" aria-live="polite"><span class="led"></span><span class="rs-who"></span> <span class="rs-text"></span></p>' : ''}
        <div class="card-grid">
          <div class="panel viewer-wrap" data-tilt="off">
            <div class="viewer" aria-label="3D model of ${esc(m.name)}. Drag to rotate, scroll or pinch to zoom."></div>
            <div class="viewer-tools" role="toolbar" aria-label="Model controls">
              <button class="tool" data-act="zoomIn" aria-label="Zoom in">＋</button>
              <button class="tool" data-act="zoomOut" aria-label="Zoom out">－</button>
              <button class="tool" data-act="reset" aria-label="Reset view">⟲</button>
              <button class="tool tool-wide" data-act="inspect" aria-pressed="false">⤢ Inspect</button>
            </div>
            <p class="viewer-note hidden">Model placeholder: download <code>${esc(entry?.file || m.model)}</code> from NASA 3D Resources.</p>
            <p class="hint">Drag to rotate · scroll or pinch to zoom · right-drag to move</p>
          </div>
          <div class="panel card-fields">
            <dl>
              ${field('Where it is', `${m.place}${m.lat != null ? ` (${m.lat}°, ${m.lon}°)` : ''}`, 'real')}
              ${field('Arrived', m.arrived, 'real')}
              ${field('Why it was sent', m.why, tags.why || 'real')}
              ${field('How it worked · the engineering', m.howItWorked, tags.howItWorked || 'real')}
              ${field('What it found · the science', m.found, tags.found || 'real')}
              ${field(`Status today${m.statusAsOf ? ` (as of ${m.statusAsOf})` : ''}`, m.status, 'real')}
              ${m.numanNote ? field('Numan note', m.numanNote, 'story') : ''}
            </dl>
            <p class="source"><a href="${esc(m.source)}" target="_blank" rel="noopener">NASA record ↗</a>${u ? ` <span class="muted">· Scanned ${esc(u.date)}</span>` : ''}</p>
          </div>
        </div>

        <div class="story-grid">
          ${m.log?.length ? `
          <article class="panel machine-log" aria-label="In its own words">
            <header class="log-head">
              <h2>In its own words ${tag('real')}</h2>
              <button class="tool tool-wide" data-act="readAloud" aria-label="Read the log aloud">🔊 Read aloud</button>
            </header>
            <p class="log-note muted">Written as if ${esc(m.name)} could talk. Every event really happened.</p>
            <ol class="log-lines">${m.log.map((l) => `<li data-full="${esc(l)}"><span class="log-text"></span></li>`).join('')}</ol>
          </article>` : ''}

          <article class="panel hello" aria-label="Send a hello">
            <h2>Send a hello</h2>
            <div class="hello-track" aria-hidden="true">
              <span class="hello-end earth">🌍<small>Earth</small></span>
              <span class="hello-line"><span class="hello-dot"></span></span>
              <span class="hello-end machine">${m.alive ? '📡' : m.monument ? '🗿' : '💤'}<small>${esc(m.short || m.name)}</small></span>
            </div>
            <p class="hello-time">${sig ? `A radio signal takes <b>${esc(sig.text)}</b> to get there. ${tag('real')}` : 'It is very far from Earth.'}</p>
            <button class="btn" data-act="hello">Send a hello</button>
            <p class="hello-reply" aria-live="polite"></p>
            <p class="hint hello-count">${hellos ? `You've sent ${hellos} hello${hellos === 1 ? '' : 's'} to ${esc(m.name)}.` : ''}</p>
          </article>
        </div>
      </section>`;

    // ---- machine log: typed out line by line (instant with reduced motion) ----
    const lines = [...el.querySelectorAll('.log-lines li')];
    const typeLine = (i) => {
      if (i >= lines.length) return;
      const li = lines[i]; const span = li.querySelector('.log-text'); const full = li.dataset.full;
      li.classList.add('shown');
      if (settings.reducedMotion) { span.textContent = full; typeLine(i + 1); return; }
      let c = 0;
      const step = () => {
        span.textContent = full.slice(0, ++c);
        if (c < full.length) timers.push(setTimeout(step, 18));
        else timers.push(setTimeout(() => typeLine(i + 1), 380));
      };
      step();
    };
    timers.push(setTimeout(() => typeLine(0), 600));
    if (params.fresh) {
      loadRadio().then((radio) => {
        const line = radio.scanned?.[0]; const strip = el.querySelector('.card-radio');
        if (!line || !strip) return;
        const text = line.text.replace('{short}', m.short || m.name).replace('{place}', m.place);
        strip.querySelector('.rs-who').innerHTML = `${esc(line.who)}: ${tag(line.tag)}`;
        const t = strip.querySelector('.rs-text'); let c = 0;
        const step = () => { if (!t.isConnected) return; t.textContent = text.slice(0, ++c); if (c < text.length) timers.push(setTimeout(step, 20)); };
        timers.push(setTimeout(step, 300));
      }).catch(() => {});
    }

    // ---- send a hello ----
    const helloBtn = el.querySelector('[data-act="hello"]');
    const reply = el.querySelector('.hello-reply');
    const dot = el.querySelector('.hello-dot');
    const sendHello = () => {
      helloBtn.disabled = true;
      reply.textContent = '';
      // the Moon trip plays in real time; farther ones are sped up so you don't wait a day
      const realMs = sig ? sig.seconds * 1000 : 3000;
      const showMs = Math.min(realMs, 2600);
      dot.style.transition = 'none'; dot.style.left = '0%'; dot.classList.add('on');
      void dot.offsetWidth;
      dot.style.transition = `left ${settings.reducedMotion ? 0 : showMs}ms linear`;
      dot.style.left = '100%';
      try { sfx.click(); } catch { /* audio not started */ }
      timers.push(setTimeout(() => {
        dot.classList.remove('on');
        state.hellos ||= {};
        state.hellos[m.id] = (state.hellos[m.id] || 0) + 1; save();
        const n = state.hellos[m.id];
        el.querySelector('.hello-count').textContent = `You've sent ${n} hello${n === 1 ? '' : 's'} to ${m.name}.`;
        const sped = realMs > showMs ? ' (sped up for you)' : ' (that was real time!)';
        if (m.alive) {
          reply.innerHTML = `Arrived${esc(sped)}. ${esc(m.name)} is still working, and its signals still reach Earth. ${tag('real')}`;
          try { sfx.hit('perfect'); } catch { /* */ }
        } else {
          reply.innerHTML = `Arrived${esc(sped)}. ${esc(m.name)} can't answer anymore${m.quietSince ? `. It went quiet in ${esc(m.quietSince)}` : ''}. ${tag('real')} The Numans say it heard you anyway. ${tag('story')}`;
          try { sfx.back(); } catch { /* */ }
        }
        helloBtn.disabled = false;
      }, settings.reducedMotion ? 50 : showMs + 120));
    };

    const wrap = el.querySelector('.viewer-wrap');
    const setInspect = (on) => {
      document.getElementById('app').scrollTop = 0;
      wrap.classList.toggle('inspecting', on);
      document.body.classList.toggle('inspect-open', on);
      const b = el.querySelector('[data-act="inspect"]');
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '✕ Close' : '⤢ Inspect';
      viewer?.setDetail(on);
      viewer?.reset();
    };
    wire(el, go, {
      zoomIn: () => viewer?.zoom(0.7),
      zoomOut: () => viewer?.zoom(1.4),
      reset: () => viewer?.reset(),
      inspect: () => setInspect(!wrap.classList.contains('inspecting')),
      readAloud: (b) => {
        if (speechSynthesis?.speaking) { speechSynthesis.cancel(); b.textContent = '🔊 Read aloud'; return; }
        if (speak(m.log.join(' '))) { b.textContent = '⏹ Stop'; const u2 = speechSynthesis; const iv = setInterval(() => { if (!u2.speaking) { b.textContent = '🔊 Read aloud'; clearInterval(iv); } }, 400); timers.push(iv); }
        else b.textContent = 'Not supported here';
      },
      hello: sendHello,
    });
    onKey = (e) => { if (e.key === 'Escape' && wrap.classList.contains('inspecting')) setInspect(false); };
    window.addEventListener('keydown', onKey);
    viewer = acquireViewer(el.querySelector('.viewer'), { interactive: true, spin: 0.004 });
    const { placeholder } = await viewer.show(m.model, { scan: true });
    if (placeholder) el.querySelector('.viewer-note')?.classList.remove('hidden');
  },
  unmount() {
    releaseViewer(); viewer = null;
    document.body.classList.remove('inspect-open');
    if (onKey) window.removeEventListener('keydown', onKey);
    onKey = null;
    timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = [];
    try { speechSynthesis.cancel(); } catch { /* not supported */ }
  },
};
