export const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

// Axis-aligned boxes: the one rectangle test for the world, the simulation and the renderer.
// A box is { minX, minY, maxX, maxY }; edges count as inside.

// Point `p` lies in `box` grown by `pad` on every side.
export const inBox = (p, box, pad = 0) =>
  p.x >= box.minX - pad && p.x <= box.maxX + pad && p.y >= box.minY - pad && p.y <= box.maxY + pad;

// Two boxes touch or overlap.
export const boxesOverlap = (a, b) =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;

// `b` lies strictly inside the box of half-size `halfWidth` × `halfHeight` centred on `a`:
// the cheap test before a distance check, or a rectangular area of effect.
export const near = (a, b, halfWidth, halfHeight = halfWidth) =>
  Math.abs(a.x - b.x) < halfWidth && Math.abs(a.y - b.y) < halfHeight;
