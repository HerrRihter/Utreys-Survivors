const { loadModule, resourcePath } = require('./helpers/load-modules.cjs');
async function main() {
  const projectRoot = require('node:path').resolve(__dirname, '..');
  const fs = require('node:fs'),
    vm = require('node:vm'),
    assert = require('node:assert/strict');
  const source = fs.readFileSync(projectRoot + '/src/systems/persistence.js', 'utf8'),
    storage = new Map();
  async function load() {
    const e = {
      localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    };
    e.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
    vm.createContext(e);
    await loadModule(e, projectRoot + '/src/systems/persistence.js', { fresh: false });
    return e.Progression;
  }
  let p = await load();
  assert.equal(p.data.helmets, 0);
  assert(p.owned('utrace'));
  assert(!p.buyHero('cacofonix'));
  for (let i = 0; i < 9; i++) assert.equal(p.kill(), 0);
  assert.equal(p.kill(), 1);
  assert.equal(p.data.helmets, 1);
  p.earn(39);
  assert(!p.buyHero('cacofonix'));
  assert.equal(p.data.helmets, 40);
  assert(p.buyUpgrade('health'));
  assert.equal(p.data.helmets, 10);
  assert.equal(p.cost('health'), 60);
  assert(!p.buyUpgrade('health'));
  assert(!p.buyHero('__proto__'));
  p = await load();
  assert(p.owned('utrace'));
  assert(!p.owned('cacofonix'));
  assert.equal(p.data.levels.health, 1);
  assert.equal(p.data.helmets, 10);
  assert.equal(p.data.kills, 10);
  p.earn(2000);
  for (let i = 0; i < 4; i++) assert(p.buyUpgrade('health'));
  assert(!p.buyUpgrade('health'));
  assert.equal(p.data.levels.health, 5);
  storage.set(
    'utreys-progression-v1',
    JSON.stringify({
      helmets: -5,
      kills: 'bad',
      unlocked: ['unknown'],
      levels: { health: 500, power: -1 },
    }),
  );
  p = await load();
  assert.equal(p.data.helmets, 0);
  assert.equal(p.data.kills, 0);
  assert.equal(p.data.levels.health, 5);
  assert(!p.owned('unknown'));
  storage.set('utreys-progression-v1', 'broken');
  assert.equal((await load()).data.helmets, 0);
  const e = {
    localStorage: {
      getItem: () => null,
      setItem: () => {
        throw Error('quota');
      },
    },
  };
  e.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
  vm.createContext(e);
  await loadModule(e, projectRoot + '/src/systems/persistence.js', { fresh: false });
  e.Progression.earn(3);
  assert.equal(e.Progression.data.helmets, 3);
  assert.equal(e.Progression.persistent, false);
  console.log(
    'PASS: kill milestones, exact prices, insufficient funds, duplicate purchase protection, save/reload, upgrade caps, corrupt storage and write failure.',
  );

  const timers = new Map(),
    idleJobs = new Map(),
    events = {},
    docEvents = {};
  let next = 0,
    writes = 0,
    snapshot,
    fail = false;
  const batched = {
    localStorage: {
      getItem: () => null,
      setItem: (k, v) => {
        writes++;
        if (fail) throw Error('quota');
        snapshot = JSON.parse(v);
      },
    },
    setTimeout: (fn) => {
      const id = ++next;
      timers.set(id, fn);
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    requestIdleCallback: (fn) => {
      const id = ++next;
      idleJobs.set(id, fn);
      return id;
    },
    cancelIdleCallback: (id) => idleJobs.delete(id),
    addEventListener: (name, fn) => (events[name] = fn),
    document: { hidden: false, addEventListener: (name, fn) => (docEvents[name] = fn) },
  };
  await loadModule(batched, projectRoot + '/src/systems/persistence.js');
  const rewards = batched.Progression;
  for (let i = 0; i < 100; i++) rewards.kill();
  rewards.earn(30);
  assert.equal(writes, 0, 'Mass kills must not write storage in the combat frame');
  assert.equal(timers.size, 1);
  assert.equal(rewards.data.kills, 100);
  assert.equal(rewards.data.helmets, 40);
  const timer = timers.values().next().value;
  timers.clear();
  timer();
  assert.equal(writes, 0);
  assert.equal(idleJobs.size, 1);
  const idleJob = idleJobs.values().next().value;
  idleJobs.clear();
  idleJob();
  assert.equal(writes, 1);
  assert.equal(snapshot.kills, 100);
  assert.equal(snapshot.helmets, 40);
  rewards.kill();
  events.pagehide();
  assert.equal(snapshot.kills, 101);
  assert.equal(timers.size, 0);
  rewards.earn(3);
  batched.document.hidden = true;
  docEvents.visibilitychange();
  assert.equal(snapshot.helmets, 43);
  rewards.earn(100);
  assert(rewards.buyUpgrade('health'));
  assert.equal(snapshot.helmets, 113);
  assert.equal(timers.size, 0);
  rewards.kill();
  timers.values().next().value();
  timers.clear();
  assert.equal(idleJobs.size, 1);
  rewards.flush();
  assert.equal(idleJobs.size, 0);
  rewards.kill();
  fail = true;
  rewards.flush();
  assert.equal(rewards.persistent, false);
  fail = false;
  rewards.flush();
  assert.equal(snapshot.kills, 103);
  assert.equal(rewards.persistent, true);
  const savedWrites = writes;
  rewards.flush();
  assert.equal(writes, savedWrites, 'Clean flush does not write');
  const beforeRank = writes;
  assert(rewards.grantArmorRank());
  assert.equal(writes, beforeRank, 'Active forge does not write storage in a combat frame');
  assert.equal(rewards.armorRank, 1);
  events.pagehide();
  assert.equal(snapshot.levels.armor, 1);
  assert.equal(rewards.helmets, snapshot.helmets);
  console.log(
    'PASS: combat rewards coalesce into idle saves; lifecycle and purchases flush; failed saves can retry.',
  );

  // Every active achievement can be earned and claimed once.
  rewards.earn(10000);
  for (const id of Object.keys(rewards.upgrades)) while (rewards.buyUpgrade(id)) {}

  for (const achievement of rewards.achievements) {
    const before = rewards.data.helmets;
    for (let i = 0; i < 1000; i++) rewards.recordAbility();
    rewards.recordTime(10000);
    rewards.recordLevel(100);
    for (let i = 0; i < 3000; i++) rewards.kill();
    for (let i = 0; i < 100; i++) rewards.recordBossKill();
    assert(achievement.getProgress(rewards.data) >= achievement.target, achievement.id);
    assert(rewards.claimAchievement(achievement.id), achievement.id);
    assert(!rewards.claimAchievement(achievement.id), 'duplicate claim ' + achievement.id);
    assert(rewards.data.helmets >= before + achievement.reward);
  }
  console.log('PASS: active achievement rewards and duplicate prevention.');
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
