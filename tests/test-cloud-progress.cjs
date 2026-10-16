const assert = require('node:assert/strict');
const { createStore } = require('../src/app/store.js');
const { createProgression, normalizeProgression } = require('../src/systems/persistence.js');
const {
  createCloudProgress,
  stableKey,
  CLOUD_META_KEY,
} = require('../src/services/cloud-progress.js');

// The save is normalized the same way from localStorage and from the cloud.
const fresh = normalizeProgression(null);
assert.equal(fresh.codes, 0);
assert.deepEqual(fresh.unlocked, ['utrace']);
const cleaned = normalizeProgression({ codes: -5, unlocked: ['nobody'], helmets: 7 });
assert.equal(cleaned.codes, 0, 'negative codes are dropped');
assert.deepEqual(cleaned.unlocked, ['utrace'], 'unknown heroes are dropped');
assert.equal(normalizeProgression({ helmets: 7 }).codes, 7, 'old currency key migrates');
assert.equal(
  stableKey({ b: 1, a: [1, { d: 2, c: 3 }] }),
  stableKey({ a: [1, { c: 3, d: 2 }], b: 1 }),
);

// One Firestore shared by every device: documents by path, transactions all or nothing.
function fakeCloud() {
  const docs = new Map();
  let writes = 0,
    beforeTransaction = null;
  const snapshot = (path) => {
    const data = docs.has(path) ? structuredClone(docs.get(path)) : undefined;
    return { exists: () => data !== undefined, data: () => data };
  };
  const firestore = {
    doc: (_db, ...path) => path.join('/'),
    getDoc: async (path) => snapshot(path),
    serverTimestamp: () => 'now',
    async runTransaction(_db, body) {
      beforeTransaction?.();
      beforeTransaction = null;
      const pending = new Map();
      await body({
        get: async (path) => snapshot(path),
        set: (path, data) => pending.set(path, data),
      });
      for (const [path, data] of pending) {
        docs.set(path, structuredClone(data));
        writes++;
      }
    },
  };
  return {
    docs,
    sdk: { db: {}, firestore },
    get writes() {
      return writes;
    },
    // Runs once, between a device reading the cloud and writing to it.
    interleave(fn) {
      beforeTransaction = fn;
    },
  };
}

function fakeAccount(cloud) {
  const store = createStore();
  let state = { status: 'guest', uid: '', login: '' },
    online = true;
  return {
    subscribe: store.subscribe,
    getVersion: store.getVersion,
    get state() {
      return state;
    },
    firebase: async () => {
      if (!online) throw new Error('Нет связи с сервером');
      return cloud.sdk;
    },
    signIn(uid) {
      state = { status: 'signedIn', uid, login: uid };
      store.emit();
    },
    signOut() {
      state = { status: 'guest', uid: '', login: '' };
      store.emit();
    },
    set online(value) {
      online = value;
    },
  };
}

