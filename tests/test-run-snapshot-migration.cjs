const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const {
  RUN_SNAPSHOT_KEY,
  LEGACY_RUN_SNAPSHOT_KEYS,
  migrateRunSnapshot,
} = require('../src/systems/run-snapshot.js');
const { nodeGuardian, openTickets } = require('../src/systems/node-objectives.js');
const { mapDefinitions } = require('../data/maps/maps.js');
// Version 1 saves written by the game before enemy ids (ba on the service desks, qa in the
// server room with a destroyed node, weapons and an open elite), and version 2 saves written
// before the content id renames (utrace's `potion` ability on the service desks, qa).
const fixtures = {
  ...require('./fixtures/run-snapshot-v1.json'),
  ...Object.fromEntries(
    Object.entries(require('./fixtures/run-snapshot-v2.json')).map(([k, v]) => ['v2 ' + k, v]),
  ),
};
const legacyKey = (version) => 'utreys-run-v' + version;
const currentVersion = 3;
// Values from the session's context, compared as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value));

(async () => {
  assert.deepEqual(LEGACY_RUN_SNAPSHOT_KEYS, [legacyKey(2), legacyKey(1)]);
  assert.equal(RUN_SNAPSHOT_KEY, legacyKey(currentVersion));
  for (const [label, v1] of Object.entries(fixtures)) {
    assert(v1.version < currentVersion, label);
    const LEGACY_RUN_SNAPSHOT_KEY = legacyKey(v1.version);
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

    // The menu offers the old save; reading it converts it once to the current version.
    let game = h.createSession();
    assert(game.views.menu().resume, label + ' Continue is offered');
    assert(!store.has(LEGACY_RUN_SNAPSHOT_KEY), label + ' the old save is removed');
    const v2 = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
    assert.deepEqual(v2, JSON.parse(JSON.stringify(migrateRunSnapshot(v1))), label);
    assert.equal(v2.version, currentVersion);
    // Renamed content ids: no old ability id or card id is left anywhere in the save.
    const text = JSON.stringify(v2);
    assert(!/potion/.test(text), label + ' no potion left');
    assert(!/Сервисдеск \d/.test(JSON.stringify(v2.state.nodes)), label + ' desk ids renamed');
    if (v1.map === 'pepsiDesk')
      assert.deepEqual(
        v2.state.nodes.map((n) => n.id),
        ['desk-1', 'desk-2', 'desk-3'],
      );
    if (/potion/.test(JSON.stringify(v1))) {
      assert(
        v2.state.abilities.some((a) => a.id === 'overclock'),
        label + ' overclock',
      );
      assert.equal(v2.state.upgradeRanks.ability_overclock, v1.state.upgradeRanks.ability_potion);
      assert(v2.state.banned.includes('ability_overclock'), label + ' bans renamed');
      assert(
        v2.state.offers.some((o) => o.picked === 'ability_overclock'),
        label + ' offers',
      );
    }
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
    assert.deepEqual(plain(s.upgradeRanks), v2.state.upgradeRanks);
    assert.deepEqual(
      plain(s.abilities.map((a) => [a.id, a.cd])),
      v2.state.abilities.map((a) => [a.id, a.cd]),
      label + ' abilities',
    );
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
    for (const node of v2.state.nodes) {
      const restored = s.nodes.find((n) => n.id === node.id);
      assert(restored, label + ' node ' + node.id);
      assert.equal(restored.status, node.status, label + ' ' + node.id);
      const guardian = nodeGuardian(s, restored);
      if (node.guardianHp === null) assert.equal(guardian, null);
      else {
        assert.equal(guardian.hp, node.guardianHp, label + ' guardian health');
        assert.equal(guardian.summons, node.summons, label + ' desk escalation');
      }
    }
    if (v1.version === 1)
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
    assert.equal(
      JSON.parse(store.get(RUN_SNAPSHOT_KEY)).version,
      currentVersion,
      label + ' saved in the current version',
    );
    assert(!store.has(LEGACY_RUN_SNAPSHOT_KEY));
    game.menu();
    assert(!store.has(RUN_SNAPSHOT_KEY), label + ' the menu clears the save');
    game.dispose();
  }
  // Anything that is not an older run is not converted.
  assert.equal(migrateRunSnapshot({ version: currentVersion, state: {} }), null);
  assert.equal(migrateRunSnapshot({ version: 0, state: {} }), null);
  assert.equal(migrateRunSnapshot(null), null);
  console.log(
    'PASS: ' + Object.keys(fixtures).length + ' version 1 and 2 runs migrate to v3 and play on',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
