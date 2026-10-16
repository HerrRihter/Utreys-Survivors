const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { createRunLog, RUN_LOG_KEY, MAX_ENTRIES } = require('../src/systems/run-log.js');
const { computeStats, report } = require('../tools/run-stats.cjs');

// The run journal records offers, picks and endings; tools/run-stats.cjs turns exports into
// pick rates and win rates.
(async () => {
  const h = await createHarness();
  // The harness storage drops writes; back it with a map for this test.
  const store = new Map();
  h.env.localStorage.getItem = (k) => store.get(k) ?? null;
  h.env.localStorage.setItem = (k, v) => store.set(k, v);
  const game = h.session,
    run = game.views.run();

  game.start();
  const s = game.state;
  s.spawn = 9999;
  s.rerolls = 1;
  s.skips = 1;
  // Level-up 1: reroll, then pick.
  s.xp = s.need;
  game.update(0.01);
  assert.equal(game.mode, 'level');
  run.levelLock = 0;
  game.commands.reroll();
  const shown = run.choice.map((c) => c.id);
  game.pickUpgrade(1);
  // Level-up 2: skip.
  s.xp = s.need;
  game.update(0.01);
  run.levelLock = 0;
  game.commands.skip();
  assert.equal(s.offers.length, 2);
  assert.equal(
    JSON.stringify(s.offers[0].cards),
    JSON.stringify(shown),
    'the offer keeps the cards shown last',
  );
  assert.equal(s.offers[0].rerolls, 1);
  assert.equal(s.offers[0].picked, shown[1]);
  assert.equal(s.offers[1].action, 'skip');

  // Death by a client's hit is the cause.
  s.lastHitBy = 'pepsi';
  s.damageBy = { hero: 120.4, mine: 40 };
  // Far below zero: a regeneration card picked above cannot bring the hero back in one step.
  s.p.hp = -1e6;
  game.update(0.01);
  assert.equal(game.mode, 'end');
  let entries = JSON.parse(store.get(RUN_LOG_KEY));
  assert.equal(entries.length, 1);
  const entry = entries[0];
  assert.equal(entry.hero, 'utrace');
  assert.equal(entry.cause, 'pepsi');
  assert.equal(entry.win, false);
  assert.equal(entry.offers.length, 2);
  assert.equal(JSON.stringify(entry.damage), JSON.stringify({ hero: 120, mine: 40 }));
  assert(entry.seed !== null && entry.build.weapons[0].id === 'hero');

  // A win, then production: two entries, offers are not counted twice.
  game.start();
  game.state.xp = game.state.need;
  game.update(0.01);
  game.pickUpgrade(0);
  game.finish(true);
  game.continueProduction();
  game.state.p.hp = -1e6;
  game.update(0.01);
  entries = JSON.parse(store.get(RUN_LOG_KEY));
  assert.equal(entries.length, 3);
  assert.equal(entries[1].win, true);
  assert.equal(entries[1].offers.length, 1);
  assert.equal(entries[2].endless, true);
  assert.equal(entries[2].offers.length, 0, 'production entry has only its own offers');

  // Quitting is logged as a quit; settings show the count; export is JSON.
  game.start();
  game.menu();
  entries = JSON.parse(store.get(RUN_LOG_KEY));
  assert.equal(entries.at(-1).cause, 'quit');
  assert.equal(game.views.settings().runLogCount, 4);
  const exported = JSON.parse(game.commands.exportRunLog());
  assert.equal(exported.format, 'utreys-run-log');
  assert.equal(exported.runs.length, 4);
  game.commands.clearRunLog();
  assert.equal(game.views.settings().runLogCount, 0);
  h.session.dispose();

  // The journal keeps only the newest entries and survives corrupt storage.
  const map = new Map([[RUN_LOG_KEY, '{oops']]);
  const log = createRunLog({
    storage: { getItem: (k) => map.get(k), setItem: (k, v) => map.set(k, v) },
  });
  assert.equal(log.count(), 0);
  for (let i = 0; i < MAX_ENTRIES + 5; i++) log.record({ hero: 'qa', i });
  assert.equal(log.count(), MAX_ENTRIES);
  assert.equal(log.entries()[0].i, 5);

  // Statistics.
  const offer = (cards, picked) => ({ cards, picked, action: picked ? 'pick' : 'skip' });
  const runs = [];
  for (let i = 0; i < 10; i++)
    runs.push({
      hero: 'utrace',
      load: 1,
      win: i < 6,
      time: 300,
      cause: i < 6 ? null : 'pepsi',
      damage: { hero: 70, mine: 30 },
      offers: [offer(['w_mine', 'might', 'tempo', 'area'], 'w_mine')],
    });
  for (let i = 0; i < 10; i++)
    runs.push({ hero: 'qa', load: 1, win: i < 2, time: 200, cause: 'l3', offers: [] });
  runs.push({ hero: 'qa', load: 1, endless: true, productionTime: 95, offers: [] });
  const stats = computeStats(runs);
  assert.equal(stats.finished, 20);
  assert.equal(stats.wins, 8);
  assert.equal(stats.production.bestTime, 95);
  const mine = stats.cards.find((c) => c.id === 'w_mine');
  assert.deepEqual([mine.offered, mine.picked, mine.rate, mine.flag], [10, 10, 100, 'high']);
  assert.equal(stats.cards.find((c) => c.id === 'might').flag, 'low');
  const utrace = stats.heroes.find((r) => r.hero === 'utrace');
  assert.equal(utrace.winRate, 60);
  assert.equal(stats.spread[0].ratio, 3);
  assert(stats.spread[0].flag, 'win rates more than 1.5× apart are flagged');
  assert.equal(stats.causes[0].cause, 'l3');
  assert.equal(stats.damage[0].tag, 'hero');
  assert.match(report(stats, 10), /w_mine.*100%.*⚠/);

  console.log('PASS: run journal, export, production entries and run statistics');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
