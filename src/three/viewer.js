// Hardware model viewer. Loads the NASA .glb named in the manifest; if it's not
// downloaded yet, shows a marked placeholder. Adds a hologram pedestal, studio
// lighting, a scan-line reveal on load, and a silhouette mode for machines the
// player hasn't scanned yet. Logs size/triangles; frees GPU memory on close.
import * as THREE from 'three';
import { getGLTFLoader } from './loader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getModel } from '../core/manifest.js';
import { settings } from '../core/settings.js';
import { ORIGINALS } from './originals.js';

const SCAN_SEC = 1.4;

export class HardwareViewer {
  /** @param {HTMLElement} container @param {{pedestal?: boolean, interactive?: boolean, spin?: number}} opts */
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { pedestal: true, interactive: true, spin: 0.004, ...opts };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.92;
    this.renderer.localClippingEnabled = true;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.camera.position.set(0, 0.7, 4.3);
    this.camera.lookAt(0, -0.05, 0);

    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(3, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xc2dde4, 2.4);
    rim.position.set(-4, 2, -4);
    this.scene.add(rim);
    const warm = new THREE.DirectionalLight(0xc9374c, 0.8);
    warm.position.set(4, -1, -3);
    this.scene.add(warm);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    if (this.opts.pedestal) this.addPedestal();

