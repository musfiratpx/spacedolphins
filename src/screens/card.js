// Hardware card: 3D model + fixed card fields.
import { wire, esc, tag } from '../ui/dom.js';
import { getMachine } from '../core/data.js';
import { state } from '../core/state.js';
import { HardwareViewer } from '../three/viewer.js';
import { getModel } from '../core/manifest.js';

let viewer = null;
let onKey = null;

function field(label, value, kind = 'real') {
  if (!value) return '';
  const todo = String(value).includes('TODO_VERIFY');
  return `<div class="field ${todo ? 'todo' : ''}"><dt>${label} ${tag(kind)}</dt><dd>${esc(value)}</dd></div>`;
}

export default {
  async mount(el, params, go) {
    const m = getMachine(params.id);
    const u = state.unlocked[m.id];
    const tags = m.tags || {};
    const { entry } = getModel(m.model);
    el.innerHTML = `
      <section class="screen card-screen">
        <header class="hub-head">
          <div><p class="eyebrow">${params.fresh ? 'New in the Archive' : 'Hardwaredex'}</p><h1>${esc(m.name)}</h1></div>
          <div class="stack row">
            <button class="btn btn-ghost" data-go="dex">Hardwaredex</button>
            <button class="btn" data-go="hub">Hub</button>
          </div>
        </header>
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
              ${field('How it worked', m.howItWorked, tags.howItWorked || 'real')}
              ${field('What it found', m.found, tags.found || 'real')}
              ${field(`Status today${m.statusAsOf ? ` (as of ${m.statusAsOf})` : ''}`, m.status, 'real')}
              ${m.numanNote ? field('Numan note', m.numanNote, 'story') : ''}
            </dl>
            <p class="source"><a href="${esc(m.source)}" target="_blank" rel="noopener">NASA record ↗</a>${u ? ` <span class="muted">· Scanned ${esc(u.date)}</span>` : ''}</p>
          </div>
        </div>
      </section>`;
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
    });
    onKey = (e) => { if (e.key === 'Escape' && wrap.classList.contains('inspecting')) setInspect(false); };
    window.addEventListener('keydown', onKey);
    viewer = new HardwareViewer(el.querySelector('.viewer'));
    const { placeholder } = await viewer.show(m.model, { scan: true });
    if (placeholder) el.querySelector('.viewer-note')?.classList.remove('hidden');
  },
  unmount() {
    viewer?.dispose(); viewer = null;
    document.body.classList.remove('inspect-open');
    if (onKey) window.removeEventListener('keydown', onKey);
    onKey = null;
  },
};
