// Mission patches (original art, drawn in code): one embroidered-style badge per
// machine, with a stitched border in its region color, an icon of what kind of
// machine it is, its short name and the year it arrived.
import { getHardware } from '../core/data.js';
import { state } from '../core/state.js';

const KIND = {
  viking: 'lander', insight: 'lander', 'apollo11-descent': 'lander', 'blue-ghost': 'lander',
  opportunity: 'rover', 'apollo17-rover': 'rover', ingenuity: 'heli',
  lro: 'orbiter', cassini: 'probe', voyager1: 'probe', voyager2: 'probe', 'new-horizons': 'probe',
};

function icon(c, kind, x, y, s, ink) {
  c.save(); c.translate(x, y); c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = s * 0.06; c.lineCap = 'round'; c.lineJoin = 'round';
  const line = (pts) => { c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a * s, b * s) : c.moveTo(a * s, b * s))); c.stroke(); };
  if (kind === 'lander') {
    c.fillRect(-0.28 * s, -0.12 * s, 0.56 * s, 0.22 * s);
    line([[-0.22, 0.1], [-0.4, 0.38]]); line([[0.22, 0.1], [0.4, 0.38]]); line([[0, 0.1], [0, 0.36]]);
    line([[-0.5, 0.38], [-0.3, 0.38]]); line([[0.3, 0.38], [0.5, 0.38]]);
    c.beginPath(); c.arc(0.12 * s, -0.26 * s, 0.1 * s, Math.PI, 0); c.stroke(); line([[0.12, -0.26], [0.12, -0.12]]);
  } else if (kind === 'rover') {
    c.fillRect(-0.36 * s, -0.08 * s, 0.72 * s, 0.18 * s);
    for (const wx of [-0.3, 0, 0.3]) { c.beginPath(); c.arc(wx * s, 0.24 * s, 0.1 * s, 0, 7); c.stroke(); }
    line([[0.22, -0.08], [0.22, -0.36]]); c.fillRect(0.12 * s, -0.44 * s, 0.22 * s, 0.1 * s);
  } else if (kind === 'heli') {
    line([[-0.48, -0.28], [0.48, -0.2]]); line([[-0.48, -0.18], [0.48, -0.3]]); line([[0, -0.24], [0, -0.04]]);
    c.fillRect(-0.12 * s, -0.04 * s, 0.24 * s, 0.2 * s);
    line([[-0.1, 0.16], [-0.3, 0.4]]); line([[0.1, 0.16], [0.3, 0.4]]);
  } else if (kind === 'orbiter') {
    c.fillRect(-0.14 * s, -0.14 * s, 0.28 * s, 0.28 * s);
    c.strokeRect(-0.5 * s, -0.08 * s, 0.3 * s, 0.16 * s); c.strokeRect(0.2 * s, -0.08 * s, 0.3 * s, 0.16 * s);
  } else {
    c.beginPath(); c.arc(0, -0.08 * s, 0.3 * s, Math.PI * 0.05, Math.PI * 0.95); c.stroke();
    line([[0, -0.08], [0, 0.18]]); c.fillRect(-0.1 * s, 0.12 * s, 0.2 * s, 0.16 * s); line([[0.1, 0.2], [0.42, 0.34]]);
  }
  c.restore();
}

/** Draw one patch centered at (x, y) with diameter d. Locked = dashed outline only. */
export function drawPatch(c, x, y, d, m, color, earned = true) {
  const r = d / 2;
  c.save();
  if (!earned) {
    c.setLineDash([d * 0.05, d * 0.05]); c.strokeStyle = 'rgba(232,236,245,.35)'; c.lineWidth = d * 0.03;
    c.beginPath(); c.arc(x, y, r * 0.92, 0, 7); c.stroke();
    c.fillStyle = 'rgba(232,236,245,.35)'; c.font = `900 ${d * 0.3}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', x, y);
    c.restore(); return;
  }
  // embroidered border, twill field, stitched inner ring
  c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r * 0.86);
  g.addColorStop(0, '#1d2756'); g.addColorStop(1, '#0B1026');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.84, 0, 7); c.fill();
  c.setLineDash([d * 0.025, d * 0.02]); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = d * 0.012;
  c.beginPath(); c.arc(x, y, r * 0.92, 0, 7); c.stroke(); c.setLineDash([]);
  // stars
  c.fillStyle = 'rgba(232,236,245,.7)';
  for (const [sx, sy] of [[-0.5, -0.35], [0.45, -0.45], [0.55, 0.05], [-0.6, 0.1]]) c.fillRect(x + sx * r, y + sy * r, d * 0.018, d * 0.018);
  icon(c, KIND[m.id] || 'probe', x, y - r * 0.12, d * 0.5, '#E8ECF5');
  // name banner + year
  c.fillStyle = color; c.fillRect(x - r * 0.78, y + r * 0.36, r * 1.56, r * 0.32);
  c.fillStyle = '#0B1026'; c.font = `900 ${d * 0.1}px Nunito, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText((m.short || m.name).toUpperCase(), x, y + r * 0.52, r * 1.5);
  c.fillStyle = '#F2B134'; c.font = `700 ${d * 0.085}px "Space Mono", monospace`; c.fillText(String(m.arrived), x, y - r * 0.66);
  c.restore();
}

/** The patch board: every machine in a grid, earned ones in color. */
export function drawPatchBoard(c, w, h, { cols = 2 } = {}) {
  const { machines, regions } = getHardware();
  const color = Object.fromEntries(regions.map((r) => [r.id, r.color]));
  c.fillStyle = '#2a2f45'; c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < w; i += 6) c.fillRect(i, 0, 2, h);   // felt texture
  c.strokeStyle = '#8a6a2c'; c.lineWidth = Math.max(2, w * 0.02); c.strokeRect(1, 1, w - 2, h - 2);
  const rows = Math.ceil(machines.length / cols);
  const cw = w / cols; const ch = h / rows; const d = Math.min(cw, ch) * 0.86;
  machines.forEach((m, i) => drawPatch(c, cw * (i % cols) + cw / 2, ch * Math.floor(i / cols) + ch / 2, d, m, color[m.region], Boolean(state.unlocked[m.id])));
}
