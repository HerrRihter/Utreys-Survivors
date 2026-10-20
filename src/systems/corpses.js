import { compact } from '../core/compact.js';
import { CORPSE_LIFETIME } from './queries/corpses.js';

// Fallen enemies: bodies that tip over and fade out (rendering/corpses.js draws them from a
// cached pose per unit). A body keeps only its unit, position and fall direction.
export function createCorpses() {
  const limit = 180;
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
    if (list.length > limit) list.splice(0, list.length - limit);
  }
  function update(list, dt) {
    for (const body of list) body.age += dt;
    return compact(list, (body) => body.age < CORPSE_LIFETIME);
  }
  return { add, update };
}
