const assert = require('node:assert/strict');
const fs = require('node:fs'),
  path = require('node:path');
const { persisted } = require('../src/core/storage.js');

// Every saved key goes through src/core/storage.js: reads and writes never throw, unreadable
// values count as nothing saved, and older keys are converted once.
const memory = (entries = []) => {
  const map = new Map(entries);
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
};
// A normalizer accepts its own output: what load returns may be written back as is.
const count = (saved) => ({ n: Number.isSafeInteger(saved?.n) ? saved.n : 0 });

// Round trip, defaults, corrupt JSON and a normalizer that throws on an odd shape.
const s = memory([['bad', '{oops']]);
const file = persisted(s, 'k', { normalize: count });
assert.equal(file.load().n, 0, 'nothing saved gives the default');
assert.equal(file.save({ n: 3 }), true);
assert.equal(file.load().n, 3);
assert.equal(persisted(s, 'bad', { normalize: count }).load().n, 0, 'corrupt JSON is nothing');
s.setItem('odd', '"text"');
const strict = persisted(s, 'odd', {
  normalize: (saved) => {
    if (saved !== null && typeof saved !== 'object') throw Error('odd');
    return saved ?? 'default';
  },
});
assert.equal(strict.load(), 'default', 'a value the normalizer rejects is nothing');
file.clear();
assert.equal(s.map.has('k'), false);

// Blocked storage: reads are empty, writes report failure, nothing throws.
const blocked = {
  getItem() {
    throw Error('SecurityError');
  },
  setItem() {
    throw Error('QuotaExceeded');
  },
};
const locked = persisted(blocked, 'k', { normalize: count, legacyKeys: ['old'] });
assert.equal(locked.load().n, 0);
assert.equal(locked.save({ n: 1 }), false);
assert.doesNotThrow(() => locked.clear());

// Older keys: the newest found is converted, written under the new key, then removed.
const legacy = memory([
  ['v1', JSON.stringify({ count: 1 })],
  ['v2', JSON.stringify({ count: 2 })],
]);
const seen = [];
const moved = persisted(legacy, 'v3', {
  normalize: count,
  migrate: (old, key) => (seen.push(key), { n: old.count * 10 }),
  legacyKeys: ['v2', 'v1'],
});
assert.equal(moved.load().n, 20);
assert.deepEqual(seen, ['v2']);
assert.equal(legacy.getItem('v3'), '{"n":20}', 'the converted value is stored');
assert(!legacy.map.has('v2') && !legacy.map.has('v1'), 'older keys are removed');
assert.equal(moved.load().n, 20);
assert.deepEqual(seen, ['v2'], 'converted once');
// A failed write keeps the old key for the next try; a key under the new name wins.
const full = memory([['v1', JSON.stringify({ count: 4 })]]);
full.setItem = () => {
  throw Error('full');
};
const retry = persisted(full, 'v2', {
  normalize: count,
  migrate: (old) => ({ n: old.count }),
  legacyKeys: ['v1'],
});
assert.equal(retry.load().n, 4);
assert(full.map.has('v1'));
const both = memory([
  ['new', JSON.stringify({ n: 7 })],
  ['old', JSON.stringify({ n: 1 })],
]);
assert.equal(persisted(both, 'new', { normalize: count, legacyKeys: ['old'] }).load().n, 7);
// Storage without removeItem: an old key is overwritten with null.
const plain = new Map([['old', JSON.stringify({ n: 5 })]]);
const noRemove = { getItem: (k) => plain.get(k) ?? null, setItem: (k, v) => plain.set(k, v) };
assert.equal(persisted(noRemove, 'new', { normalize: count, legacyKeys: ['old'] }).load().n, 5);
assert.equal(plain.get('old'), 'null');

// Nothing else in the game reads or writes storage directly.
const root = path.resolve(__dirname, '..');
const allowed = new Set(['src/core/storage.js', 'src/app/useGameSession.ts']);
const offenders = [];
const walk = (dir) => {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = dir + '/' + entry.name;
    if (entry.isDirectory()) walk(rel);
    else if (/\.(js|ts|tsx)$/.test(entry.name) && !allowed.has(rel)) {
      const text = fs.readFileSync(path.join(root, rel), 'utf8');
      if (/\.(getItem|setItem|removeItem)\(|localStorage\./.test(text)) offenders.push(rel);
    }
  }
};
walk('src');
walk('data');
assert.deepEqual(offenders, [], 'storage access outside src/core/storage.js');

console.log(
  'PASS: persisted storage: defaults, corrupt and blocked storage, legacy keys, one door',
);
