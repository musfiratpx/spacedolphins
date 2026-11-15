import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// data/ and assets/ are fetched at runtime (so teammates can edit JSON and drop in
// models/sounds without touching code). This copies them into dist/ on build.
function copyRuntimeFolders() {
  return {
    name: 'copy-runtime-folders',
    closeBundle() {
      for (const dir of ['data', 'assets']) {
        const from = path.resolve(dir);
        const to = path.resolve('dist', dir);
        if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true });
      }
    },
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  build: { outDir: 'dist', chunkSizeWarningLimit: 1200 },
  plugins: [copyRuntimeFolders()],
  // pre-bundle three and its add-ons together so the dev server ships ONE copy of three
  optimizeDeps: {
    include: [
      'three',
      'three/examples/jsm/loaders/GLTFLoader.js',
      'three/examples/jsm/loaders/DRACOLoader.js',
      'three/examples/jsm/environments/RoomEnvironment.js',
      'three/examples/jsm/controls/OrbitControls.js',
      // dev-only: scripts/convert-new-horizons.js
      'three/examples/jsm/loaders/STLLoader.js',
      'three/examples/jsm/exporters/GLTFExporter.js',
    ],
  },
});
