const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { achievementDefinitions } = require('../data/achievements.js');

// Stage 4: achievements open weapons, mastery stats feed new achievements, the shop gains
// greed, luck and head start, level-up controls wait for the first win, and a respec refunds.
(async () => {
  const { createProgression } = await import('../src/systems/persistence.js');
  const make = (saved) => {
    const storage = new Map(saved ? [['utreys-progression-v1', JSON.stringify(saved)]] : []);
    return createProgression({
      storage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) },
      events: null,
      document: null,
    });
  };

  assert(achievementDefinitions.length >= 20 && achievementDefinitions.length <= 30);
  const gated = achievementDefinitions
    .filter((a) => a.unlocks?.weapon)
    .map((a) => a.unlocks.weapon);
  assert.deepEqual(gated.sort(), ['cache', 'log', 'printer', 'retry']);

  // Fresh save: four starting weapons, controls locked until a win.
  const p = make();
  for (const id of ['orbit', 'homing', 'mine', 'ping']) assert(p.weaponUnlocked(id), id);
  for (const id of gated) assert(!p.weaponUnlocked(id), id);
  p.earn(1000);
  assert.equal(p.upgradeLock('rerolls'), 'win');
  assert(!p.buyUpgrade('rerolls'), 'controls need a win');
  for (let i = 0; i < 500; i++) p.kill('hero');
  assert(p.weaponUnlocked('printer'), 'done achievement opens content without claiming');
  for (let i = 0; i < 500; i++) p.kill('mine');
  assert(p.weaponUnlocked('log'), 'kills with one weapon open the log stream');
  assert.equal(p.data.weaponKills.mine, 500);

  // Mastery stats.
  p.recordRunStats({ win: true, hero: 'qa', time: 400, untouched: true, cleanSweep: true });
  p.recordRunStats({ win: true, hero: 'qa', time: 700, noFood: true, evolutions: 2 });
  const st = p.data.stats;
  assert.equal(st.wins, 2);
  assert.equal(st.heroWins.qa, 2);
  assert.equal(st.bestWinTime, 400);
  assert.equal(st.untouchedRuns, 1);
  assert.equal(st.cleanSweeps, 1);
  assert.equal(st.noFoodWins, 1);
  assert.equal(st.maxEvolutions, 2);
  assert(p.buyUpgrade('rerolls'), 'controls open after a win');

  // Respec refunds every code spent on permanent upgrades.
  const before = p.codes;
  assert(p.buyUpgrade('health') && p.buyUpgrade('health') && p.buyUpgrade('training_utrace'));
  assert.equal(before - p.codes, 30 + 60 + 50);
  assert.equal(p.upgradeSpent(), 30 + 60 + 50 + 30);
  assert.equal(p.respec(), 170);
  assert.equal(p.codes, before + 30);
  assert(Object.values(p.data.levels).every((n) => n === 0));
  assert.equal(p.respec(), 0, 'nothing left to refund');

  // Old saves: earlier boss kills count as wins and open what they earned.
  const old = make({ codes: 5, kills: 600, stats: { bossKills: 1, maxTime: 320 } });
  assert.equal(old.data.stats.wins, 1);
  for (const id of ['printer', 'retry', 'cache']) assert(old.weaponUnlocked(id), id);
  assert(!old.weaponUnlocked('log'));
  assert.equal(old.upgradeLock('skips'), '');
  const corrupt = make({ weaponKills: { mine: -4, 'bad key': 9, orbit: 3 }, stats: { wins: 'x' } });
  assert.deepEqual(corrupt.data.weaponKills, { orbit: 3 });
  assert.equal(corrupt.data.stats.wins, 0);

  // In a run: kill tags, head start, greed, luck and the result screen lists.
  const h = await createHarness();
  const game = h.session,
    P = h.env.Progression;
  P.earn(1000);
  assert(P.buyUpgrade('headStart') && P.buyUpgrade('greed') && P.buyUpgrade('greed'));
  assert(P.buyUpgrade('luck'));
  game.start();
  const s = game.state;
  s.spawn = 9999;
  assert.equal(s.xp, s.need, 'head start fills the first level');
  assert.equal(s.stats.luck, 0.01);
  game.update(0.01);
  assert.equal(game.mode, 'level', 'the run opens with a level-up');
  game.pickUpgrade(0);
  const target = game.spawn('l3', false, { x: s.p.x + 300, y: s.p.y });
  game.damage(target, 1e9, 0, 0, s.p, 'mine');
  assert.equal(P.data.weaponKills.mine, 1);
  for (let i = 0; i < 9; i++) P.kill();
  assert(game.views.menu().goals.length === 3);
  s.t = 200;
  s.earned = 100;
  const codes = P.codes;
  game.finish(false);
  const result = game.views.run().result;
  assert.equal(P.codes - codes, 10, 'two greed ranks pay 10% of the run');
  assert(
    result.unlocked.some((a) => a.id === 'kills_10'),
    'new achievements are listed',
  );
  assert.equal(result.goals.length, 2);
  assert(result.goals[0].unlock, 'content unlocks come first');
  assert.equal(P.data.stats.untouchedRuns, 1, 'three minutes without damage');
  assert.equal(P.data.stats.wins, 0, 'a loss is not a win');
  h.session.dispose();

  console.log('PASS: unlocks, mastery stats, control gating, respec, greed, luck and head start');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
