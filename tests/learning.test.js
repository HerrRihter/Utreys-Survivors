import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createHarness } from './helpers/game-harness.js';
import { learningCourse } from '../data/learning-questions.js';
import { incidentCourse } from '../data/learning-incidents.js';
import { learningRules, learningRooms, learningGrading } from '../data/learning-rules.js';
import { unitDefinitions } from '../data/enemies/units.js';
import { validateLearningCourse, validLearning } from '../src/systems/learning.js';
import {
  courseOf,
  currentLayout,
  doorOpen,
  roomLayout,
  roomNodes,
} from '../src/systems/queries/learning.js';
import { edgeTargets } from '../src/rendering/edge-arrows.js';
import { createArenas } from '../src/world/arenas.js';
import { snapshotRun, RUN_SNAPSHOT_KEY, migrateRunSnapshot } from '../src/systems/run-snapshot.js';
import { stateHash } from './helpers/replay.js';
import { normalizeRunEntry } from '../src/systems/run-records.js';
import { createEnemyRenderer } from '../src/rendering/enemies.js';

const mazes = learningRooms.filter((room) => room.maze).length;

async function open(seed = 789, course = learningCourse.id) {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  const game = h.createSession();
  game.selectMap('learningCenter');
  game.commands.chooseCourse(course);
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
  const q = courseOf(game.state).questions.find((q) => q.id === a.questions[a.index].id);
  for (const id of correct ? q.correct : [q.options.find((o) => !q.correct.includes(o.id)).id])
    game.commands.selectLearningAnswer(a.id, id);
  assert(game.commands.submitLearningAnswer(a.id));
  const points = game.state.learning.points;
  assert.equal(game.commands.submitLearningAnswer(a.id), false);
  assert.equal(game.state.learning.points, points);
}
// `correct`: every answer right or wrong, or a list, one entry per question.
function finishTest(game, correct = true) {
  let n = 0;
  while (game.state.learning.active.phase !== 'result') {
    const a = game.state.learning.active;
    if (a.phase === 'feedback') game.commands.advanceLearning(a.id);
    else answer(game, Array.isArray(correct) ? correct[n++] : correct);
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
  assert(validateLearningCourse(learningCourse));
  assert.equal(learningCourse.questions.length, 26);
  assert.equal(learningCourse.questions.filter((q) => q.type === 'open').length, 2);
  const multiple = learningCourse.questions.find((q) => q.sourceNumber === 10);
  assert.equal(multiple.type, 'multiple');
  assert.equal(multiple.correct.length, 1);
  const broken = structuredClone(learningCourse);
  broken.questions[0].correct = ['missing'];
  assert.throws(() => validateLearningCourse(broken));
  const sourced = structuredClone(learningCourse);
  sourced.questions[0].explanation = 'По предоставленному учебному материалу: ответ.';
  assert.throws(() => validateLearningCourse(sourced), /lead-in/);
});

test('the incident course keeps the scored test: keys, comments, open questions', () => {
  assert(validateLearningCourse(incidentCourse));
  assert.equal(incidentCourse.questions.length, 40);
  assert.equal(incidentCourse.questions.filter((q) => q.type === 'open').length, 7);
  assert.equal(incidentCourse.questions.filter((q) => q.type === 'multiple').length, 8);
  for (let topic = 0; topic < 3; topic++)
    assert(
      incidentCourse.questions.filter((q) => q.topic === topic && q.type !== 'open').length >= 9,
    );
  // Keys of the questions answered wrongly in the scored page.
  const key = (start) => {
    const q = incidentCourse.questions.find((q) => q.text.startsWith(start));
    return q.correct.map((id) => q.options.find((o) => o.id === id).text);
  };
  assert.deepEqual(key('Каким тегом'), ['ZombieSquad']);
  assert.equal(key('При переводе тикета CRIT').length, 5);
  assert(!key('Какие обязанности').includes('Лично устраняет техническую неисправность'));
  assert(incidentCourse.questions.filter((q) => q.type === 'open').every((q) => q.reference));
});

test('the incident map plays the same scheme with its own course and boss', async () => {
  const { game } = await open(321, incidentCourse.id);
  try {
    assert.equal(game.state.learning.course, 'critical-incidents');
    for (let i = 0; i < mazes; i++) {
      for (let k = 0; k < 3; k++) {
        startTest(game, k);
        const a = game.state.learning.active;
        assert(
          a.questions.every((q) => q.id.startsWith('incident-')),
          'its own questions',
        );
        finishTest(game);
      }
      nextRoom(game);
    }
    game.update(1 / 60);
    const boss = game.state.enemies.find((e) => e.boss);
    assert.equal(unitDefinitions[boss.unit].name, 'Критический инцидент');
  } finally {
    game.dispose();
  }
});

