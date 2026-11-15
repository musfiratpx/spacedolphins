// Builds assets/models/new-horizons.glb from NASA's printable New Horizons parts
// (science.nasa.gov/3d-resources/new-horizons/), assembled per NASA's assembly sheet:
// dish antenna on top of the body, RTG plugged horizontally into the narrow end.
// Runs in the browser (dev server); the CDP helper in the README saves the result.
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

export async function buildNewHorizons(opts = {}) {
  // positions found by matching NASA's assembly sheet: the RTG mount is the flat facet on the
  // body's -Z corner; the antenna's dowels sit near the middle of the triangular top
  const o = { antenna: [-0.1, 2.06, 0.15], rtg: [0, 0.95, -1.75], rtgRot: [-Math.PI / 2, 0, 0], ...opts };
  const load = (n) => new STLLoader().loadAsync(`scripts/sources/new-horizons/7399_05_rp_${n}.stl`);
  const [body, antenna, rtg] = await Promise.all([load('body'), load('antenna'), load('rtg')]);
  for (const g of [body, antenna, rtg]) g.computeVertexNormals();
  const mat = {
    // gold thermal blanket on the body, white dish, dark RTG fins
    foil: new THREE.MeshStandardMaterial({ name: 'gold-blanket', color: 0xd4a849, metalness: 0.85, roughness: 0.32 }),
    dish: new THREE.MeshStandardMaterial({ name: 'antenna-white', color: 0xe9e9e4, metalness: 0.05, roughness: 0.45 }),
    rtg: new THREE.MeshStandardMaterial({ name: 'rtg-metal', color: 0x4a4e57, metalness: 0.75, roughness: 0.4 }),
  };
  const root = new THREE.Group(); root.name = 'New Horizons';
  const bodyM = new THREE.Mesh(body, mat.foil); bodyM.name = 'body'; root.add(bodyM);
  const antM = new THREE.Mesh(antenna, mat.dish); antM.name = 'high-gain antenna'; antM.position.set(...o.antenna); root.add(antM);
  const rtgM = new THREE.Mesh(rtg, mat.rtg); rtgM.name = 'RTG';
  rtgM.position.set(...o.rtg); rtgM.rotation.set(...o.rtgRot); root.add(rtgM);
  return root;
}

export async function exportGLB(root) {
  const buf = await new GLTFExporter().parseAsync(root, { binary: true });
  let s = ''; const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
