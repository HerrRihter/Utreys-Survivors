// Replays a run from a seed and a recorded input tape, step by step, and hashes what decides the
// run. Used by tests/test-golden-replay.cjs.
const crypto = require('node:crypto');
const { createHarness } = require('./game-harness.cjs');
const { mapDefinitions } = require('../../data/maps/maps.js');
const { heroDefinitions } = require('../../data/characters/heroes.js');
const { createRng } = require('../../src/core/rng.js');
const { toGraphJson } = require('../../src/core/graph-json.js');
const { persistentKeys } = require('../../src/systems/run-model.js');
const { RUN_SNAPSHOT_KEY } = require('../../src/systems/run-snapshot.js');

const STEP = 1 / 60;

// The input a player gave: the movement intent from step `step` on, ability presses at a step,
// and what was done at each level-up in turn (pick a card, reroll first, skip).
function recordTape(seed, steps) {
  const rng = createRng(seed);
  const moves = [],
    presses = [],
    levelUps = [];
  for (let step = 0; step < steps; step += 30 + Math.floor(rng.random() * 60)) {
    const still = rng.random() < 0.1,
      a = rng.random() * Math.PI * 2,
      speed = 0.4 + rng.random() * 0.6;
    moves.push({ step, x: still ? 0 : Math.cos(a) * speed, y: still ? 0 : Math.sin(a) * speed });
  }
  for (let step = 200; step < steps; step += 300 + Math.floor(rng.random() * 400))
    presses.push({ step, slot: rng.random() < 0.5 ? 0 : 1 });
  for (let i = 0; i < 40; i++) {
    const roll = rng.random();
    levelUps.push(roll < 0.08 ? { skip: true } : { reroll: roll < 0.2, card: i % 4 });
  }
  return { moves, presses, levelUps };
}

// Everything the simulation reads, with the references between objects, and the random
// source's position. Not the run id (a new one each start) or what enemies say on screen.
const cosmetic = new Set(['runId', 'speech', 'nextSpeechAt', 'speechPhraseIndex', 'speechCursor']);
function stateHash(s) {
  const fields = toGraphJson(Object.fromEntries(persistentKeys.map((key) => [key, s[key]])));
  const text = JSON.stringify(fields, (key, value) => (cosmetic.has(key) ? undefined : value));
  return crypto
    .createHash('sha256')
    .update(text + '|' + s.rng.getState())
    .digest('hex')
    .slice(0, 16);
}

// One account (harness) per replay: a resumed run continues on the same account.
async function openAccount(hero) {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const P = h.env.Progression;
  for (const map of Object.keys(mapDefinitions))
    P.recordRunStats({ win: true, hero: 'utrace', map, time: 600 });
  P.replace({ ...P.data, unlocked: Object.keys(heroDefinitions) });
  return { h, store };
}

// Starts the run: the seed and a sturdy hero, so the tape plays to its end.
function startRun(h, { hero, map, seed }) {
  const game = h.createSession();
  game.select(hero);
  game.selectMap(map);
  game.views.run().nextSeed = seed;
  game.start();
  game.state.p.max = game.state.p.hp = 4000;
  return game;
}

// Plays steps [from, to) of the tape. Level-ups are answered in order; `cursor.levelUps` counts
// those answered so far (a resumed run continues the count).
function play(game, tape, from, to, cursor) {
  const run = game.views.run();
  let move = tape.moves.findLast((m) => m.step <= from) || { x: 0, y: 0 };
  let next = tape.moves.findIndex((m) => m.step > from);
  if (next < 0) next = tape.moves.length;
  for (let step = from; step < to; step++) {
    while (game.mode === 'level') {
      const answer = tape.levelUps[cursor.levelUps++ % tape.levelUps.length];
      run.levelLock = 0;
      if (answer.skip && game.state.skips > 0) game.commands.skip();
      else {
        if (answer.reroll && game.state.rerolls > 0) game.commands.reroll();
        game.pickUpgrade(answer.card);
      }
    }
    if (game.mode !== 'play') return step;
    while (next < tape.moves.length && tape.moves[next].step <= step) move = tape.moves[next++];
    for (const press of tape.presses) if (press.step === step) game.activateAbility(press.slot);
    run.stick = { x: move.x, y: move.y };
    game.update(STEP);
  }
  return to;
}

// The whole replay without a break; hashes at `marks` (steps).
async function replayContinuous(scenario, marks = []) {
  const { h } = await openAccount(scenario.hero);
  const game = startRun(h, scenario);
  const tape = recordTape(scenario.seed, scenario.steps);
  const cursor = { levelUps: 0 },
    hashes = {};
  let step = 0;
  for (const mark of [...marks, scenario.steps]) {
    step = play(game, tape, step, mark, cursor);
    hashes[mark] = stateHash(game.state);
  }
  const s = game.state;
  const out = { hashes, t: s.t, kills: s.kills, level: s.level, enemies: s.enemies.length };
  game.dispose();
  return out;
}

// The replay saved at `saveAt` as a closing tab does, then continued in a new session.
async function replaySaved(scenario, saveAt) {
  const { h, store } = await openAccount(scenario.hero);
  let game = startRun(h, scenario);
  const tape = recordTape(scenario.seed, scenario.steps);
  const cursor = { levelUps: 0 };
  play(game, tape, 0, saveAt, cursor);
  const atSave = stateHash(game.state);
  h.listeners.pagehide({});
  if (!store.has(RUN_SNAPSHOT_KEY)) throw new Error('the run was not saved');
  game.dispose();
  game = h.createSession();
  if (!game.resume()) throw new Error('the saved run does not resume');
  if (game.mode === 'pause') game.pause();
  const resumed = stateHash(game.state);
  play(game, tape, saveAt, scenario.steps, cursor);
  const out = { atSave, resumed, end: stateHash(game.state) };
  game.dispose();
  return out;
}

module.exports = { recordTape, stateHash, replayContinuous, replaySaved, STEP };
