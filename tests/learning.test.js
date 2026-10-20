import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createHarness } from './helpers/game-harness.js';
import { learningCourse } from '../data/learning-questions.js';
import { learningRooms } from '../data/learning-rules.js';
import { unitDefinitions } from '../data/enemies/units.js';
import { validateLearningCourse, validLearning } from '../src/systems/learning.js';
import { currentRoom, inRoom } from '../src/systems/queries/learning.js';
import { snapshotRun, RUN_SNAPSHOT_KEY, migrateRunSnapshot } from '../src/systems/run-snapshot.js';
import { stateHash } from './helpers/replay.js';
import { normalizeRunEntry } from '../src/systems/run-records.js';
import { createEnemyRenderer } from '../src/rendering/enemies.js';

async function open() {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const game = h.createSession();
  game.selectMap('learningLab');
  game.views.run().nextSeed = 789;
  game.start();
  return { h, game, store };
}
function startTest(game, bonus = false) {
  const node = game.state.nodes.find(
    (n) => n.room === game.state.learning.roomIndex && n.required === !bonus,
  );
  Object.assign(game.state.p, { x: node.x, y: node.y });
  assert(game.commands.startLearningTest(node.id));
  return game.state.learning.active.id;
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
function nextRoom(game) {
  const room = currentRoom(game.state);
  Object.assign(game.state.p, room.exit);
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

test('three gated rooms lead to the new boss, rewards and result recorded once', async () => {
  const { game, h } = await open();
  try {
    assert.equal(game.commands.moveLearningRoom(), false);
    assert.equal(game.commands.startLearningTest('lesson-errors'), false);
    for (let i = 0; i < 3; i++) {
      assert.equal(game.state.learning.roomIndex, i);
      startTest(game);
      finishTest(game);
      assert.equal(game.state.nodes.find((n) => n.required && n.room === i).status, 'completed');
      assert.equal(game.state.bossSpawned, false);
      const earned = game.state.earned;
      nextRoom(game);
      assert.equal(game.state.earned, earned);
    }
    game.update(1 / 60);
    const boss = game.state.enemies.find((e) => e.boss);
    assert.equal(unitDefinitions[boss.unit].name, 'Партионный учёт');
    game.damage(boss, 999999, 0, 0, game.state.p, 'hero');
    game.update(1 / 60);
    assert.equal(game.mode, 'end');
    assert.equal(game.views.run().result.win, true);
    assert.equal(game.views.run().result.canContinue, false);
    assert.equal(game.continueProduction(), false);
    assert.equal(h.env.Progression.data.stats.wins, 0);
    assert.equal(h.env.Progression.data.runStats.all.games, 0);
    const snapshot = JSON.stringify(h.env.Progression.data);
    game.finish(true);
    assert.equal(JSON.stringify(h.env.Progression.data), snapshot);
  } finally {
    game.dispose();
  }
});

test('quiz freezes simulation and rejects stale commands and empty answers', async () => {
  const { game } = await open();
  try {
    const id = startTest(game),
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

test('failed lesson retries; a successful terminal and bonus cannot farm rewards', async () => {
  const { game } = await open();
  try {
    startTest(game);
    finishTest(game, false);
    assert.equal(game.state.nodes[0].status, 'available');
    assert.equal(game.state.learning.points, 0);
    startTest(game);
    finishTest(game);
    assert.equal(game.commands.startLearningTest('lesson-basics'), false);
    nextRoom(game);
    startTest(game, true);
    finishTest(game, false);
    assert.equal(game.commands.startLearningTest('bonus-reserve'), false);
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
    assert.equal(game.state.p.hp, game.state.p.max * 0.5);
    assert.equal(game.state.p.inv, 3);
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

test('every quiz phase restores exactly, reward cannot double after reload', async () => {
  const { game: first, h } = await open();
  let game = first;
  try {
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
      assert.equal(game.state.learning.active.phase, phase);
      assert.equal(stateHash(game.state), hash);
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

test('boss attacks and summons ordinary Pepsi within its room and population cap', async () => {
  const { game } = await open();
  try {
    for (let i = 0; i < 3; i++) {
      startTest(game);
      finishTest(game);
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
    assert(
      adds.every(
        (e) =>
          spec.summon.units.includes(e.unit) &&
          !e.boss &&
          inRoom(currentRoom(game.state), e.x, e.y),
      ),
    );
    assert(game.state.p.hp < hp);
  } finally {
    game.dispose();
  }
});

test('v4 migration, unknown course protection and no leaderboard admission', async () => {
  const { game, store, h } = await open();
  try {
    const old = snapshotRun(game.views.run());
    old.version = 4;
    old.map = 'empty';
    delete old.state.learning;
    const migrated = migrateRunSnapshot(old);
    assert.equal(migrated.version, 5);
    assert.equal(migrated.state.learning, null);
    startTest(game);
    const saved = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
    saved.state.learning.courseVersion = 999;
    store.set(RUN_SNAPSHOT_KEY, JSON.stringify(saved));
    game.dispose();
    const other = h.createSession();
    assert.equal(other.resume(), false);
    assert(store.has(RUN_SNAPSHOT_KEY));
    other.dispose();
    assert.equal(normalizeRunEntry({ runId: 'abc', map: 'learningLab', time: 60 }), null);
    assert.equal(validLearning({}), false);
  } finally {
    game.dispose();
  }
});

test('room geometry is closed, terminal art and boss art draw through Canvas renderer', async () => {
  const { game, h } = await open();
  try {
    game.draw();
    const renderer = createEnemyRenderer({ createCanvas: () => null });
    renderer.draw(h.context, { unit: 'batch_accounting', x: 0, y: 0, heading: 0, hp: 100, hit: 0 });
    for (const room of learningRooms) assert(inRoom(room, room.entry.x, room.entry.y, 14));
    game.state.p.x = 1030;
    game.state.p.y = 500;
    game.views.run().stick.x = 1;
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    assert(game.state.p.x <= 1026);
  } finally {
    game.dispose();
  }
});
