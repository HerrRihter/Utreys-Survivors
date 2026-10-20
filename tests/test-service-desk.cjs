const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const {
  allNodesResolved,
  openTickets,
  nodeGuardian,
} = require('../src/systems/node-objectives.js');
const { mapDefinitions, mapUnlocked } = require('../data/maps/maps.js');
const { unitDefinitions } = require('../data/enemies/units.js');

// The Pepsi service desk map: desks replace the nodes, never attack, release more Pepsi the
// longer they stay open, and the CRPT comes once every desk is closed.
(async () => {
  const desk = mapDefinitions.pepsiDesk;
  // Unlock chain: the desk map needs a victory on the server room, not just any victory.
  assert.equal(mapUnlocked(mapDefinitions.empty, {}), true);
  assert.equal(mapUnlocked(mapDefinitions.serverRoom, { wins: 0 }), false);
  assert.equal(mapUnlocked(mapDefinitions.serverRoom, { wins: 1 }), true);
  assert.equal(mapUnlocked(desk, { wins: 3, mapWins: { empty: 3 } }), false);
  assert.equal(mapUnlocked(desk, { wins: 1, mapWins: { serverRoom: 1 } }), true);

  const h = await createHarness();
  const s = h.session,
    P = h.env.Progression;
  s.commands.chooseMap('pepsiDesk');
  assert.notEqual(s.views.run().selectedMap, 'pepsiDesk', 'a closed map cannot be picked');
  P.records.recordRunStats({ win: true, hero: 'utrace', map: 'empty', time: 600 });
  s.commands.chooseMap('pepsiDesk');
  assert.notEqual(s.views.run().selectedMap, 'pepsiDesk', 'a win elsewhere does not open it');
  P.records.recordRunStats({ win: true, hero: 'utrace', map: 'serverRoom', time: 600 });
  s.commands.chooseMap('pepsiDesk');
  assert.equal(s.views.run().selectedMap, 'pepsiDesk');

  s.start();
  s.update(0.01);
  const st = s.state;
  assert.equal(st.map, 'pepsiDesk');
  assert.equal(st.nodes.length, desk.objective.count);
  const guards = st.enemies.filter((e) => e.nodeId);
  assert.equal(guards.length, desk.objective.count);
  for (const node of st.nodes) {
    assert.equal(node.kind, 'desk');
    const guardian = nodeGuardian(st, node);
    assert.equal(guardian.unit, 'pepsi_desk');
    assert.deepEqual([guardian.x, guardian.y], [node.x, node.y], 'a desk stands on its spot');
  }

  // Standing at a desk neither researches a workaround nor gets the player hit.
  const first = st.nodes[0];
  st.enemies = st.enemies.filter((e) => e.nodeId);
  Object.assign(st.p, { x: first.x + 60, y: first.y });
  const hp = st.p.hp;
  for (let i = 0; i < 200; i++) {
    st.t = Math.min(st.t, 5);
    s.update(0.05);
    for (const e of st.enemies) if (!e.nodeId) e.hp = 0;
    st.p.hp = Math.max(st.p.hp, hp);
  }
  assert.equal(first.status, 'guarded', 'a desk has no workaround');
  const struck = st.enemies.some((e) => e.nodeId && e.action);
  assert.equal(struck, false, 'desks never start an attack');

  // Releases grow: one Pepsi at first, more after every `grow` releases, up to countMax.
  const spec = unitDefinitions.pepsi_desk.summon;
  const g = nodeGuardian(st, first);
  const released = [];
  for (let call = 0; call < spec.grow * spec.countMax; call++) {
    for (const e of st.enemies) if (e.summonerId === g.id) e.hp = 0;
    st.enemies = st.enemies.filter((e) => e.hp > 0);
    g.summonCd = 0;
    s.update(0.001);
    released.push(st.enemies.filter((e) => e.summonerId === g.id).length);
  }
  assert.equal(released[0], spec.count);
  assert.equal(Math.max(...released), spec.countMax);
  assert(st.enemies.filter((e) => e.summonerId === g.id).every((e) => e.unit === 'pepsi'));
  assert.equal(openTickets(st), released.at(-1), 'open tickets count living desk Pepsi');

  // Closing every desk brings the CRPT.
  st.t = 999;
  s.update(0.01);
  assert.equal(st.bossSpawned, false, 'open desks block the boss');
  for (const node of st.nodes) s.damage(nodeGuardian(st, node), 100000);
  s.update(0.01);
  assert(allNodesResolved(st));
  assert(st.evoTokens >= desk.objective.count, 'each desk leaves an archive');
  s.update(0.01);
  assert.equal(st.enemies.filter((e) => e.boss).length, 1);

  // A desk victory counts for its map, not as a clean node sweep.
  s.finish(true);
  assert.equal(P.data.stats.mapWins.pepsiDesk, 1);
  assert.equal(P.data.stats.cleanSweeps, 0);
  const wins = P.data.stats.mapWins;
  assert.deepEqual([wins.empty, wins.serverRoom, wins.pepsiDesk], [1, 1, 1]);
  s.dispose();
  console.log(
    'PASS: desk map unlock, passive desks, growing releases, tickets, boss gate and map wins',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
