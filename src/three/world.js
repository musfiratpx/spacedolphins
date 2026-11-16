// The 3D world behind every screen: real stars, a nebula, Earth with its failing
// shield, the Moon, Mars with Phobos and Deimos, drifting asteroids and a
// detailed first-person cockpit. Planet textures and the asteroid shape are NASA's
// (see assets/manifest.json). The camera glides to a new "shot" on every screen
// change. Everything respects settings.reducedMotion.
//
// Performance: the nebula noise is rendered ONCE into a texture; resolution adapts
// to the frame rate (dynamic resolution); rounds render the background lighter so
// the note highway always gets the frame budget.
import * as THREE from 'three';
import { Cockpit } from './cockpit.js';
import { settings } from '../core/settings.js';
import { on } from '../core/bus.js';
import { getManifest } from '../core/manifest.js';
import { getAsteroids } from '../core/data.js';
import { makeRockGeometry, makeRockMaterial, sizeFromDiameter } from './asteroids.js';
import { getGLTFLoader } from './loader.js';
import { getModel } from '../core/manifest.js';
import { fitObject, polish } from './viewer.js';

const EARTH = new THREE.Vector3(0, 0, 0);
const MOON = new THREE.Vector3(-7, 1.4, -9);
const MARS = new THREE.Vector3(70, -3, -50);
const DEEP = new THREE.Vector3(-90, 14, -140);
const REGION_CENTER = { moon: MOON, mars: MARS, deep: DEEP };
const REGION_RADIUS = { moon: 0.6, mars: 1, deep: 1.4 };

const NEBULA = {
  earth: [0x0b1f3a, 0x1c2a6b],
  moon: [0x0d0f17, 0x3a3f4d],
  mars: [0x1a0c0a, 0x6b2a14],
  deep: [0x0c0820, 0x3b2370],
};

const v = (x, y, z) => new THREE.Vector3(x, y, z);

// Title screen: open sky (side-lit by the Sun) with three real NASA machines floating
// on the right, instead of Earth. Earth stays the centre of the hub and the story.
const TITLE_POS = v(-6, 1.5, 16);
const TITLE_DIR = v(-0.63, 0.06, 0.77).normalize();
const TITLE_TARGET = TITLE_POS.clone().addScaledVector(TITLE_DIR, 10);
const SHOWCASE = [
  // [model, size, right, up, forward, spin]
  ['voyager', 1.25, 1.35, 0.42, 3.7, 0.05],
  ['opportunity', 0.78, 1.95, -0.62, 3.2, -0.08],
  ['ingenuity', 0.55, 0.62, -0.52, 2.7, 0.12],
];

