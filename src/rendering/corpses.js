import { corpseOpacity } from '../systems/queries/corpses.js';

// Fallen enemies: a pose per unit, drawn once by the enemy renderer into an offscreen canvas,
// tips over in the fall direction and fades out. `enemies` draws a standing enemy;
// `createCanvas` makes the pose canvases (none in headless tests: nothing is drawn).
export function createCorpseRenderer({ enemies, createCanvas }) {
  const poses = new Map();
  function pose(unit) {
    if (poses.has(unit)) return poses.get(unit);
    const c = createCanvas(256, 256),
      g = c?.getContext('2d');
    if (!g) return null;
    g.imageSmoothingEnabled = false;
    enemies.draw(g, { unit, x: 128, y: 196, heading: 0, hit: 0, action: null, animationTime: 0 });
    poses.set(unit, c);
    return c;
  }
  // Bodies within 100 px of the screen rectangle (cx, cy, w, h).
  function draw(g, list, cx, cy, w, h) {
    for (const b of list) {
      if (b.x < cx - 100 || b.x > cx + w + 100 || b.y < cy - 100 || b.y > cy + h + 100) continue;
      const fall = Math.min(1, b.age / 0.32),
        ease = 1 - (1 - fall) ** 3;
      const x = b.x + b.fallX * 18 * ease,
        y = b.y + b.fallY * 18 * ease;
      g.save();
      g.globalAlpha = corpseOpacity(b);
      g.fillStyle = '#11261944';
      g.beginPath();
      g.ellipse(x, y + 3, 31, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.translate(x, y - 40 * (1 - ease));
      g.scale(1, 1 - 0.42 * ease);
      g.rotate(b.angle * ease);
      g.scale(b.flip ? -1 : 1, 1);
      const frame = pose(b.unit);
      if (frame) g.drawImage(frame, -128, -196);
      g.restore();
    }
  }
  return { draw };
}
