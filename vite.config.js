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
});
