'use strict';
const assert = require('node:assert/strict');
async function main() {
  const { orderActors } = await import('../src/rendering/depth-order.js');
  const { advanceAction } = await import('../src/core/action-timeline.js');
  const { CanvasSystem } = await import('../src/rendering/canvas.js');
  const window = { innerWidth: 390, innerHeight: 844, devicePixelRatio: 2 };
  const view = CanvasSystem.create({ window, canvas: {}, ctx: { setTransform() {} } });
  view.resize();
  assert.equal(view.W, 390 / 0.9, 'Portrait view is scaled down by one third');
  assert.equal(view.H, 844 / 0.9, 'Portrait view height follows the reduced scale');
  window.innerWidth = 844;
  window.innerHeight = 390;
  view.resize();
  assert.equal(view.W, 844, 'Landscape scale remains unchanged');
  assert.equal(view.H, 390, 'Landscape height remains unchanged');
  const objects = [
    { y: 3, id: 'a', scenery: true },
    { y: 3, id: 'b', scenery: true },
    { y: 9, id: 'c', scenery: true },
  ];
  const enemies = [
      { y: 9, id: 'one' },
      { y: 3, id: 'two' },
      { y: 3, id: 'three' },
    ],
    player = { y: 3, id: 'player' };
  const expected = [...objects, ...enemies, { ...player, type: 'utrace', player: true }].sort(
    (a, b) => a.y - b.y,
  );
  assert.deepEqual(
    orderActors(objects, enemies, player, 'utrace'),
    expected,
    'Equal depths preserve scenery and actor order',
  );
  assert.equal(enemies[0].id, 'one', 'Ordering does not reorder simulation arrays');
  for (const count of [0, 1, 120])
    for (let sample = 0; sample < 25; sample++) {
      const actors = Array.from({ length: count }, (_, i) => ({
        y: (i * 137 + sample * 31) % 10,
        id: i,
      }));
      const old = [...objects, ...actors, { ...player, type: 'ba', player: true }].sort(
        (a, b) => a.y - b.y,
      );
      assert.deepEqual(orderActors(objects, actors, player, 'ba'), old);
    }
  let hits = 0;
  const actor = { action: { elapsed: 0, duration: 1, hit: false } };
  advanceAction(actor, 0.49, () => hits++);
  assert.equal(hits, 0);
  advanceAction(actor, 0.01, () => hits++);
  assert.equal(hits, 1);
  advanceAction(actor, 0.49, () => hits++);
  assert.equal(hits, 1);
  advanceAction(actor, 0.02, () => hits++);
  assert.equal(actor.action, null);
  assert.equal(hits, 1);
  actor.action = { elapsed: 0, duration: 1, hit: false };
  advanceAction(actor, 2, () => hits++);
  assert.equal(hits, 2, 'Skipped frames dispatch hit once');
  advanceAction(actor, 2, () => hits++);
  assert.equal(hits, 2, 'Interrupted/completed action does not dispatch again');
  console.log(
    'PASS: identical depth order across 75 scenes, stable ties, untouched actor arrays, third-frame hit once, skipped frames and completed actions.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
