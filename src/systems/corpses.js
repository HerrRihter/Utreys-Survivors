import { compact } from '../core/compact.js';

// Fallen enemies: a cached pose per unit that tips over and fades out. A body keeps only its
// unit; the pose canvas stays in the cache.
export function createCorpses({ enemies, createCanvas }) {
  const lifetime = 8,
    fadeTime = 2,
    limit = 180,
    cache = new Map();
  function pose(e) {
    const key = e.unit;
    if (cache.has(key)) return cache.get(key);
    const c = createCanvas(256, 256),
      g = c?.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false;
    enemies.draw(g, { ...e, x: 128, y: 196, heading: 0, hit: 0, action: null, animationTime: 0 });
    cache.set(key, c);
    return c;
  }
  function add(list, e, impact = { x: 1, y: 0 }) {
    const length = Math.hypot(impact.x, impact.y),
      nx = length > 0 ? impact.x / length : 1,
      ny = length > 0 ? impact.y / length : 0;
    list.push({
      x: e.x,
      y: e.y,
      age: 0,
      flip: Math.cos(e.heading || 0) < 0,
      fallX: nx,
      fallY: ny,
      angle: Math.atan2(nx, -ny / 0.58),
      unit: e.unit,
    });
    // The pose is drawn once per unit, from the first enemy of that unit that falls.
    pose(e);
    if (list.length > limit) list.splice(0, list.length - limit);
  }
  function update(list, dt) {
    for (const body of list) body.age += dt;
    return compact(list, (body) => body.age < lifetime);
  }
  function opacity(body) {
    return Math.min(1, Math.max(0, (lifetime - body.age) / fadeTime));
  }
  function draw(g, list, cx, cy, w, h) {
    for (const b of list) {
      if (b.x < cx - 100 || b.x > cx + w + 100 || b.y < cy - 100 || b.y > cy + h + 100) continue;
      const fall = Math.min(1, b.age / 0.32),
        ease = 1 - (1 - fall) ** 3;
      const x = b.x + b.fallX * 18 * ease,
        y = b.y + b.fallY * 18 * ease;
      g.save();
      g.globalAlpha = opacity(b);
      g.fillStyle = '#11261944';
      g.beginPath();
      g.ellipse(x, y + 3, 31, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.translate(x, y - 40 * (1 - ease));
      g.scale(1, 1 - 0.42 * ease);
      g.rotate(b.angle * ease);
      g.scale(b.flip ? -1 : 1, 1);
      const frame = cache.get(b.unit);
      if (frame) g.drawImage(frame, -128, -196);
      g.restore();
    }
  }
  return { add, update, draw };
}
