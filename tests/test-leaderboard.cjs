const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  createLeaderboard,
  statPath,
  TABLE_SIZE,
  RANK_LIMIT,
} = require('../src/services/leaderboard.js');
const { statMetrics } = require('../data/leaderboards.js');
const { statNumbers } = require('../src/systems/run-records.js');

// Every table is a stats field, and the rules' list limit allows the queries we send.
for (const metric of statMetrics) assert.ok(statNumbers.includes(metric.field), metric.field);
assert.equal(statMetrics.length, statNumbers.length, 'every number has a table');
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');
const listLimit = Number(rules.match(/allow list: if request\.query\.limit <= (\d+);/)[1]);
assert.ok(TABLE_SIZE <= listLimit && RANK_LIMIT <= listLimit);
assert.equal(statPath('all', 'games'), 'all.games');
assert.equal(statPath('serverRoom', 'bestTime'), 'maps.serverRoom.bestTime');

// A Firestore with just the query features the leaderboards use.
function fakeFirestore(docs) {
  let reads = 0,
    counts = 0;
  const value = (data, field) => field.split('.').reduce((v, key) => v?.[key], data);
  const run = ({ filters, order, max }) => {
    let rows = [...docs.entries()].map(([id, data]) => ({ id, data }));
    for (const f of filters) rows = rows.filter((r) => value(r.data, f.field) > f.value);
    if (order) rows.sort((a, b) => value(b.data, order) - value(a.data, order));
    return rows.slice(0, max);
  };
  const firestore = {
    collection: () => 'stats',
    where: (field, op, v) => ({ type: 'where', field, op, value: v }),
    orderBy: (field, dir) => ({ type: 'order', field, dir }),
    limit: (n) => ({ type: 'limit', n }),
    query: (_c, ...parts) => ({
      filters: parts.filter((p) => p.type === 'where'),
      order: parts.find((p) => p.type === 'order')?.field,
      max: parts.find((p) => p.type === 'limit')?.n ?? Infinity,
    }),
    async getDocs(q) {
      reads++;
      assert.ok(q.max <= listLimit, 'the rules refuse larger queries');
      return { docs: run(q).map((r) => ({ id: r.id, data: () => r.data })) };
    },
    async getCount(q) {
      counts++;
      assert.ok(q.max <= listLimit, 'the rules refuse larger queries');
      return { data: () => ({ count: run(q).length }) };
    },
  };
  return {
    sdk: { db: {}, firestore },
    get reads() {
      return reads;
    },
    get counts() {
      return counts;
    },
  };
}

const player = (login, all, maps = {}) => ({ login, all, maps });

(async () => {
  const docs = new Map([
    ['a', player('Аня', { bestTime: 300, games: 4 }, { empty: { bestTime: 300 } })],
    [
      'b',
      player(
        'Боря',
        { bestTime: 500, games: 1, bestTimeHero: 'qa' },
        { serverRoom: { bestTime: 500 } },
      ),
    ],
    ['c', player('Вика', { bestTime: 0, games: 9 })],
    ['d', player('Гена', { games: 2 })],
  ]);
  const fake = fakeFirestore(docs);
  let clock = 0;
  const board = createLeaderboard({
    account: { firebase: async () => fake.sdk },
    now: () => clock,
  });

  // Best first; players without the record are left out.
  const top = await board.top('bestTime', 'all');
  assert.deepEqual(
    top.map((r) => [r.place, r.login]),
    [
      [1, 'Боря'],
      [2, 'Аня'],
    ],
  );
  assert.equal(top[0].scope.bestTimeHero, 'qa', 'the row carries the scope for labels');
  assert.deepEqual(
    (await board.top('games', 'all')).map((r) => r.login),
    ['Вика', 'Аня', 'Гена', 'Боря'],
  );
  // Per map.
  assert.deepEqual(
    (await board.top('bestTime', 'serverRoom')).map((r) => r.login),
    ['Боря'],
  );

  // Places: 1 + players with a better value.
  assert.equal(await board.place('bestTime', 'all', 300), 2);
  assert.equal(await board.place('bestTime', 'all', 900), 1);
  assert.equal(await board.place('bestTime', 'all', 0), null, 'no value, no place');

  // Answers are cached for a minute, then read again; invalidate drops them at once.
  const reads = fake.reads;
  await board.top('bestTime', 'all');
  assert.equal(fake.reads, reads);
  clock += 61000;
  await board.top('bestTime', 'all');
  assert.equal(fake.reads, reads + 1);
  board.invalidate();
  await board.top('bestTime', 'all');
  assert.equal(fake.reads, reads + 2);

  // Beyond the counted range the place is unknown.
  for (let i = 0; i < RANK_LIMIT; i++) docs.set('x' + i, player('p' + i, { games: 100 + i }));
  board.invalidate();
  assert.equal(await board.place('games', 'all', 50), Infinity);
  assert.equal((await board.top('games', 'all')).length, TABLE_SIZE);

  // A failed read is not cached.
  let online = false;
  const flaky = createLeaderboard({
    account: {
      firebase: async () => {
        if (!online) throw new Error('offline');
        return fake.sdk;
      },
    },
  });
  await assert.rejects(flaky.top('games', 'all'));
  online = true;
  assert.equal((await flaky.top('games', 'all')).length, TABLE_SIZE);

  console.log('Leaderboard checks passed.');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
