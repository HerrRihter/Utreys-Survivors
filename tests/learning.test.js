import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createHarness } from './helpers/game-harness.js';
import { learningCourse } from '../data/learning-questions.js';
import { learningRules, learningRooms } from '../data/learning-rules.js';
import { unitDefinitions } from '../data/enemies/units.js';
import { validateLearningCourse, validLearning } from '../src/systems/learning.js';
import { currentLayout, doorOpen, roomLayout, roomNodes } from '../src/systems/queries/learning.js';
import { edgeTargets } from '../src/rendering/edge-arrows.js';
import { createArenas } from '../src/world/arenas.js';
import { snapshotRun, RUN_SNAPSHOT_KEY, migrateRunSnapshot } from '../src/systems/run-snapshot.js';
import { stateHash } from './helpers/replay.js';
import { normalizeRunEntry } from '../src/systems/run-records.js';
import { createEnemyRenderer } from '../src/rendering/enemies.js';

const mazes = learningRooms.filter((room) => room.maze).length;

async function open(seed = 789) {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const game = h.createSession();
  game.selectMap('learningLab');
  game.views.run().nextSeed = seed;
  game.start();
  // The tests drive the quizzes; the waves must not end the run meanwhile.
  game.state.p.hp = game.state.p.max = 1e6;
  return { h, game, store };
}
// The guard of a terminal falls: the terminal opens for its test.
function unguard(game, node) {
  game.update(1 / 60);
  const guard = game.state.enemies.find((e) => e.id === node.guardianId);
  assert(guard, 'a guard stands at ' + node.id);
  game.damage(guard, 1e9, 0, 0, game.state.p, 'hero');
  game.update(1 / 60);
  assert.equal(node.status, 'available');
}
function startTest(game, k = 0) {
  const node = roomNodes(game.state)[k];
  if (node.status === 'guarded') unguard(game, node);
  Object.assign(game.state.p, { x: node.x, y: node.y });
  assert(game.commands.startLearningTest(node.id));
  return node;
}
function answer(game, correct = true) {
  const a = game.state.learning.active;
  if (a.phase === 'intro') game.commands.advanceLearning(a.id);
  const q = learningCourse.questions.find((q) => q.id === a.questions[a.index].id);
  for (const id of correct ? q.correct : [q.options.find((o) => !q.correct.includes(o.id)).id])
    game.commands.selectLearningAnswer(a.id, id);
  assert(game.commands.submitLearningAnswer(a.id));
  const points = game.state.learning.points;
  assert.equal(game.commands.submitLearningAnswer(a.id), false);
  assert.equal(game.state.learning.points, points);
}
function finishTest(game, correct = true) {
  while (game.state.learning.active.phase !== 'result') {
    const a = game.state.learning.active;
    if (a.phase === 'feedback') game.commands.advanceLearning(a.id);
    else answer(game, correct);
  }
  const id = game.state.learning.active.id;
  game.commands.closeLearning(id);
  assert.equal(game.commands.closeLearning(id), false);
}
function clearMaze(game) {
  for (let k = 0; k < roomNodes(game.state).length; k++) {
    startTest(game, k);
    finishTest(game);
  }
}
function nextRoom(game) {
  Object.assign(game.state.p, currentLayout(game.state).exit);
  assert(game.commands.moveLearningRoom());
  assert.equal(game.commands.moveLearningRoom(), false);
}

test('learning content preserves all supplied questions and rejects invalid banks', () => {
  assert(validateLearningCourse());
  assert.equal(learningCourse.questions.length, 26);
  assert.equal(learningCourse.questions.filter((q) => q.type === 'open').length, 2);
  const multiple = learningCourse.questions.find((q) => q.sourceNumber === 10);
  assert.equal(multiple.type, 'multiple');
  assert.equal(multiple.correct.length, 1);
  const broken = structuredClone(learningCourse);
  broken.questions[0].correct = ['missing'];
  assert.throws(() => validateLearningCourse(broken));
});

