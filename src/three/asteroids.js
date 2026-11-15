// Procedural asteroids (original, made in code). Irregular lumpy bodies with
// bowl-shaped craters and raised rims, fine surface grit, darker crater floors
// and brighter rims. A handful of unique shapes are built once and reused, so
// the field stays cheap to draw. Sizes come from the real NeoWs snapshot.
import * as THREE from 'three';

// small seeded random so every rock shape is repeatable
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// value noise on the sphere (3D), smooth and cheap
function makeNoise(rand) {
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rand() * 2 - 1);
  const h = (x, y, z) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const fade = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const n = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = fade(x - xi), yf = fade(y - yi), zf = fade(z - zi);
    return lerp(
      lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), xf), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), xf), yf),
      lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), xf), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), xf), yf), zf);
  };
  return (x, y, z, oct = 4) => { let a = 0.5, f = 1, s = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f, z * f); a *= 0.5; f *= 2.1; } return s; };
}

/** One rock geometry with vertex colors. detail 4 ≈ 5k triangles. */
export function makeRockGeometry(seed, detail = 4) {
  const rand = rng(seed);
  const noise = makeNoise(rand);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position;
  const axes = new THREE.Vector3(0.75 + rand() * 0.45, 0.55 + rand() * 0.35, 0.65 + rand() * 0.4);
  const craters = [];
  const nCr = 14 + Math.floor(rand() * 12);
  for (let i = 0; i < nCr; i++) {
    const d = new THREE.Vector3(rand() * 2 - 1, rand() * 2 - 1, rand() * 2 - 1).normalize();
    const big = rand() < 0.2;
    craters.push({ d, r: big ? 0.35 + rand() * 0.25 : 0.08 + rand() * 0.16, depth: big ? 0.12 + rand() * 0.06 : 0.04 + rand() * 0.05 });
  }
  const colors = new Float32Array(pos.count * 3);
  const base = new THREE.Color().setHSL(0.07 + rand() * 0.04, 0.12 + rand() * 0.1, 0.36 + rand() * 0.1);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    // big lumps + medium bumps + fine grit
    let r = 1 + noise(v.x * 1.3 + 7, v.y * 1.3, v.z * 1.3, 3) * 0.55 + noise(v.x * 4, v.y * 4, v.z * 4, 3) * 0.12 + noise(v.x * 14, v.y * 14, v.z * 14, 2) * 0.035;
    let shade = 0;
    for (const c of craters) {
      const ang = v.angleTo(c.d);
      if (ang < c.r * 1.45) {
        const k = ang / c.r;
        if (k < 1) { r -= c.depth * (1 - k * k); shade -= 0.22 * (1 - k); }        // bowl
        else { const rim = 1 - (k - 1) / 0.45; r += c.depth * 0.35 * rim; shade += 0.12 * rim; }  // raised rim
      }
    }
    v.multiply(axes).multiplyScalar(r);
    pos.setXYZ(i, v.x, v.y, v.z);
    const grit = noise(v.x * 9 + 3, v.y * 9, v.z * 9, 2) * 0.18;
    const c = base.clone().offsetHSL(0, 0, shade + grit);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** Shared rock material with a fine generated normal map for surface grain. */
export function makeRockMaterial() {
  const size = 256;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const img = g.createImageData(size, size);
  const rand = rng(99);
  const hgt = new Float32Array(size * size).map(() => rand());
  // blur the height a little so the grain reads as pebbles, not static
  const at = (x, y) => hgt[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * 0.9;
      const dy = (at(x, y + 1) - at(x, y - 1)) * 0.9;
      const i = (y * size + x) * 4;
      img.data[i] = 128 + dx * 100; img.data[i + 1] = 128 + dy * 100; img.data[i + 2] = 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const normal = new THREE.CanvasTexture(cv);
  normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
  normal.repeat.set(4, 2);
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, normalMap: normal, normalScale: new THREE.Vector2(0.6, 0.6) });
  // soft cool rim light so rocks read against black space instead of as dark blobs
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float rimK = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
      totalEmissiveRadiance += vec3(0.20, 0.30, 0.42) * rimK;`);
  };
  return mat;
}

/** Map a real diameter (m) to a scene scale: log scale so tiny and huge rocks both read. */
export function sizeFromDiameter(m) {
  const d = Math.max(5, m || 50);
  return 0.025 + (Math.log10(d) - 0.7) * 0.03;
}
