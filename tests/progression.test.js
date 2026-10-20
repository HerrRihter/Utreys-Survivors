import assert from 'node:assert/strict';
import { test, vi } from 'vitest';

test('progression', async () => {
  async function main() {
    const storage = new Map();
    async function load() {
      const e = {
        localStorage: { getItem: (k) => storage.get(k), setItem: (k, v) => storage.set(k, v) },
      };
      e.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
      Object.assign(e, await import('../src/systems/progression/index.js'));
      e.Progression = e.createProgression({ storage: e.localStorage });
      return e.Progression;
    }
    let p = await load();
    assert.equal(p.data.codes, 0);
    assert(p.shop.owned('utrace'));
    assert(!p.shop.buyHero('cacofonix'));
    // Every tenth kill of a run pays a code, however many the account has.
    for (let i = 1; i <= 9; i++) assert.equal(p.wallet.kill('hero', i), 0);
    assert.equal(p.wallet.kill('hero', 10), 1);
    assert.equal(p.data.codes, 1);
    assert.equal(p.wallet.kill('hero', 1), 0, 'a new run counts from its first kill');
    assert.equal(p.wallet.kill(), 0, 'no run, no reward');
    assert.equal(p.data.kills, 12);
    p.replace({ ...p.data, kills: 10 });
    p.wallet.earn(39);
    assert(!p.shop.buyHero('cacofonix'));
    assert.equal(p.data.codes, 40);
    assert(p.shop.buyUpgrade('health'));
    assert.equal(p.data.codes, 10);
    assert.equal(p.shop.cost('health'), 60);
    assert(!p.shop.buyUpgrade('health'));
    assert(!p.shop.buyHero('__proto__'));
    p = await load();
    assert(p.shop.owned('utrace'));
    assert(!p.shop.owned('cacofonix'));
    assert.equal(p.data.levels.health, 1);
    assert.equal(p.data.codes, 10);
    assert.equal(p.data.kills, 10);
    p.wallet.earn(2000);
    for (let i = 0; i < 4; i++) assert(p.shop.buyUpgrade('health'));
    assert(!p.shop.buyUpgrade('health'));
    assert.equal(p.data.levels.health, 5);
    storage.set(
      'utreys-progression-v1',
      JSON.stringify({
        codes: -5,
        kills: 'bad',
        unlocked: ['unknown'],
        levels: { health: 500, power: -1 },
      }),
    );
    p = await load();
    assert.equal(p.data.codes, 0);
    assert.equal(p.data.kills, 0);
    assert.equal(p.data.levels.health, 5);
    assert(!p.shop.owned('unknown'));
    storage.set('utreys-progression-v1', 'broken');
    assert.equal((await load()).data.codes, 0);
    const e = {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw Error('quota');
        },
      },
    };
    e.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
    Object.assign(e, await import('../src/systems/progression/index.js'));
    e.Progression = e.createProgression({ storage: e.localStorage });
    e.Progression.wallet.earn(3);
    e.Progression.flush();
    assert.equal(e.Progression.data.codes, 3);
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
    Object.assign(batched, await import('../src/systems/progression/index.js'));
    // The store defers saves with the global timers; these hold the jobs until the test runs them.
    for (const name of ['setTimeout', 'clearTimeout', 'requestIdleCallback', 'cancelIdleCallback'])
      vi.stubGlobal(name, batched[name]);
    batched.Progression = batched.createProgression({
      storage: batched.localStorage,
      events: batched,
      document: batched.document,
    });
    const rewards = batched.Progression;
    for (let i = 1; i <= 100; i++) rewards.wallet.kill('hero', i);
    rewards.wallet.earn(30);
    assert.equal(writes, 0, 'Mass kills must not write storage in the combat frame');
    assert.equal(timers.size, 1);
    assert.equal(rewards.data.kills, 100);
    assert.equal(rewards.data.codes, 40);
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
    assert.equal(snapshot.codes, 40);
    rewards.wallet.kill();
    events.pagehide();
    assert.equal(snapshot.kills, 101);
    assert.equal(timers.size, 0);
    rewards.wallet.earn(3);
    batched.document.hidden = true;
    docEvents.visibilitychange();
    assert.equal(snapshot.codes, 43);
    rewards.wallet.earn(100);
    assert(rewards.shop.buyUpgrade('health'));
    assert.equal(snapshot.codes, 113);
    assert.equal(timers.size, 0);
    rewards.wallet.kill();
    timers.values().next().value();
    timers.clear();
    assert.equal(idleJobs.size, 1);
    rewards.flush();
    assert.equal(idleJobs.size, 0);
    rewards.wallet.kill();
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
    const beforeStats = writes;
    rewards.records.recordBossKill();
    assert.equal(writes, beforeStats, 'Combat stats do not write storage in a combat frame');
    events.pagehide();
    assert(writes > beforeStats, 'Deferred stats are saved on pagehide');
    assert.equal(rewards.wallet.codes, snapshot.codes);
    console.log(
      'PASS: combat rewards coalesce into idle saves; lifecycle and purchases flush; failed saves can retry.',
    );
    vi.unstubAllGlobals();

    // Every active achievement can be earned and claimed once.
    const platinum = rewards.achievements.list.find((achievement) => achievement.id === 'platinum');
    const others = rewards.achievements.list.filter((achievement) => achievement.id !== 'platinum');
    assert.equal(platinum.target, others.length, 'Platinum excludes itself from the target');
    assert.equal(platinum.getProgress({}), 0, 'Empty saves have no platinum progress');
    assert(!rewards.achievements.claimAchievement('platinum'), 'Cannot claim platinum early');
    const earnedIds = others.map((achievement) => achievement.id);
    assert.equal(
      platinum.getProgress({ claimedAchievements: [...earnedIds.slice(1), 'platinum', 'unknown'] }),
      others.length - 1,
      'Platinum and unknown IDs cannot replace a missing achievement',
    );
    assert.equal(
      platinum.getProgress({ claimedAchievements: earnedIds, codes: 0 }),
      others.length,
      'Claimed achievements still count after spending codes',
    );
    rewards.wallet.earn(10000);
    for (const id of Object.keys(rewards.shop.upgrades)) while (rewards.shop.buyUpgrade(id));

    for (const achievement of rewards.achievements.list) {
      const before = rewards.data.codes;
      for (let i = 0; i < 1000; i++) rewards.records.recordAbility();
      rewards.records.recordTime(10000);
      rewards.records.recordLevel(100);
      for (let i = 0; i < 3000; i++) rewards.wallet.kill();
      for (let i = 0; i < 100; i++) rewards.records.recordBossKill();
      for (let i = 0; i < 600; i++) rewards.wallet.kill('orbit');
      for (let level = 1; level <= 10; level++) rewards.loads.recordLoadWin('utrace', level);
      rewards.loads.recordProduction('utrace', 10, 400, 50);
      for (const hero of ['utrace', 'traceability', 'serialization', 'ba', 'qa'])
        rewards.records.recordRunStats({
          win: true,
          hero,
          time: 300,
          cleanSweep: true,
          noFood: true,
        });
      rewards.records.recordRunStats({
        win: true,
        hero: 'qa',
        untouched: true,
        allWorkaround: true,
      });
      rewards.records.recordRunStats({ win: false, hero: 'qa', evolutions: 3 });
      assert(achievement.getProgress(rewards.data) >= achievement.target, achievement.id);
      assert(rewards.achievements.claimAchievement(achievement.id), achievement.id);
      assert(
        !rewards.achievements.claimAchievement(achievement.id),
        'duplicate claim ' + achievement.id,
      );
      assert(rewards.data.codes >= before + achievement.reward);
    }
    console.log('PASS: active achievement rewards and duplicate prevention.');

    // `data` is one read-only copy until the save changes: reads do not clone, and other code
    // cannot change the progression through it.
    // The save lives in the module realm: compare error names, not constructors.
    const isTypeError = (error) => error.name === 'TypeError';
    const view = rewards.data;
    assert.equal(rewards.data, view, 'Reads between changes share one copy');
    assert(Object.isFrozen(view) && Object.isFrozen(view.stats) && Object.isFrozen(view.levels));
    assert(Object.isFrozen(view.unlocked) && Object.isFrozen(view.runStats));
    const codes = view.codes;
    assert.throws(() => {
      'use strict';
      view.codes = 1e9;
    }, isTypeError);
    assert.throws(() => view.unlocked.push('qa'), isTypeError);
    assert.throws(() => {
      'use strict';
      view.levels.health = 0;
    }, isTypeError);
    assert.equal(rewards.wallet.codes, codes, 'A write through data does not reach the save');
    rewards.wallet.earn(1);
    assert.notEqual(rewards.data, view, 'A change makes a new copy');
    assert.equal(rewards.data.codes, codes + 1);
    assert.equal(view.codes, codes, 'An old copy keeps what it showed');
    console.log('PASS: progression data is a shared read-only copy rebuilt after changes.');
  }
  await main();
});
