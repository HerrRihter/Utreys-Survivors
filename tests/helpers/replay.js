// Replays a run from a seed and a recorded input tape, step by step, and hashes what decides the
// run. Used by tests/golden-replay.test.js.
import crypto from 'node:crypto';
import { createHarness } from './game-harness.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { heroDefinitions } from '../../data/characters/heroes.js';
import { createRng } from '../../src/core/rng.js';
import { toGraphJson } from '../../src/core/graph-json.js';
import { persistentKeys } from '../../src/systems/run-model.js';
import { RUN_SNAPSHOT_KEY } from '../../src/systems/run-snapshot.js';

export const STEP = 1 / 60;

// The input a player gave: the movement intent from step `step` on, ability presses at a step,
// and what was done at each level-up in turn (pick a card, reroll first, skip).
export function recordTape(seed, steps) {
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
// source's position. Not the run id (a new one each start), display labels or what enemies say
// on screen.
const cosmetic = new Set([
  'runId',
  'label',
  'speech',
  'nextSpeechAt',
  'speechPhraseIndex',
  'speechCursor',
]);
// Fields added after a fixture was taken, which its projection leaves out: `pre-learning`
// before the learning map, `pre-incident` before the incident escalation mode; both before
// the Penza run flag (false in these replays).
export const projections = {
  'pre-learning': ['learning', 'incident', 'penza'],
  'pre-incident': ['incident', 'penza'],
};
export function stateHash(s, projection = null) {
  const without = projections[projection] ?? [];
  const fields = toGraphJson(
    Object.fromEntries(
      persistentKeys.filter((key) => !without.includes(key)).map((key) => [key, s[key]]),
    ),
  );
  const text = JSON.stringify(fields, (key, value) => (cosmetic.has(key) ? undefined : value));
  return crypto
    .createHash('sha256')
    .update(text + '|' + s.rng.getState())
    .digest('hex')
    .slice(0, 16);
}

// One account (harness) per replay: a resumed run continues on the same account. `accountKills`
// starts it with enemies defeated in earlier runs.
async function openAccount({ accountKills = 0 } = {}) {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const P = h.env.Progression;
  for (const map of Object.keys(mapDefinitions))
    P.records.recordRunStats({ win: true, hero: 'utrace', map, time: 600 });
  P.replace({ ...P.data, unlocked: Object.keys(heroDefinitions), kills: accountKills });
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
export async function replayContinuous(scenario, marks = []) {
  const { h } = await openAccount(scenario);
  const game = startRun(h, scenario);
  const tape = recordTape(scenario.seed, scenario.steps);
  const cursor = { levelUps: 0 },
    hashes = {};
  let step = 0;
  for (const mark of [...marks, scenario.steps]) {
    step = play(game, tape, step, mark, cursor);
    hashes[mark] = stateHash(game.state, scenario.projection);
  }
  const s = game.state;
  const out = { hashes, t: s.t, kills: s.kills, level: s.level, enemies: s.enemies.length };
  game.dispose();
  return out;
}

// The replay saved at `saveAt` as a closing tab does, then continued in a new session.
export async function replaySaved(scenario, saveAt) {
  const { h, store } = await openAccount(scenario);
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

// The golden replays: five heroes on three maps; one full two-minute replay per hero, shorter
// ones for the other pairs.
const heroes = ['utrace', 'traceability', 'serialization', 'ba', 'qa'],
  maps = ['empty', 'serverRoom', 'pepsiDesk'];
export const goldenScenarios = heroes.flatMap((hero, h) =>
  maps.map((map, m) => ({
    hero,
    map,
    seed: 1000 + h * 31 + m * 7,
    steps: m === h % 3 ? 120 * 60 : 40 * 60,
  })),
);
export const scenarioLabel = (s) => `${s.hero}@${s.map}`;