test('every run and every room gets its own connected maze', () => {
  const arenas = createArenas();
  const walls = new Set();
  for (let seed = 1; seed <= 12; seed++)
    for (let room = 0; room < mazes; room++) {
      const layout = roomLayout('learningLab', seed, room);
      assert.deepEqual(layout, roomLayout('learningLab', seed, room), 'same seed, same maze');
      walls.add(JSON.stringify(layout.walls));
      const arena = arenas.forRoom('learningLab', `${seed}:${room}`, layout.walls);
      // Every terminal, the door and the guards can be reached from the entry by a hero.
      for (const target of [
        ...layout.terminals,
        ...layout.terminals.map((t) => t.guard),
        layout.exit,
      ])
        assert.notDeepEqual(
          arena.direction(layout.entry, target, 14),
          { x: 0, y: 0 },
          `seed ${seed} room ${room}: ${JSON.stringify(target)} is reachable`,
        );
      for (const point of [layout.entry, layout.exit, ...layout.terminals])
        assert(!arena.blocked(point.x, point.y, 40), 'clear of walls');
    }
  assert.equal(walls.size, 12 * mazes, 'no two mazes alike');
});

test('a guard holds its terminal until beaten or worked around', async () => {
  const { game } = await open();
  try {
    const [first, second] = roomNodes(game.state);
    assert.equal(first.status, 'guarded');
    Object.assign(game.state.p, { x: first.x, y: first.y });
    assert.equal(game.commands.startLearningTest(first.id), false, 'no test while guarded');
    unguard(game, first);
    assert(game.commands.startLearningTest(first.id));
    finishTest(game);
    // A workaround: standing in the circle unhurt opens it without the kill.
    Object.assign(game.state.p, { x: second.x, y: second.y });
    for (let i = 0; i < 60 * 30 && second.status === 'guarded'; i++) {
      game.state.p.hurt = null;
      Object.assign(game.state.p, { x: second.x, y: second.y });
      game.update(1 / 60);
    }
    assert.equal(second.status, 'available');
    // Later mazes stay locked until the hero gets there.
    assert(game.state.nodes.filter((n) => n.room > 0).every((n) => n.status === 'locked'));
  } finally {
    game.dispose();
  }
});

test('a passed test pays an update bundle once; wrong answers call audits', async () => {
  const { game } = await open();
  try {
    const node = startTest(game);
    finishTest(game, false);
    assert.equal(node.status, 'available', 'a failed terminal waits for another try');
    assert.equal(game.state.learning.audits, learningRules.auditMax, 'audits are capped');
    const before = game.state.enemies.length;
    game.update(1 / 60);
    game.update(1 / 60);
    assert.equal(game.state.learning.audits, 0);
    assert(
      game.state.enemies.length - before >= learningRules.auditPack,
      'audit packs arrived: ' + (game.state.enemies.length - before),
    );
    assert.equal(game.state.pickups.filter((p) => p.type === 'bundle').length, 0);
    startTest(game);
    finishTest(game);
    assert.equal(node.status, 'completed');
    assert.equal(game.state.learning.audits, 0);
    assert.equal(
      game.state.pickups.filter((p) => p.type === learningRules.terminalReward).length,
      1,
    );
    assert.equal(game.commands.startLearningTest(node.id), false, 'a passed terminal is done');
  } finally {
    game.dispose();
  }
});

test('the door opens after every terminal, then three mazes lead to the hall boss', async () => {
  const { game, h } = await open();
  try {
    for (let i = 0; i < mazes; i++) {
      assert.equal(game.state.learning.roomIndex, i);
      assert.equal(doorOpen(game.state), false);
      Object.assign(game.state.p, currentLayout(game.state).exit);
      assert.equal(game.commands.moveLearningRoom(), false, 'the door is shut');
      clearMaze(game);
      assert(doorOpen(game.state));
      assert(
        edgeTargets(game.state).some((t) => t.label === 'ДВЕРЬ'),
        'the arrow leads to it',
      );
      assert.equal(game.state.bossSpawned, false);
      const walls = JSON.stringify(currentLayout(game.state).walls);
      nextRoom(game);
      assert.notEqual(JSON.stringify(currentLayout(game.state).walls), walls, 'a new room');
      assert.deepEqual({ x: game.state.p.x, y: game.state.p.y }, currentLayout(game.state).entry);
    }
    game.update(1 / 60);
    const boss = game.state.enemies.find((e) => e.boss);
    assert.equal(unitDefinitions[boss.unit].name, 'Партионный учёт');
    const spot = learningRooms.at(-1).boss;
    assert(Math.hypot(boss.x - spot.x, boss.y - spot.y) < 10, 'the boss arrives at its spot');
    game.damage(boss, 999999, 0, 0, game.state.p, 'hero');
    game.update(1 / 60);
    assert.equal(game.mode, 'end');
    assert.equal(game.views.run().result.win, true);
    assert.equal(game.views.run().result.canContinue, false);
    assert.equal(game.continueProduction(), false);
    assert.equal(h.env.Progression.data.runStats.all.games, 0, 'not ranked');
  } finally {
    game.dispose();
  }
});

