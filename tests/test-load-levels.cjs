const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const {
  loadModifiers,
  loadLevels,
  maxLoad,
  production,
  rewardPerLevel,
} = require('../data/difficulty.js');
const { unitDefinitions } = require('../data/enemies/units.js');
const { snapshotRun } = require('../src/systems/run-snapshot.js');

// Stage 3: load levels open one by one per hero, modifiers stack, wins pay more, and the
// production mode continues a won run with growing pressure and its own records.
(async () => {
  assert.equal(loadLevels.length, maxLoad);
  const base = loadModifiers(1);
  assert(
    Object.values(base).every((v) => v === 0),
    'level 1 changes nothing',
  );
  const third = loadModifiers(3);
  assert.equal(third.hp, 0.2);
  assert.equal(third.speed, 0.1);
  assert(loadModifiers(10).hp > loadModifiers(9).hp - 1e-9, 'levels only add');
  assert.equal(loadModifiers(1, 2).hp, production.perMinute.hp * 2, 'production adds per minute');

  const h = await createHarness();
  const game = h.session,
    P = h.env.Progression;
  game.select('utrace');
  game.commands.chooseLoad(5);
  game.start();
  assert.equal(game.state.load, 1, 'locked levels fall back to the highest open one');
  const view = game.views.heroSelect();
  assert.equal(view.loads.filter((l) => !l.locked).length, 1);

  // A win opens the next level, for this hero only.
  game.finish(true);
  assert.equal(P.loadCleared('utrace'), 1);
  assert.equal(P.loadAvailable('utrace'), 2);
  assert.equal(P.loadAvailable('qa'), 1, 'levels are tracked per hero');
  assert.match(game.views.run().result.text, /Открыта нагрузка 2/);
  assert(game.views.run().result.canContinue);

  // Level 2: enemies are tougher, codes pay more.
  game.commands.chooseLoad(2);
  game.start();
  const s = game.state;
  assert.equal(s.load, 2);
  s.spawn = 9999;
  const enemy = game.spawn('l3', false, { x: s.p.x + 300, y: s.p.y });
  assert.equal(enemy.max, Math.round(unitDefinitions.l3.hp * 1.2));
  s.earned = 100;
  const codes = P.codes;
  game.finish(true);
  const bonus = Math.floor(100 * rewardPerLevel);
  assert.equal(P.codes - codes, bonus, 'load bonus is paid in codes');
  assert.equal(s.earned, 100 + bonus);
  assert.match(game.views.run().result.tag, /НАГРУЗКА 2/);

  // Production: the same run goes on.
  assert(game.continueProduction());
  assert.equal(game.mode, 'play');
  assert(s.endless && !s.bossDead && !s.resultRecorded);
  assert(!game.continueProduction(), 'only from the result screen');
  s.t += 120;
  assert.match(game.views.hud().weapon, /Продакшен 2 мин/);
  const later = game.spawn('l3', false, { x: s.p.x + 300, y: s.p.y });
  assert(later.max > enemy.max, 'production minutes make enemies tougher');

  // A production CRPT pays codes and does not end the run.
  s.t = s.productionBossNext;
  game.update(0.01);
  assert.equal(s.productionBosses, 1);
  const boss = s.enemies.find((e) => e.boss);
  assert(boss, 'production boss arrives');
  const before = s.earned;
  game.damage(boss, 1e9);
  game.update(0.01);
  assert.equal(game.mode, 'play', 'killing a production boss does not end the run');
  assert(s.earned >= before + production.bossReward);

  // A snapshot keeps the production state.
  const saved = snapshotRun(game.views.run());
  assert.equal(saved.state.load, 2);
  assert.equal(saved.state.endless, true);
  assert.equal(saved.state.endlessStart, s.endlessStart);

  // Death ends production with a per-hero, per-level record.
  s.kills += 7;
  s.p.hp = -1e6;
  game.update(0.01);
  assert.equal(game.mode, 'end');
  const result = game.views.run().result;
  assert.equal(result.title, 'Продакшен упал');
  assert(!result.canContinue);
  const record = P.productionRecord('utrace', 2);
  assert(record && record.time > 120 && record.kills >= 7);
  assert.equal(P.productionRecord('utrace', 1), null);
  assert.match(game.views.heroSelect().loadProgress, /Рекорд продакшена/);
  h.session.dispose();

  // Progress survives a reload and bad saves are ignored.
  const storage = new Map([
    [
      'utreys-progression-v1',
      JSON.stringify({
        loads: { utrace: 3, qa: 99, ba: -1 },
        production: { utrace: { 2: { time: 61, kills: 4 }, 0: { time: 5 } } },
      }),
    ],
  ]);
  const { createProgression } = await import('../src/systems/persistence.js');
  const reload = createProgression({
    storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
    events: null,
    document: null,
  });
  assert.equal(reload.loadCleared('utrace'), 3);
  assert.equal(reload.loadCleared('qa'), maxLoad, 'clamped to the top level');
  assert.equal(reload.loadCleared('ba'), 0);
  assert.deepEqual(reload.productionRecord('utrace', 2), { time: 61, kills: 4 });
  assert.equal(reload.productionRecord('utrace', 0), null);
  assert.equal(reload.loadAvailable('utrace'), 4);

  console.log('PASS: load levels, per-hero unlocks, rewards, production mode and records');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