test('one learning map: the course is picked beside it and old maps saves are dropped', async () => {
  const { game, store, h } = await open(789, incidentCourse.id);
  try {
    assert.equal(game.state.map, 'learningCenter');
    assert.equal(game.state.learning.course, incidentCourse.id);
    assert.equal(game.commands.chooseCourse('missing'), undefined);
    assert.equal(game.views.run().selectedCourse, incidentCourse.id, 'unknown course ignored');
    const picker = game.views.heroSelect();
    assert.equal(picker.showCourses, true);
    assert.deepEqual(
      picker.courses.map((c) => c.id),
      [learningCourse.id, incidentCourse.id],
    );
    // The maze names come from the course.
    assert.match(game.views.hud().progress, new RegExp(incidentCourse.rooms[0]));
    game.pause();
    const saved = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
    saved.map = 'incidentLab';
    store.set(RUN_SNAPSHOT_KEY, JSON.stringify(saved));
    const other = h.createSession();
    assert.equal(other.resume(), false, 'a save of a removed map does not go on');
    other.selectMap('empty');
    assert.equal(other.views.heroSelect().showCourses, false);
    other.dispose();
  } finally {
    game.dispose();
  }
});

test('every run and every room gets its own connected maze', () => {
  const arenas = createArenas();
  const walls = new Set();
  for (let seed = 1; seed <= 12; seed++)
    for (let room = 0; room < mazes; room++) {
      const layout = roomLayout('learningCenter', seed, room);
      assert.deepEqual(layout, roomLayout('learningCenter', seed, room), 'same seed, same maze');
      walls.add(JSON.stringify(layout.walls));
      const arena = arenas.forRoom('learningCenter', `${seed}:${room}`, layout.walls);
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

test('a failed test shuts the terminal and swells the waves; rewards follow the score', async () => {
  const { game } = await open();
  try {
    const count = (type) => game.state.pickups.filter((p) => p.type === type).length;
    const node = startTest(game);
    finishTest(game, false);
    assert.equal(node.status, 'available', 'a failed terminal waits for another try');
    assert.equal(game.state.learning.audits, learningRules.auditMax, 'audits are capped');
    assert.equal(node.retryAt, game.state.t + learningRules.failLock);
    assert.equal(game.state.learning.surgeUntil, game.state.t + learningRules.surge.seconds);
    const before = game.state.enemies.length;
    game.update(1 / 60);
    game.update(1 / 60);
    assert.equal(game.state.learning.audits, 0);
    assert(
      game.state.enemies.length - before >= learningRules.auditPack,
      'audit packs arrived: ' + (game.state.enemies.length - before),
    );
    assert.equal(count('bundle') + count('food'), 0);
    Object.assign(game.state.p, { x: node.x, y: node.y });
    assert.equal(game.commands.startLearningTest(node.id), false, 'shut for a while');
    assert.match(game.views.hud().progress, /недоступен/);
    while (game.state.t < node.retryAt) {
      if (game.mode === 'level') game.pickUpgrade(0);
      game.update(1 / 60);
    }
    // All right: the update bundle and a capsule.
    startTest(game);
    finishTest(game);
    assert.equal(node.status, 'completed');
    assert.equal(game.state.learning.audits, 0);
    assert.equal(count('bundle'), 1);
    assert.equal(count('food'), 1);
    assert.equal(game.commands.startLearningTest(node.id), false, 'a passed terminal is done');
    // Two of three: a capsule only.
    const second = startTest(game, 1);
    finishTest(game, [true, true, false]);
    assert.equal(second.status, 'completed');
    assert.equal(count('bundle'), 1);
    assert.equal(count('food'), 2);
    // Leaving a test before any answer costs nothing.
    const third = startTest(game, 2);
    game.commands.closeLearning(game.state.learning.active.id);
    assert.equal(third.retryAt, 0);
  } finally {
    game.dispose();
  }
});

test('the report card grades every question by the attempt that got it right', async () => {
  const { game } = await open();
  try {
    startTest(game);
    finishTest(game, [false, false, false]);
    game.state.nodes.find((n) => n.room === 0).retryAt = 0;
    startTest(game);
    finishTest(game);
    const s = game.state;
    const records = Object.values(s.learning.answers);
    for (const r of records) {
      assert(r.sources.includes('terminal'));
      if (r.firstCorrectAt !== 1) assert(r.wrong.length > 0, 'its wrong pick is kept');
    }
    game.state.p.hp = -1;
    game.update(1 / 60);
    game.commands.closeLearning(game.state.learning.active.id);
    const report = game.views.run().result.learning;
    assert.equal(report.preliminary, true, 'a defeat grades preliminarily');
    const questions = report.topics.flatMap((t) => t.questions);
    assert.equal(questions.length, records.length);
    const expected =
      records.reduce(
        (n, r) =>
          n +
          (r.firstCorrectAt ? learningGrading.attemptScore[Math.min(r.firstCorrectAt, 3) - 1] : 0),
        0,
      ) / records.length;
    assert.equal(report.percent, Math.round(expected * 100) + '%');
    assert.equal(report.grade, learningGrading.grades.find((g) => expected >= g.min).name);
    for (const q of questions) {
      assert(q.text && q.verdict);
      if (!q.firstTry) assert(q.correct.length && q.explanation, 'a missed one shows its key');
    }
  } finally {
    game.dispose();
  }
});

test('v5 saves gain the terminal lock, the surge and the report card fields', async () => {
  const { game } = await open();
  try {
    startTest(game);
    finishTest(game, [true, false, true]);
    const saved = JSON.parse(JSON.stringify(snapshotRun(game.views.run())));
    saved.version = 5;
    delete saved.state.learning.surgeUntil;
    for (const n of saved.state.nodes) delete n.retryAt;
    for (const r of Object.values(saved.state.learning.answers)) {
      delete r.firstCorrectAt;
      delete r.wrong;
      delete r.sources;
    }
    const migrated = migrateRunSnapshot(saved);
    assert.equal(migrated.version, 7);
    assert.equal(migrated.state.learning.surgeUntil, 0);
    assert(migrated.state.nodes.every((n) => n.retryAt === 0));
    assert(validLearning(migrated.state.learning, 'learningCenter'));
    for (const r of Object.values(migrated.state.learning.answers))
      assert.equal(r.firstCorrectAt, r.firstCorrect ? 1 : r.correct ? 2 : null);
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
    assert.equal(game.views.run().result.title, 'Курс пройден: Партионный учёт');
    assert.equal(game.views.run().result.learning.preliminary, false);
    assert.equal(game.views.run().result.learning.grade, 'Отлично');
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
      maze = arenas.forRoom('learningCenter', 'check', currentLayout(game.state).walls);
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

test('the learning bosses: bigger, five times the health, every bug attack and a trick each', async () => {
  for (const [map, unit] of [
    [learningCourse.id, 'batch_accounting'],
    [incidentCourse.id, 'critical_incident'],
  ]) {
    const { game } = await open(789, map);
    try {
      for (let i = 0; i < mazes; i++) {
        clearMaze(game);
        nextRoom(game);
      }
      game.update(1 / 60);
      const boss = game.state.enemies.find((e) => e.boss),
        spec = unitDefinitions[unit];
      assert.equal(boss.unit, unit);
      assert.equal(spec.hp, 9000);
      assert(boss.r > 52 && spec.artScale > 1);
      for (const kit of ['summon', 'pools', 'slow', 'barrage', 'phases'])
        assert(spec[kit], unit + ' has ' + kit);
      Object.assign(game.state.p, { x: boss.x + 120, y: boss.y });
      let bombs = 0,
        shots = 0;
      for (let i = 0; i < 60 * 31; i++) {
        if (game.mode === 'level') game.pickUpgrade(0);
        game.update(1 / 60);
        shots = Math.max(shots, game.state.enemyShots.length);
        bombs += game.state.hazards.filter(
          (h) => h.kind === 'blast' && Math.hypot(h.x - boss.x, h.y - boss.y) > boss.r,
        ).length;
      }
      assert(shots >= spec.barrage.shots.count, 'a ring of shots: ' + shots);
      assert(bombs > 0, 'bombs land around the boss');
      if (spec.ward) {
        boss.hp = boss.max;
        for (const e of game.state.enemies) if (e.summonerId === boss.id) e.hp = 0;
        game.update(1 / 60);
        boss.summonCd = 0;
        game.update(1 / 60);
        const add = game.state.enemies.find((e) => e.summonerId === boss.id && e.hp > 0);
        assert(add && boss.warded, 'its Pepsi ward it');
        game.damage(boss, 1000, 0, 0, game.state.p, 'test');
        const warded = boss.max - boss.hp;
        for (const e of game.state.enemies) if (e.summonerId === boss.id) e.hp = 0;
        game.update(1 / 60);
        assert.equal(boss.warded, false);
        boss.hp = boss.max;
        game.damage(boss, 1000, 0, 0, game.state.p, 'test');
        assert(warded < (boss.max - boss.hp) * 0.5, 'the ward cuts the damage');
      }
      if (spec.escalate) assert.equal(boss.escalation, 1, 'one level after 30 s');
    } finally {
      game.dispose();
    }
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
    assert.equal(migrated.version, 7);
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
    assert.equal(normalizeRunEntry({ runId: 'abc', map: 'learningCenter', time: 60 }), null);
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
