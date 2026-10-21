import { createRng } from '../core/rng.js';

// A maze of `cols` × `rows` square cells filling a `size` × `size` arena. Generated from the
// run's seed and the room's number, so a resumed run gets the same maze and a new run another.
//   walls      [x, y, w, h] rectangles, merged along each grid line (fewer collision boxes)
//   entry      where the hero comes in (a corner cell)
//   terminals  `terminals` points as far from the entry and from each other as the arena allows,
//              each with `guard`: where its guardian stands, in the corridor leading to it
//   exit       the door's cell: an inner one at least a third of the maze from the others
// A recursive backtracker gives a perfect maze; `braid` then opens that share of dead ends, so
// there are loops to run around and enemies are not always coming down the same corridor.

const cache = new Map();

export function mazeLayout(spec, seed, room) {
  const key = `${seed}:${room}:${spec.cols}x${spec.rows}`;
  if (!cache.has(key)) {
    if (cache.size > 8) cache.clear();
    cache.set(
      key,
      generateMaze(spec, createRng((seed ^ Math.imul(room + 1, 0x9e3779b1)) >>> 0).random),
    );
  }
  return cache.get(key);
}

export function generateMaze({ size, cols, rows, wall, braid, terminals }, rng) {
  const cw = size / cols,
    ch = size / rows,
    index = (c, r) => r * cols + c;
  // open[i] bit: 1 east, 2 south, 4 west, 8 north.
  const open = new Uint8Array(cols * rows);
  const steps = [
    [1, 0, 1, 4],
    [0, 1, 2, 8],
    [-1, 0, 4, 1],
    [0, -1, 8, 2],
  ];
  const neighbours = (c, r) =>
    steps
      .map(([dc, dr, bit, back]) => ({ c: c + dc, r: r + dr, bit, back }))
      .filter((n) => n.c >= 0 && n.r >= 0 && n.c < cols && n.r < rows);
  const carve = (c, r, n) => {
    open[index(c, r)] |= n.bit;
    open[index(n.c, n.r)] |= n.back;
  };

  // The hero enters at a random corner; the backtracker starts there.
  const corner = Math.floor(rng() * 4),
    entryCell = { c: corner % 2 ? cols - 1 : 0, r: corner > 1 ? rows - 1 : 0 };
  const seen = new Uint8Array(cols * rows),
    stack = [entryCell];
  seen[index(entryCell.c, entryCell.r)] = 1;
  while (stack.length) {
    const { c, r } = stack.at(-1);
    const next = neighbours(c, r).filter((n) => !seen[index(n.c, n.r)]);
    if (!next.length) {
      stack.pop();
      continue;
    }
    const n = next[Math.floor(rng() * next.length)];
    carve(c, r, n);
    seen[index(n.c, n.r)] = 1;
    stack.push({ c: n.c, r: n.r });
  }
  const degree = (i) => [1, 2, 4, 8].filter((bit) => open[i] & bit).length;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (degree(index(c, r)) !== 1 || rng() >= braid) continue;
      const closed = neighbours(c, r).filter((n) => !(open[index(c, r)] & n.bit));
      if (closed.length) carve(c, r, closed[Math.floor(rng() * closed.length)]);
    }

  // Farthest-point picks on the map: each next cell is the one farthest from the entry and from
  // everything chosen so far, give or take `spread` cells; dead ends are preferred (a terminal at
  // the end of a corridor).
  const spread = Math.min(cols, rows) * 0.35;
  const chosen = [index(entryCell.c, entryCell.r)];
  const apart = (i, j) =>
    Math.hypot((i % cols) - (j % cols), Math.floor(i / cols) - Math.floor(j / cols));
  // Terminals keep off the outer ring: at the arena's edge the camera stops and the corner HUD
  // panels would cover the hero standing at them.
  const edge = (i) => i % cols === 0 || i % cols === cols - 1 || i < cols || i >= cols * (rows - 1);
  const pick = (preferDeadEnds) => {
    let best = -1,
      bestScore = -1;
    for (let i = 0; i < cols * rows; i++) {
      if (chosen.includes(i) || (preferDeadEnds && edge(i))) continue;
      // A random share keeps the corners from always winning: far apart, but not predictable.
      const score =
        Math.min(...chosen.map((j) => apart(i, j))) +
        (preferDeadEnds && degree(i) === 1 ? 0.75 : 0) +
        rng() * spread;
      if (score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    chosen.push(best);
    return best;
  };
  const centre = (i) => ({
    x: Math.round((i % cols) * cw + cw / 2),
    y: Math.round(Math.floor(i / cols) * ch + ch / 2),
  });
  const terminalCells = Array.from({ length: terminals }, () => pick(true));
  // The door: any inner cell at least a third of the maze from the entry and every terminal.
  const doorCells = [];
  for (let i = 0; i < cols * rows; i++)
    if (!edge(i) && chosen.every((j) => apart(i, j) >= Math.min(cols, rows) / 3)) doorCells.push(i);
  const exitCell = doorCells.length ? doorCells[Math.floor(rng() * doorCells.length)] : pick(false);
  // A guardian stands in the passage that leads into its terminal's cell.
  const guardOf = (i) => {
    const c = i % cols,
      r = Math.floor(i / cols),
      way = neighbours(c, r).find((n) => open[i] & n.bit),
      p = centre(i);
    return way
      ? { x: Math.round(p.x + (way.c - c) * cw * 0.5), y: Math.round(p.y + (way.r - r) * ch * 0.5) }
      : p;
  };

  return {
    walls: wallRects({ open, cols, rows, cw, ch, wall, size }),
    entry: centre(chosen[0]),
    terminals: terminalCells.map((i) => ({ ...centre(i), guard: guardOf(i) })),
    exit: centre(exitCell),
    cell: Math.min(cw, ch),
  };
}

// Closed cell sides as rectangles centred on the grid lines, consecutive ones merged.
function wallRects({ open, cols, rows, cw, ch, wall, size }) {
  const rects = [],
    half = wall / 2;
  // Horizontal lines y = r·ch, r = 0..rows: a segment above cell (c, r) is closed unless the
  // cell above opens south (or it is the border).
  for (let r = 0; r <= rows; r++) {
    let from = -1;
    for (let c = 0; c <= cols; c++) {
      const closed = c < cols && (r === 0 || r === rows || !(open[(r - 1) * cols + c] & 2));
      if (closed && from < 0) from = c;
      if (!closed && from >= 0) {
        rects.push(clip([from * cw - half, r * ch - half, (c - from) * cw + wall, wall], size));
        from = -1;
      }
    }
  }
  for (let c = 0; c <= cols; c++) {
    let from = -1;
    for (let r = 0; r <= rows; r++) {
      const closed = r < rows && (c === 0 || c === cols || !(open[r * cols + c - 1] & 1));
      if (closed && from < 0) from = r;
      if (!closed && from >= 0) {
        rects.push(clip([c * cw - half, from * ch - half, wall, (r - from) * ch + wall], size));
        from = -1;
      }
    }
  }
  return rects;
}

// Keeps a rectangle inside the arena (border walls are half outside the grid).
function clip([x, y, w, h], size) {
  const x0 = Math.max(0, x),
    y0 = Math.max(0, y),
    x1 = Math.min(size, x + w),
    y1 = Math.min(size, y + h);
  return [Math.round(x0), Math.round(y0), Math.round(x1 - x0), Math.round(y1 - y0)];
}
