// Original 3D models built in code for machines NASA has no 3D model of.
// Shapes follow public NASA mission photos; no company logos or markings.
// Units are roughly meters; the viewer normalizes size.
import * as THREE from 'three';

const std = (color, roughness = 0.5, metalness = 0.2, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });

/** place a mesh and return it (a mesh's position is read-only and must be set, not replaced) */
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

function tube(a, b, r, mat) {
  // a cylinder from point a to point b
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, dir.length(), 10), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

/** Wire-mesh wheel with chevron treads, like the Apollo rover's. */
function lrvWheel(mats) {
  const g = new THREE.Group();
  const R = 0.41; const W = 0.23;
  // woven wire-mesh tire: a torus-ish band shown as a fine wire lattice + a solid inner band
  const band = new THREE.Mesh(new THREE.CylinderGeometry(R, R, W, 40, 1, true), mats.meshDark);
  band.rotation.z = Math.PI / 2; g.add(band);
  const lattice = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(R + 0.006, R + 0.006, W, 40, 4, true)), mats.wire);
  lattice.rotation.z = Math.PI / 2; g.add(lattice);
  // chevron treads (titanium) around the tire
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 0.012, 0.035), mats.chrome);
      t.position.set(s * W * 0.22, Math.cos(a) * (R + 0.012), Math.sin(a) * (R + 0.012));
      t.rotation.set(a, 0, s * 0.5);
      g.add(t);
    }
  }
  // hub and spokes
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, W * 0.9, 20), mats.alu);
  hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(tube(new THREE.Vector3(0, Math.cos(a) * 0.1, Math.sin(a) * 0.1), new THREE.Vector3(0, Math.cos(a) * (R - 0.02), Math.sin(a) * (R - 0.02)), 0.008, mats.alu));
  }
  return g;
}

