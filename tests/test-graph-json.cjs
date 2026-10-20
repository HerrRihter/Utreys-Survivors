const assert = require('node:assert/strict');
const vm = require('node:vm');
const { toGraphJson, fromGraphJson } = require('../src/core/graph-json.js');

const roundTrip = (value) => fromGraphJson(JSON.parse(JSON.stringify(toGraphJson(value))));

// Shared objects come back shared; Sets and Maps keep their members.
const enemy = { id: 7, hp: 12, wcd: { orbit: 3 } },
  other = { id: 8, hp: 0 };
const state = {
  enemies: [enemy, { id: 9 }],
  shots: [
    { target: enemy, hit: new Set([enemy, other]) },
    { target: null, hit: new Set() },
  ],
  guards: [enemy],
  pairs: new Map([['a', enemy]]),
  list: [1, 2],
};
state.again = state.list;
const back = roundTrip(state);
assert.equal(back.shots[0].target, back.enemies[0], 'a target is the listed enemy');
assert(back.shots[0].hit.has(back.enemies[0]), 'a hit list holds the listed enemy');
assert.equal([...back.shots[0].hit][1].id, 8, 'an enemy outside the lists is kept');
assert.equal(back.guards[0], back.enemies[0]);
assert.equal(back.pairs.get('a'), back.enemies[0]);
assert.equal(back.again, back.list, 'a shared array stays shared');
assert.deepEqual(back.enemies[0], enemy);
assert.deepEqual(Object.keys(back), Object.keys(state), 'field order is kept');

// Cycles, special numbers and undefined.
const loop = { name: 'loop' };
loop.self = loop;
const odd = roundTrip({
  loop,
  n: [-0, NaN, Infinity, -Infinity, 0.1 + 0.2],
  u: undefined,
  k: [undefined],
});
assert.equal(odd.loop.self, odd.loop);
assert(Object.is(odd.n[0], -0));
assert(Number.isNaN(odd.n[1]));
assert.deepEqual(odd.n.slice(2), [Infinity, -Infinity, 0.1 + 0.2]);
assert('u' in odd && odd.u === undefined);
assert.equal(odd.k.length, 1);

// Plain data only: functions and class instances are refused with their path.
assert.throws(() => toGraphJson({ a: [{ f() {} }] }), /\$\.a\[0\]\.f: function/);
assert.throws(() => toGraphJson({ d: new Date(0) }), /\$\.d: Date/);

// Objects of another realm (the game runs in a vm in tests) are plain too.
const foreign = vm.runInNewContext('const e = { id: 1 }; ({ list: [e], hit: new Set([e]) })');
const fromVm = roundTrip(foreign);
assert(fromVm.hit.has(fromVm.list[0]));

// A shared object is written once.
const text = JSON.stringify(toGraphJson(state));
assert.equal(text.match(/"wcd"/g).length, 1);
console.log('PASS: graph JSON keeps shared objects, sets, maps, cycles and special numbers');