    // scan effect: a clipping plane rises through the model with a glowing ring
    this.clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 10);
    this.scanRing = new THREE.Mesh(
      new THREE.RingGeometry(1.0, 1.25, 64),
      new THREE.MeshBasicMaterial({ color: 0xc2dde4, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.scanRing.rotation.x = -Math.PI / 2;
    this.scanRing.visible = false;
    this.scene.add(this.scanRing);

    this.dragging = false;
    this.autoRotate = !settings.reducedMotion;
    {
      // drag to rotate, scroll/pinch to zoom, right-drag (or two fingers) to pan
      const c = new OrbitControls(this.camera, this.renderer.domElement);
      c.enabled = Boolean(this.opts.interactive);
      c.enableDamping = !settings.reducedMotion;
      c.dampingFactor = 0.08;
      c.minDistance = 0.6;
      c.maxDistance = 9;
      c.zoomSpeed = 0.9;
      c.target.set(0, -0.15, 0);
      c.addEventListener('start', () => { this.dragging = true; this.autoRotate = false; });
      c.addEventListener('end', () => { this.dragging = false; });
      this.renderer.domElement.style.touchAction = this.opts.interactive ? 'none' : 'auto';
      this.controls = c;
    }
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.ro = new ResizeObserver(this.onResize);
    this.ro.observe(container);
    this.resize();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  addPedestal() {
    const g = new THREE.Group();
    const ringMat = (o) => new THREE.MeshBasicMaterial({ color: 0xc2dde4, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    for (const [r1, r2, o] of [[1.15, 1.2, 0.7], [1.32, 1.34, 0.35], [0.5, 1.15, 0.06]]) {
      const m = new THREE.Mesh(new THREE.RingGeometry(r1, r2, 96), ringMat(o));
      m.rotation.x = -Math.PI / 2;
      g.add(m);
    }
    // tick marks around the outer ring
    const ticks = new THREE.Group();
    for (let i = 0; i < 48; i++) {
      const t = new THREE.Mesh(new THREE.PlaneGeometry(0.012, i % 4 ? 0.05 : 0.11), ringMat(0.6));
      const a = (i / 48) * Math.PI * 2;
      t.position.set(Math.cos(a) * 1.42, 0, Math.sin(a) * 1.42);
      t.rotation.set(-Math.PI / 2, 0, -a + Math.PI / 2);
      ticks.add(t);
    }
    g.add(ticks);
    // soft contact shadow under the model, and a faint glow disc around it
    const disc = (inner, outer, color, alpha, blend) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1.4, 64), new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: blend,
        uniforms: { uC: { value: new THREE.Color(color) } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: `uniform vec3 uC; varying vec2 vUv; void main(){ float r = length(vUv-.5)*2.; gl_FragColor = vec4(uC, smoothstep(${outer.toFixed(2)}, ${inner.toFixed(2)}, r) * ${alpha.toFixed(2)}); }`,
      }));
      m.rotation.x = -Math.PI / 2;
      return m;
    };
    const shadow = disc(0.0, 0.7, 0x000000, 0.55, THREE.NormalBlending); shadow.position.y = 0.002; g.add(shadow);
    const glowDisc = disc(0.5, 1.0, 0xc2dde4, 0.18, THREE.AdditiveBlending); glowDisc.position.y = 0.001; g.add(glowDisc);
    g.position.y = -1.05;
    this.ticks = ticks;
    this.pedestal = g;
    this.scene.add(g);
  }

  /**
   * @param {string} modelId
   * @param {{silhouette?: boolean, scan?: boolean}} opts
   * @returns {Promise<{placeholder: boolean}>}
   */
  async show(modelId, opts = {}) {
    const token = (this.token = (this.token || 0) + 1);
    this.clear();
    const { url, placeholder, entry, procedural } = getModel(modelId);
    this.fitOverride = entry?.fit || null;
    if (placeholder) {
      this.addPlaceholder();
      return { placeholder: true };
    }
    try {
      this.container.classList.add('loading');
      const t0 = performance.now();
      const gltf = procedural ? { scene: ORIGINALS[procedural]() } : await getGLTFLoader().loadAsync(url);
      if (this.disposed || token !== this.token) { disposeObject(gltf.scene); return { placeholder: false }; }
      logModel(modelId, gltf.scene, performance.now() - t0);
      if (opts.silhouette) applySilhouette(gltf.scene); else polish(gltf.scene);
      this.model = this.fit(gltf.scene);
      this.pivot.add(this.model);
      if (opts.hotspots?.length) this.addHotspots(opts.hotspots, opts.onHotspot);
      if (opts.scan && !settings.reducedMotion) this.startScan(gltf.scene);
      return { placeholder: false };
    } catch (err) {
      console.warn(`[viewer] failed to load ${url}; showing placeholder`, err);
      this.addPlaceholder();
      return { placeholder: true };
    } finally {
      this.container.classList.remove('loading');
    }
  }

  startScan(obj) {
    obj.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) { m.clippingPlanes = [this.clip]; m.needsUpdate = true; }
    });
    this.scanT0 = this.clock.getElapsedTime();
    this.scanning = true;
    this.scanRing.visible = true;
  }

  fit(obj) {
    const { wrap, bottom } = fitObject(obj, 2, this.fitOverride);
    // feet/wheels rest on the pedestal (never sunk into it)
    wrap.position.y = -1.05 + Math.min(bottom, 2.2);
    return wrap;
  }

  addPlaceholder() {
    // Clearly marked stand-in: teal wireframe "probe" shape.
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xc2dde4, wireframe: true, transparent: true, opacity: 0.8 });
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat));
    const legMat = new THREE.MeshBasicMaterial({ color: 0x9db7c2, wireframe: true });
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), legMat);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.6, -0.7, Math.sin(a) * 0.6);
      leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5;
      group.add(leg);
    }
    group.position.y = 0.1;
    group.userData.placeholder = true;
    this.pivot.add(group);
  }

  /** Pulsing dots on real parts. Found by mesh/node name, or by a spot inside the model's box. */
  addHotspots(list, onPick) {
    this.hotspots = [];
    this.onHotspot = onPick;
    this.pivot.updateMatrixWorld(true);
    const inv = this.pivot.matrixWorld.clone().invert();
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = 'rgba(194,221,228,.25)'; c.beginPath(); c.arc(32, 32, 30, 0, 7); c.fill();
    c.strokeStyle = '#C2DDE4'; c.lineWidth = 5; c.beginPath(); c.arc(32, 32, 18, 0, 7); c.stroke();
    c.fillStyle = '#C2DDE4'; c.beginPath(); c.arc(32, 32, 9, 0, 7); c.fill();
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const whole = new THREE.Box3().setFromObject(this.model);
    list.forEach((h, i) => {
      let point = null;
      if (h.mesh) {
        // repeated parts (4 wheels, 2 panels): put the dot on the FIRST one, not the average
        const re = new RegExp(h.mesh, 'i'); let found = null;
        this.model.traverse((o) => { if (!found && o.name && re.test(o.name)) found = o; });
        if (found) { const box = new THREE.Box3().setFromObject(found); if (!box.isEmpty()) point = box.getCenter(new THREE.Vector3()); }
      } else if (h.at) {
        const size = whole.getSize(new THREE.Vector3());
        point = whole.min.clone().add(new THREE.Vector3(h.at[0] * size.x, h.at[1] * size.y, h.at[2] * size.z));
      }
      if (!point) { console.warn(`[viewer] hotspot "${h.part}" not found`); return; }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
      sp.renderOrder = 10;
      sp.position.copy(point.applyMatrix4(inv));
      sp.scale.setScalar(0.2);
      sp.userData.hotspot = i;
      this.pivot.add(sp);
      this.hotspots.push({ sprite: sp, data: h, index: i });
    });
    if (!this.hotspotClick) {
      // a click (not a drag) on a dot picks it
      const el = this.renderer.domElement; let down = null;
      el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
      el.addEventListener('pointerup', (e) => {
        if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6 || !this.hotspots?.length) return;
        const r = el.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
        const hit = ray.intersectObjects(this.hotspots.map((h) => h.sprite))[0];
        if (hit) this.focusHotspot(hit.object.userData.hotspot);
      });
      this.hotspotClick = true;
    }
    return this.hotspots.map((h) => h.data);
  }

  /** Fly the camera to a part and tell the card which one. */
  focusHotspot(i) {
    const h = this.hotspots?.find((x) => x.index === i);
    if (!h || !this.controls) return;
    this.autoRotate = false;
    const p = h.sprite.getWorldPosition(new THREE.Vector3());
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.flyTo = { target: p, cam: p.clone().add(dir.multiplyScalar(1.7)) };
    this.zoomTo = null;
    this.hotspots.forEach((x) => { x.sprite.material.opacity = x.index === i ? 1 : 0.55; });
    this.onHotspot?.(h.data, i);
  }

  clear() {
    this.hotspots = [];
    this.flyTo = null;
    for (const child of [...this.pivot.children]) { this.pivot.remove(child); disposeObject(child); }
    this.pivot.rotation.set(0, 0, 0);
    this.scanning = false;
    this.scanRing.visible = false;
  }

  resize() {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // narrow panels: back the camera off so the whole pedestal stays in view
    if (!this.framed || !this.controls?.enabled) this.frameHome();
    this.camera.updateProjectionMatrix();
  }

  /** Default camera position for this panel shape. */
  frameHome() {
    const dist = 4.3 * Math.max(1, 1.25 / (this.camera.aspect || 1));
    this.camera.position.set(0, 0.55 + dist * 0.04, dist);
    this.camera.lookAt(0, -0.15, 0);
    this.controls?.target.set(0, -0.15, 0);
    this.framed = true;
  }

  /** Zoom in (factor < 1) or out (> 1) toward the target, smoothly. */
  zoom(factor) {
    const c = this.controls; if (!c) return;
    const off = this.camera.position.clone().sub(c.target);
    const len = THREE.MathUtils.clamp(off.length() * factor, c.minDistance, c.maxDistance);
    this.zoomTo = c.target.clone().add(off.setLength(len));
  }

  reset() { this.autoRotate = !settings.reducedMotion; this.pivot.rotation.set(0, 0, 0); this.frameHome(); this.zoomTo = null; this.flyTo = null; this.hotspots?.forEach((x) => { x.sprite.material.opacity = 1; }); }

  /** Higher resolution while inspecting full screen. */
  setDetail(high) {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.75));
    this.resize();
  }

  loop() {
    if (this.disposed || this.running === false) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    if (this.flyTo && this.controls) {
      const k = settings.reducedMotion ? 1 : 0.1;
      this.controls.target.lerp(this.flyTo.target, k);
      this.camera.position.lerp(this.flyTo.cam, k);
      if (this.camera.position.distanceTo(this.flyTo.cam) < 0.003) this.flyTo = null;
    }
    if (this.hotspots?.length && !settings.reducedMotion) {
      const s = 0.19 + Math.sin(t * 4) * 0.03;
      for (const h of this.hotspots) h.sprite.scale.setScalar(s);
    }
    if (this.zoomTo) {
      this.camera.position.lerp(this.zoomTo, 0.18);
      if (this.camera.position.distanceTo(this.zoomTo) < 0.005) this.zoomTo = null;
    }
    this.controls?.update();
    if (this.autoRotate && !this.dragging) this.pivot.rotation.y += this.opts.spin;
    if (this.ticks && !settings.reducedMotion) this.ticks.rotation.y = -t * 0.15;
    if (this.scanning) {
      const k = Math.min(1, (t - this.scanT0) / SCAN_SEC);
      const y = -1.1 + k * 2.4;
      this.clip.constant = y;            // plane keeps everything below y
      this.scanRing.position.y = y;
      this.scanRing.material.opacity = 0.8 * (1 - k * 0.6);
      if (k >= 1) { this.scanning = false; this.scanRing.visible = false; this.clip.constant = 100; }
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Move this viewer into another container (reuses the WebGL context: no hitch). */
  attach(container, opts = {}) {
    this.opts = { ...this.opts, ...opts };
    this.container = container;
    container.appendChild(this.renderer.domElement);
    this.ro.disconnect(); this.ro.observe(container);
    this.controls.enabled = Boolean(this.opts.interactive);
    this.renderer.domElement.style.touchAction = this.opts.interactive ? 'none' : 'auto';
    this.setDetail(false);
    this.framed = false; this.zoomTo = null;
    this.autoRotate = !settings.reducedMotion;
    this.resize();
    if (!this.running) { this.running = true; this.raf = requestAnimationFrame(this.loop); }
  }

  /** Park the viewer: stop drawing and free the model, keep the context for next time. */
  detach() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.token = (this.token || 0) + 1;      // cancel any model still loading
    this.clear();
    this.renderer.domElement.remove();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.ro.disconnect();
    this.controls?.dispose();
    this.clear();
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

/**
 * Same framing for every machine: fit the main BODY to `target` units, so long thin
 * booms and antennas (Voyager, Cassini, InSight) don't shrink the machine to a speck.
 * @returns {{ wrap: THREE.Group, height: number }}
 */
export function fitObject(obj, target = 2, fitOverride = null) {
  obj.updateMatrixWorld(true);
  const all = new THREE.Box3().setFromObject(obj);
  const allSize = all.getSize(new THREE.Vector3());
  const allMax = Math.max(allSize.x, allSize.y, allSize.z) || 1;
  // sample vertex positions (world space) and take the 5th–95th percentile on each axis:
  // that's where the body is; thin booms have few vertices and fall outside it
  const xs = []; const ys = []; const zs = []; const v = new THREE.Vector3();
  let total = 0;
  obj.traverse((o) => { if (o.isMesh) total += o.geometry.attributes.position.count; });
  const stride = Math.max(1, Math.floor(total / 30000));
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += stride) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      xs.push(v.x); ys.push(v.y); zs.push(v.z);
    }
  });
  const pct = (arr, q) => { arr.sort((a, b) => a - b); return arr[Math.min(arr.length - 1, Math.floor(q * arr.length))]; };
  let center; let span;
  if (xs.length > 50) {
    const lo = new THREE.Vector3(pct(xs, 0.05), pct(ys, 0.05), pct(zs, 0.05));
    const hi = new THREE.Vector3(pct(xs, 0.95), pct(ys, 0.95), pct(zs, 0.95));
    center = lo.clone().add(hi).multiplyScalar(0.5);
    const core = hi.clone().sub(lo);
    span = Math.max(Math.max(core.x, core.y, core.z) * 1.55, allMax * 0.55);
  } else {
    center = all.getCenter(new THREE.Vector3());
    span = allMax;
  }
  // per-model framing from the manifest ("fit": fraction of the full size to frame)
  if (fitOverride) { span = allMax * fitOverride; center = all.getCenter(new THREE.Vector3()); }
  const scale = target / span;
  obj.position.sub(center);
  const wrap = new THREE.Group();
  wrap.add(obj);
  wrap.scale.setScalar(scale);
  // distance from the model's center down to its lowest point (feet/wheels) after scaling
  return { wrap, height: (center.y - all.min.y) * scale * 2, bottom: (center.y - all.min.y) * scale };
}

