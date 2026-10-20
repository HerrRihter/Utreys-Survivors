import { eventSpec } from '../systems/queries/events.js';
import { inBox } from '../core/math.js';

import { nodeAvailable } from '../systems/queries/nodes.js';

// Off-screen markers at the screen edge pointing to the nearest unresolved node and the boss.

// Where a marker for a world point sits on screen, or null when the point is visible.
// `cx`, `cy` is the camera origin. The marker stays inside the screen by `margin` pixels at the
// sides and by shares of the height at the top and bottom, clear of the HUD panels there.
export function edgeMarker(target, cx, cy, width, height, margin = 30) {
  const sx = target.x - cx,
    sy = target.y - cy;
  if (inBox({ x: sx, y: sy }, { minX: 0, minY: 0, maxX: width, maxY: height })) return null;
  const left = margin,
    right = width - margin,
    top = Math.max(margin, height * 0.27, 105),
    // On short screens the status lines sit at the bottom centre.
    bottom = height - Math.max(margin, height * 0.2, height <= 500 ? 112 : 0);
  const mx = width / 2,
    my = (top + bottom) / 2,
    dx = sx - mx,
    dy = sy - my;
  // Scale the ray from the middle of the safe area until it meets its border.
  const scale = Math.min(
    dx ? (dx > 0 ? right - mx : mx - left) / Math.abs(dx) : Infinity,
    dy ? (dy > 0 ? bottom - my : my - top) / Math.abs(dy) : Infinity,
  );
  return { x: mx + dx * scale, y: my + dy * scale, angle: Math.atan2(dy, dx) };
}

// Targets worth pointing at: the closest guarded node and a living boss.
export function edgeTargets(s) {
  const out = [];
  let node = null,
    best = Infinity;
  for (const n of s.nodes) {
    if (!nodeAvailable(n)) continue;
    const d = Math.hypot(n.x - s.p.x, n.y - s.p.y);
    if (d < best) {
      best = d;
      node = n;
    }
  }
  if (node) out.push({ x: node.x, y: node.y, label: node.label, color: '#ffd54f', distance: best });
  const marker = eventSpec(s)?.marker;
  if (marker)
    out.push({
      x: s.event.x,
      y: s.event.y,
      label: marker,
      color: '#ff8a65',
      distance: Math.hypot(s.event.x - s.p.x, s.event.y - s.p.y),
    });
  for (const e of s.enemies)
    if (e.boss && e.hp > 0)
      out.push({
        x: e.x,
        y: e.y,
        label: 'ЦРПТ',
        color: '#ff5252',
        distance: Math.hypot(e.x - s.p.x, e.y - s.p.y),
      });
  return out;
}

export function drawEdgeArrows(g, s, cx, cy, width, height) {
  for (const t of edgeTargets(s)) {
    const m = edgeMarker(t, cx, cy, width, height);
    if (!m) continue;
    g.save();
    g.translate(m.x, m.y);
    g.save();
    g.rotate(m.angle);
    g.fillStyle = t.color;
    g.globalAlpha = 0.9;
    g.beginPath();
    g.moveTo(14, 0);
    g.lineTo(-6, -9);
    g.lineTo(-2, 0);
    g.lineTo(-6, 9);
    g.closePath();
    g.fill();
    g.restore();
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    g.fillStyle = '#08171a';
    // Long node ids are shortened on small screens.
    const label = width < 700 && t.label.length > 14 ? t.label.slice(0, 13) + '…' : t.label;
    const text = `${label} · ${Math.round(t.distance / 10) * 10}`;
    // Keep the whole label on screen next to a marker at the side.
    const half = (g.measureText?.(text).width || 0) / 2 + 4;
    const tx = Math.min(Math.max(0, half - m.x), width - half - m.x);
    g.fillText(text, tx + 1, 21);
    g.fillStyle = t.color;
    g.fillText(text, tx, 20);
    g.restore();
  }
}
