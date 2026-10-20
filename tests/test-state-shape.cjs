const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHarness } = require('./helpers/game-harness.cjs');
const { heroDefinitions } = require('../data/characters/heroes.js');
const { mapDefinitions } = require('../data/maps/maps.js');
const { abilityDefinitions } = require('../data/characters/abilities.js');

// Every field of `run.state` is either saved by snapshotRun or listed here as runtime-only.
// A new field must be put in one of the two lists on purpose, so a save never drops it silently.
const RUNTIME_KEYS = [
  // Rebuilt by start() from the map, seed and hero.
  'eventPlan',
  'attack',
  'heroWeaponName',
  'abilities',
  'nodes',
  'p',
  'weapons',
  // Live world, dropped or saved in reduced form.
  'enemies',
  'corpses',
  'enemyShots',
  'hazards',
  'shots',
  'codes',
  'gems',
  'fx',
  'texts',
  'pickups',
  'bossDead',
  'shake',
  // Saved at the snapshot's top level, not inside `state`.
  'map',
  // Per-frame caches set by the simulation and weapons.
  'wfx',
  'crowd',
  'guards',
  'attackCycle',
  // Set lazily by systems and not saved today: a resumed run starts them over.
  'speechPhraseIndex',
  'speechCursor',
  'nextSpeechAt',
  'eventsDone',
  // Ending bookkeeping: a run that has ended is never saved.
  'resultRecorded',
  'recordsImproved',
];

// The plain keys snapshotRun copies, read from its source so the test follows the save format.
function snapshotKeys() {
  const source = fs.readFileSync(path.join(__dirname, '../src/systems/run-snapshot.js'), 'utf8');
  const list = source.match(/\.\.\.pick\(s, \[([\s\S]*?)\]\)/);
  assert(list, 'snapshotRun key list not found');
  return [...list[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

const SECONDS = 180,
  DT = 1 / 60;

(async () => {
  const saved = new Set(snapshotKeys());
  const known = new Set([...saved, ...RUNTIME_KEYS]);
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const P = h.env.Progression;
  const heroes = Object.keys(heroDefinitions),
    maps = Object.keys(mapDefinitions);
  for (const map of maps) P.recordRunStats({ win: true, hero: 'utrace', map, time: 600 });
  // `P.data` is a copy: heroes are opened through a replaced save.
  P.replace({ ...P.data, unlocked: heroes });

  const seen = new Set();
  const unknown = new Map();
  for (const hero of heroes)
    for (const map of maps) {
      const label = hero + '@' + map;
      let game = h.createSession();
      game.select(hero);
      game.selectMap(map);
      game.start();
      assert.equal(game.state.map, map, label);
      assert.equal(game.state.abilities[1].id, abilityDefinitions[hero][1].id, label + ' hero');
      const moves = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
      for (let i = 0, steps = SECONDS / DT; i < steps; i++) {
        if (game.mode === 'level') game.pickUpgrade(0);
        if (game.mode !== 'play') break;
        // Walk a square so pickups and nodes are reached; full health keeps the run going.
        if (i % 120 === 0) {
          game.keys.clear();
          game.keys.add(moves[(i / 120) % 4]);
        }
        game.state.p.hp = game.state.p.max;
        game.update(DT);
      }
      game.keys.clear();
      if (game.mode === 'level') game.pickUpgrade(0);
      const s = game.state;
      for (const key of Object.keys(s)) {
        seen.add(key);
        if (!known.has(key)) unknown.set(key, (unknown.get(key) || []).concat(label));
      }

      // Round trip: save on pause, back to the menu, continue the saved run.
      assert.equal(game.mode, 'play', label + ' still running');
      game.pause();
      const snapshot = store.get('utreys-run-v1');
      assert(snapshot, label + ' pause saves the run');
      const expected = JSON.parse(
        JSON.stringify({
          t: s.t,
          kills: s.kills,
          level: s.level,
          xp: s.xp,
          stats: s.stats,
          upgradeRanks: s.upgradeRanks,
          weapons: s.weapons.map((w) => [w.id, w.level, w.evolved]),
          hp: s.p.hp,
          max: s.p.max,
          nodes: s.nodes.map((n) => [n.id, n.status, n.progress]),
        }),
      );
      game.menu();
      assert.equal(game.state, null);
      store.set('utreys-run-v1', snapshot);
      game.dispose();
      game = h.createSession();
      assert(game.resume(), label + ' resumes');
      const r = game.state;
      assert.deepEqual(
        JSON.parse(
          JSON.stringify({
            t: r.t,
            kills: r.kills,
            level: r.level,
            xp: r.xp,
            stats: r.stats,
            upgradeRanks: r.upgradeRanks,
            weapons: r.weapons.map((w) => [w.id, w.level, w.evolved]),
            hp: r.p.hp,
            max: r.p.max,
            nodes: r.nodes.map((n) => [n.id, n.status, n.progress]),
          }),
        ),
        expected,
        label + ' round trip keeps the saved fields',
      );
      game.menu();
      game.dispose();
    }

  assert.equal(
    unknown.size,
    0,
    'run.state fields neither saved nor listed in RUNTIME_KEYS: ' +
      [...unknown].map(([key, where]) => key + ' (' + where[0] + ')').join(', '),
  );
  // Stale entries make the list lie; every runtime key must still exist somewhere.
  const unused = RUNTIME_KEYS.filter((key) => !seen.has(key));
  assert.deepEqual(unused, [], 'RUNTIME_KEYS lists fields no run has');
  console.log(
    'PASS: run.state shape for ' + heroes.length * maps.length + ' hero/map runs, save round trip',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
