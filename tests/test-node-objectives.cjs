const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { updateNodes, allNodesResolved } = require('../src/systems/node-objectives.js');
const { nodeDefinitions } = require('../data/enemies/nodes.js');
const { unitDefinitions } = require('../data/enemies/units.js');

(async () => {
  const h = await createHarness();
  const s = h.session;
  s.start();
  s.update(0.01);
  assert.equal(s.state.nodes.length, 5);
  assert.equal(s.state.enemies.filter((e) => e.nodeId).length, 5);
  for (const node of nodeDefinitions) assert.equal(unitDefinitions[node.bug].miniboss, true);
  const ctx = { state: s.state, spawn: s.spawn, toast() {} };
  const first = s.state.nodes[0];
  Object.assign(s.state.p, { x: first.x, y: first.y });
  updateNodes(ctx, 3);
  assert.equal(first.progress, 3);
  s.state.p.hurt = { elapsed: 0 };
  updateNodes(ctx, 1);
  assert.equal(first.progress, 0, 'damage resets research');
  s.state.p.hurt = null;
  updateNodes(ctx, 3);
  s.state.p.x += 200;
  updateNodes(ctx, 1);
  assert.equal(first.progress, 0, 'leaving resets research');
  for (const node of s.state.nodes.slice(0, 3)) {
    Object.assign(s.state.p, { x: node.x, y: node.y });
    for (let i = 0; i < 121; i++) updateNodes(ctx, 0.05);
    assert.equal(node.status, 'workaround');
    assert(!s.state.enemies.includes(node.guardian));
  }
  assert.equal(s.state.kills, 0, 'workarounds grant no kill rewards');
  s.state.t = 999;
  s.update(0.01);
  assert.equal(s.state.bossSpawned, false, 'unresolved nodes block boss beyond old timer');
  for (const node of s.state.nodes.slice(3)) s.damage(node.guardian, 10000);
  s.update(0.01);
  assert(allNodesResolved(s.state));
  assert.equal(s.state.kills, 2);
  assert.equal(s.state.bossDead, false, 'miniboss kills do not finish the game');
  s.update(0.01);
  assert.equal(s.state.enemies.filter((e) => e.boss).length, 1);
  s.start();
  assert(s.state.nodes.every((n) => n.status === 'guarded' && n.progress === 0 && !n.guardian));
  assert.equal(s.state.bossSpawned, false);
  s.dispose();
  console.log('PASS: nodes, interrupted workarounds, mixed resolution, boss gate and fresh run');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
