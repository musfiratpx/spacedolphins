// Hardware model viewer. Loads the NASA .glb named in the manifest; if it's not
// downloaded yet, shows a marked placeholder. Phase 2 adds hotspots, scan effect,
// triangle/size logging and fancier lighting.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getModel } from '../core/manifest.js';
import { settings } from '../core/settings.js';

export class HardwareViewer {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    this.camera.position.set(0, 0.6, 4);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.HemisphereLight(0xe8ecf5, 0x0b1026, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 5);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x2ec4b6, 1.6);
    rim.position.set(-4, 2, -4);
    this.scene.add(rim);

    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);

    this.dragging = false;
    this.autoRotate = !settings.reducedMotion;
    this.bindDrag();
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  bindDrag() {
    const el = this.renderer.domElement;
    let lastX = 0; let lastY = 0;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true; this.autoRotate = false;
      lastX = e.clientX; lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      this.pivot.rotation.y += (e.clientX - lastX) * 0.01;
      this.pivot.rotation.x = THREE.MathUtils.clamp(this.pivot.rotation.x + (e.clientY - lastY) * 0.005, -0.8, 0.8);
      lastX = e.clientX; lastY = e.clientY;
    });
    el.addEventListener('pointerup', () => { this.dragging = false; });
    el.addEventListener('pointercancel', () => { this.dragging = false; });
  }

  /** @returns {Promise<{placeholder: boolean}>} */
  async show(modelId) {
    this.clear();
    const { url, placeholder } = getModel(modelId);
    if (placeholder) {
      this.addPlaceholder();
      return { placeholder: true };
    }
    try {
      const gltf = await new GLTFLoader().loadAsync(url);
      if (this.disposed) { disposeObject(gltf.scene); return { placeholder: false }; }
      this.pivot.add(this.fit(gltf.scene));
      return { placeholder: false };
    } catch (err) {
      console.warn(`[viewer] failed to load ${url}; showing placeholder`, err);
      this.addPlaceholder();
      return { placeholder: true };
    }
  }

  fit(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const scale = 2 / Math.max(size.x, size.y, size.z || 1);
    obj.position.sub(center);
    const wrap = new THREE.Group();
    wrap.add(obj);
    wrap.scale.setScalar(scale);
    return wrap;
  }

  addPlaceholder() {
    // Clearly marked stand-in: teal wireframe "probe" shape.
    const group = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0x2ec4b6, wireframe: true, transparent: true, opacity: 0.8 });
    group.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 1), mat));
    const legMat = new THREE.MeshBasicMaterial({ color: 0xa7adba, wireframe: true });
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), legMat);
      const a = (i / 3) * Math.PI * 2;
      leg.position.set(Math.cos(a) * 0.6, -0.7, Math.sin(a) * 0.6);
      leg.rotation.z = Math.cos(a) * 0.5; leg.rotation.x = -Math.sin(a) * 0.5;
      group.add(leg);
    }
    group.userData.placeholder = true;
    this.pivot.add(group);
  }

  clear() {
    for (const child of [...this.pivot.children]) { this.pivot.remove(child); disposeObject(child); }
    this.pivot.rotation.set(0, 0, 0);
  }

  resize() {
    const w = this.container.clientWidth || 300;
    const h = this.container.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  loop() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.autoRotate && !this.dragging) this.pivot.rotation.y += 0.004;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    this.clear();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

function disposeObject(obj) {
  obj.traverse?.((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}
