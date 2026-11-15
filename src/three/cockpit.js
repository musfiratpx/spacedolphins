// First-person ship interior (original, made in code). Parented to the camera so
// it frames the window: canopy frame with rivets, wraparound dashboard with live
// screens (radar, Numan waveform, mission clock), button banks, throttle levers,
// overhead switch panel, side walls with vents and cables, interior lights,
// window-glass reflections, and a small plant that grows as the Archive fills.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { state } from '../core/state.js';
import { getHardware } from '../core/data.js';
import { on } from '../core/bus.js';

const PALETTE = { teal: 0x2ec4b6, amber: 0xf2b134, rust: 0xd9622b, star: 0xe8ecf5 };

export class Cockpit {
  constructor(renderer, camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    camera.add(this.group);
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    const std = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMap: this.env, envMapIntensity: 0.35 });
    this.mat = {
      hull: std(0x1b2348, 0.45, 0.65),
      panel: std(0x262f5e, 0.6, 0.4),
      dark: std(0x0c1129, 0.7, 0.3),
      rubber: std(0x070a18, 0.9, 0.0),
      chrome: std(0xa7adba, 0.25, 0.9),
      pot: std(0x8a4a2a, 0.8, 0.0),
      leaf: std(0x3fa34d, 0.7, 0.0),
      trim: new THREE.MeshBasicMaterial({ color: PALETTE.teal, transparent: true, opacity: 0.7 }),
      amberTrim: new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.6 }),
    };
    this.screens = [];
    this.blinkers = [];
    this.levers = [];
    this.t0 = performance.now();
    // Interior lights live on the camera and never get removed or hidden: changing
    // the number of lights forces every shader to recompile (a visible hitch).
    this.lights = [
      [PALETTE.teal, 1.6, [0, -0.3, -0.65]], [PALETTE.amber, 0.9, [0, 0.39, -0.6]], [0x7b6cf6, 0.7, [0, 0, -0.7]],
    ].map(([c, i, p]) => { const l = new THREE.PointLight(c, 0, 1.4, 2); l.position.set(...p); l.userData.base = i; camera.add(l); return l; });
    this.plushies = {};      // region id -> mesh group
    this.aspect = 0;
    // redraw the best-grade sticky note after every round
    on('round:end', () => { setTimeout(() => {
      const map = this.note?.material.map; if (!map) return;
      const cv = map.image; this.drawNote(cv.getContext('2d'), cv.width, cv.height); map.needsUpdate = true;
    }, 50); });
  }

  /** 0..1 how much the cockpit is showing (fades the interior lights). */
  setShow(k) { for (const l of this.lights) l.intensity = l.userData.base * k; }

  /** Rebuild for the current aspect ratio (only when it actually changes). */
  layout() {
    if (Math.abs(this.camera.aspect - this.aspect) < 1e-3) return;
    this.aspect = this.camera.aspect;
    const g = this.group;
    for (const c of [...g.children]) { g.remove(c); c.traverse((o) => o.geometry?.dispose()); }
    this.screens = []; this.blinkers = []; this.levers = [];
    const Z = -1;
    const hh = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const hw = hh * this.camera.aspect;
    this.hh = hh; this.hw = hw;
    const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0, parent = g) => {
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
    };
    const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);


    // ---- canopy frame ----
    const top = hh * 0.13;
    add(box(hw * 2.6, top, 0.18), this.mat.hull, 0, hh - top * 0.35, Z + 0.05, 0.15);
    add(box(hw * 2.6, 0.004, 0.004), this.mat.trim, 0, hh - top * 0.85, Z + 0.15);
    for (const s of [-1, 1]) {
      const len = hh * 2.4;
      const pillar = new THREE.Group();
      pillar.position.set(s * hw * 0.9, 0, Z); pillar.rotation.z = s * 0.2;
      g.add(pillar);
      add(box(hw * 0.09, len, 0.12), this.mat.hull, 0, 0, 0, 0, 0, 0, pillar);
      add(box(hw * 0.03, len, 0.02), this.mat.panel, -s * hw * 0.035, 0, 0.065, 0, 0, 0, pillar);
      add(box(0.003, len, 0.003), this.mat.trim, -s * hw * 0.05, 0, 0.075, 0, 0, 0, pillar);
      // rivets
      const rivet = new THREE.SphereGeometry(hh * 0.006, 8, 6);
      for (let i = 0; i < 14; i++) add(rivet, this.mat.chrome, s * hw * 0.02, -len / 2 + (i + 0.5) * (len / 14), 0.07, 0, 0, 0, pillar);
    }

    // ---- side walls with vents and cable runs ----
    for (const s of [-1, 1]) {
      const wall = new THREE.Group();
      wall.position.set(s * hw * 1.18, 0, Z + 0.25); wall.rotation.y = -s * 0.9;
      g.add(wall);
      add(box(0.5, hh * 2.4, 0.02), this.mat.dark, 0, 0, 0, 0, 0, 0, wall);
      for (let i = 0; i < 9; i++) add(box(0.22, hh * 0.012, 0.012), this.mat.rubber, 0.05, hh * 0.25 - i * hh * 0.045, 0.015, 0, 0, 0, wall);
      add(box(0.24, hh * 0.44, 0.006), this.mat.panel, 0.05, hh * 0.07, 0.008, 0, 0, 0, wall);
      // cable conduits curving down the wall
      for (let k = 0; k < 3; k++) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-0.2 + k * 0.03, hh * 1.1, 0.03),
          new THREE.Vector3(-0.15 + k * 0.03, hh * 0.2, 0.05),
          new THREE.Vector3(-0.18 + k * 0.025, -hh * 0.6, 0.04),
          new THREE.Vector3(-0.1 + k * 0.02, -hh * 1.2, 0.02),
        ]);
        add(new THREE.TubeGeometry(curve, 24, hh * 0.008, 6), k === 1 ? this.mat.amberTrim : this.mat.rubber, 0, 0, 0, 0, 0, 0, wall);
      }
    }

    // ---- overhead switch panel ----
    const over = new THREE.Group();
    over.position.set(0, hh * 0.93, Z + 0.32); over.rotation.x = 0.9;
    g.add(over);
    add(box(hw * 0.9, hh * 0.18, 0.03), this.mat.panel, 0, 0, 0, 0, 0, 0, over);
    for (let i = 0; i < 12; i++) {
      const x = (i - 5.5) * hw * 0.065;
      add(new THREE.CylinderGeometry(hh * 0.004, hh * 0.004, hh * 0.04, 6), this.mat.chrome, x, -hh * 0.02, 0.025, 0.5 + (i % 3 === 0 ? -1 : 0), 0, 0, over);
      const lamp = add(new THREE.CircleGeometry(hh * 0.007, 12), new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? PALETTE.amber : PALETTE.teal, transparent: true }), x, hh * 0.05, 0.017, 0, 0, 0, over);
      this.blinkers.push({ m: lamp, rate: 0.2 + Math.random() * 0.8, off: Math.random() * 7 });
    }

    // ---- wraparound dashboard: center + two angled wings ----
    const dashH = hh * 0.3;
    const dashY = -hh + dashH * 0.72;
    const dash = new THREE.Group();
    dash.position.set(0, dashY, Z + 0.15);
    g.add(dash);
    const center = new THREE.Group(); center.rotation.x = -1.0; dash.add(center);
    add(box(hw * 0.95, dashH, 0.06), this.mat.hull, 0, 0, 0, 0, 0, 0, center);
    add(box(hw * 0.95, 0.005, 0.005), this.mat.trim, 0, dashH / 2, 0.035, 0, 0, 0, center);
    const wings = [];
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(s * hw * 0.47, 0, 0); wing.rotation.set(-1.0, 0, 0);
      const pivot = new THREE.Group(); pivot.rotation.y = -s * 0.55; pivot.add(wing);
      pivot.position.set(s * hw * 0.0, 0, 0);
      dash.add(pivot);
      add(box(hw * 0.8, dashH, 0.06), this.mat.hull, s * hw * 0.4, 0, 0, 0, 0, 0, wing);
      add(box(hw * 0.8, 0.005, 0.005), this.mat.trim, s * hw * 0.4, dashH / 2, 0.035, 0, 0, 0, wing);
      wings.push({ wing, s });
    }
    // front lip / glare shield
    add(box(hw * 2.4, hh * 0.03, 0.08), this.mat.rubber, 0, dashY + dashH * 0.45, Z + 0.08, -0.2);

    // screens on the center console
    const screenW = hw * 0.26; const screenH = dashH * 0.62;
    const kinds = ['radar', 'wave', 'clock'];
    kinds.forEach((kind, i) => {
      const x = (i - 1) * screenW * 1.12;
      add(box(screenW * 1.06, screenH * 1.1, 0.01), this.mat.rubber, x, dashH * 0.04, 0.032, 0, 0, 0, center);
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160;
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const scr = add(new THREE.PlaneGeometry(screenW, screenH), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }), x, dashH * 0.04, 0.038, 0, 0, 0, center);
      this.screens.push({ kind, cv, ctx: cv.getContext('2d'), tex, mesh: scr });
    });

    // button banks and switches on the wings
    for (const { wing, s } of wings) {
      const cols = 8; const rows = 3;
      const btn = box(hw * 0.05, dashH * 0.11, 0.015);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = s * (hw * 0.12 + c * hw * 0.075);
          const y = dashH * 0.22 - r * dashH * 0.17;
          const lit = (r * cols + c) % 3 === 0;
          const color = [PALETTE.teal, PALETTE.amber, PALETTE.rust, PALETTE.star][(r + c) % 4];
          const mat = lit ? new THREE.MeshBasicMaterial({ color, transparent: true }) : this.mat.panel;
          const b = add(btn, mat, x, y, 0.038, 0, 0, 0, wing);
          if (lit) this.blinkers.push({ m: b, rate: 0.15 + Math.random() * 0.9, off: Math.random() * 9 });
        }
      }
      // toggle switches row
      for (let c = 0; c < 6; c++) {
        add(new THREE.CylinderGeometry(hh * 0.004, hh * 0.006, dashH * 0.14, 8), this.mat.chrome, s * (hw * 0.14 + c * hw * 0.09), -dashH * 0.33, 0.06, 0.6 * (c % 2 ? 1 : -1), 0, 0, wing);
      }
      // throttle levers on the right wing, a dial cluster on the left
      if (s === 1) {
        for (let k = 0; k < 2; k++) {
          const lever = new THREE.Group();
          lever.position.set(hw * 0.72 + k * hw * 0.06, -dashH * 0.05, 0.04);
          add(new THREE.CylinderGeometry(hh * 0.006, hh * 0.006, dashH * 0.5, 8), this.mat.chrome, 0, 0, dashH * 0.25, Math.PI / 2, 0, 0, lever);
          add(new THREE.SphereGeometry(hh * 0.018, 16, 12), k ? this.mat.amberTrim : this.mat.rubber, 0, 0, dashH * 0.5, 0, 0, 0, lever);
          lever.rotation.x = -0.4;
          wing.add(lever);
          this.levers.push({ lever, off: k * 1.7 });
        }
      } else {
        for (let k = 0; k < 3; k++) {
          const x = -hw * (0.72 - k * 0.11);
          add(new THREE.CylinderGeometry(dashH * 0.13, dashH * 0.13, 0.01, 24), this.mat.rubber, x, -dashH * 0.05, 0.04, Math.PI / 2, 0, 0, wing);
          add(new THREE.RingGeometry(dashH * 0.1, dashH * 0.115, 24), this.mat.trim, x, -dashH * 0.05, 0.047, 0, 0, 0, wing);
          const needle = add(box(dashH * 0.012, dashH * 0.09, 0.004), this.mat.amberTrim, x, -dashH * 0.05, 0.049, 0, 0, 0, wing);
          needle.geometry.translate(0, dashH * 0.045, 0);
          this.levers.push({ needle, off: k * 2.1 });
        }
      }
    }

    // a small plant on the dash; it grows as the Archive fills
    this.plant = new THREE.Group();
    this.plant.position.set(-hw * 0.62, dashY + dashH * 0.42, Z + 0.06);
    g.add(this.plant);
    add(new THREE.CylinderGeometry(hh * 0.025, hh * 0.018, hh * 0.04, 16), this.mat.pot, 0, 0, 0, 0, 0, 0, this.plant);
    this.leaves = new THREE.Group(); this.plant.add(this.leaves);
    this.growPlant();

    // Numan plushies, one per completed region, each displayed its own way:
    // Mars sits on the dash, Moon hangs on the window from a suction cup,
    // Deep space bounces on a spring like a bobblehead.
    this.plushies = {};
    this.plushSpots = {
      mars: { style: 'sit', x: hw * 0.3, y: dashY + dashH * 0.46, z: Z + 0.07, s: 1.0 },
      moon: { style: 'hang', x: -hw * 0.5, y: hh * 0.62, z: Z * 0.99, s: 0.85 },
      deep: { style: 'spring', x: hw * 0.6, y: dashY + dashH * 0.46, z: Z + 0.07, s: 0.8 },
    };
    this.dashTop = { hh };
    this.knownPlush = null;
    this.syncPlushies(false);

    this.addLivedIn({ hw, hh, Z, dashY, dashH, add });

    // window glass: faint reflections and a soft edge glow
    const gc = document.createElement('canvas'); gc.width = 256; gc.height = 256;
    const c2 = gc.getContext('2d');
    const gr = c2.createLinearGradient(0, 0, 256, 256);
    gr.addColorStop(0, 'rgba(255,255,255,0.0)'); gr.addColorStop(0.42, 'rgba(255,255,255,0.0)');
    gr.addColorStop(0.47, 'rgba(180,230,255,0.07)'); gr.addColorStop(0.52, 'rgba(255,255,255,0.0)');
    gr.addColorStop(0.6, 'rgba(180,230,255,0.04)'); gr.addColorStop(0.64, 'rgba(255,255,255,0)');
    c2.fillStyle = gr; c2.fillRect(0, 0, 256, 256);
    const vg = c2.createRadialGradient(128, 128, 60, 128, 128, 180);
    vg.addColorStop(0, 'rgba(46,196,182,0)'); vg.addColorStop(1, 'rgba(46,196,182,0.10)');
    c2.fillStyle = vg; c2.fillRect(0, 0, 256, 256);
    add(new THREE.PlaneGeometry(hw * 2.2, hh * 2.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(gc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 0, 0, Z * 1.1);
  }

  /** Show a plushie for every completed region; new ones pop in with a bounce. */
  syncPlushies(animate = true) {
    let done = [];
    try {
      const { regions, machines } = getHardware();
      done = regions.filter((r) => {
        const ms = machines.filter((m) => m.region === r.id);
        return ms.length && ms.every((m) => state.unlocked[m.id]);
      }).map((r) => r.id);
    } catch { return; }
    const key = done.join(',');
    if (key === this.knownPlush) return;
    this.knownPlush = key;
    for (const id of done) {
      if (this.plushies[id] || !this.plushSpots[id]) continue;
      const spot = this.plushSpots[id];
      const hh = this.dashTop.hh;
      const r = hh * 0.11;
      const body = makeNuman(id, r);
      const root = new THREE.Group();
      root.position.set(spot.x, spot.y, spot.z);
      let holder = root;
      if (spot.style === 'hang') {
        // suction cup on the glass + a short string; the plushie swings below it
        const cupMat = new THREE.MeshPhysicalMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.55, roughness: 0.1, transmission: 0.5 });
        const cup = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 0.25, 24, 1, true), cupMat);
        cup.rotation.x = -Math.PI / 2; root.add(cup);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(r * 0.09, 12, 8), cupMat); knob.position.z = r * 0.16; root.add(knob);
        const swing = new THREE.Group(); swing.position.z = r * 0.18; root.add(swing);
        const len = r * 2.2;
        const string = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.012, r * 0.012, len, 6), new THREE.MeshBasicMaterial({ color: 0xe8ecf5 }));
        string.position.y = -len / 2; swing.add(string);
        body.position.y = -len - r * 2.3;    // hangs from the antenna tip
        holder = swing;
        root.userData.swing = swing;
      } else if (spot.style === 'spring') {
        // coil spring from the dash up to the plushie's feet
        const turns = 6; const h = r * 1.1; const pts = [];
        for (let i = 0; i <= turns * 16; i++) { const a = (i / 16) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r * 0.22, (i / (turns * 16)) * h, Math.sin(a) * r * 0.22)); }
        const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, r * 0.03, 6), this.mat.chrome);
        root.add(coil);
        const top = new THREE.Group(); top.position.y = h; root.add(top);
        holder = top;
        root.userData.coil = coil; root.userData.top = top; root.userData.springH = h;
      }
      holder.add(body);
      root.scale.setScalar(animate ? 0.001 : spot.s);
      root.userData = { ...root.userData, body, style: spot.style, target: spot.s, born: animate ? performance.now() : 0, seed: Math.random() * 6, antenna: body.userData.antenna };
      this.group.add(root);
      this.plushies[id] = root;
    }
  }

  growPlant() {
    if (!this.leaves) return;
    for (const c of [...this.leaves.children]) { this.leaves.remove(c); c.geometry.dispose(); }
    let total = 12; let got = 0;
    try { const { machines } = getHardware(); total = machines.length; got = machines.filter((m) => state.unlocked[m.id]).length; } catch { /* data not loaded yet */ }
    this.plantKey = got;
    const hh = this.hh;
    const n = 2 + Math.round((got / Math.max(1, total)) * 9);
    for (let i = 0; i < n; i++) {
      const h = hh * (0.03 + 0.05 * (i / n) + 0.02 * Math.random());
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(hh * 0.008, h, 6), this.mat.leaf);
      const a = (i / n) * Math.PI * 2 * 1.618;
      leaf.position.set(Math.cos(a) * hh * 0.008, hh * 0.02 + h / 2, Math.sin(a) * hh * 0.008);
      leaf.rotation.set(Math.sin(a) * 0.45, 0, Math.cos(a) * 0.45);
      this.leaves.add(leaf);
    }
  }

  /** @param t seconds, still = reduced motion, pulse = beat pulse 0..1, mouse = smoothed pointer */
  /** Stickers, notes, a mug, a lanyard and dust: the cockpit looks lived in. All original art. */
  addLivedIn({ hw, hh, Z, dashY, dashH, add }) {
    const sticker = (draw, w, h, x, y, z, rot = 0, ry = 0, size = 256) => {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = Math.round(size * (h / w));
      const c = cv.getContext('2d');
      draw(c, cv.width, cv.height);
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const m = add(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.7, metalness: 0, envMap: this.env, envMapIntensity: 0.2 }), x, y, z, 0, ry, rot);
      return m;
    };
    const S = hh * 0.07;   // base sticker size
    // smiling Mars
    sticker((c, w) => {
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, w / 2, w * 0.48, 0, 7); c.fill();
      const g = c.createRadialGradient(w * 0.4, w * 0.4, 5, w / 2, w / 2, w * 0.44); g.addColorStop(0, '#f08a4b'); g.addColorStop(1, '#b8471d');
      c.fillStyle = g; c.beginPath(); c.arc(w / 2, w / 2, w * 0.44, 0, 7); c.fill();
      c.fillStyle = '#7a2e12'; for (const [x, y, r] of [[.35, .3, .06], [.68, .62, .05], [.3, .7, .04]]) { c.beginPath(); c.arc(w * x, w * y, w * r, 0, 7); c.fill(); }
      c.fillStyle = '#1b1030'; c.beginPath(); c.arc(w * .4, w * .45, w * .04, 0, 7); c.arc(w * .6, w * .45, w * .04, 0, 7); c.fill();
      c.strokeStyle = '#1b1030'; c.lineWidth = w * .03; c.beginPath(); c.arc(w / 2, w * .52, w * .12, 0.2, Math.PI - 0.2); c.stroke();
    }, S, S, -hw * 0.18, dashY + dashH * 0.42, Z + 0.17, 0.2, 0, 128);
    // "4052 CREW" star badge
    sticker((c, w) => {
      c.translate(w / 2, w / 2); c.fillStyle = '#F2B134'; c.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? w * .2 : w * .46; const a = i * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill(); c.lineWidth = w * .03; c.strokeStyle = '#fff'; c.stroke();
      c.fillStyle = '#0B1026'; c.font = `900 ${w * .14}px Nunito, sans-serif`; c.textAlign = 'center'; c.fillText('4052', 0, w * .02); c.font = `700 ${w * .08}px Nunito, sans-serif`; c.fillText('CREW', 0, w * .11);
    }, S * 1.1, S * 1.1, hw * 0.83, -hh * 0.05, Z + 0.07, -0.25, -0.2, 128);
    // rocket doodle
    sticker((c, w, h) => {
      c.fillStyle = '#e8ecf5'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#2EC4B6'; c.lineWidth = 5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(w * .5, h * .12); c.quadraticCurveTo(w * .75, h * .4, w * .62, h * .72); c.lineTo(w * .38, h * .72); c.quadraticCurveTo(w * .25, h * .4, w * .5, h * .12); c.stroke();
      c.beginPath(); c.arc(w * .5, h * .4, w * .07, 0, 7); c.stroke();
      c.strokeStyle = '#D9622B'; c.beginPath(); c.moveTo(w * .42, h * .78); c.lineTo(w * .46, h * .92); c.moveTo(w * .58, h * .78); c.lineTo(w * .54, h * .92); c.stroke();
    }, S * 0.9, S * 1.1, -hw * 0.86, hh * 0.15, Z + 0.07, 0.15, 0.2, 128);
    // Numan face
    sticker((c, w) => {
      c.fillStyle = '#2EC4B6'; c.beginPath(); c.ellipse(w / 2, w * .55, w * .42, w * .38, 0, 0, 7); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w * .36, w * .5, w * .1, 0, 7); c.arc(w * .64, w * .5, w * .1, 0, 7); c.fill();
      c.fillStyle = '#0B1026'; c.beginPath(); c.arc(w * .37, w * .52, w * .06, 0, 7); c.arc(w * .65, w * .52, w * .06, 0, 7); c.fill();
      c.strokeStyle = '#0B1026'; c.lineWidth = w * .03; c.beginPath(); c.arc(w / 2, w * .66, w * .08, 0.3, Math.PI - 0.3); c.stroke();
      c.strokeStyle = '#2EC4B6'; c.lineWidth = w * .04; c.beginPath(); c.moveTo(w / 2, w * .18); c.lineTo(w / 2, w * .05); c.stroke();
      c.fillStyle = '#F2B134'; c.beginPath(); c.arc(w / 2, w * .05, w * .05, 0, 7); c.fill();
    }, S, S, hw * 0.12, dashY + dashH * 0.42, Z + 0.17, -0.15, 0, 128);
    // holographic star (iridescent)
    sticker((c, w) => {
      const g = c.createLinearGradient(0, 0, w, w); ['#ff9ad5', '#9ae7ff', '#c4ff9a', '#ffe59a', '#d59aff'].forEach((col, i) => g.addColorStop(i / 4, col));
      c.translate(w / 2, w / 2); c.fillStyle = g; c.beginPath();
      for (let i = 0; i < 8; i++) { const r = i % 2 ? w * .16 : w * .46; const a = i * Math.PI / 4; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.closePath(); c.fill();
    }, S * 0.7, S * 0.7, -hw * 0.7, hh * 0.84, Z + 0.25, 0.3, 0, 128);
    // "scan, don't recover" ribbon on the overhead edge
    sticker((c, w, h) => {
      c.fillStyle = '#D9622B'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = `900 ${h * .55}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SCAN · DON\'T RECOVER', w / 2, h / 2 + 2);
    }, S * 3, S * 0.45, hw * 0.4, hh * 0.86, Z + 0.24, -0.04, 0, 512);

    // sticky note with your real best grade
    this.note = sticker((c, w, h) => this.drawNote(c, w, h), S * 1.4, S * 1.4, hw * 0.75, hh * 0.35, Z + 0.075, -0.06, -0.2, 256);
    // taped checklist on the left pillar
    sticker((c, w, h) => {
      c.fillStyle = '#f7f3e8'; c.fillRect(0, 0, w, h);
      c.fillStyle = 'rgba(200,220,240,.5)'; c.fillRect(w * .35, 0, w * .3, h * .07);
      c.fillStyle = '#26324f'; c.font = `700 ${w * .085}px "Space Mono", monospace`;
      ['PRE-FLIGHT', '☑ Shield check', '☑ Calibrate lanes', '☑ Feed the Numans?', '☐ Call Earth'].forEach((l, i) => c.fillText(l, w * .08, h * (.2 + i * .16)));
    }, S * 1.5, S * 1.9, -hw * 0.8, -hh * 0.18, Z + 0.075, 0.08, 0.2, 256);
    // drawn Earth polaroid
    sticker((c, w, h) => {
      c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#0b1026'; c.fillRect(w * .08, w * .08, w * .84, w * .84);
      const g = c.createRadialGradient(w * .45, w * .45, 4, w / 2, w / 2, w * .3); g.addColorStop(0, '#5aa8ff'); g.addColorStop(1, '#1d4f9c');
      c.fillStyle = g; c.beginPath(); c.arc(w / 2, w / 2, w * .3, 0, 7); c.fill();
      c.fillStyle = '#3fa34d'; c.beginPath(); c.ellipse(w * .44, w * .45, w * .1, w * .14, .4, 0, 7); c.fill(); c.beginPath(); c.ellipse(w * .6, w * .6, w * .07, w * .05, -.3, 0, 7); c.fill();
      c.fillStyle = '#26324f'; c.font = `700 ${w * .08}px "Space Mono", monospace`; c.textAlign = 'center'; c.fillText('home ♥', w / 2, h * .92);
    }, S * 1.2, S * 1.45, hw * 0.55, hh * 0.62, Z + 0.06, 0.12, 0, 256);

    // coffee mug on the dash
    const mug = new THREE.Group(); mug.position.set(-hw * 0.45, dashY + dashH * 0.47, Z + 0.1);
    const mugMat = new THREE.MeshStandardMaterial({ color: 0xd9622b, roughness: 0.45, envMap: this.env, envMapIntensity: 0.4 });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(hh * 0.022, hh * 0.019, hh * 0.05, 20, 1, true), mugMat); cup.position.y = hh * 0.025; mug.add(cup);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(hh * 0.019, 20), mugMat); bottom.rotation.x = -Math.PI / 2; mug.add(bottom);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(hh * 0.021, 20), new THREE.MeshStandardMaterial({ color: 0x2a160c, roughness: 0.2 })); coffee.rotation.x = -Math.PI / 2; coffee.position.y = hh * 0.042; mug.add(coffee);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(hh * 0.012, hh * 0.0035, 8, 16), mugMat); handle.position.set(hh * 0.024, hh * 0.026, 0); mug.add(handle);
    this.group.add(mug);
    // keycard lanyard hanging from the overhead panel (sways a little)
    this.lanyard = new THREE.Group(); this.lanyard.position.set(-hw * 0.22, hh * 0.86, Z + 0.32);
    const strap = new THREE.Mesh(new THREE.BoxGeometry(hh * 0.008, hh * 0.18, hh * 0.002), new THREE.MeshStandardMaterial({ color: 0x2ec4b6, roughness: 0.8 }));
    strap.position.y = -hh * 0.09; this.lanyard.add(strap);
    const card = sticker((c, w, h) => {
      c.fillStyle = '#e8ecf5'; c.fillRect(0, 0, w, h); c.fillStyle = '#2EC4B6'; c.fillRect(0, 0, w, h * .25);
      c.fillStyle = '#0B1026'; c.font = `900 ${w * .12}px Nunito, sans-serif`; c.fillText('RECOVERY', w * .08, h * .17);
      c.fillStyle = '#A7ADBA'; c.fillRect(w * .08, h * .35, w * .35, h * .4);
      c.fillStyle = '#26324f'; c.font = `700 ${w * .09}px "Space Mono", monospace`; c.fillText('TRAVELER', w * .5, h * .5); c.fillText('ID 4052', w * .5, h * .66);
    }, hh * 0.05, hh * 0.07, 0, 0, 0, 0, 0, 128);
    this.group.remove(card); card.position.set(0, -hh * 0.2, 0.002); this.lanyard.add(card);
    this.group.add(this.lanyard);
    // dust motes drifting in the cabin light
    const n = 90; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * hw * 1.8, (Math.random() - 0.5) * hh * 1.6, Z + 0.1 + Math.random() * 0.6], i * 3);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xfff1d6, size: hh * 0.004, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dustBase = pos.slice();
    this.group.add(this.dust);
  }

  /** Sticky note text: your best grade so far (real progress). */
  drawNote(c, w, h) {
    c.fillStyle = '#ffe36e'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.06)'; c.fillRect(0, 0, w, h * .12);
    c.fillStyle = '#3a2a00'; c.font = `700 ${w * .1}px "Space Mono", monospace`;
    let best = null;
    try { for (const v of Object.values(state.best || {})) if (!best || v.accuracy > best.accuracy) best = v; } catch { /* */ }
    c.fillText('BEST RUN', w * .1, h * .3);
    c.font = `900 ${w * .34}px Nunito, sans-serif`; c.fillText(best ? best.grade : '–', w * .1, h * .7);
    c.font = `700 ${w * .09}px "Space Mono", monospace`; c.fillText(best ? `${Math.round(best.accuracy * 100)}%` : 'go play!', w * .5, h * .66);
    c.fillText('keep it up :)', w * .1, h * .9);
  }

  update(t, still, pulse, mouse) {
    if (!still) {
      if (this.lanyard) this.lanyard.rotation.z = Math.sin(t * 0.9) * 0.06 + mouse.x * 0.05;
      if (this.dust) {
        const p = this.dust.geometry.attributes.position; const b = this.dustBase;
        for (let i = 0; i < p.count; i++) {
          p.setXYZ(i, b[i * 3] + Math.sin(t * 0.15 + i) * 0.03, b[i * 3 + 1] + Math.sin(t * 0.11 + i * 1.7) * 0.025, b[i * 3 + 2]);
        }
        p.needsUpdate = true;
      }
    }
    // subtle inner parallax: the cockpit lags the head a little
    if (!still) {
      this.group.position.x = -mouse.x * 0.012;
      this.group.rotation.y = mouse.x * 0.02;
      this.group.rotation.x = mouse.y * 0.015;
    }
    for (const b of this.blinkers) b.m.material.opacity = still ? 0.85 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * b.rate * 2 + b.off)) + pulse * 0.2;
    for (const l of this.levers) {
      if (l.lever) l.lever.rotation.x = -0.4 + (still ? 0 : Math.sin(t * 0.3 + l.off) * 0.08);
      if (l.needle) l.needle.rotation.z = still ? 0.3 : Math.sin(t * 0.6 + l.off) * 0.9 + pulse * 0.2;
    }
    let got = 0;
    try { got = Object.keys(state.unlocked).length; } catch { /* */ }
    if (got !== this.plantKey) { this.growPlant(); this.syncPlushies(true); }
    // plushies: springy pop-in, then a gentle squish on the beat
    const now = performance.now();
    for (const p of Object.values(this.plushies)) {
      const u = p.userData;
      let sc = u.target;
      if (u.born) {
        const k = Math.min(1, (now - u.born) / 900);
        sc = u.target * (still ? 1 : 1 - Math.cos(k * Math.PI * 3.5) * Math.exp(-k * 5));
        if (k >= 1) u.born = 0;
      }
      p.scale.setScalar(sc);
      const body = u.body;
      if (still) continue;
      u.antenna?.forEach((a, i) => { a.rotation.z = Math.sin(t * 3 + i + u.seed) * 0.25; });
      if (u.style === 'hang') {
        // pendulum swing, nudged by the beat
        u.swing.rotation.z = Math.sin(t * 1.4 + u.seed) * 0.12 + pulse * 0.05;
        u.swing.rotation.x = Math.sin(t * 0.9 + u.seed) * 0.05;
        body.rotation.y = Math.sin(t * 0.5 + u.seed) * 0.5;
      } else if (u.style === 'spring') {
        // bobblehead: the spring compresses on the beat and boings back
        const bob = Math.sin(t * 6 + u.seed) * 0.05 * (0.4 + pulse) + pulse * 0.12;
        u.coil.scale.y = 1 - bob; u.top.position.y = u.springH * (1 - bob);
        body.rotation.z = Math.sin(t * 2.2 + u.seed) * 0.12;
        body.rotation.y = Math.sin(t * 0.8 + u.seed) * 0.3;
      } else {
        const squish = pulse * 0.08 + Math.sin(t * 2 + u.seed) * 0.02;
        body.scale.set(1 + squish, 1 - squish, 1 + squish);
        body.rotation.y = Math.sin(t * 0.7 + u.seed) * 0.35;
      }
    }
    // screens update ~20 times a second
    if (!this.lastDraw || t - this.lastDraw > 0.05) { this.lastDraw = t; for (const s of this.screens) this.draw(s, t, still, pulse); }
  }

  draw(s, t, still, pulse) {
    const { ctx: c, cv } = s; const W = cv.width; const H = cv.height;
    c.fillStyle = '#06122a'; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(46,196,182,0.12)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    c.font = '700 13px "Space Mono", monospace'; c.fillStyle = '#2EC4B6';
    if (s.kind === 'radar') {
      const cx = W / 2; const cy = H / 2 + 6; const R = 62;
      c.strokeStyle = 'rgba(46,196,182,.5)';
      for (const r of [R, R * 0.66, R * 0.33]) { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke(); }
      const a = still ? 0.6 : t * 1.4;
      const sweep = c.createConicGradient ? c.createConicGradient(a - 0.8, cx, cy) : null;
      if (sweep) {
        sweep.addColorStop(0, 'rgba(46,196,182,0)'); sweep.addColorStop(0.12, 'rgba(46,196,182,0.45)'); sweep.addColorStop(0.13, 'rgba(46,196,182,0)');
        c.fillStyle = sweep; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fill();
      }
      for (let i = 0; i < 6; i++) {
        const ba = i * 1.9 + 0.4; const br = R * (0.3 + ((i * 37) % 60) / 100);
        const age = ((a - ba) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        c.fillStyle = `rgba(242,177,52,${Math.max(0.15, 1 - age / 4)})`;
        c.beginPath(); c.arc(cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, 3, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = '#2EC4B6'; c.fillText('ROCK SCAN', 8, 16);
    } else if (s.kind === 'wave') {
      c.fillText('NUMAN SIGNAL', 8, 16);
      c.strokeStyle = '#2EC4B6'; c.lineWidth = 2; c.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const p = x / W;
        const y = H / 2 + 10 + Math.sin(p * 18 + (still ? 0 : t * 4)) * 18 * (0.6 + pulse) * Math.sin(p * Math.PI) + Math.sin(p * 47 + t * 7) * 4;
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
      c.strokeStyle = 'rgba(217,98,43,.8)'; c.lineWidth = 1.5; c.beginPath();
      for (let x = 0; x <= W; x += 3) {
        const p = x / W; const y = H / 2 + 10 + Math.sin(p * 9 - (still ? 0 : t * 2.3)) * 10 * Math.sin(p * Math.PI);
        x ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    } else {
      const secs = Math.floor((performance.now() - this.t0) / 1000);
      const mm = String(Math.floor(secs / 60)).padStart(2, '0'); const ss = String(secs % 60).padStart(2, '0');
      let got = 0; let total = 12;
      try { const { machines } = getHardware(); total = machines.length; got = machines.filter((m) => state.unlocked[m.id]).length; } catch { /* */ }
      c.fillText('MISSION CLOCK', 8, 16);
      c.fillStyle = '#E8ECF5'; c.font = '700 22px "Space Mono", monospace';
      c.fillText('4052.11.14', 8, 50);
      c.fillStyle = '#F2B134'; c.fillText(`T+${mm}:${ss}`, 8, 80);
      c.fillStyle = '#2EC4B6'; c.font = '700 13px "Space Mono", monospace';
      c.fillText(`ARCHIVE ${got}/${total}`, 8, 110);
      c.fillStyle = 'rgba(46,196,182,.25)'; c.fillRect(8, 120, W - 16, 10);
      c.fillStyle = '#2EC4B6'; c.fillRect(8, 120, (W - 16) * (got / Math.max(1, total)), 10);
      if (!still && Math.floor(t * 1.5) % 2) { c.fillStyle = '#F2B134'; c.fillText('SHIELD LOW', 8, 150); }
    }
    // scan lines
    c.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 0; y < H; y += 3) c.fillRect(0, y, W, 1);
    s.tex.needsUpdate = true;
  }
}

// ---- Numan plushies (original design, made in code) -----------------------
// Soft, round light-beings in each region's color. Felt-like sheen material,
// big glossy eyes, glowing antenna tips. Moon: crescent ears. Mars: one tall
// antenna and freckles. Deep space: three eyes and a little star.
const NUMAN_LOOK = {
  moon: { body: 0xc9c3e6, cheek: 0xf2a1c4, glow: 0xe8ecf5 },
  mars: { body: 0xe8804a, cheek: 0xffb08a, glow: 0x2ec4b6 },
  deep: { body: 0x8f7cf7, cheek: 0xd9a6ff, glow: 0xf2b134 },
};

export function makeNuman(kind, r) {
  const look = NUMAN_LOOK[kind] || NUMAN_LOOK.mars;
  const g = new THREE.Group();
  const felt = new THREE.MeshPhysicalMaterial({ color: look.body, roughness: 0.9, sheen: 0.35, sheenRoughness: 0.8, sheenColor: new THREE.Color(look.body).lerp(new THREE.Color(0xffffff), 0.3), emissive: look.body, emissiveIntensity: 0.08 });
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
  const black = new THREE.MeshPhysicalMaterial({ color: 0x0b1026, roughness: 0.05, clearcoat: 1 });
  const glow = new THREE.MeshBasicMaterial({ color: look.glow });
  const cheekM = new THREE.MeshBasicMaterial({ color: look.cheek, transparent: true, opacity: 0.8 });
  const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };

  // squishy body + little feet and arms
  add(new THREE.SphereGeometry(r, 32, 24), felt, 0, r * 0.95, 0, 1.08, 0.95, 1);
  for (const s of [-1, 1]) {
    add(new THREE.SphereGeometry(r * 0.3, 16, 12), felt, s * r * 0.5, r * 0.15, r * 0.25, 1, 0.6, 1.2);
    add(new THREE.SphereGeometry(r * 0.25, 16, 12), felt, s * r * 1.02, r * 0.85, r * 0.1, 0.8, 1.2, 0.8);
  }
  // eyes
  const eyes = kind === 'deep' ? [[-0.42, 1.05], [0.42, 1.05], [0, 1.45]] : [[-0.38, 1.05], [0.38, 1.05]];
  for (const [ex, ey] of eyes) {
    const er = kind === 'deep' && ey > 1.2 ? 0.18 : 0.24;
    add(new THREE.SphereGeometry(r * er, 20, 16), white, ex * r, ey * r, r * 0.85, 1, 1.1, 0.5);
    add(new THREE.SphereGeometry(r * er * 0.72, 20, 16), black, ex * r, ey * r - r * 0.02, r * 0.95, 1, 1.1, 0.5);
    add(new THREE.SphereGeometry(r * er * 0.22, 10, 8), white, ex * r + r * 0.05, ey * r + r * 0.07, r * 1.02);
  }
  // blush and a tiny smile
  for (const s of [-1, 1]) add(new THREE.CircleGeometry(r * 0.13, 16), cheekM, s * r * 0.62, r * 0.78, r * 0.93);
  const smile = add(new THREE.TorusGeometry(r * 0.12, r * 0.025, 8, 16, Math.PI), black, 0, r * 0.78, r * 1.0);
  smile.rotation.z = Math.PI;
  // antennae with glowing tips
  const antenna = [];
  const stalks = kind === 'mars' ? [[0, 0.5]] : [[-0.35, 0.32], [0.35, 0.32]];
  for (const [ax, len] of stalks) {
    const piv = new THREE.Group(); piv.position.set(ax * r, r * 1.8, 0); g.add(piv);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.04, r * 0.05, r * len * 2, 8), felt);
    st.position.y = r * len; piv.add(st);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 16, 12), glow);
    tip.position.y = r * len * 2; piv.add(tip);
    antenna.push(piv);
  }
  g.userData.antenna = antenna;
  // region details
  if (kind === 'moon') {
    for (const s of [-1, 1]) {
      const ear = add(new THREE.TorusGeometry(r * 0.28, r * 0.08, 8, 20, Math.PI * 1.2), felt, s * r * 0.85, r * 1.55, 0);
      ear.rotation.z = s > 0 ? -0.3 : Math.PI + 0.3;
    }
  } else if (kind === 'mars') {
    const freck = new THREE.MeshBasicMaterial({ color: 0x9c3b17 });
    for (const [fx, fy] of [[-0.55, 0.92], [-0.48, 0.85], [0.55, 0.92], [0.48, 0.85]]) add(new THREE.CircleGeometry(r * 0.035, 8), freck, fx * r, fy * r, r * 0.97);
  } else {
    const star = add(new THREE.OctahedronGeometry(r * 0.16, 0), glow, r * 0.75, r * 1.6, r * 0.2);
    star.rotation.z = 0.4;
  }
  return g;
}
