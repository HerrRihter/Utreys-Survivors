import { boxesOverlap, inBox } from '../core/math.js';

// Solid ground as axis-aligned boxes { minX, minY, maxX, maxY } (a map's racks). A mover is a
// capsule: the segment it sweeps in one step, grown by its radius. It is clear when it stays
// `r` inside the arena's edge and no box comes closer than `r` to the segment.
export const ArenaCollision = {
  create(boxes, size) {
    const bucketSize = 100,
      bucketCols = Math.ceil(size / bucketSize) + 2,
      buckets = [];
    const solid = boxes.map((b) => ({ ...b, stamp: 0 }));
    for (const box of solid) {
      const minBy = Math.max(0, Math.floor(box.minY / bucketSize)),
        maxBy = Math.min(bucketCols - 1, Math.floor(box.maxY / bucketSize));
      const minBx = Math.max(0, Math.floor(box.minX / bucketSize)),
        maxBx = Math.min(bucketCols - 1, Math.floor(box.maxX / bucketSize));
      for (let y = minBy; y <= maxBy; y++)
        for (let x = minBx; x <= maxBx; x++) (buckets[x + y * bucketCols] ||= []).push(box);
    }
    let queryStamp = 1;
    const candidateList = [];
    // Boxes in the buckets under the query box, each once.
    function candidates(query) {
      const minBx = Math.max(0, Math.floor(query.minX / bucketSize)),
        maxBx = Math.min(bucketCols - 1, Math.floor(query.maxX / bucketSize));
      const minBy = Math.max(0, Math.floor(query.minY / bucketSize)),
        maxBy = Math.min(bucketCols - 1, Math.floor(query.maxY / bucketSize));
      queryStamp++;
      if (queryStamp > 2000000000) {
        for (const box of solid) box.stamp = 0;
        queryStamp = 1;
      }
      candidateList.length = 0;
      for (let y = minBy; y <= maxBy; y++) {
        const row = y * bucketCols;
        for (let x = minBx; x <= maxBx; x++) {
          const bucket = buckets[row + x];
          if (bucket)
            for (const box of bucket)
              if (box.stamp !== queryStamp) {
                box.stamp = queryStamp;
                candidateList.push(box);
              }
        }
      }
      return candidateList;
    }
    // Squared distance from point (x, y) to segment a–b.
    function toSegment2(x, y, a, b) {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      return (x - a.x - t * dx) ** 2 + (y - a.y - t * dy) ** 2;
    }
    // Squared distance from point `p` to `box`; zero inside.
    function toBox2(p, box) {
      const dx = Math.max(box.minX - p.x, 0, p.x - box.maxX),
        dy = Math.max(box.minY - p.y, 0, p.y - box.maxY);
      return dx * dx + dy * dy;
    }
    // Segment a–b passes through `box` (slab test over t in [0, 1]).
    function crosses(a, b, box) {
      let enter = 0,
        leave = 1;
      const dx = b.x - a.x,
        dy = b.y - a.y;
      if (dx === 0) {
        if (a.x < box.minX || a.x > box.maxX) return false;
      } else {
        const t0 = (box.minX - a.x) / dx,
          t1 = (box.maxX - a.x) / dx;
        enter = Math.max(enter, Math.min(t0, t1));
        leave = Math.min(leave, Math.max(t0, t1));
      }
      if (dy === 0) {
        if (a.y < box.minY || a.y > box.maxY) return false;
      } else {
        const t0 = (box.minY - a.y) / dy,
          t1 = (box.maxY - a.y) / dy;
        enter = Math.max(enter, Math.min(t0, t1));
        leave = Math.min(leave, Math.max(t0, t1));
      }
      return enter <= leave;
    }
    // The capsule a–b of radius `r` touches `box`. Without crossing, the closest points are an
    // end of the segment against the box or a corner of the box against the segment.
    function touches(a, b, box, r) {
      if (inBox(a, box) || inBox(b, box) || crosses(a, b, box)) return true;
      const r2 = r * r;
      return (
        toBox2(a, box) < r2 ||
        toBox2(b, box) < r2 ||
        toSegment2(box.minX, box.minY, a, b) < r2 ||
        toSegment2(box.maxX, box.minY, a, b) < r2 ||
        toSegment2(box.maxX, box.maxY, a, b) < r2 ||
        toSegment2(box.minX, box.maxY, a, b) < r2
      );
    }
    // The swept segment's box, grown by the radius; reused by every query.
    const sweep = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
    function clear(a, b, r = 14) {
      if (
        Math.min(a.x, b.x) < r ||
        Math.min(a.y, b.y) < r ||
        Math.max(a.x, b.x) > size - r ||
        Math.max(a.y, b.y) > size - r
      )
        return false;
      // Open arenas need only the bounds test above.
      if (solid.length === 0) return true;
      sweep.minX = Math.min(a.x, b.x) - r;
      sweep.minY = Math.min(a.y, b.y) - r;
      sweep.maxX = Math.max(a.x, b.x) + r;
      sweep.maxY = Math.max(a.y, b.y) + r;
      for (const box of candidates(sweep))
        if (boxesOverlap(box, sweep) && touches(a, b, box, r)) return false;
      return true;
    }
    const reusablePoint = { x: 0, y: 0 };
    const blocked = (x, y, r = 14) => {
      reusablePoint.x = x;
      reusablePoint.y = y;
      return !clear(reusablePoint, reusablePoint, r);
    };
    // Ground outlines as data (corner points per box); rendering/collision.js draws them.
    const outlines = solid.map((box) => [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
    ]);
    return { blocked, clear, outlines };
  },
};
