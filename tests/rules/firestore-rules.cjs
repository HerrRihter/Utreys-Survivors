// firestore.rules on the Firestore emulator. Run through `npm run test:rules`, which starts
// the emulator (Java required); kept out of `npm test` for that reason.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  orderBy,
  limit,
  where,
  getCountFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} = require('firebase/firestore');

const now = serverTimestamp;
const tests = [];
const test = (name, body) => tests.push({ name, body });

let env;
const as = (uid) => env.authenticatedContext(uid).firestore();
const guest = () => env.unauthenticatedContext().firestore();
const seed = (writes) =>
  env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [p, data] of Object.entries(writes)) await setDoc(doc(db, p), data);
  });

function register(db, uid, login, key) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'logins', key), { uid });
  batch.set(doc(db, 'users', uid), { login, loginKey: key, createdAt: now() });
  return batch.commit();
}

// ---- logins and profiles ----

test('registering claims the login and writes the profile', async () => {
  await assertSucceeds(register(as('u1'), 'u1', 'Алёна', 'алена'));
  await assertSucceeds(register(as('u3'), 'u3', 'ЭЮЯ_Ъ-1', 'эюя_ъ-1'));
  await assertSucceeds(register(as('u4'), 'u4', 'Vasya_2', 'vasya_2'));
  await assertSucceeds(getDoc(doc(guest(), 'users/u1')));
  await assertFails(getDoc(doc(guest(), 'logins/алена')));
  await assertSucceeds(getDoc(doc(as('u2'), 'logins/алена')));
});

test('a taken login cannot be claimed again', async () => {
  await seed({ 'logins/алена': { uid: 'u1' } });
  await assertFails(register(as('u2'), 'u2', 'АЛЕНА', 'алена'));
});

test('the profile login must match its key', async () => {
  await assertFails(register(as('u1'), 'u1', 'Вася', 'петя'));
  await assertFails(register(as('u1'), 'u1', 'Вaся', 'вaся'), 'mixed alphabets');
  await assertFails(register(as('u1'), 'u1', 'ab', 'ab'), 'too short');
});

test('a profile cannot be written for someone else or changed', async () => {
  const db = as('u2');
  const batch = writeBatch(db);
  batch.set(doc(db, 'logins', 'вася'), { uid: 'u1' });
  batch.set(doc(db, 'users', 'u1'), { login: 'Вася', loginKey: 'вася', createdAt: now() });
  await assertFails(batch.commit());
  await assertSucceeds(register(as('u1'), 'u1', 'Вася', 'вася'));
  await assertFails(updateDoc(doc(as('u1'), 'users/u1'), { login: 'ВАСЯ' }));
  await assertFails(deleteDoc(doc(as('u1'), 'logins/вася')));
});

test('a login claim needs its profile in the same write', async () => {
  await assertFails(setDoc(doc(as('u1'), 'logins/вася'), { uid: 'u1' }));
});

// ---- progress ----

const progress = (rev, extra = {}) => ({
  data: { codes: 10, unlocked: ['utrace'] },
  schema: 1,
  rev,
  device: 'dev-1',
  updatedAt: now(),
  ...extra,
});

test('progress is private and every write bumps rev by one', async () => {
  const ref = (db) => doc(db, 'progress/u1');
  await assertFails(setDoc(ref(as('u1')), progress(2)));
  await assertSucceeds(setDoc(ref(as('u1')), progress(1)));
  await assertSucceeds(getDoc(ref(as('u1'))));
  await assertFails(getDoc(ref(as('u2'))));
  await assertFails(getDoc(ref(guest())));
  await assertFails(setDoc(ref(as('u2')), progress(2)));
  await assertFails(setDoc(ref(as('u1')), progress(1)), 'rev must grow');
  await assertFails(setDoc(ref(as('u1')), progress(3)), 'rev grows by one');
  await assertSucceeds(setDoc(ref(as('u1')), progress(2)));
  await assertFails(setDoc(ref(as('u1')), progress(3, { extra: 1 })));
  await assertFails(setDoc(ref(as('u1')), progress(3, { schema: 2 })));
  await assertFails(deleteDoc(ref(as('u1'))));
});

