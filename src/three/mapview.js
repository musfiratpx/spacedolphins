// "Where are they now?" globe: the Moon or Mars (NASA textures) with a pin at each
// machine's real landing coordinates. Teal pins still talk to Earth, gray pins are
// quiet, amber pins are monuments. Drag to spin, scroll to zoom, click a pin.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { getManifest } from '../core/manifest.js';
import { settings } from '../core/settings.js';

const PIN_COLOR = { alive: 0x5be38f, quiet: 0x9db7c2, monument: 0xc9374c };   // green = still active as of 2026

/** lat/lon (degrees) -> point on a THREE.SphereGeometry-mapped globe (texture centered on 0° lon). */
export function latLonToVec(lat, lon, r) {
  const phi = THREE.MathUtils.degToRad(lon + 180);
  const theta = THREE.MathUtils.degToRad(90 - lat);
  return new THREE.Vector3(-Math.cos(phi) * Math.sin(theta) * r, Math.cos(theta) * r, Math.sin(phi) * Math.sin(theta) * r);
}

export class MapView {
  constructor(container, onPick) {
    this.container = container; this.onPick = onPick;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(0, 1, 5.4);
    this.scene.add(this.camera);
    this.scene.add(new THREE.AmbientLight(0x8090c0, 0.5));
    // the light rides with the camera, so whichever side you turn to is lit
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.3); sun.position.set(1.5, 1.2, 0.5); this.camera.add(sun);
    sun.target.position.set(0, 0, -5); this.camera.add(sun.target);
    this.globe = new THREE.Group(); this.scene.add(this.globe);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !settings.reducedMotion; this.controls.enablePan = false;
    this.controls.minDistance = 2.6; this.controls.maxDistance = 8;
    this.controls.autoRotate = !settings.reducedMotion; this.controls.autoRotateSpeed = 0.6;
    this.renderer.domElement.style.touchAction = 'none';
    this.pins = [];
    this.texLoader = new THREE.TextureLoader();
    // click (not drag) picks a pin
    let down = null;
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const ray = new THREE.Raycaster(); ray.setFromCamera(ndc, this.camera);
      const hit = ray.intersectObjects(this.pins.map((p) => p.hit))[0];
      if (hit) this.focus(hit.object.userData.machine.id, true);
    });
    this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(container);
    window.__hhMap = this;   // debugging/testing
    this.resize();
    this.clock = new THREE.Clock();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  /** Show a body ('moon' | 'mars') with pins for the given machines. */
  setBody(body, machines) {
    for (const c of [...this.globe.children]) { this.globe.remove(c); c.traverse?.((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); }
    this.pins = []; this.orbiter = null;
    const entry = getManifest().textures?.[body];
    const map = entry?.file ? this.texLoader.load(entry.file) : null;
    if (map) { map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; }
    const R = 1.2;
    this.globe.add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0x888888, roughness: 1 })));
    for (const m of machines) {
      if (m.lat == null || m.lon == null) {
        if (m.id === 'lro') this.addOrbiter(m, R);
        continue;
      }
      const kind = m.alive ? 'alive' : m.monument ? 'monument' : 'quiet';
      const pos = latLonToVec(m.lat, m.lon, R);
      const n = pos.clone().normalize();
      const pin = new THREE.Group();
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.1, 6), new THREE.MeshBasicMaterial({ color: 0xc2dde4 }));
      stick.position.y = 0.05; pin.add(stick);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshBasicMaterial({ color: PIN_COLOR[kind] }));
      head.position.y = 0.105; pin.add(head);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.026, 0.036, 24), new THREE.MeshBasicMaterial({ color: PIN_COLOR[kind], transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002; pin.add(ring);
      // invisible, bigger target so pins are easy to click on touch screens
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = 0.09; hit.userData.machine = m; pin.add(hit);
      pin.position.copy(pos);
      pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      this.globe.add(pin);
      this.pins.push({ machine: m, pin, ring, kind, hit, normal: n });
    }
  }

  addOrbiter(m, R) {
    const path = new THREE.Mesh(new THREE.TorusGeometry(R * 1.35, 0.004, 6, 120), new THREE.MeshBasicMaterial({ color: 0xc2dde4, transparent: true, opacity: 0.5 }));
    path.rotation.x = Math.PI / 2.2; this.globe.add(path);
    const sat = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: PIN_COLOR.alive }));
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.userData.machine = m; sat.add(hit);
    this.globe.add(sat);
    this.orbiter = { sat, path, R: R * 1.35 };
    this.pins.push({ machine: m, pin: sat, hit, kind: 'alive', orbit: true });
  }

  /** Turn the globe so a machine faces the camera, and report it. */
  focus(id, fromClick = false) {
    const p = this.pins.find((x) => x.machine.id === id);
    if (!p) return;
    this.controls.autoRotate = false;
    // swing AROUND the globe (rotate the view direction) instead of cutting through it
    const to = p.pin.getWorldPosition(new THREE.Vector3()).normalize();
    const from = this.camera.position.clone().normalize();
    this.flyTo = { from, q: new THREE.Quaternion().setFromUnitVectors(from, to), dist: this.camera.position.length(), t0: performance.now() };
    this.selected = id;
    this.onPick?.(p.machine, fromClick);
  }

  resize() {
    const w = this.container.clientWidth || 300; const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const t = this.clock.getElapsedTime();
    if (this.flyTo) {
      const f = this.flyTo;
      const k = settings.reducedMotion ? 1 : Math.min(1, (performance.now() - f.t0) / 1100);
      const e = k * k * (3 - 2 * k);
      const q = new THREE.Quaternion().slerp(f.q, e);
      this.camera.position.copy(f.from).applyQuaternion(q).multiplyScalar(f.dist);
      if (k >= 1) this.flyTo = null;
    }
    for (const p of this.pins) {
      if (p.ring && p.kind === 'alive' && !settings.reducedMotion) { const s = 1 + (t * 0.8 % 1) * 1.6; p.ring.scale.setScalar(s); p.ring.material.opacity = 1 - (t * 0.8 % 1); }
      if (p.pin.children[1] && !p.orbit) p.pin.children[1].scale.setScalar(this.selected === p.machine.id ? 1.45 : 1);
    }
    if (this.orbiter && !settings.reducedMotion) {
      const a = t * 0.5; const { R } = this.orbiter;
      const v = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R).applyEuler(this.orbiter.path.rotation);
      this.orbiter.sat.position.copy(v);
    } else if (this.orbiter) this.orbiter.sat.position.set(this.orbiter.R, 0, 0);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.ro.disconnect(); this.controls.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    this.renderer.dispose(); this.renderer.forceContextLoss?.(); this.renderer.domElement.remove();
  }
}
