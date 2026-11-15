// Saves a snapshot of near-Earth asteroids from NASA NeoWs into data/asteroids.json.
// Usage:  node scripts/fetch-asteroids.js            (last 7 days)
//         node scripts/fetch-asteroids.js 2026-11-08 (7 days starting that date)
// Needs NASA_API_KEY in .env (copy .env.example). Falls back to DEMO_KEY (very low rate limit).
import fs from 'node:fs';
import path from 'node:path';

function readEnv() {
  const file = path.resolve('.env');
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/)
      .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }),
  );
}

const env = { ...readEnv(), ...process.env };
const key = env.NASA_API_KEY || 'DEMO_KEY';
if (key === 'DEMO_KEY') console.warn('Using DEMO_KEY. Get a free key at https://api.nasa.gov/ and put it in .env');

const day = (d) => d.toISOString().slice(0, 10);
const start = process.argv[2] ? new Date(`${process.argv[2]}T00:00:00Z`) : new Date(Date.now() - 6 * 864e5);
const end = new Date(start.getTime() + 6 * 864e5);   // NeoWs feed allows at most 7 days

const url = `https://api.nasa.gov/neo/rest/v1/feed?start_date=${day(start)}&end_date=${day(end)}&api_key=${encodeURIComponent(key)}`;
console.log(`Fetching NeoWs feed ${day(start)} to ${day(end)} ...`);
const res = await fetch(url);
if (!res.ok) { console.error(`NeoWs error ${res.status}: ${await res.text()}`); process.exit(1); }
const feed = await res.json();

const asteroids = Object.values(feed.near_earth_objects).flat().map((a) => {
  const ca = a.close_approach_data?.[0] || {};
  return {
    id: a.id,
    name: a.name,
    diameterMinM: Math.round(a.estimated_diameter.meters.estimated_diameter_min),
    diameterMaxM: Math.round(a.estimated_diameter.meters.estimated_diameter_max),
    hazardous: a.is_potentially_hazardous_asteroid,
    closeApproachDate: ca.close_approach_date,
    speedKph: Math.round(Number(ca.relative_velocity?.kilometers_per_hour || 0)),
    missDistanceKm: Math.round(Number(ca.miss_distance?.kilometers || 0)),
    nasaUrl: a.nasa_jpl_url,
  };
}).sort((a, b) => b.diameterMaxM - a.diameterMaxM);

const out = {
  source: 'NASA NeoWs feed (https://api.nasa.gov/)',
  fetchedAt: new Date().toISOString(),
  range: { start: day(start), end: day(end) },
  count: asteroids.length,
  largest: asteroids[0]?.name || null,
  asteroids,
};
fs.mkdirSync('data', { recursive: true });
fs.writeFileSync('data/asteroids.json', JSON.stringify(out, null, 2) + '\n');
console.log(`Saved ${asteroids.length} asteroids to data/asteroids.json (largest: ${out.largest})`);
