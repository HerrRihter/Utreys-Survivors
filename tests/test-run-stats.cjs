const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { createStore } = require('../src/app/store.js');
const { createProgression } = require('../src/systems/persistence.js');
const {
  applyRun,
  emptyScope,
  normalizeRunEntry,
  normalizeRunStats,
  victoryScore,
  victoryFromScore,
  MIN_COUNTED_RUN,
} = require('../src/systems/run-records.js');
const { createRunStats, STATS_QUEUE_KEY } = require('../src/services/run-stats.js');

const entry = (more = {}) => ({
  runId: 'r1',
  map: 'empty',
  hero: 'utrace',
  load: 2,
  newGame: true,
  addKills: 50,
  addCodes: 30,
  time: 120,
  kills: 50,
  codes: 30,
  victory: false,
  production: 0,
  ...more,
});

// Entries: short runs and endings with nothing new do not count; values are clamped.
assert.equal(normalizeRunEntry(entry({ time: MIN_COUNTED_RUN - 1 })), null);
assert.equal(normalizeRunEntry(entry({ map: 'moon' })), null);
assert.equal(normalizeRunEntry(entry({ runId: 'Bad Id' })), null);
assert.equal(
  normalizeRunEntry(entry({ newGame: false, addKills: 0, addCodes: 0 })),
  null,
  'a second ending with nothing new',
);
assert.equal(normalizeRunEntry(entry({ kills: -5 })).kills, 0);
assert.equal(normalizeRunEntry(entry({ time: 1e9 })).time, 21600);
assert.equal(normalizeRunEntry(entry({ hero: '<script>' })).hero, '');

// Applying runs: one game, growing totals, records with who set them.
let { scope, improved } = applyRun(emptyScope(), normalizeRunEntry(entry()));
assert.equal(scope.games, 1);
assert.equal(scope.totalKills, 50);
assert.equal(scope.bestTime, 120);
assert.equal(scope.bestTimeHero, 'utrace');
assert.equal(scope.bestTimeLoad, 2);
assert.deepEqual(improved, ['bestTime', 'bestKills', 'bestCodes']);
({ scope, improved } = applyRun(
  scope,
  normalizeRunEntry(entry({ runId: 'r2', hero: 'qa', time: 60, kills: 80, addKills: 80 })),
));
assert.equal(scope.games, 2);
assert.equal(scope.totalKills, 130);
assert.equal(scope.bestTime, 120, 'a shorter run keeps the record');
assert.equal(scope.bestTimeHero, 'utrace');
assert.equal(scope.bestKillsHero, 'qa');
assert.deepEqual(improved, ['bestKills']);

// Victory: higher load first, then faster.
assert.ok(victoryScore(3, 900) > victoryScore(2, 300));
assert.ok(victoryScore(2, 300) > victoryScore(2, 400));
assert.deepEqual(victoryFromScore(victoryScore(4, 512.3)), { load: 4, time: 512.3 });

// Saved statistics keep known maps only.
const stats = normalizeRunStats({ all: { games: 3 }, maps: { empty: { games: 3 }, moon: {} } });
assert.equal(stats.all.games, 3);
assert.deepEqual(Object.keys(stats.maps), ['empty']);

