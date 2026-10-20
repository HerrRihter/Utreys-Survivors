const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { createRng, parseSeed, seedText } = require('../src/core/rng.js');
const { layoutNodes, planEvents } = require('../src/systems/run-layout.js');
const { mapDefinitions, nodeSpacing } = require('../data/maps/maps.js');
const { nodeDefinitions } = require('../data/enemies/nodes.js');
const { waveSchedules } = require('../data/enemies/waves.js');
const { createArenas } = require('../src/world/arenas.js');
const { snapshotRun } = require('../src/systems/run-snapshot.js');

// Stage 6: seeded node layouts and events, elites with update bundles, map pickups, mid-run
// events and the second map.
(async () => {
  // Seeds.
  const a = createRng(42),
    b = createRng(42);
  for (let i = 0; i < 5; i++) assert.equal(a.random(), b.random());
  // A saved position continues the same sequence.
  const position = a.getState(),
    next = [a.random(), a.random()];
  b.setState(position);
  assert.deepEqual([b.random(), b.random()], next);
  assert.equal(parseSeed(seedText(123456789)), 123456789);
  assert.equal(parseSeed('zik0zj'), parseInt('zik0zj', 36));
  assert.equal(parseSeed('bad seed!'), null);
  assert.equal(parseSeed(''), null);

  // Layouts: repeatable, varied, spaced, clear of racks, bugs dealt once each.
  const arenas = createArenas();
  for (const map of Object.keys(mapDefinitions)) {
    const arena = arenas.get(map);
    const positions = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const nodes = layoutNodes(map, seed);
      const desks = mapDefinitions[map].objective;
      assert.deepEqual(nodes, layoutNodes(map, seed), 'same seed, same layout');
      if (desks) {
        assert.equal(nodes.length, desks.count, `${map} places every desk`);
        assert(nodes.every((n) => n.kind === 'desk' && n.bug === desks.unit));
      } else {
        assert.equal(nodes.length, nodeDefinitions.length);
        assert.deepEqual(nodes.map((n) => n.bug).sort(), nodeDefinitions.map((n) => n.bug).sort());
      }
      for (const n of nodes) {
        assert(!arena.blocked(n.x, n.y, 40), `${map} node on a rack`);
        for (const m of nodes) if (m !== n) assert(Math.hypot(m.x - n.x, m.y - n.y) >= nodeSpacing);
      }
      positions.add(nodes.map((n) => `${n.x},${n.y}`).join(';'));
    }
    assert(positions.size > 30, `${map} layouts vary between seeds`);
  }
  const plan = planEvents(waveSchedules.empty, 7);
  assert.deepEqual(plan, planEvents(waveSchedules.empty, 7));
  assert.deepEqual(plan.map((e) => e.type).sort(), ['friday', 'incident', 'rush']);
  assert(arenas.get('serverRoom').blocked(330, 280, 5), 'server racks are solid');
  assert(!arenas.get('empty').blocked(330, 280, 5));

  const h = await createHarness();
  const game = h.session,
    P = h.env.Progression;
  let seed = 11;
  h.env.Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;

  // Typed seed and replay.
  game.commands.chooseSeed('UTR4CE');
  game.commands.startSelected();
  let s = game.state;
  assert.equal(s.seed, parseSeed('UTR4CE'));
  // The harness runs in its own realm: compare plain JSON.
  const layout = JSON.stringify(s.nodes.map((n) => [n.x, n.y, n.bug]));
  assert.equal(layout, JSON.stringify(layoutNodes('empty', s.seed).map((n) => [n.x, n.y, n.bug])));
  game.finish(false);
  assert.equal(game.views.run().result.seed, 'UTR4CE');
  game.commands.restartSameSeed();
  assert.equal(
    JSON.stringify(game.state.nodes.map((n) => [n.x, n.y, n.bug])),
    layout,
    'same seed repeats',
  );
  game.start();
  assert.notEqual(game.state.seed, parseSeed('UTR4CE'), 'a plain restart picks a new seed');

  // The server room opens after the first win.
  game.selectMap('serverRoom');
  game.start();
  assert.equal(game.state.map, 'empty', 'locked map falls back');
  P.recordRunStats({ win: true, hero: 'utrace', time: 600 });
  game.selectMap('serverRoom');
  game.start();
  s = game.state;
  assert.equal(s.map, 'serverRoom');
  s.spawn = 9999;
  s.eventPlan = [];

  // Elites and update bundles.
  s.t = s.eliteNext;
  game.update(0.01);
  const elite = s.enemies.find((e) => e.elite);
  assert(elite, 'an elite arrives on schedule');
  assert(elite.max >= 5 * 10, 'elites are much tougher');
  const saved = snapshotRun(game.views.run());
  assert(saved.state.seed === s.seed && saved.enemies === undefined);
  assert(
    saved.state.enemies.some((e) => e.elite),
    'snapshots keep elites',
  );
  game.damage(elite, 1e9);
  const bundle = s.pickups.find((p) => p.type === 'bundle');
  assert(bundle, 'elites drop an update bundle');
  const ranks = () =>
    Object.values(s.upgradeRanks).reduce((n, r) => n + r, 0) +
    s.weapons.reduce((n, w) => n + w.level, 0);
  const before = ranks();
  bundle.x = s.p.x;
  bundle.y = s.p.y;
  game.update(0.01);
  assert(ranks() > before, 'a bundle upgrades items without a choice');
  if (game.mode === 'level') game.pickUpgrade(0);

  // Pickups: magnet, freeze, bomb.
  s.gems.push({ x: s.p.x + 900, y: s.p.y, v: 3 });
  s.pickups.push({ x: s.p.x, y: s.p.y, type: 'magnet' });
  game.update(0.01);
  assert(
    s.gems.every((g) => g.pull),
    'magnet pulls every gem',
  );
  const target = game.spawn('l3', false, { x: s.p.x + 200, y: s.p.y + 200 });
  s.pickups.push({ x: s.p.x, y: s.p.y, type: 'freeze' });
  game.update(0.01);
  assert(target.abilityStun > 3, 'freeze stops ordinary enemies');
  s.pickups.push({ x: s.p.x, y: s.p.y, type: 'bomb' });
  game.update(0.01);
  assert(target.hp < target.max, 'bomb hits enemies on screen');
  assert(s.damageBy.bomb > 0);

  // Events: incident succeeds while the hero holds the point.
  if (game.mode === 'level') game.pickUpgrade(0);
  s.eventPlan = [
    { time: s.t, type: 'incident' },
    { time: s.t + 1000, type: 'rush' },
  ];
  s.eventIndex = 0;
  game.update(0.01);
  assert.equal(s.event.type, 'incident');
  assert.match(game.views.hud().event, /Инцидент/);
  s.p.x = s.event.x;
  s.p.y = s.event.y;
  s.p.hp = s.p.max = 1e6;
  for (let i = 0; i < 400 && s.event; i++) {
    s.p.x = s.event.x;
    s.p.y = s.event.y;
    game.update(0.05);
    if (game.mode === 'level') game.pickUpgrade(0);
  }
  assert.equal(s.event, null);
  assert.equal(s.eventsDone, 1, 'incident held');

  // Rush: event codes count toward the goal and pay on success.
  s.eventPlan[1].time = s.t;
  game.update(0.01);
  assert.equal(s.event.type, 'rush');
  const tokens = s.codes.filter((c) => c.event);
  assert.equal(tokens.length, waveSchedules.serverRoom.events.rush.tokens);
  const earned = s.earned;
  for (const c of tokens) {
    c.x = s.p.x;
    c.y = s.p.y;
  }
  // Codes are picked up after events update; the goal is checked on the next step.
  game.update(0.01);
  game.update(0.01);
  assert.equal(s.event, null);
  assert.equal(s.eventsDone, 2);
  assert(s.earned >= earned + 25 + tokens.length);

  // Friday: a ring of enemies arrives at once.
  const count = s.enemies.length;
  s.eventPlan.push({ time: s.t, type: 'friday' });
  game.update(0.01);
  assert.equal(s.event.type, 'friday');
  assert(s.enemies.length >= count + waveSchedules.serverRoom.events.friday.count - 2);
  h.session.dispose();

  console.log('PASS: seeds, procedural nodes, second map, elites, bundles, pickups and events');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
