// Renders small 3D snapshots of NASA models for the Hardwaredex grid.
// One offscreen renderer draws every thumbnail, then it's freed. Results are
// cached for the session. Locked machines render as silhouettes.
import * as THREE from 'three';
import { getGLTFLoader } from './loader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { getModel } from '../core/manifest.js';
import { ORIGINALS } from './originals.js';
import { applySilhouette, disposeObject, polish, fitObject } from './viewer.js';

const cache = new Map();   // `${model}:${locked}` -> dataURL | null
const W = 320; const H = 220;

/**
 * @param {{model: string, locked: boolean}[]} jobs
 * @param {(job, url: string|null) => void} onEach
 */
export async function renderThumbs(jobs, onEach) {
  const todo = [];
  for (const j of jobs) {
    const key = `${j.model}:${j.locked}`;
    if (cache.has(key)) onEach(j, cache.get(key)); else todo.push(j);
  }
  if (!todo.length) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch { todo.forEach((j) => onEach(j, null)); return; }
  renderer.setSize(W, H, false);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc2dde4, 2.2); rim.position.set(-4, 2, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.01, 100);
  camera.position.set(2.6, 1.3, 3.4);
  camera.lookAt(0, 0, 0);
  const loader = getGLTFLoader();

  try {
    for (const j of todo) {
      const k = `${j.model}:${j.locked}`;
      const { url, placeholder, entry, procedural } = getModel(j.model);
      if (placeholder) { cache.set(k, null); onEach(j, null); continue; }
      let tries = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) try {
        const gltf = procedural ? { scene: ORIGINALS[procedural]() } : await loader.loadAsync(url);
        const obj = gltf.scene;
        if (j.locked) applySilhouette(obj); else polish(obj);
        const { wrap } = fitObject(obj, 2.3, entry?.fit);
        scene.add(wrap);
        renderer.render(scene, camera);
        const data = renderer.domElement.toDataURL('image/png');
        scene.remove(wrap); disposeObject(wrap);
        cache.set(k, data);
        onEach(j, data);
        break;
      } catch (err) {
        if (tries++ < 1) { console.info(`[thumbs] ${j.model} retrying`); continue; }
        console.warn(`[thumbs] ${j.model} failed`, err);
        onEach(j, null);   // not cached, so the next visit tries again
        break;
      }
    }
  } finally {
    env.dispose();
    renderer.dispose();
    renderer.forceContextLoss?.();
  }
}