test('later mazes bring stronger enemies from the whole roster', async () => {
  const { game } = await open();
  try {
    const spawnIn = (room) => {
      game.state.learning.roomIndex = room;
      return game.spawn('l3', false, { ...currentLayout(game.state).entry });
    };
    const first = spawnIn(0),
      last = spawnIn(mazes - 1);
    const ratio = last.max / first.max;
    assert(Math.abs(ratio - learningRooms[mazes - 1].strength) < 0.05, 'strength ' + ratio);
  } finally {
    game.dispose();
  }
});

test('quiz freezes simulation and rejects stale commands and empty answers', async () => {
  const { game } = await open();
  try {
    startTest(game);
    const id = game.state.learning.active.id,
      before = stateHash(game.state);
    game.update(20);
    assert.equal(stateHash(game.state), before);
    assert.equal(game.activateAbility(0), false);
    assert.equal(game.commands.submitLearningAnswer(id), false);
    game.commands.advanceLearning(id);
    assert.equal(game.commands.submitLearningAnswer(id), false);
    assert.equal(game.commands.selectLearningAnswer(id + 1, 'answer-1'), false);
    assert.equal(game.commands.selectLearningAnswer(id, 'unknown'), false);
    assert.equal(
      game.views.learning().active.options.some((o) => o.correct),
      false,
    );
    answer(game);
    assert(game.views.learning().active.options.some((o) => o.correct));
  } finally {
    game.dispose();
  }
});

test('only one revival, no final defeat before its decision, restores dead quiz', async () => {
  const { game: first, h, store } = await open();
  let game = first;
  try {
    game.state.p.hp = -10;
    game.update(1 / 60);
    assert.equal(game.mode, 'quiz');
    assert.equal(game.state.resultRecorded, false);
    assert(game.state.learning.reviveUsed);
    assert(store.has(RUN_SNAPSHOT_KEY));
    const saved = stateHash(game.state);
    game.dispose();
    game = h.createSession();
    assert(game.resume());
    assert.equal(game.mode, 'quiz');
    assert.equal(stateHash(game.state), saved);
    finishTest(game);
    assert.equal(game.state.p.hp, game.state.p.max * learningRules.reviveHealth);
    assert.equal(game.state.p.inv, learningRules.reviveInvulnerability);
    game.state.p.hp = -10;
    game.update(1 / 60);
    assert.equal(game.mode, 'end');
    assert.equal(store.has(RUN_SNAPSHOT_KEY), false);
  } finally {
    game.dispose();
  }
});

test('revival refusal and failure end the run, ordinary dead saves stay forbidden', async () => {
  for (const refuse of [true, false]) {
    const { game } = await open();
    try {
      game.state.p.hp = -1;
      assert.equal(snapshotRun(game.views.run()), null);
      game.update(1 / 60);
      if (refuse) game.commands.closeLearning(game.state.learning.active.id);
      else finishTest(game, false);
      assert.equal(game.mode, 'end');
      assert.equal(game.views.run().result.win, false);
    } finally {
      game.dispose();
    }
  }
});