test('progress keeps the shape of a save', async () => {
  const ref = doc(as('u1'), 'progress/u1');
  const save = (data) => progress(1, { data });
  await assertFails(setDoc(ref, save({ codes: 10, junk: 'x' })), 'unknown field');
  await assertFails(setDoc(ref, save({ codes: 1e12 })), 'too many codes');
  await assertFails(setDoc(ref, save({ codes: -5 })), 'negative codes');
  await assertFails(setDoc(ref, save({ codes: '10' })), 'codes as text');
  await assertFails(setDoc(ref, save({ unlocked: 'utrace' })), 'heroes not a list');
  await assertFails(
    setDoc(ref, save({ unlocked: Array.from({ length: 31 }, (_, i) => 'h' + i) })),
    'too many heroes',
  );
  await assertFails(setDoc(ref, save({ runStats: { all: {}, extra: {} } })), 'runStats field');
  await assertSucceeds(
    setDoc(
      ref,
      save({
        codes: 500,
        kills: 1200,
        unlocked: ['utrace'],
        levels: { health: 2 },
        stats: { wins: 1 },
        weaponKills: {},
        evolutionsSeen: [],
        claimedAchievements: [],
        loads: {},
        production: {},
        runStats: { all: {}, maps: {} },
      }),
    ),
  );
});

// ---- bans ----

test('a banned player can read but not write', async () => {
  await seed({
    'users/u1': { login: 'Вася', loginKey: 'вася' },
    'progress/u1': { ...progress(1), updatedAt: 1 },
    'banned/u1': { at: 1 },
    'banned/u3': { at: 1 },
  });
  const db = as('u1');
  await assertSucceeds(getDoc(doc(db, 'progress/u1')));
  await assertFails(setDoc(doc(db, 'progress/u1'), progress(2)));
  await assertFails(setDoc(statsRef(db), first()));
  await assertFails(register(as('u3'), 'u3', 'Петя', 'петя'), 'a new login');
  await assertFails(getDoc(doc(db, 'banned/u1')));
  await assertFails(setDoc(doc(db, 'banned/u2'), { at: 1 }));
  await assertSucceeds(setDoc(doc(as('u2'), 'progress/u2'), progress(1)), 'others still write');
});

// ---- statistics ----

const scope = (games, kills, codes, more = {}) => ({
  games,
  totalKills: kills,
  totalCodes: codes,
  bestTime: 300,
  bestTimeHero: 'utrace',
  bestTimeLoad: 1,
  bestKills: kills,
  bestCodes: codes,
  victoryScore: 0,
  productionTime: 0,
  ...more,
});
const stats = ({ runId = 'r1', map = 'empty', all, maps, login = 'Вася' }) => ({
  login,
  all,
  maps,
  lastRun: { map, runId },
  updatedAt: now(),
});
const first = () => stats({ all: scope(1, 100, 20), maps: { empty: scope(1, 100, 20) } });
const statsRef = (db, uid = 'u1') => doc(db, 'stats', uid);
const withProfile = () =>
  seed({
    'users/u1': { login: 'Вася', loginKey: 'вася' },
    'users/u2': { login: 'Петя', loginKey: 'петя' },
  });

test('the first run creates the statistics', async () => {
  await withProfile();
  await assertSucceeds(setDoc(statsRef(as('u1')), first()));
  await assertSucceeds(getDoc(statsRef(guest())));
  await assertFails(setDoc(statsRef(as('u2')), first()), 'someone else');
  await assertFails(setDoc(statsRef(as('u2'), 'u2'), first()), 'login of another player');
});

