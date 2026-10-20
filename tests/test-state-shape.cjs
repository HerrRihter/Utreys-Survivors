const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { heroDefinitions } = require('../data/characters/heroes.js');
const { mapDefinitions } = require('../data/maps/maps.js');
const { abilityDefinitions } = require('../data/characters/abilities.js');
const { runFields, persistentKeys, reducedKeys } = require('../src/systems/run-model.js');
const { RUN_SNAPSHOT_KEY } = require('../src/systems/run-snapshot.js');
const { toGraphJson } = require('../src/core/graph-json.js');

// Every field of `run.state` comes from the run model's schema (runFields): copied into the
// save, saved in a reduced form or rebuilt. Only `runtime` holds the simulation's caches; it is
// saved, since a step reads values the previous step counted.
// A field outside the schema fails here, so a save never drops it silently.
const RUNTIME_KEYS = ['runtime'];

// What a resumed run must have as saved: every copied field as it was, with the references
// between objects (targets, hit lists, guards), and the game random source at its position.
const shape = (s) =>
  JSON.stringify({
    fields: toGraphJson(Object.fromEntries(persistentKeys.map((key) => [key, s[key]]))),
    rng: s.rng.getState(),
  });

const SECONDS = 180,
  DT = 1 / 60;

(async () => {
  const known = new Set(Object.keys(runFields));
  for (const key of RUNTIME_KEYS) assert.equal(runFields[key], 'save', key + ' is saved');
  assert.equal(
    new Set([...persistentKeys, ...reducedKeys]).size,
    persistentKeys.length + reducedKeys.length,
  );
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
  for (const map of maps) P.records.recordRunStats({ win: true, hero: 'utrace', map, time: 600 });
  // `P.data` is a copy: heroes are opened through a replaced save.
  P.replace({ ...P.data, unlocked: heroes });

  // A picked card can open the next level-up at once when the experience covers two.
  const answerLevelUps = (game) => {
    for (let i = 0; i < 20 && game.mode === 'level'; i++) game.pickUpgrade(0);
  };
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
        answerLevelUps(game);
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
      answerLevelUps(game);
      const s = game.state;
      for (const key of Object.keys(s)) {
        seen.add(key);
        if (!known.has(key)) unknown.set(key, (unknown.get(key) || []).concat(label));
      }

      // Round trip: save on pause, back to the menu, continue the saved run.
      assert.equal(game.mode, 'play', label + ' still running');
      game.pause();
      const snapshot = store.get(RUN_SNAPSHOT_KEY);
      assert(snapshot, label + ' pause saves the run');
      const saved = JSON.parse(snapshot).state;
      assert.deepEqual(
        Object.keys(saved).sort(),
        [...persistentKeys, ...reducedKeys].sort(),
        label + ' the save holds the schema fields',
      );
      const expected = shape(s);
      game.menu();
      assert.equal(game.state, null);
      store.set(RUN_SNAPSHOT_KEY, snapshot);
      game.dispose();
      game = h.createSession();
      assert(game.resume(), label + ' resumes');
      assert.equal(shape(game.state), expected, label + ' round trip keeps the saved fields');
      game.menu();
      game.dispose();
    }

  assert.equal(
    unknown.size,
    0,
    'run.state fields missing from runFields in src/systems/run-model.js: ' +
      [...unknown].map(([key, where]) => key + ' (' + where[0] + ')').join(', '),
  );
  // Stale entries make the schema lie; every field must exist in a run.
  const unused = [...known].filter((key) => !seen.has(key));
  assert.deepEqual(unused, [], 'runFields lists fields no run has');
  console.log(
    'PASS: run.state shape for ' + heroes.length * maps.length + ' hero/map runs, save round trip',
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
