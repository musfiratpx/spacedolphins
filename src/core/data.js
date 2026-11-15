// Loads the plain data files the engine reads.
let hardware = null;
const songs = new Map();

export async function loadHardware() {
  if (!hardware) {
    const res = await fetch('data/hardware.json', { cache: 'no-store' });
    hardware = await res.json();
  }
  return hardware;
}

export function getHardware() { return hardware; }

export function machinesIn(regionId) {
  return hardware.machines.filter((m) => m.region === regionId);
}

export function getMachine(id) {
  return hardware.machines.find((m) => m.id === id);
}

export function getRegion(id) {
  return hardware.regions.find((r) => r.id === id);
}

export async function loadSong(id) {
  if (!songs.has(id)) {
    const res = await fetch(`data/songs/${id}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Song ${id} not found`);
    songs.set(id, await res.json());
  }
  return songs.get(id);
}