test('a run adds one game and grows totals the same overall and on its map', async () => {
  await withProfile();
  await seed({ 'stats/u1': { ...first(), updatedAt: 1 } });
  const db = as('u1');
  await assertSucceeds(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r2',
        all: scope(2, 150, 30),
        maps: { empty: scope(2, 150, 30) },
      }),
    ),
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({ runId: 'r3', all: scope(4, 200, 40), maps: { empty: scope(4, 200, 40) } }),
    ),
    'two games at once',
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({ runId: 'r3', all: scope(3, 140, 40), maps: { empty: scope(3, 140, 40) } }),
    ),
    'kills went down',
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({ runId: 'r3', all: scope(3, 300, 40), maps: { empty: scope(3, 200, 40) } }),
    ),
    'overall grew more than the map',
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r3',
        all: scope(3, 250, 40, { bestTime: 100 }),
        maps: { empty: scope(3, 250, 40) },
      }),
    ),
    'a record went down',
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r3',
        all: scope(3, 250, 40, { cheat: 1 }),
        maps: { empty: scope(3, 250, 40) },
      }),
    ),
    'unknown field',
  );
});

test('another map is added without touching the first', async () => {
  await withProfile();
  await seed({ 'stats/u1': { ...first(), updatedAt: 1 } });
  const db = as('u1');
  await assertFails(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r2',
        map: 'serverRoom',
        all: scope(2, 150, 30),
        maps: { empty: scope(1, 100, 25), serverRoom: scope(1, 50, 5) },
      }),
    ),
    'two maps changed',
  );
  await assertFails(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r2',
        map: 'moon',
        all: scope(2, 150, 30),
        maps: { empty: scope(1, 100, 20), moon: scope(1, 50, 10) },
      }),
    ),
    'unknown map',
  );
  await assertSucceeds(
    setDoc(
      statsRef(db),
      stats({
        runId: 'r2',
        map: 'serverRoom',
        all: scope(2, 150, 30),
        maps: { empty: scope(1, 100, 20), serverRoom: scope(1, 50, 10) },
      }),
    ),
  );
});

test('the same run sent again adds kills but never a game', async () => {
  await withProfile();
  await seed({ 'stats/u1': { ...first(), updatedAt: 1 } });
  const db = as('u1');
  await assertFails(
    setDoc(statsRef(db), stats({ all: scope(2, 150, 30), maps: { empty: scope(2, 150, 30) } })),
  );
  await assertSucceeds(
    setDoc(statsRef(db), stats({ all: scope(1, 150, 30), maps: { empty: scope(1, 150, 30) } })),
  );
});

test('tables can be listed only with a limit', async () => {
  await withProfile();
  await seed({ 'stats/u1': { ...first(), updatedAt: 1 } });
  const table = collection(guest(), 'stats');
  await assertSucceeds(getDocs(query(table, orderBy('maps.empty.totalKills', 'desc'), limit(50))));
  await assertFails(getDocs(query(table, orderBy('all.games', 'desc'))));
  await assertFails(deleteDoc(statsRef(as('u1'))));
});

test('a place in a table is counted with a limit', async () => {
  await withProfile();
  await seed({ 'stats/u1': { ...first(), updatedAt: 1 } });
  const table = collection(guest(), 'stats');
  const better = where('all.bestTime', '>', 100);
  const counted = await assertSucceeds(getCountFromServer(query(table, better, limit(1000))));
  assert.equal(counted.data().count, 1);
  await assertFails(getCountFromServer(query(table, better)));
  await assertFails(getDocs(query(table, better, limit(1001))));
});

test('everything else is closed', async () => {
  await assertFails(setDoc(doc(as('u1'), 'leaderboards/x'), { a: 1 }));
  await assertFails(getDoc(doc(guest(), 'progress/u1')));
});

(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-utreys',
    firestore: {
      host,
      port: Number(port),
      rules: fs.readFileSync(path.join(__dirname, '..', '..', 'firestore.rules'), 'utf8'),
    },
  });
  let failed = 0;
  for (const { name, body } of tests) {
    await env.clearFirestore();
    try {
      await body();
      console.log('PASS ' + name);
    } catch (e) {
      failed++;
      console.error('FAIL ' + name + '\n  ' + (e?.stack || e));
    }
  }
  await env.cleanup();
  assert.equal(failed, 0, failed + ' rules test(s) failed');
  console.log(tests.length + ' rules tests passed.');
})().catch((e) => {
  console.error(e?.message || e);
  process.exitCode = 1;
});
