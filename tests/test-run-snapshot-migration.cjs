const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const {
  RUN_SNAPSHOT_KEY,
  LEGACY_RUN_SNAPSHOT_KEY,
  migrateRunSnapshot,
} = require('../src/systems/run-snapshot.js');
const { nodeGuardian, openTickets } = require('../src/systems/node-objectives.js');
const { mapDefinitions } = require('../data/maps/maps.js');
// Version 1 saves written by the game before enemy ids (ba on the service desks, qa in the
// server room with a destroyed node, weapons and an open elite).
const fixtures = require('./fixtures/run-snapshot-v1.json');
// Values from the session's context, compared as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  for (const [label, v1] of Object.entries(fixtures)) {
    assert.equal(v1.version, 1, label);
    const h = await createHarness({ createSession: false });
    const store = new Map([[LEGACY_RUN_SNAPSHOT_KEY, JSON.stringify(v1)]]);
    h.env.localStorage = {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    };
    const P = h.env.Progression;
    for (const map of Object.keys(mapDefinitions))
      P.recordRunStats({ win: true, hero: 'utrace', map, time: 600 });
    P.replace({ ...P.data, unlocked: [...P.data.unlocked, v1.hero] });

    // The menu offers the old save; reading it converts it once to version 2.
    let game = h.createSession();
    assert(game.views.menu().resume, label + ' Continue is offered');
    assert(!store.has(LEGACY_RUN_SNAPSHOT_KEY), label + ' the v1 save is removed');
    const v2 = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
    assert.deepEqual(v2, JSON.parse(JSON.stringify(migrateRunSnapshot(v1))), label);
    assert.equal(v2.version, 2);
    const ids = [
      ...v2.state.enemies.map((e) => e.id),
      ...v2.state.nodes.map((n) => n.guardianId).filter((id) => id !== null),
    ];
    assert.equal(new Set(ids).size, ids.length, label + ' ids are unique');
    assert(
      ids.every((id) => id < v2.state.nextEnemyId),
      label + ' the counter is past every id',
    );

    // The converted run continues where it was saved.
    assert(game.resume(), label + ' resumes');
    const s = game.state,
      saved = v1.state;
    assert.equal(game.state.map, v1.map, label + ' map');
    assert.equal(s.t, saved.t);
    assert.equal(s.kills, saved.kills);
    assert.equal(s.level, saved.level);
    assert.equal(s.xp, saved.xp);
    assert.equal(s.earned, saved.earned);
    assert.equal(s.p.hp, saved.p.hp);
    assert.deepEqual(plain(s.stats), saved.stats);
    assert.deepEqual(plain(s.upgradeRanks), saved.upgradeRanks);
    assert.deepEqual(
      plain(s.weapons.map((w) => [w.id, w.level, w.evolved])),
      saved.weapons.map((w) => [w.id, w.level, w.evolved]),
    );
    assert.equal(s.baSpecialization?.client ?? null, v1.baClient);
    assert.equal(s.enemies.filter((e) => !e.nodeId).length, saved.enemies.length, label);
    assert.equal(
      s.enemies.filter((e) => e.elite).length,
      saved.enemies.filter((e) => e.elite).length,
    );
    for (const node of saved.nodes) {
      const restored = s.nodes.find((n) => n.id === node.id);
      assert.equal(restored.status, node.status, label + ' ' + node.id);
      const guardian = nodeGuardian(s, restored);
      if (node.guardianHp === null) assert.equal(guardian, null);
      else {
        assert.equal(guardian.hp, node.guardianHp, label + ' guardian health');
        assert.equal(guardian.summons, node.summons, label + ' desk escalation');
      }
    }
    assert.equal(openTickets(s), 0, label + ' v1 summons are not linked to desks');

    // It plays on: guardians, summons and new enemies get fresh ids.
    game.pause();
    const moves = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
    for (let i = 0; i < 40 * 60; i++) {
      if (game.mode === 'level') game.pickUpgrade(0);
      if (game.mode !== 'play') break;
      if (i % 120 === 0) {
        game.keys.clear();
        game.keys.add(moves[(i / 120) % 4]);
      }
      s.p.hp = s.p.max;
      game.update(1 / 60);
    }
    game.keys.clear();
    if (game.mode === 'level') game.pickUpgrade(0);
    assert.equal(game.mode, 'play', label + ' still running');
    assert(s.t > saved.t + 39, label + ' time goes on');
    const live = s.enemies.map((e) => e.id);
    assert.equal(new Set(live).size, live.length, label + ' live ids stay unique');
    game.pause();
    assert.equal(JSON.parse(store.get(RUN_SNAPSHOT_KEY)).version, 2, label + ' saved as v2');
    assert(!store.has(LEGACY_RUN_SNAPSHOT_KEY));
    game.menu();
    assert(!store.has(RUN_SNAPSHOT_KEY), label + ' the menu clears the save');
    game.dispose();
  }
  // Anything that is not a version 1 run is not converted.
  assert.equal(migrateRunSnapshot({ version: 3, state: {} }), null);
  assert.equal(migrateRunSnapshot(null), null);
  console.log(
    'PASS: ' + Object.keys(fixtures).length + ' version 1 runs migrate to v2 and play on',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