function fakeTimers() {
  let next = 1;
  const pending = new Map();
  return {
    setTimeout(fn, ms) {
      pending.set(next, { fn, ms });
      return next++;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    get pending() {
      return [...pending.values()];
    },
    runAll() {
      const due = [...pending.values()];
      pending.clear();
      for (const { fn } of due) fn();
    },
  };
}

function device(cloud) {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  const progression = createProgression({ storage, events: null, document: null });
  const account = fakeAccount(cloud);
  const timers = fakeTimers();
  let replaced = 0;
  const sync = createCloudProgress({
    account,
    progression,
    storage,
    timers,
    onReplace: () => replaced++,
  });
  return {
    map,
    progression,
    account,
    timers,
    sync,
    get replaced() {
      return replaced;
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};
const win = (p) => p.recordRunStats({ win: true, hero: 'utrace', time: 400 });
const remote = (cloud, uid = 'u1') => cloud.docs.get('progress/' + uid);

(async () => {
  const cloud = fakeCloud();

  // Signed out: nothing leaves the device.
  const a = device(cloud);
  a.progression.earn(120);
  win(a.progression);
  await settle();
  assert.equal(a.sync.state.status, 'off');
  assert.equal(cloud.writes, 0);
  assert.equal(a.timers.pending.length, 0);

  // First sign-in with an empty cloud uploads this device's save as revision 1.
  a.account.signIn('u1');
  await settle();
  assert.equal(a.sync.state.status, 'synced');
  assert.equal(remote(cloud).rev, 1);
  assert.equal(remote(cloud).schema, 1);
  assert.equal(remote(cloud).data.codes, 120);
  assert.equal(remote(cloud).data.stats.wins, 1);
  assert.equal(typeof remote(cloud).device, 'string');

  // A new device with nothing saved takes the cloud save without asking.
  const b = device(cloud);
  b.account.signIn('u1');
  await settle();
  assert.equal(b.sync.state.status, 'synced');
  assert.equal(b.progression.codes, 120);
  assert.equal(b.replaced, 1, 'menus are told to re-render');
  assert.equal(JSON.parse(b.map.get('utreys-progression-v1')).codes, 120, 'kept locally too');

  // A run result on B goes up after the delay, as revision 2.
  b.progression.earn(30);
  win(b.progression);
  assert.equal(b.timers.pending.length, 1);
  assert.equal(b.timers.pending[0].ms, 5000);
  b.timers.runAll();
  await settle();
  assert.equal(remote(cloud).rev, 2);
  assert.equal(remote(cloud).data.codes, 150);

  // Combat income alone does not sync.
  b.progression.earn(5);
  assert.equal(b.timers.pending.length, 0);

  // A has not changed since revision 1, so it simply takes revision 2.
  await a.sync.sync();
  await settle();
  assert.equal(a.progression.codes, 150);
  assert.equal(a.progression.data.stats.wins, 2);
  assert.equal(a.replaced, 1);

  // Both changed: A must choose. Keeping A's save writes it over B's.
  a.progression.earn(1000);
  win(a.progression);
  b.progression.earn(7);
  win(b.progression);
  b.timers.runAll();
  await settle();
  assert.equal(remote(cloud).rev, 3);
  a.timers.runAll();
  await settle();
  assert.equal(a.sync.state.status, 'conflict');
  const { conflict } = a.sync.state;
  assert.equal(conflict.local.codes, 1150);
  assert.equal(conflict.cloud.codes, 162);
  assert.equal(conflict.local.wins, 3);
  assert.equal(conflict.cloud.wins, 3);
  const writesBefore = cloud.writes;
  win(a.progression);
  a.timers.runAll();
  await settle();
  assert.equal(cloud.writes, writesBefore, 'nothing is written while the player decides');
  await a.sync.resolve('local');
  await settle();
  assert.equal(a.sync.state.status, 'synced');
  assert.equal(remote(cloud).rev, 4);
  assert.equal(remote(cloud).data.codes, 1150);
  // B had nothing new since its own write, so it follows.
  await b.sync.sync();
  await settle();
  assert.equal(b.progression.codes, 1150);

  // The other answer: the cloud save replaces this device's one.
  a.progression.earn(1);
  win(a.progression);
  b.progression.earn(2);
  win(b.progression);
  b.timers.runAll();
  await settle();
  await a.sync.sync();
  await settle();
  assert.equal(a.sync.state.status, 'conflict');
  await a.sync.resolve('cloud');
  await settle();
  assert.equal(a.progression.codes, 1152);
  assert.equal(stableKey(a.progression.data), stableKey(remote(cloud).data));

  // A device that has its own progress but never synced with this account asks first.
  const c = device(cloud);
  c.progression.earn(9);
  win(c.progression);
  c.account.signIn('u1');
  await settle();
  assert.equal(c.sync.state.status, 'conflict');
  assert.equal(c.progression.codes, 9, 'nothing is overwritten before the answer');
  // Signing out drops the question and keeps the local save.
  c.account.signOut();
  await settle();
  assert.equal(c.sync.state.status, 'off');
  assert.equal(c.sync.state.conflict, null);
  assert.equal(c.progression.codes, 9);

  // Another device writes between our read and our write: we read again and follow.
  const d = device(cloud);
  d.account.signIn('u1');
  await settle();
  d.progression.earn(40);
  win(d.progression);
  cloud.interleave(() => {
    const doc = remote(cloud);
    cloud.docs.set('progress/u1', { ...doc, rev: doc.rev + 1 });
  });
  d.timers.runAll();
  await settle();
  assert.equal(d.sync.state.status, 'conflict', 'the race shows up as both sides changed');

  // Offline: the status says so and a retry is scheduled.
  const e = device(cloud);
  e.account.online = false;
  e.account.signIn('u2');
  await settle();
  assert.equal(e.sync.state.status, 'offline');
  assert.equal(e.timers.pending.at(-1).ms, 60000);
  e.account.online = true;
  e.timers.runAll();
  await settle();
  assert.equal(e.sync.state.status, 'synced');
  assert.equal(remote(cloud, 'u2').rev, 1);

  // A different account on the same device is treated as never synced.
  const meta = JSON.parse(e.map.get(CLOUD_META_KEY));
  assert.equal(meta.uid, 'u2');
  assert.equal(meta.rev, 1);
  assert.ok(meta.hash.length < 20, 'only a fingerprint of the save is kept');

  // Disposal stops listening.
  e.sync.dispose();
  win(e.progression);
  assert.equal(e.timers.pending.length, 0);

  console.log('Cloud progress checks passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
