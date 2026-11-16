// Region-complete reward reveal: a dark silhouette of the Numan plushie appears,
// light rays and sparkles build, then one shine reveals the full-color plushie.
// Reduced motion skips straight to the reveal (no rays, sparkles or flash).
import * as THREE from 'three';
import { makeNuman } from '../three/cockpit.js';
import { settings } from '../core/settings.js';
import { sfx } from '../audio/sfx.js';
import { esc } from './dom.js';

const WHERE = {
  mars: 'It now sits on your dashboard.',
  moon: 'It now hangs on your window from a suction cup.',
  deep: 'It now bobbles on a spring on your dash.',
};
const NAME = { mars: 'Mars Numan plushie', moon: 'Moon Numan plushie', deep: 'Deep space Numan plushie' };

/** @returns {Promise<void>} resolves when the player closes it */
export function showReward(region) {
  return new Promise((resolve) => {
    const still = settings.reducedMotion;
    const el = document.createElement('div');
    el.className = `reward ${still ? 'still' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Region complete');
    el.innerHTML = `
      <div class="reward-inner">
        <p class="eyebrow">Region complete</p>
        <h1 class="reward-title">You scanned every machine in ${esc(region.name)}!</h1>
        <div class="reward-stage">
          <div class="reward-rays" aria-hidden="true"></div>
          ${Array.from({ length: 14 }, (_, i) => `<span class="spark" style="--i:${i}" aria-hidden="true"></span>`).join('')}
          <div class="reward-canvas" aria-hidden="true"></div>
        </div>
        <div class="reward-text">
          <p class="eyebrow">Here's your reward</p>
          <p class="reward-name">${NAME[region.id] || 'Numan plushie'}</p>
          <p class="reward-where">${WHERE[region.id] || ''} The Numans made it to say thank you. <span class="tag tag-story">Story</span></p>
          <button class="btn btn-big reward-ok">Awesome!</button>
        </div>
      </div>`;
    document.body.appendChild(el);

    // ---- small 3D stage ----
    const host = el.querySelector('.reward-canvas');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    cam.position.set(0, 1.4, 7.2); cam.lookAt(0, 1.25, 0);
    scene.add(new THREE.HemisphereLight(0xc2dde4, 0x1a1030, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xc2dde4, 2); rim.position.set(-3, 2, -3); scene.add(rim);

    const color = makeNuman(region.id, 1);
    const shadow = makeNuman(region.id, 1);
    const glow = { value: 0 };
    const sil = new THREE.ShaderMaterial({
      uniforms: { uGlow: glow },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uGlow; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(normalize(vN), vV)), 2.); vec3 rimC = mix(vec3(.18,.77,.71), vec3(1.), uGlow*.6); gl_FragColor = vec4(vec3(.02,.03,.08) + rimC * f * (.4 + uGlow*1.6), 1.); }',
    });
    shadow.traverse((o) => { if (o.isMesh) o.material = sil; });
    const stage = new THREE.Group(); stage.add(shadow); stage.add(color); scene.add(stage);
    color.visible = still;
    shadow.visible = !still;

    const resize = () => {
      const w = host.clientWidth || 320; const h = host.clientHeight || 320;
      renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    const t0 = performance.now();
    const REVEAL = 2300;
    let revealed = still;
    let raf = 0;
    if (still) { el.classList.add('revealed'); try { sfx.unlock(); } catch { /* */ } }
    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      const t = (now - t0) / 1000;
      const ms = now - t0;
      if (!still) {
        stage.rotation.y = Math.sin(t * 0.8) * 0.5;
        if (!revealed) {
          // silhouette rises in, then glows brighter as the moment builds
          const k = Math.min(1, ms / 800);
          stage.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - k, 3)));
          glow.value = Math.max(0, (ms - 800) / (REVEAL - 800));
          if (ms > 900) el.classList.add('charging');
          if (ms >= REVEAL) {
            revealed = true;
            shadow.visible = false; color.visible = true;
            el.classList.add('revealed');          // one shine (a single flash, well under 3 per second)
            try { sfx.unlock(); } catch { /* audio not started */ }
          }
        } else {
          // springy pop after the reveal
          const k = Math.min(1, (ms - REVEAL) / 700);
          stage.scale.setScalar(1 + Math.sin(k * Math.PI * 2.5) * 0.12 * (1 - k));
          color.position.y = Math.sin(t * 2) * 0.05;
        }
      }
      renderer.render(scene, cam);
    };
    raf = requestAnimationFrame(frame);

    const close = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('keydown', onKey);
      scene.traverse((o) => { o.geometry?.dispose(); });
      sil.dispose();
      renderer.dispose(); renderer.forceContextLoss?.();
      el.classList.add('closing');
      setTimeout(() => { el.remove(); resolve(); }, still ? 0 : 250);
    };
    const onKey = (e) => { if ((e.key === 'Escape' || e.key === 'Enter') && revealed) { e.preventDefault(); close(); } };
    window.addEventListener('keydown', onKey);
    el.querySelector('.reward-ok').addEventListener('click', close);
    setTimeout(() => el.querySelector('.reward-ok')?.focus(), still ? 0 : REVEAL + 400);
  });
}