test('a saved run resumes in its maze and every quiz phase exactly', async () => {
  const { game: first, h } = await open();
  let game = first;
  try {
    clearMaze(game);
    nextRoom(game);
    // The second maze with its enemies: they come back inside its corridors, not its walls.
    for (let i = 0; i < 60 * 20; i++) {
      if (game.mode === 'level') game.pickUpgrade(0);
      game.update(1 / 60);
    }
    const arenas = createArenas(),
      maze = arenas.forRoom('learningLab', 'check', currentLayout(game.state).walls);
    startTest(game);
    for (const phase of ['intro', 'question', 'feedback', 'result']) {
      if (phase === 'question') game.commands.advanceLearning(game.state.learning.active.id);
      if (phase === 'feedback') answer(game);
      if (phase === 'result') {
        while (game.state.learning.active.phase !== 'result') {
          if (game.state.learning.active.phase === 'feedback')
            game.commands.advanceLearning(game.state.learning.active.id);
          else answer(game);
        }
      }
      const hash = stateHash(game.state);
      h.listeners.pagehide({});
      game.dispose();
      game = h.createSession();
      assert(game.resume());
      assert.equal(game.state.learning.roomIndex, 1);
      assert.equal(game.state.learning.active.phase, phase);
      assert.equal(stateHash(game.state), hash);
      for (const e of game.state.enemies) assert(!maze.blocked(e.x, e.y, 2), 'enemy off the walls');
    }
    const id = game.state.learning.active.id;
    game.commands.closeLearning(id);
    const points = game.state.learning.points;
    game.dispose();
    game = h.createSession();
    assert(game.resume());
    assert.equal(game.commands.closeLearning(id), false);
    assert.equal(game.state.learning.points, points);
  } finally {
    game.dispose();
  }
});

test('the hall boss attacks and summons ordinary Pepsi within its cap', async () => {
  const { game } = await open();
  try {
    for (let i = 0; i < mazes; i++) {
      clearMaze(game);
      nextRoom(game);
    }
    game.update(1 / 60);
    const boss = game.state.enemies.find((e) => e.boss),
      spec = unitDefinitions[boss.unit];
    assert.equal(spec.passive, undefined);
    game.state.p.max = game.state.p.hp = 100000;
    game.state.attack = 10000;
    Object.assign(game.state.p, { x: boss.x + 80, y: boss.y });
    const hp = game.state.p.hp;
    for (let i = 0; i < 2400; i++) {
      if (game.mode === 'level') game.pickUpgrade(0);
      game.update(1 / 60);
    }
    const adds = game.state.enemies.filter((e) => e.summonerId === boss.id);
    assert(adds.length > 0 && adds.length <= spec.summon.max);
    assert(adds.every((e) => spec.summon.units.includes(e.unit) && !e.boss));
    assert(game.state.p.hp < hp);
  } finally {
    game.dispose();
  }
});

test('v4 migration, old learning layouts and unknown courses are refused, no leaderboard', async () => {
  const { game, store, h } = await open();
  try {
    const old = snapshotRun(game.views.run());
    old.version = 4;
    old.map = 'empty';
    delete old.state.learning;
    const migrated = migrateRunSnapshot(old);
    assert.equal(migrated.version, 5);
    assert.equal(migrated.state.learning, null);
    for (const change of [(l) => (l.courseVersion = 999), (l) => (l.layout = 1)]) {
      startTest(game);
      const saved = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
      change(saved.state.learning);
      store.set(RUN_SNAPSHOT_KEY, JSON.stringify(saved));
      const other = h.createSession();
      assert.equal(other.resume(), false);
      assert(store.has(RUN_SNAPSHOT_KEY));
      other.dispose();
      game.commands.closeLearning(game.state.learning.active.id);
    }
    assert.equal(normalizeRunEntry({ runId: 'abc', map: 'learningLab', time: 60 }), null);
    assert.equal(validLearning({}), false);
  } finally {
    game.dispose();
  }
});

test('maze, terminals, door and boss art draw through the Canvas renderer', async () => {
  const { game, h } = await open();
  try {
    game.draw();
    clearMaze(game);
    game.draw();
    const renderer = createEnemyRenderer({ createCanvas: () => null });
    renderer.draw(h.context, { unit: 'batch_accounting', x: 0, y: 0, heading: 0, hp: 100, hit: 0 });
  } finally {
    game.dispose();
  }
});
