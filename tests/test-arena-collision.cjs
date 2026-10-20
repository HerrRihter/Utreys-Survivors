const assert = require('node:assert/strict');
const { ArenaCollision } = require('../src/world/collision.js');
const { ArenaNavigation } = require('../src/world/navigation.js');
const { createArenas } = require('../src/world/arenas.js');
const collision = ArenaCollision.create([{ minX: 100, minY: 100, maxX: 150, maxY: 150 }], 400);
assert(collision.blocked(125, 125, 5));
assert(!collision.clear({ x: 50, y: 125 }, { x: 200, y: 125 }, 5), 'swept collision cannot tunnel');
assert(collision.clear({ x: 50, y: 60 }, { x: 200, y: 60 }, 5));
assert(collision.blocked(2, 200, 5), 'world edge');
const nav = ArenaNavigation.create({ size: 400, cell: 25, cols: 16, ...collision });
nav.prepare([10, 20, 10], { x: 250, y: 125 });
const actor = { x: 50, y: 125 };
for (let i = 0; i < 300; i++) {
  const dir = nav.direction(actor, { x: 250, y: 125 }, 10);
  nav.move(actor, dir.x * 3, dir.y * 3, 10);
  assert(!collision.blocked(actor.x, actor.y, 10));
  if (Math.hypot(actor.x - 250, actor.y - 125) < 15) break;
}
assert(Math.hypot(actor.x - 250, actor.y - 125) < 15, 'routes around a box');
const arena = createArenas().get('empty');
for (const r of [14, 18, 24, 28, 32]) {
  assert(arena.clear({ x: 500, y: 500 }, { x: 1000, y: 1000 }, r));
  assert(arena.blocked(1, 1, r));
}
console.log('PASS: arena boxes, swept collision, navigation and boundary radii');
