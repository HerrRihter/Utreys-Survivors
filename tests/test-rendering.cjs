'use strict';
const assert = require('node:assert/strict');
async function main() {
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
  // Invulnerability frames draw the hero faded, then the alpha is restored.
  const { SpriteRenderer } = await import('../src/rendering/sprite-renderer.js');
  const alphas = [];
  const g = {
    globalAlpha: 1,
    stack: [],
    save() {
      this.stack.push(this.globalAlpha);
    },
    restore() {
      this.globalAlpha = this.stack.pop();
    },
  };
  const { sprite } = SpriteRenderer.create({
    run: { state: null },
    drawHero: (context) => alphas.push(context.globalAlpha),
  });
  sprite(g, 'utrace', 0, 0, 3, false, false);
  sprite(g, 'utrace', 0, 0, 3, false, true);
  assert.equal(alphas[0], 1, 'a normal frame is opaque');
  assert(alphas[1] < 1, 'a flash frame is faded');
  assert.equal(g.globalAlpha, 1, 'the flash restores the alpha');
  console.log(
    'PASS: third-frame hit once, skipped frames and completed actions, invulnerability flash.',
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