/** Make NASA models read well: double-sided thin parts, crisp textures, gentle env reflections. */
export function polish(obj) {
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      m.side = THREE.DoubleSide;
      if (m.map) m.map.anisotropy = 8;
      if ('envMapIntensity' in m) m.envMapIntensity = 1.1;
      // fully metallic, perfectly smooth parts look black without a detailed sky; soften them
      if (m.metalness > 0.9 && m.roughness < 0.2) m.roughness = 0.3;
      // pure-white untextured surfaces blow out under studio light; tame them so shape reads
      if (!m.map && m.color) {
        const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
        if (lum > 0.8) m.color.multiplyScalar(0.8 / lum);
        if (m.roughness !== undefined && m.roughness < 0.35 && m.metalness < 0.5) m.roughness = 0.45;
      }
    }
  });
}

/** Replace every material with a dark body + teal rim: the "unscanned" look. */
export function applySilhouette(obj) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uRim: { value: new THREE.Color(0xc2dde4) } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
    fragmentShader: 'uniform vec3 uRim; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1. - abs(dot(normalize(vN), vV)), 2.5); gl_FragColor = vec4(mix(vec3(0.03,0.05,0.12), uRim, f), 1.); }',
    side: THREE.DoubleSide,
  });
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const old = Array.isArray(o.material) ? o.material : [o.material];
    old.forEach((m) => { for (const val of Object.values(m)) if (val?.isTexture) val.dispose(); m.dispose(); });
    o.material = mat;
  });
}

function logModel(id, obj, ms) {
  let tris = 0;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  console.info(`[viewer] ${id}: ${Math.round(tris).toLocaleString()} triangles, loaded in ${Math.round(ms)} ms`);
}

export function disposeObject(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const val of Object.values(m)) if (val && val.isTexture) val.dispose();
      m.dispose();
    }
  });
}

// One shared viewer for the pre-round silhouette and the hardware card, so moving
// between screens never creates a new WebGL context or re-bakes the lighting.
let shared = null;
export function acquireViewer(container, opts = {}) {
  if (!shared || shared.disposed) shared = new HardwareViewer(container, opts);
  else shared.attach(container, opts);
  shared.running = true;
  return shared;
}
export function releaseViewer() { shared?.detach(); }