(async () => {
  // The game counts each ending: the run's map, a new game only once, production separately.
  const h = await createHarness();
  const store = new Map();
  h.env.localStorage.getItem = (k) => store.get(k) ?? null;
  h.env.localStorage.setItem = (k, v) => store.set(k, v);
  const game = h.session,
    progression = h.env.Progression;
  const runStats = () => progression.data.runStats;
  const heard = [];
  progression.onChange((reason, payload) => reason === 'run' && heard.push(payload));

  game.start();
  let s = game.state;
  const map = s.map;
  assert.match(s.runId, /^[a-z0-9-]+$/);
  s.spawn = 9999;
  s.t = 120;
  s.kills = 40;
  s.earned = 25;
  game.finish(false);
  assert.equal(runStats().all.games, 1);
  assert.equal(runStats().maps[map].games, 1);
  assert.equal(runStats().all.totalKills, 40);
  assert.equal(runStats().all.bestTime, 120);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].newGame, true);
  // Back to the menu from the results adds nothing.
  game.menu();
  assert.equal(runStats().all.games, 1);
  assert.equal(heard.length, 1);

  // Quitting a short run does not count.
  game.start();
  game.state.spawn = 9999;
  game.state.t = 5;
  game.menu();
  assert.equal(runStats().all.games, 1);

  // Quitting a real run counts it.
  game.start();
  s = game.state;
  s.spawn = 9999;
  s.t = 200;
  s.kills = 70;
  game.menu();
  assert.equal(runStats().all.games, 2);
  assert.equal(runStats().all.bestKills, 70);

  // A win, then production on the same run: one game, the victory and production records.
  game.start();
  s = game.state;
  s.spawn = 9999;
  s.t = 300;
  s.kills = 100;
  s.earned = 10;
  game.finish(true);
  assert.equal(runStats().all.games, 3);
  assert.ok(runStats().all.victoryScore > 0);
  assert.ok(s.recordsImproved.all.includes('victoryScore'));
  assert.ok(game.continueProduction());
  s.t = 420;
  s.kills = 130;
  game.finish(false);
  assert.equal(runStats().all.games, 3, 'production continues the same run');
  assert.equal(runStats().all.productionTime, 120);
  assert.equal(runStats().all.totalKills, 40 + 70 + 130);
  assert.equal(heard.at(-1).newGame, false);
  assert.equal(heard.at(-1).addKills, 30);

  // The statistics survive a reload of the save.
  progression.flush();
  const reloaded = h.env.createProgression({ storage: h.env.localStorage, events: null });
  assert.equal(reloaded.data.runStats.all.games, 3);

  // ---- sending to stats/{uid} ----
  const docs = new Map();
  let refuse = false,
    online = true;
  const snapshot = (path) => {
    const data = docs.has(path) ? structuredClone(docs.get(path)) : undefined;
    return { exists: () => data !== undefined, data: () => data };
  };
  const sdk = {
    db: {},
    firestore: {
      doc: (_db, ...path) => path.join('/'),
      getDoc: async (path) => snapshot(path),
      serverTimestamp: () => 'now',
      async runTransaction(_db, body) {
        const writes = new Map();
        const result = await body({
          get: async (path) => snapshot(path),
          set: (path, data) => writes.set(path, data),
        });
        if (refuse) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
        for (const [path, data] of writes) docs.set(path, structuredClone(data));
        return result;
      },
    },
  };
  docs.set('users/u1', { login: 'Вася', loginKey: 'вася' });
  const accountStore = createStore();
  let accountState = { status: 'guest', uid: '' };
  const account = {
    subscribe: accountStore.subscribe,
    getVersion: accountStore.getVersion,
    get state() {
      return accountState;
    },
    firebase: async () => {
      if (!online) throw new Error('offline');
      return sdk;
    },
  };
  const signIn = (uid) => {
    accountState = { status: 'signedIn', uid };
    accountStore.emit();
  };
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const local = createProgression({ storage, events: null, document: null });
  const timers = {
    pending: [],
    setTimeout(fn) {
      this.pending.push(fn);
      return this.pending.length;
    },
    clearTimeout() {},
  };
  const sender = createRunStats({ account, progression: local, storage, timers });
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
  };

  // Signed out: runs stay local; only the latest one waits for a sign-in.
  local.recordRunResult(entry({ runId: 'old-guest', map: 'serverRoom' }));
  local.recordRunResult(entry({ runId: 'guest', time: 30 }));
  await settle();
  assert.equal(docs.has('stats/u1'), false);
  assert.equal(sender.queued, 0);
  assert.equal(sender.state.guestRun, 'guest');

  // Signing in sends that run, then later ones as they end.
  signIn('u1');
  await settle();
  assert.equal(docs.get('stats/u1').all.games, 1, 'only the latest guest run');
  assert.deepEqual(docs.get('stats/u1').lastRun, { map: 'empty', runId: 'guest' });
  assert.equal(sender.state.guestRun, '');
  docs.delete('stats/u1');
  local.recordRunResult(entry());
  await settle();
  const doc = docs.get('stats/u1');
  assert.equal(doc.login, 'Вася', 'the login comes from the profile');
  assert.equal(doc.all.games, 1);
  assert.equal(doc.maps.empty.games, 1);
  assert.deepEqual(doc.lastRun, { map: 'empty', runId: 'r1' });
  assert.equal(sender.queued, 0);
  assert.ok(sender.state.last.improved.map.includes('bestTime'));
  assert.equal(sender.state.last.all.bestTime, 120);
  assert.equal(sender.state.last.map, 'empty');

  // A second map adds its own scope and grows the overall one.
  local.recordRunResult(entry({ runId: 'r2', map: 'serverRoom', kills: 9, addKills: 9 }));
  await settle();
  assert.equal(docs.get('stats/u1').all.games, 2);
  assert.equal(docs.get('stats/u1').all.totalKills, 59);
  assert.equal(docs.get('stats/u1').maps.serverRoom.games, 1);
  assert.equal(docs.get('stats/u1').maps.empty.games, 1);

  // The same run sent twice (the answer was lost) counts once.
  memory.set(
    STATS_QUEUE_KEY,
    JSON.stringify([
      { uid: 'u1', entry: normalizeRunEntry(entry({ runId: 'r2', map: 'serverRoom' })) },
    ]),
  );
  await sender.send();
  assert.equal(docs.get('stats/u1').all.games, 2);
  assert.equal(sender.queued, 0);

  // Offline: the run waits in the queue and goes up on retry.
  online = false;
  local.recordRunResult(entry({ runId: 'r3' }));
  await settle();
  assert.equal(sender.state.status, 'offline');
  assert.equal(sender.queued, 1);
  online = true;
  timers.pending.shift()();
  await settle();
  assert.equal(sender.queued, 0);
  assert.equal(docs.get('stats/u1').all.games, 3);

  // Refused by the rules: dropped, so the queue never jams.
  refuse = true;
  local.recordRunResult(entry({ runId: 'r4' }));
  const warn = console.warn;
  console.warn = () => {};
  await settle();
  console.warn = warn;
  refuse = false;
  assert.equal(sender.queued, 0);
  assert.equal(docs.get('stats/u1').all.games, 3);

  assert.equal((await sender.remote()).all.games, 3);
  sender.dispose();
  console.log('Run statistics checks passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
