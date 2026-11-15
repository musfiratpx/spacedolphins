// Asset manifest loader. Uses the real file when it's present, a marked
// placeholder when it's missing, and logs a summary of what's missing.
const status = new Map();   // url -> boolean (exists)
let manifest = { models: {}, sounds: {} };

async function exists(url) {
  if (status.has(url)) return status.get(url);
  let ok = false;
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    const type = res.headers.get('content-type') || '';
    // Dev servers can answer missing files with index.html; treat that as missing.
    ok = res.ok && !type.includes('text/html');
  } catch { ok = false; }
  status.set(url, ok);
  return ok;
}

export async function loadManifest() {
  try {
    const res = await fetch('assets/manifest.json', { cache: 'no-store' });
    manifest = await res.json();
  } catch (err) {
    console.warn('[manifest] assets/manifest.json missing or invalid; using placeholders', err);
  }
  await checkAll();
  return manifest;
}

async function checkAll() {
  const missing = [];
  const entries = [
    ...Object.entries(manifest.models || {}).map(([id, m]) => ['model', id, m]),
    ...Object.entries(manifest.sounds || {}).map(([id, s]) => ['sound', id, s]),
  ];
  await Promise.all(entries.map(async ([kind, id, entry]) => {
    const url = entry.file;
    entry.present = url ? await exists(url) : false;
    if (!entry.present) missing.push(`${kind}:${id} (${url || 'no file set'})`);
  }));
  if (missing.length) {
    console.groupCollapsed(`[manifest] ${missing.length} asset(s) missing; placeholders in use`);
    missing.forEach((m) => console.info(m));
    console.groupEnd();
  } else {
    console.info('[manifest] all assets present');
  }
}

/** @returns {{ url: string|null, placeholder: boolean, entry: object|null }} */
export function getModel(id) {
  const entry = manifest.models?.[id] || null;
  if (entry?.present) return { url: entry.file, placeholder: false, entry };
  return { url: null, placeholder: true, entry };
}

export function getSound(id) {
  const entry = manifest.sounds?.[id] || null;
  if (entry?.present) return { url: entry.file, placeholder: false, entry };
  return { url: null, placeholder: true, entry };
}

export function getManifest() { return manifest; }
