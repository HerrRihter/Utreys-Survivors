import { neonStroke, neon } from './neon.js';
import { browserCanvas } from './offscreen.js';

// Draws an arena's datacenter floor: grid, data buses, server racks and the core rings.
// `arena` is the geometry from world/arenas.js ({ size, racks }).
export function createArenaFloor({ createCanvas = browserCanvas } = {}) {
  // Floor + grid + data buses repeat every 400 px: one tile per arena, drawn once per device ratio.
  const tileSize = 400;
  const tiles = new WeakMap();
  function paintTile(g) {
    g.fillStyle = '#0a1619';
    g.fillRect(0, 0, tileSize, tileSize);
    g.strokeStyle = '#122e35';
    g.lineWidth = 1;
    g.beginPath();
    // Edge lines straddle the seam: each tile paints its half, neighbours complete them.
    for (let p = 0; p <= tileSize; p += 100) {
      g.moveTo(p, 0);
      g.lineTo(p, tileSize);
      g.moveTo(0, p);
      g.lineTo(tileSize, p);
    }
    g.stroke();
    g.strokeStyle = '#00e5ff33';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(200, 0);
    g.lineTo(200, tileSize);
    g.moveTo(0, 200);
    g.lineTo(tileSize, 200);
    g.stroke();
  }
  function groundPattern(g, arena, ratio) {
    let cached = tiles.get(arena);
    if (!cached || cached.ratio !== ratio) {
      const canvas = createCanvas(Math.round(tileSize * ratio), Math.round(tileSize * ratio));
      const c = canvas?.getContext('2d');
      if (!c) return null;
      c.scale(ratio, ratio);
      paintTile(c);
      const tile = g.createPattern?.(canvas, 'repeat') || null;
      tile?.setTransform?.({ a: 1 / ratio, b: 0, c: 0, d: 1 / ratio, e: 0, f: 0 });
      cached = { tile, ratio };
      tiles.set(arena, cached);
    }
    return cached.tile;
  }

  // view = visible world rectangle; without it the whole floor is drawn (previews).
  function draw(g, arena, view) {
    const size = arena.size;
    const scale = g.getTransform?.()?.a;
    // Match the screen transform so the repeated floor does not get resampled.
    const pattern = view && scale > 0 ? groundPattern(g, arena, scale) : null;
    if (pattern) {
      const x0 = Math.max(0, Math.floor(view.x)),
        y0 = Math.max(0, Math.floor(view.y)),
        x1 = Math.min(size, Math.ceil(view.x + view.width)),
        y1 = Math.min(size, Math.ceil(view.y + view.height));
      g.fillStyle = pattern;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      drawCore(g, arena);
      return;
    }
    // Dark cyber datacenter floor
    g.fillStyle = '#0a1619';
    g.fillRect(0, 0, size, size);

    // Grid lines
    g.strokeStyle = '#122e35';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= size; x += 100) {
      g.moveTo(x, 0);
      g.lineTo(x, size);
    }
    for (let y = 0; y <= size; y += 100) {
      g.moveTo(0, y);
      g.lineTo(size, y);
    }
    g.stroke();

    // Data buses / optical traces
    g.strokeStyle = '#00e5ff33';
    g.lineWidth = 2;
    g.beginPath();
    for (let pos = 200; pos < size; pos += 400) {
      g.moveTo(pos, 0);
      g.lineTo(pos, size);
      g.moveTo(0, pos);
      g.lineTo(size, pos);
    }
    g.stroke();

    drawCore(g, arena);
  }

  function drawRacks(g, racks) {
    for (const [x, y, w, h] of racks) {
      g.fillStyle = '#0d2128';
      g.fillRect(x, y, w, h);
      g.fillStyle = '#163640';
      const horizontal = w >= h;
      for (let i = 8; i < (horizontal ? w : h) - 6; i += 18)
        if (horizontal) g.fillRect(x + i, y + 6, 10, h - 12);
        else g.fillRect(x + 6, y + i, w - 12, 10);
      g.fillStyle = '#64ffda';
      for (let i = 14; i < (horizontal ? w : h) - 6; i += 36)
        if (horizontal) g.fillRect(x + i, y + 4, 3, 3);
        else g.fillRect(x + 4, y + i, 3, 3);
      g.beginPath();
      g.rect(x, y, w, h);
      neonStroke(g, '#00e5ff99', 1.5, 6);
    }
  }

  function drawCore(g, arena) {
    // A generated room (the learning mazes and hall): its walls are all there is.
    if (arena.rooms) {
      drawRacks(g, arena.racks);
      return;
    }
    const size = arena.size;
    drawRacks(g, arena.racks);
    // Central Data Processing Core Ring
    g.strokeStyle = '#00e5ff88';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(size / 2, size / 2, 140, 0, Math.PI * 2);
    neonStroke(g, neon.cyan, 2, 8);
    g.strokeStyle = '#ffd60044';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(size / 2, size / 2, 220, 0, Math.PI * 2);
    neonStroke(g, '#64ffda66', 1, 5);
  }

  return { draw };
}
