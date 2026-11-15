// Tiny event bus. Every system talks through this so later phases can plug in
// without rewrites. Event names are listed in CLAUDE.md ("Required hooks").
const handlers = new Map();

export function on(event, fn) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(fn);
  return () => off(event, fn);
}

export function off(event, fn) {
  handlers.get(event)?.delete(fn);
}

export function once(event, fn) {
  const wrap = (data) => { off(event, wrap); fn(data); };
  return on(event, wrap);
}

export function emit(event, data) {
  const set = handlers.get(event);
  if (!set) return;
  for (const fn of [...set]) {
    try { fn(data); } catch (err) { console.error(`[bus] ${event} handler failed`, err); }
  }
}

export const bus = { on, off, once, emit };