export function buildLRV() {
  const mats = {
    alu: std(0xc9ccd2, 0.35, 0.85),
    chrome: std(0xe6e8ec, 0.25, 0.9),
    dark: std(0x2b2f38, 0.6, 0.4),
    meshDark: std(0x55575c, 0.7, 0.6, { side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
    wire: new THREE.LineBasicMaterial({ color: 0xb8bcc4 }),
    fender: std(0x9aa3ad, 0.55, 0.3, { side: THREE.DoubleSide }),
    seat: std(0x2d4a7a, 0.85, 0.05),
    foil: std(0xd4a849, 0.3, 0.85),
    white: std(0xeeeeea, 0.5, 0.05),
    glass: std(0x1d2633, 0.15, 0.6),
  };
  const rover = new THREE.Group(); rover.name = 'Lunar Roving Vehicle (original model)';
  const L = 3.1; const Wd = 2.0; const H = 0.75;   // chassis length, track width, deck height
  // chassis: tubular frame + deck panels
  const deck = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.62, 0.05, L * 0.62), mats.alu); deck.position.y = H; rover.add(deck);
  for (const s of [-1, 1]) {
    rover.add(tube(new THREE.Vector3(s * Wd * 0.33, H - 0.03, -L * 0.48), new THREE.Vector3(s * Wd * 0.33, H - 0.03, L * 0.48), 0.025, mats.alu));
  }
  for (const z of [-0.48, -0.16, 0.16, 0.48]) rover.add(tube(new THREE.Vector3(-Wd * 0.33, H - 0.03, z * L), new THREE.Vector3(Wd * 0.33, H - 0.03, z * L), 0.022, mats.alu));
  // wheels, suspension arms and fenders
  for (const zs of [-1, 1]) {
    for (const xs of [-1, 1]) {
      const wheel = lrvWheel(mats);
      wheel.name = 'lrv-wheel';
      wheel.position.set(xs * Wd / 2, 0.41, zs * L * 0.37);
      rover.add(wheel);
      rover.add(tube(new THREE.Vector3(xs * Wd * 0.33, H - 0.05, zs * L * 0.3), new THREE.Vector3(xs * (Wd / 2 - 0.12), 0.41, zs * L * 0.37), 0.02, mats.alu));
      rover.add(tube(new THREE.Vector3(xs * Wd * 0.33, H - 0.05, zs * L * 0.44), new THREE.Vector3(xs * (Wd / 2 - 0.12), 0.41, zs * L * 0.37), 0.02, mats.alu));
      const fender = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 24, 1, true, -Math.PI * 0.05, Math.PI * 0.7), mats.fender);
      fender.rotation.z = Math.PI / 2; fender.rotation.x = zs > 0 ? 0 : Math.PI * 0.35;
      fender.position.copy(wheel.position);
      rover.add(fender);
    }
  }
  // two seats with webbing and footrests
  for (const xs of [-1, 1]) {
    const seat = new THREE.Group(); seat.name = 'lrv-seat'; seat.position.set(xs * 0.33, H, -0.1);
    seat.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.42), mats.seat), 0, 0.08, 0));
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.5, 0.05), mats.seat); back.position.set(0, 0.34, -0.22); back.rotation.x = -0.15; seat.add(back);
    for (const s of [-1, 1]) {
      seat.add(tube(new THREE.Vector3(s * 0.23, 0.02, 0.2), new THREE.Vector3(s * 0.23, 0.62, -0.28), 0.012, mats.alu));
      seat.add(tube(new THREE.Vector3(s * 0.23, 0.02, -0.2), new THREE.Vector3(s * 0.23, 0.1, 0.2), 0.012, mats.alu));
    }
    // lap belt
    seat.add(at(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.008, 6, 20, Math.PI), mats.white), 0, 0.12, 0.05));
    rover.add(seat);
  }
  // control console + T-handle hand controller between the seats
  const consoleBox = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.12), mats.dark); consoleBox.position.set(0, H + 0.5, 0.42); consoleBox.rotation.x = -0.35; rover.add(consoleBox);
  for (let i = 0; i < 4; i++) {
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), mats.white);
    dial.position.set(-0.13 + i * 0.087, H + 0.55, 0.465); dial.rotation.x = -0.35; rover.add(dial);
  }
  rover.add(tube(new THREE.Vector3(0, H, 0.15), new THREE.Vector3(0, H + 0.32, 0.18), 0.015, mats.alu));
  const tHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 10), mats.dark); tHandle.rotation.z = Math.PI / 2; tHandle.position.set(0, H + 0.34, 0.18); rover.add(tHandle);
  // front: umbrella high-gain antenna on a mast, TV camera, low-gain antenna
  rover.add(tube(new THREE.Vector3(0.25, H, L * 0.36), new THREE.Vector3(0.25, H + 1.25, L * 0.36), 0.018, mats.alu));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 10, 0, Math.PI * 2, 0, Math.PI * 0.32), mats.meshDark);
  dish.position.set(0.25, H + 1.55, L * 0.36); dish.rotation.x = Math.PI * 0.85; rover.add(dish);
  const ribs = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.SphereGeometry(0.505, 16, 4, 0, Math.PI * 2, 0, Math.PI * 0.32)), mats.wire);
  ribs.position.copy(dish.position); ribs.rotation.copy(dish.rotation); rover.add(ribs);
  rover.add(tube(new THREE.Vector3(-0.3, H, L * 0.4), new THREE.Vector3(-0.3, H + 0.75, L * 0.4), 0.014, mats.alu));
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.32), mats.white); cam.position.set(-0.3, H + 0.85, L * 0.4); rover.add(cam);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 16), mats.glass); lens.rotation.x = Math.PI / 2; lens.position.set(-0.3, H + 0.85, L * 0.4 + 0.2); rover.add(lens);
  rover.add(tube(new THREE.Vector3(-0.55, H, L * 0.3), new THREE.Vector3(-0.55, H + 0.9, L * 0.3), 0.01, mats.alu));
  const helix = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.25, 10), mats.white); helix.position.set(-0.55, H + 1.0, L * 0.3); rover.add(helix);
  // front battery/electronics boxes (gold thermal cover) and rear tool pallet
  const front = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.55, 0.22, 0.5), mats.foil); front.position.set(0, H + 0.13, L * 0.38); rover.add(front);
  const mirrors = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.5, 0.012, 0.42), mats.chrome); mirrors.position.set(0, H + 0.25, L * 0.38); rover.add(mirrors);
  const pallet = new THREE.Mesh(new THREE.BoxGeometry(Wd * 0.5, 0.35, 0.4), mats.alu); pallet.position.set(0, H + 0.2, -L * 0.42); rover.add(pallet);
  for (let i = 0; i < 4; i++) rover.add(tube(new THREE.Vector3(-0.35 + i * 0.23, H + 0.35, -L * 0.42), new THREE.Vector3(-0.35 + i * 0.23, H + 0.95, -L * 0.45), 0.012, mats.chrome));
  return rover;
}