/** Camera shot for a screen. */
function shotFor(id, params = {}) {
  const region = params.region || 'mars';
  const c = REGION_CENTER[region] || MARS;
  const r = REGION_RADIUS[region] ?? 1;
  switch (id) {
    case 'title':   return { pos: TITLE_POS.clone(), target: TITLE_TARGET.clone(), nebula: 'deep', asteroids: TITLE_POS, rocks: 4 };
    case 'intro':   return { pos: v(0.1, 0.1, 3.4), target: v(0, -0.35, 0), cockpit: true, nebula: 'earth', asteroids: EARTH };
    // Earth centred and low in the window, framed between the two hub panels
    case 'hub':     return { pos: v(0, 0.2, 6.4), target: v(0, 0.75, 0), cockpit: true, nebula: 'earth', asteroids: EARTH };
    case 'preround':return { pos: c.clone().add(v(0, r * 1.5, r * 2.6 + 0.6)), target: c.clone().add(v(0, r * 1.35, -1)), nebula: region, asteroids: c, depth: 10 };
    case 'round':   return { pos: c.clone().add(v(0, r * 1.18 + 0.05, r * 1.9 + 0.3)), target: c.clone().add(v(0, r * 1.3 + 0.1, -2)), nebula: region, asteroids: c, depth: 10, lite: true };
    case 'results': return { pos: c.clone().add(v(r * 2.2 + 0.5, r * 0.4, r * 2.6 + 1)), target: c.clone(), nebula: region, asteroids: c };
    case 'card':    return { rocks: 0, pos: c.clone().add(v(-r * 2.6 - 1, r * 0.6, r * 3 + 1.4)), target: c.clone().add(v(-r * 3.2 - 1.2, 0, 0)), nebula: region, asteroids: c };
    // reading screens look out at open sky (away from planets and the Sun) so text stays clear
    case 'dex':     return { pos: v(0, 0.5, 12), target: v(-22, 9, 30), nebula: 'deep', asteroids: EARTH, rocks: 0 };
    default:        return { pos: v(0, 0.5, 12), target: v(-18, 4, 34), nebula: 'earth', asteroids: EARTH, rocks: 0 };
  }
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.01, 2000);
    this.scene.add(this.camera);
    this.clock = new THREE.Clock();
    this.pulse = 0;
    this.mouse = new THREE.Vector2();
    this.mouseS = new THREE.Vector2();      // smoothed pointer (no jitter)
    this.camPos = TITLE_POS.clone();
    this.camTarget = TITLE_TARGET.clone();
    this.glide = null;
    this.texLoader = new THREE.TextureLoader();
    this.dynScale = 1;          // dynamic resolution multiplier
    this.lite = false;          // lighter background during rounds
    this.frameTimes = [];
    this._fwd = new THREE.Vector3(); this._look = new THREE.Vector3();   // reused every frame (no garbage)
    this._qTravel = new THREE.Quaternion(); this._qLook = new THREE.Quaternion();

    this.buildLights();
    this.buildSky();
    this.buildEarth();
    this.buildMoon();
    this.buildMars();
    this.buildGiant();
    this.buildAsteroids();
    // The cockpit renders in its own small pass (own camera + lights), so its interior
    // lights never cost anything for the planets, and the pass is skipped when hidden.
    this.cockpitScene = new THREE.Scene();
    this.cockpitCam = new THREE.PerspectiveCamera(45, 1, 0.01, 50);
    this.cockpitScene.add(this.cockpitCam);
    this.cockpitScene.add(new THREE.AmbientLight(0x6070b0, 0.5));
    const cSun = new THREE.DirectionalLight(0xfff4e0, 1.4); cSun.position.set(2, 3, 1); this.cockpitScene.add(cSun);
    this.cockpit = new Cockpit(this.renderer, this.cockpitCam);
    this.cockpitShow = 0;
    this.cockpitWant = 0;
    this.showcaseReady = this.buildShowcase();

    on('beat', () => { this.pulse = 1; });
    // poke things in the cockpit (plushies, mug, screens...) when clicking open window, never UI
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    const UI = 'button, a, input, select, textarea, summary, label, dialog, .panel, .neo-strip, .reward, .radio-overlay, .hearing, .round';
    const pick = (e) => {
      if (this.cockpitShow < 0.9 || !this.cockpit.pokeables.length || e.target.closest?.(UI)) return null;
      this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.cockpitCam);
      for (const hit of this.ray.intersectObjects(this.cockpit.pokeables, true)) {
        let o = hit.object; while (o && !o.userData.poke) o = o.parent;
        if (o) return o;
      }
      return null;
    };
    window.addEventListener('pointerdown', (e) => { const o = pick(e); if (o) this.cockpit.poke(o); });
    let hoverBusy = false;
    window.addEventListener('pointermove', (e) => {
      if (hoverBusy) return; hoverBusy = true;
      setTimeout(() => { hoverBusy = false; }, 70);   // ~14 checks a second is plenty
      document.body.classList.toggle('can-poke', Boolean(pick(e)));
    }, { passive: true });
    window.addEventListener('pointermove', (e) => {
      this.mouse.set(e.clientX / window.innerWidth - 0.5, e.clientY / window.innerHeight - 0.5);
    });
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.setShot('title', {}, true);
    this.lastNow = performance.now();
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ---- building ------------------------------------------------------------
  tex(id, srgb = true) {
    const entry = getManifest().textures?.[id];
    if (!entry?.file) return null;
    const t = this.texLoader.load(entry.file, undefined, undefined,
      () => console.warn(`[world] texture ${id} missing (${entry.file})`));
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }

  buildLights() {
    this.sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
    this.sun.position.set(6, 2.5, 5);
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0x4a5a99, 0.25));
    const g = document.createElement('canvas'); g.width = g.height = 128;
    const c = g.getContext('2d');
    const grad = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,250,235,1)'); grad.addColorStop(0.15, 'rgba(255,230,190,.8)'); grad.addColorStop(1, 'rgba(255,200,150,0)');
    c.fillStyle = grad; c.fillRect(0, 0, 128, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(g), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sprite.position.copy(this.sun.position).normalize().multiplyScalar(600);
    sprite.scale.setScalar(70);
    this.scene.add(sprite);
  }

  /** Render the nebula noise once into an equirectangular texture. */
  bakeNebula() {
    const rt = new THREE.WebGLRenderTarget(1024, 512, { type: THREE.UnsignedByteType });
    const mat = new THREE.ShaderMaterial({
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }',
      fragmentShader: `
        varying vec2 vUv;
        float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
        float n(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
        float fbm(vec3 p){ float a=.5, s=0.; for(int k=0;k<6;k++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
        void main(){
          // same direction mapping as THREE.SphereGeometry's UVs
          float phi = vUv.x * 6.2831853; float th = (1. - vUv.y) * 3.1415927;
          vec3 d = vec3(-cos(phi)*sin(th), cos(th), sin(phi)*sin(th));
          vec3 p = d * 2.6;
          float m = fbm(p + fbm(p*1.7));
          float band = exp(-pow(d.y*2.2 + 0.25*sin(d.x*3.), 2.));
          float k = smoothstep(.35, .95, m) * (.35 + .9*band);
          gl_FragColor = vec4(k, band, 0., 1.);
        }`,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    const sc = new THREE.Scene(); sc.add(quad);
    const cam = new THREE.Camera();
    this.renderer.setRenderTarget(rt);
    this.renderer.render(sc, cam);
    this.renderer.setRenderTarget(null);
    quad.geometry.dispose(); mat.dispose();
    return rt;
  }

  buildSky() {
    this.nebulaRT = this.bakeNebula();
    this.nebulaUniforms = {
      uMap: { value: this.nebulaRT.texture },
      uA: { value: new THREE.Color(NEBULA.earth[0]) },
      uB: { value: new THREE.Color(NEBULA.earth[1]) },
    };
    this.scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, uniforms: this.nebulaUniforms,
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
        fragmentShader: 'uniform sampler2D uMap; uniform vec3 uA, uB; varying vec2 vUv; void main(){ vec2 kb = texture2D(uMap, vUv).rg; gl_FragColor = vec4(mix(uA, uB, kb.r) + vec3(.02,.03,.06)*kb.g, 1.); }',
      }),
    ));

    // Stars: one Points cloud, per-star size and twinkle phase.
    const count = settings.quality === 'low' ? 2500 : 6000;
    const pos = new Float32Array(count * 3);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    const col = new Float32Array(count * 3);
    const tint = [new THREE.Color(0xc2dde4), new THREE.Color(0xbfd4ff), new THREE.Color(0xffe2c0), new THREE.Color(0x9ff5ec)];
    for (let i = 0; i < count; i++) {
      const u = Math.random() * 2 - 1; const t = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const rr = 500 + Math.random() * 300;
      pos.set([Math.cos(t) * s * rr, u * rr, Math.sin(t) * s * rr], i * 3);
      size[i] = Math.pow(Math.random(), 6) * 7 + 1.2;
      phase[i] = Math.random() * 6.28;
      const c = tint[Math.random() < 0.8 ? 0 : 1 + Math.floor(Math.random() * 3)];
      col.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starUniforms = { uTime: { value: 0 }, uPulse: { value: 0 }, uStill: { value: 0 }, uPR: { value: 1 } };
    this.scene.add(new THREE.Points(geo, new THREE.ShaderMaterial({
      uniforms: this.starUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `
        attribute float aSize; attribute float aPhase; varying float vA; varying vec3 vC;
        uniform float uTime, uPulse, uStill, uPR;
        void main(){
          vC = color;
          float tw = mix(.65 + .35*sin(uTime*(1.+aSize*.3) + aPhase), .85, uStill);
          vA = tw + uPulse*.25;
          gl_PointSize = aSize * uPR * (1. + uPulse*.15);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.);
        }`,
      fragmentShader: `
        varying float vA; varying vec3 vC;
        void main(){ vec2 d = gl_PointCoord - .5; float r = length(d);
          float a = smoothstep(.5, 0., r); a *= a; gl_FragColor = vec4(vC, a * vA); }`,
    })));
  }

  atmosphere(radius, color, power = 3, strength = 1.2) {
    return new THREE.Mesh(
      new THREE.SphereGeometry(radius, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color(color) }, uPow: { value: power }, uStr: { value: strength } },
        vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
        // Back faces of a slightly larger sphere: d is 0 at the halo's outer edge and
        // grows toward the planet's limb, so the glow fades smoothly outward.
        fragmentShader: 'uniform vec3 uColor; uniform float uPow, uStr; varying vec3 vN; varying vec3 vV; void main(){ float d = clamp(-dot(vN, vV) * 2.4, 0., 1.); gl_FragColor = vec4(uColor, pow(d, uPow) * uStr); }',
      }),
    );
  }

  buildEarth() {
    this.earth = new THREE.Group();
    const map = this.tex('earth');
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 40),
      new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0x2a5aa0, roughness: 0.7, metalness: 0 }),
    );
    globe.rotation.z = 0.41;          // axial tilt
    this.earthGlobe = globe;
    this.earth.add(globe);
    this.earth.add(this.atmosphere(1.09, 0x5aa8ff, 1.6, 1.1));

    // The failing shield (Story): a geodesic lattice that shimmers softly.
    this.shield = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.16, 3)),
      new THREE.LineBasicMaterial({ color: 0xc2dde4, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.earth.add(this.shield);
    this.shieldSegments = this.shield.geometry.attributes.position.count;
    this.shieldLevel = 0.5;
    this.earth.add(this.atmosphere(1.2, 0xc2dde4, 3, 0.35));
    this.earth.position.copy(EARTH);
    this.scene.add(this.earth);
  }

  /** Three NASA models floating on the title screen. Resolves when loaded (or failed). */
  async buildShowcase() {
    this.showcase = new THREE.Group();
    this.scene.add(this.showcase);
    const right = new THREE.Vector3().crossVectors(TITLE_DIR, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, TITLE_DIR).normalize();
    const fill = new THREE.DirectionalLight(0xc2dde4, 0.9);       // soft fill from the camera side
    fill.position.copy(TITLE_POS).addScaledVector(right, -4).addScaledVector(up, 2);
    fill.target.position.copy(TITLE_POS).addScaledVector(TITLE_DIR, 3);
    this.showcase.add(fill, fill.target);
    await Promise.all(SHOWCASE.map(async ([id, size, r, u, f, spin], i) => {
      const { url } = getModel(id);
      if (!url) return;
      try {
        const gltf = await getGLTFLoader().loadAsync(url);
        polish(gltf.scene);
        gltf.scene.traverse((o) => {
          if (!o.isMesh) return;
          for (const m of Array.isArray(o.material) ? o.material : [o.material]) { m.envMap = this.cockpit.env; m.envMapIntensity = 0.7; }
        });
        const { wrap } = fitObject(gltf.scene, size);
        const holder = new THREE.Group();
        holder.add(wrap);
        holder.position.copy(TITLE_POS).addScaledVector(TITLE_DIR, f).addScaledVector(right, r).addScaledVector(up, u);
        holder.rotation.set(0.25 * (i - 1), i * 2.1 + 0.6, 0.15 * i);
        holder.userData = { spin, bob: i * 1.7, y: holder.position.y };
        this.showcase.add(holder);
      } catch (err) { console.warn(`[world] showcase model ${id} failed`, err); }
    }));
  }

  buildMoon() {
    const map = this.tex('moon');
    const bump = this.tex('moon-bump', false);
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(REGION_RADIUS.moon, 64, 40),
      new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 0.35, color: map ? 0xffffff : 0x9db7c2, roughness: 1 }),
    );
    this.moon.position.copy(MOON);
    this.scene.add(this.moon);
  }

  buildMars() {
    this.mars = new THREE.Group();
    const map = this.tex('mars');
    this.marsGlobe = new THREE.Mesh(
      new THREE.SphereGeometry(1, 64, 40),
      new THREE.MeshStandardMaterial({ map, color: map ? 0xffffff : 0xc9374c, roughness: 0.95 }),
    );
    this.marsGlobe.rotation.z = 0.44;
    this.mars.add(this.marsGlobe);
    this.mars.add(this.atmosphere(1.06, 0xe8915a, 1.8, 0.8));
    this.marsMoons = [];
    for (const [id, dist, size, speed, sx] of [['phobos', 1.9, 0.07, 0.25, [1.3, 1, 0.9]], ['deimos', 3.1, 0.045, 0.1, [1.2, 0.9, 1]]]) {
      const map2 = this.tex(id);
      const geo = new THREE.IcosahedronGeometry(size, 4);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const k = 1 + 0.12 * Math.sin(p.getX(i) * 60) * Math.cos(p.getY(i) * 50 + p.getZ(i) * 40);
        p.setXYZ(i, p.getX(i) * k * sx[0], p.getY(i) * k * sx[1], p.getZ(i) * k * sx[2]);
      }
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: map2, color: map2 ? 0xffffff : 0x8a7a70, roughness: 1 }));
      m.userData = { dist, speed, a: Math.random() * 6 };
      this.marsMoons.push(m);
      this.mars.add(m);
    }
    this.mars.position.copy(MARS);
    this.scene.add(this.mars);
  }

  /** Deep space: an original ringed gas giant with painted cloud bands (not a NASA texture). */
  buildGiant() {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 512;
    const c = cv.getContext('2d');
    const bands = ['#e8d7b0', '#d9b77e', '#c99a5c', '#e6cf9f', '#b9864f', '#efe0bd', '#cfa46a', '#dcc192'];
    let y = 0;
    while (y < 512) {
      const h = 8 + Math.random() * 34;
      c.fillStyle = bands[Math.floor(Math.random() * bands.length)];
      c.fillRect(0, y, 1024, h + 1);
      y += h;
    }
    // soft turbulence along band edges
    for (let i = 0; i < 1800; i++) {
      c.fillStyle = `rgba(255,240,210,${Math.random() * 0.08})`;
      const yy = Math.random() * 512; const w = 30 + Math.random() * 160;
      c.fillRect(Math.random() * 1024, yy, w, 1 + Math.random() * 3);
    }
    const map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
    const r = REGION_RADIUS.deep;
    this.giant = new THREE.Group();
    const globe = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 40), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    this.giant.add(globe);
    this.giant.add(this.atmosphere(r * 1.05, 0xf0d9a8, 1.8, 0.6));
    // rings: radial gradient strip with gaps
    const rc = document.createElement('canvas'); rc.width = 512; rc.height = 4;
    const rg = rc.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const k = x / 512;
      const gap = (k > 0.52 && k < 0.56) || (k > 0.8 && k < 0.815);
      const a = gap ? 0.04 : (0.35 + 0.45 * Math.abs(Math.sin(k * 40))) * (k < 0.08 ? k / 0.08 : 1) * (k > 0.95 ? (1 - k) / 0.05 : 1);
      rg.fillStyle = `rgba(230,214,180,${a.toFixed(3)})`; rg.fillRect(x, 0, 1, 4);
    }
    const ringTex = new THREE.CanvasTexture(rc); ringTex.colorSpace = THREE.SRGBColorSpace;
    const ringGeo = new THREE.RingGeometry(r * 1.3, r * 2.3, 128, 1);
    // map the strip radially
    const pos = ringGeo.attributes.position; const uv = ringGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const d = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (d - r * 1.3) / (r * 1.0), 0.5);
    }
    const rings = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false }));
    rings.rotation.x = -Math.PI / 2 + 0.35;
    this.giant.add(rings);
    this.giant.rotation.z = 0.25;
    this.giantGlobe = globe;
    this.giant.position.copy(DEEP);
    this.scene.add(this.giant);
  }

  buildAsteroids() {
    // Original procedural rocks; each one stands in for a REAL asteroid from the
    // NeoWs snapshot, sized (on a log scale) from its real diameter.
    this.asteroidField = new THREE.Group();
    this.asteroidAnchor = EARTH.clone();
    this.rockDepth = 7;
    this.scene.add(this.asteroidField);
    const low = settings.quality === 'low';
    const shapes = Array.from({ length: low ? 3 : 6 }, (_, i) => makeRockGeometry(1234 + i * 77, low ? 3 : 4));
    const mat = makeRockMaterial();
    this.rockShapes = shapes;
    const real = getAsteroids();
    const n = low ? 8 : 14;
    for (let i = 0; i < n; i++) {
      const rock = new THREE.Mesh(shapes[i % shapes.length], mat);
      const a = real.length ? real[i % real.length] : null;
      rock.userData.real = a;
      rock.userData.base = a ? sizeFromDiameter((a.diameterMinM + a.diameterMaxM) / 2) : 0.03 + Math.random() * 0.06;
      this.respawnRock(rock, true);
      this.asteroidField.add(rock);
    }
  }

  respawnRock(rock, anywhere = false) {
    const s = (rock.userData.base || 0.05) * (0.85 + Math.random() * 0.3);
    rock.scale.setScalar(s);
    rock.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    const depth = this.rockDepth;
    const near = depth > 8 ? 0.8 : 3.5;       // menus keep rocks well away from the camera
    const side = (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.65);
    rock.position.set(side * depth * 0.7, (Math.random() - 0.35) * depth * 0.45, anywhere ? -near - Math.random() * depth : -near - depth);
    rock.userData = {
      ...rock.userData,
      vel: v((Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.03, (0.15 + Math.random() * 0.25) * depth / 10),
      spin: v(Math.random(), Math.random(), Math.random()).multiplyScalar(0.5),
    };
  }

  /** Earth's shield strength 0-100: weak shields go amber and lose panels. */
  setShield(pct) {
    const k = Math.max(0, Math.min(1, pct / 100));
    this.shieldLevel = k;
    this.shield.material.color.lerpColors(new THREE.Color(0xc9374c), new THREE.Color(0xc2dde4), Math.min(1, k * 1.6));
    // missing panels where the shield is damaged (whole line segments, so it reads as holes)
    const keep = Math.floor((0.45 + 0.55 * k) * this.shieldSegments / 2) * 2;
    this.shield.geometry.setDrawRange(0, keep);
  }

  // ---- shots ---------------------------------------------------------------
  setShot(id, params = {}, instant = false) {
    const s = shotFor(id, params);
    this.cockpitWant = s.cockpit ? 1 : 0;
    const [a, b] = NEBULA[s.nebula] || NEBULA.earth;
    this.nebFrom = { a: this.nebulaUniforms.uA.value.clone(), b: this.nebulaUniforms.uB.value.clone() };
    this.nebTo = { a: new THREE.Color(a), b: new THREE.Color(b) };
    this.newAnchor = s.asteroids;
    this.newDepth = s.depth || 7;
    this.calm = Boolean(s.lite) || s.rocks === 0;
    this.pendingDraw = true;
    // menus: a few far-off rocks; reading screens: none; rounds: the full field
    this.newRocks = s.rocks ?? (s.depth ? Infinity : 5);
    if (Boolean(s.lite) !== this.lite) { this.lite = Boolean(s.lite); this.resize(); }
    const still = settings.reducedMotion || instant;
    const dist = this.camPos.distanceTo(s.pos);
    // travel time grows with distance: short hops ~1.5 s, Earth to Mars ~3.4 s
    const dur = still ? 0 : THREE.MathUtils.clamp(1.2 + Math.log2(1 + dist) * 0.35, 1.2, 3.4);
    this.glide = {
      fromPos: this.camPos.clone(), fromTarget: this.camTarget.clone(),
      fromQuat: this.camera.quaternion.clone(),          // start from wherever we're looking now
      toPos: s.pos, toTarget: s.target, t0: this.clock.getElapsedTime(),
      dur, long: dist > 12,
      toQuat: lookQuat(s.pos, s.target),
      fovKick: still ? 0 : Math.min(12, dist * 0.14),
    };
    if (this.glide.long && this.asteroidField) this.asteroidField.visible = false;   // nothing pops in mid-flight
    return dur;
  }

  resize() {
    const q = settings.quality;
    const dpr = window.devicePixelRatio || 1;
    const base = q === 'low' ? 1 : q === 'high' ? Math.min(dpr, 2) : Math.min(dpr, 1.5);
    // rounds: the background is behind the notes, so it can run at lower resolution
    const pr = base * this.dynScale * (this.lite ? 0.7 : 1);
    this.renderer.setPixelRatio(Math.max(0.5, pr));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.cockpitCam.aspect = this.camera.aspect;
    this.cockpitCam.updateProjectionMatrix();
    this.starUniforms.uPR.value = this.renderer.getPixelRatio();
    this.cockpit.layout();
  }

  frame() {
    requestAnimationFrame(this.frame);
    const nowMs = performance.now();
    const realDt = Math.min((nowMs - this.lastNow) / 1000, 0.25);
    this.lastNow = nowMs;
    // nothing to draw when the tab is hidden or a full-screen inspect view covers the world
    if (document.hidden || document.body.classList.contains('inspect-open')) return;
    const dt = Math.min(realDt, 0.05);
    const t = this.clock.getElapsedTime();
    const still = settings.reducedMotion;
    this.adaptResolution(realDt);

    // glide camera (time-based, so it stays smooth even if frames drop)
    const g = this.glide;
    let lookQ = null;
    if (g) {
      const k = g.dur ? Math.min(1, (t - g.t0) / g.dur) : 1;
      const e = k * k * k * (k * (k * 6 - 15) + 10);          // smootherstep: no jolt at either end
      this.camPos.lerpVectors(g.fromPos, g.toPos, e);
      this.camPos.y += Math.sin(e * Math.PI) * Math.min(6, g.fromPos.distanceTo(g.toPos) * 0.08);
      this.camTarget.lerpVectors(g.fromTarget, g.toTarget, e);
      // pilot-style turn: face the destination early, fly, then settle into the final framing
      const travel = lookQuat(this.camPos, g.toTarget, this._qTravel);
      const turnIn = smooth(0, 0.32, k); const settle = smooth(0.62, 1, k);
      lookQ = this._qLook.copy(g.fromQuat).slerp(travel, turnIn).slerp(g.toQuat, settle);
      // a gentle field-of-view swell gives a sense of speed on long trips
      const fov = 45 + Math.sin(e * Math.PI) * g.fovKick;
      if (Math.abs(fov - this.camera.fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
      this.nebulaUniforms.uA.value.lerpColors(this.nebFrom.a, this.nebTo.a, e);
      this.nebulaUniforms.uB.value.lerpColors(this.nebFrom.b, this.nebTo.b, e);
      if (k >= 0.5 && this.newAnchor) {
        this.asteroidAnchor.copy(this.newAnchor); this.newAnchor = null;
        if (this.newDepth !== this.rockDepth) { this.rockDepth = this.newDepth; this.asteroidField?.children.forEach((r) => this.respawnRock(r, true)); }
        this.asteroidField?.children.forEach((r, i) => { r.visible = i < this.newRocks; });
      }
      if (k >= 1) { this.glide = null; if (this.camera.fov !== 45) { this.camera.fov = 45; this.camera.updateProjectionMatrix(); } }
    }

    // smoothed pointer for parallax (exponential ease, frame-rate independent)
    this.mouseS.lerp(this.mouse, 1 - Math.exp(-realDt * 4));
    const cam = this.camera;
    cam.position.copy(this.camPos);
    if (!still) {
      cam.position.x += Math.sin(t * 0.5) * 0.01 + this.mouseS.x * 0.08;
      cam.position.y += Math.sin(t * 0.37) * 0.008 - this.mouseS.y * 0.05;
    }
    if (lookQ) cam.quaternion.copy(lookQ); else cam.lookAt(this.camTarget);

    // cockpit slides in/out from below (uses real time so it never lingers)
    this.cockpitShow += (this.cockpitWant - this.cockpitShow) * (still ? 1 : 1 - Math.exp(-realDt * 5));
    if (Math.abs(this.cockpitShow - this.cockpitWant) < 0.002) this.cockpitShow = this.cockpitWant;
    this.cockpit.setShow(this.cockpitShow);
    const cg = this.cockpit.group;
    cg.visible = this.cockpitShow > 0.005;
    cg.position.y = -(1 - this.cockpitShow) * 0.7;
    if (cg.visible) this.cockpit.update(t, still, this.pulse, this.mouseS);

    if (!still) {
      this.earthGlobe.rotation.y += dt * 0.03;
      this.marsGlobe.rotation.y += dt * 0.025;
      this.moon.rotation.y += dt * 0.01;
      this.giantGlobe.rotation.y += dt * 0.04;
    }
    if (this.showcase) {
      this.showcase.visible = this.camPos.distanceTo(TITLE_POS) < 2.5;   // only on the title shot
      if (this.showcase.visible && !still) for (const h of this.showcase.children) {
        if (!h.userData.spin) continue;
        h.rotation.y += dt * h.userData.spin * 2;
        h.position.y = h.userData.y + Math.sin(t * 0.6 + h.userData.bob) * 0.04;
      }
    }
    for (const m of this.marsMoons) {
      if (!still) m.userData.a += dt * m.userData.speed;
      m.position.set(Math.cos(m.userData.a) * m.userData.dist, Math.sin(m.userData.a) * m.userData.dist * 0.15, Math.sin(m.userData.a) * m.userData.dist);
      m.rotation.y = m.userData.a;
    }
    this.shield.material.opacity = (0.1 + 0.12 * this.shieldLevel) + 0.06 * Math.sin(t * 1.3) + this.pulse * 0.05;
    if (!still) this.shield.rotation.y = t * 0.02;

    if (this.asteroidField) {
      const fwd = this._fwd.subVectors(this.camTarget, this.camPos).normalize();
      this.asteroidField.position.copy(this.camPos).addScaledVector(fwd, 0.5);
      this.asteroidField.lookAt(this._look.copy(this.camPos).addScaledVector(fwd, -10));
      this.asteroidField.visible = this.camPos.distanceTo(this.asteroidAnchor) < 12 && !(this.glide?.long && (t - this.glide.t0) / this.glide.dur < 0.92);
      for (const r of this.asteroidField.children) {
        if (!still) {
          r.position.addScaledVector(r.userData.vel, dt);
          r.rotation.x += r.userData.spin.x * dt; r.rotation.y += r.userData.spin.y * dt;
        }
        if (r.position.z > (this.rockDepth > 8 ? 0.6 : -2.5)) this.respawnRock(r);
      }
    }

    this.pulse *= Math.exp(-realDt * 6);
    this.starUniforms.uTime.value = t;
    this.starUniforms.uPulse.value = this.pulse;
    this.starUniforms.uStill.value = still ? 1 : 0;
    // The background moves slowly, so it doesn't need every frame. While the camera
    // is parked: menus redraw at half rate, rounds at a third (the note highway gets
    // the frame budget, so key presses register on time). Camera flights stay smooth.
    this.skip = (this.skip || 0) + 1;
    const every = this.lite ? 3 : 2;
    const parked = !this.glide && this.cockpitShow === this.cockpitWant;
    if (parked && !this.pendingDraw && this.skip % every !== 0) return;
    this.pendingDraw = false;
    this.renderer.render(this.scene, cam);
    if (cg.visible) {
      this.renderer.autoClear = false;
      this.renderer.clearDepth();
      this.renderer.render(this.cockpitScene, this.cockpitCam);
      this.renderer.autoClear = true;
    }
  }

  /** Dynamic resolution: drop render scale when frames run slow, raise it back when there's headroom. */
  adaptResolution(dt) {
    if (settings.quality !== 'auto') return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 45) return;
    const med = this.frameTimes.sort((a, b) => a - b)[Math.floor(this.frameTimes.length / 2)];
    this.frameTimes.length = 0;
    if (med > 1 / 48 && this.dynScale > 0.55) {
      this.dynScale = Math.max(0.55, this.dynScale - 0.15); this.goodWindows = 0; this.resize();
    } else if (med < 1 / 57) {
      this.goodWindows = (this.goodWindows || 0) + 1;
      if (this.goodWindows >= 6 && this.dynScale < 1) { this.dynScale = Math.min(1, this.dynScale + 0.1); this.goodWindows = 0; this.resize(); }
    }
  }
}

const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
/** Camera orientation that looks from eye to target. */
function lookQuat(eye, target, out = new THREE.Quaternion()) {
  _m.lookAt(eye, target, UP);
  return out.setFromRotationMatrix(_m);
}
const smooth = (a, b, x) => { const k = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

let world = null;
export function startWorld(canvas) {
  try { world = new World(canvas); } catch (err) { console.warn('[world] WebGL unavailable', err); world = null; }
  window.__hhWorld = world;   // handy in the browser console for debugging/testing
  return world;
}
export function getWorld() { return world; }
