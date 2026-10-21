import { neonStroke, neon } from './neon.js';
import { browserCanvas } from './offscreen.js';

// Floor colours: the usual neon datacenter and the hidden Penza mode's red, black and grey.
const palettes = {
  standard: {
    floor: '#0a1619',
    grid: '#122e35',
    bus: '#00e5ff33',
    rack: '#0d2128',
    slot: '#163640',
    led: '#64ffda',
    rackEdge: '#00e5ff99',
    ring: '#00e5ff88',
    ringGlow: neon.cyan,
    outerRing: '#ffd60044',
    outerGlow: '#64ffda66',
    accent: '#00e5ff',
  },
  penza: {
    floor: '#0d0b0b',
    grid: '#2a2020',
    bus: '#ff3b3b33',
    rack: '#1a1616',
    slot: '#2e2828',
    led: '#ff3b3b',
    rackEdge: '#ff3b3b99',
    ring: '#ff3b3b88',
    ringGlow: '#ff3b3b',
    outerRing: '#9e9e9e44',
    outerGlow: '#bdbdbd66',
    accent: '#ff3b3b',
  },
};

// Draws an arena's datacenter floor: grid, data buses, server racks and the core rings.
// `arena` is the geometry from world/arenas.js ({ size, racks }). `penza()` picks the Penza
// mode's palette; `palette()` gives the current one to pictures drawn over the floor.
/** @param {{ createCanvas?: typeof browserCanvas, penza?: () => boolean }} [options] */
export function createArenaFloor({ createCanvas = browserCanvas, penza = () => false } = {}) {
  const palette = () => (penza() ? palettes.penza : palettes.standard);
  // Floor + grid + data buses repeat every 400 px: one tile per arena, drawn once per device ratio.
  const tileSize = 400;
  const tiles = new WeakMap();
  function paintTile(g, colors) {
    g.fillStyle = colors.floor;
    g.fillRect(0, 0, tileSize, tileSize);
    g.strokeStyle = colors.grid;
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
    g.strokeStyle = colors.bus;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(200, 0);
    g.lineTo(200, tileSize);
    g.moveTo(0, 200);
    g.lineTo(tileSize, 200);
    g.stroke();
  }
  function groundPattern(g, arena, ratio, colors) {
    let cached = tiles.get(arena);
    if (!cached || cached.ratio !== ratio || cached.colors !== colors) {
      const canvas = createCanvas(Math.round(tileSize * ratio), Math.round(tileSize * ratio));
      const c = canvas?.getContext('2d');
      if (!c) return null;
      c.scale(ratio, ratio);
      paintTile(c, colors);
      const tile = g.createPattern?.(canvas, 'repeat') || null;
      tile?.setTransform?.({ a: 1 / ratio, b: 0, c: 0, d: 1 / ratio, e: 0, f: 0 });
      cached = { tile, ratio, colors };
      tiles.set(arena, cached);
    }
    return cached.tile;
  }

  // view = visible world rectangle; without it the whole floor is drawn (previews).
  function draw(g, arena, view) {
    const size = arena.size,
      colors = palette();
    const scale = g.getTransform?.()?.a;
    // Match the screen transform so the repeated floor does not get resampled.
    const pattern = view && scale > 0 ? groundPattern(g, arena, scale, colors) : null;
    if (pattern) {
      const x0 = Math.max(0, Math.floor(view.x)),
        y0 = Math.max(0, Math.floor(view.y)),
        x1 = Math.min(size, Math.ceil(view.x + view.width)),
        y1 = Math.min(size, Math.ceil(view.y + view.height));
      g.fillStyle = pattern;
      g.fillRect(x0, y0, x1 - x0, y1 - y0);
      drawCore(g, arena, colors);
      return;
    }
    // Dark cyber datacenter floor
    g.fillStyle = colors.floor;
    g.fillRect(0, 0, size, size);

    // Grid lines
    g.strokeStyle = colors.grid;
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
    g.strokeStyle = colors.bus;
    g.lineWidth = 2;
    g.beginPath();
    for (let pos = 200; pos < size; pos += 400) {
      g.moveTo(pos, 0);
      g.lineTo(pos, size);
      g.moveTo(0, pos);
      g.lineTo(size, pos);
    }
    g.stroke();

    drawCore(g, arena, colors);
  }

  function drawRacks(g, racks, colors) {
    for (const [x, y, w, h] of racks) {
      g.fillStyle = colors.rack;
      g.fillRect(x, y, w, h);
      g.fillStyle = colors.slot;
      const horizontal = w >= h;
      for (let i = 8; i < (horizontal ? w : h) - 6; i += 18)
        if (horizontal) g.fillRect(x + i, y + 6, 10, h - 12);
        else g.fillRect(x + 6, y + i, w - 12, 10);
      g.fillStyle = colors.led;
      for (let i = 14; i < (horizontal ? w : h) - 6; i += 36)
        if (horizontal) g.fillRect(x + i, y + 4, 3, 3);
        else g.fillRect(x + 4, y + i, 3, 3);
      g.beginPath();
      g.rect(x, y, w, h);
      neonStroke(g, colors.rackEdge, 1.5, 6);
    }
  }

  function drawCore(g, arena, colors) {
    // A generated room (the learning mazes and hall): its walls are all there is.
    if (arena.rooms) {
      drawRacks(g, arena.racks, colors);
      return;
    }
    const size = arena.size;
    drawRacks(g, arena.racks, colors);
    // Central Data Processing Core Ring
    g.strokeStyle = colors.ring;
    g.lineWidth = 3;
    g.beginPath();
    g.arc(size / 2, size / 2, 140, 0, Math.PI * 2);
    neonStroke(g, colors.ringGlow, 2, 8);
    g.strokeStyle = colors.outerRing;
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(size / 2, size / 2, 220, 0, Math.PI * 2);
    neonStroke(g, colors.outerGlow, 1, 5);
  }

  return { draw, palette };
}