export function buildBlueGhost() {
  const mats = {
    foil: std(0xd6ad55, 0.28, 0.9),
    foilDark: std(0x8a6a2c, 0.35, 0.85),
    white: std(0xe9e9e4, 0.45, 0.1),
    mli: std(0xbfc3ca, 0.3, 0.8),
    panel: std(0x1b2a5a, 0.25, 0.5),
    cell: std(0x24386e, 0.2, 0.6),
    alu: std(0xc9ccd2, 0.35, 0.85),
    dark: std(0x2a2e36, 0.6, 0.4),
    radiator: std(0xf4f4f0, 0.6, 0.05),
  };
  const g = new THREE.Group(); g.name = 'Blue Ghost lander (original model)';
  const bodyH = 0.9; const deckY = 1.15;
  // main octagonal body wrapped in gold thermal blanket, silver top deck
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, bodyH, 8), mats.foil);
  body.position.y = deckY - bodyH / 2; body.rotation.y = Math.PI / 8; g.add(body);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.05, 8), mats.mli); deck.position.y = deckY; deck.rotation.y = Math.PI / 8; g.add(deck);
  // blanket seams for detail
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.015, bodyH, 0.02), mats.foilDark);
    seam.position.set(Math.cos(a) * 1.02, deckY - bodyH / 2, Math.sin(a) * 1.02); seam.rotation.y = -a; g.add(seam);
  }
  // white radiator panels on two faces
  for (const a of [Math.PI / 2, -Math.PI / 2]) {
    const rad = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.02), mats.radiator);
    rad.position.set(Math.cos(a) * 1.04, deckY - bodyH / 2, Math.sin(a) * 1.04); rad.rotation.y = -a + Math.PI / 2; g.add(rad);
  }
  // vertical solar panels on the sides, with cell grid
  for (const a of [0, Math.PI]) {
    const p = new THREE.Group(); p.position.set(Math.cos(a) * 1.13, deckY - 0.1, Math.sin(a) * 1.13); p.rotation.y = -a + Math.PI / 2; g.add(p);
    p.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, 0.03), mats.panel));
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const cell = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), mats.cell);
      cell.position.set(-0.45 + c * 0.18, -0.33 + r * 0.22, 0.017); p.add(cell);
    }
  }
  // payload deck: assorted instrument boxes, a small dish antenna and a camera mast
  const boxes = [[0.4, 0.3, 0.25, 0.3, 0.2, mats.white], [0.3, 0.25, 0.3, -0.35, 0.3, mats.mli], [0.22, 0.4, 0.22, 0.05, -0.45, mats.foil], [0.35, 0.18, 0.28, -0.4, -0.25, mats.dark], [0.2, 0.2, 0.2, 0.55, -0.2, mats.white]];
  for (const [w, h, d, x, z, m] of boxes) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, deckY + h / 2 + 0.025, z); g.add(b); }
  g.add(tube(new THREE.Vector3(0.6, deckY, 0.45), new THREE.Vector3(0.6, deckY + 0.7, 0.45), 0.02, mats.alu));
  const ant = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 8, 0, Math.PI * 2, 0, Math.PI * 0.35), mats.white);
  ant.position.set(0.6, deckY + 0.88, 0.45); ant.rotation.x = Math.PI * 0.75; g.add(ant);
  g.add(tube(new THREE.Vector3(-0.55, deckY, -0.55), new THREE.Vector3(-0.55, deckY + 0.55, -0.55), 0.015, mats.alu));
  const cam = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.16), mats.dark); cam.position.set(-0.55, deckY + 0.6, -0.55); g.add(cam);
  // engine bell under the body
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.4, 24, 1, true), mats.dark);
  bell.position.y = deckY - bodyH - 0.15; g.add(bell);
  // four landing legs with struts and footpads (+ a fifth leg like the one NASA's dust shield rode on)
  const legAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4, 0.25];
  legAngles.forEach((a, i) => {
    const fifth = i === 4;
    const top = new THREE.Vector3(Math.cos(a) * 0.85, deckY - 0.25, Math.sin(a) * 0.85);
    const foot = new THREE.Vector3(Math.cos(a) * (fifth ? 1.5 : 1.75), 0.08, Math.sin(a) * (fifth ? 1.5 : 1.75));
    g.add(tube(top, foot, fifth ? 0.03 : 0.045, mats.alu));
    const strut = new THREE.Vector3(Math.cos(a) * 0.95, deckY - bodyH + 0.05, Math.sin(a) * 0.95);
    g.add(tube(strut, foot.clone().lerp(top, 0.25), 0.025, mats.alu));
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(fifth ? 0.14 : 0.2, fifth ? 0.16 : 0.22, 0.06, 20), fifth ? mats.radiator : mats.alu);
    if (fifth) pad.name = 'bg-eds';
    pad.position.copy(foot).setY(0.04); g.add(pad);
  });
  return g;
}

/** id -> builder, used by the viewer and thumbnails when a manifest entry says "procedural". */
export const ORIGINALS = { lrv: buildLRV, 'blue-ghost': buildBlueGhost };
