import assert from 'node:assert/strict';
import { createHarness } from './helpers/game-harness.js';
import { heroDefinitions } from '../data/characters/heroes.js';
import { heroUnlockPrices } from '../data/upgrades.js';
import { abilityDefinitions } from '../data/characters/abilities.js';
import { heroAttack } from '../src/systems/hero-attacks.js';
import { test } from 'vitest';

test('hero-roster', async () => {
  const storage = new Map();
  const load = async () => {
    const env = {
      localStorage: {
        getItem: (key) => storage.get(key),
        setItem: (key, value) => storage.set(key, value),
      },
    };
    Object.assign(env, await import('../src/systems/progression/index.js'));
    env.Progression = env.createProgression({ storage: env.localStorage });
    return env.Progression;
  };
  let p = await load();
  for (const [id, price] of Object.entries(heroUnlockPrices)) {
    assert(!p.shop.owned(id));
    assert(!p.shop.buyHero(id), 'insufficient funds');
    assert(!p.shop.buyUpgrade('training_' + id), 'locked training');
    p.wallet.earn(price);
    assert(p.shop.buyHero(id));
    assert.equal(p.data.codes, 0);
    assert(!p.shop.buyHero(id), 'duplicate purchase');
    p = await load();
    assert(p.shop.owned(id), 'purchase survives reload');
  }
  for (const id of Object.keys(heroDefinitions)) {
    assert.equal(abilityDefinitions[id].length, 2);
    const h = await createHarness();
    if (id !== 'utrace') {
      h.session.select(id);
      h.session.start();
      assert.equal(h.session.state.p.max, heroDefinitions.utrace.hp, 'locked selection falls back');
      h.env.Progression.wallet.earn(heroUnlockPrices[id]);
      assert(h.env.Progression.shop.buyHero(id));
    }
    h.session.select(id);
    h.session.start();
    assert.equal(h.session.state.p.max, heroDefinitions[id].hp);
    assert(h.session.activateAbility(0));
    assert(h.session.activateAbility(1));
    h.session.update(0.05);
    h.session.draw();
    h.session.dispose();
  }
  const attack = (id, positions, clear = () => true) => {
    const enemies = positions.map(([x, y]) => ({ x, y, hp: 100, r: 10, unit: 'l3' }));
    const state = { p: { x: 0, y: 0, facing: { x: 1, y: 0 } }, enemies, fx: [], shots: [] };
    heroAttack(
      {
        state,
        hero: heroDefinitions[id],
        units: { l3: {} },
        arena: { clear },
        effect() {},
        damage(e, n) {
          e.hp -= n;
        },
      },
      { direction: { x: 1, y: 0 } },
      { damage: 1, range: 1 },
    );
    return state;
  };
  const chain = attack('traceability', [
    [60, 0],
    [150, 0],
    [240, 0],
    [330, 0],
    [150, 110],
    [600, 0],
  ]);
  assert.deepEqual(
    chain.enemies.map((e) => Math.round((100 - e.hp) * 100) / 100),
    [24, 24, 24, 24, 24, 0],
  );
  assert.equal(chain.fx.length, 5, 'one visible link per target, including branches');
  assert(chain.fx.every((f) => f.kind === 'link' && f.life >= 0.6));
  const crowd = attack(
    'traceability',
    Array.from({ length: 20 }, (_, i) => [40 + i * 30, 0]),
  );
  assert.equal(
    crowd.enemies.filter((e) => e.hp < 100).length,
    heroDefinitions.traceability.chainLimit,
    'chain stops at its target limit',
  );
  const blocked = attack(
    'traceability',
    [
      [60, 0],
      [160, 0],
    ],
    (a, b) => b.x < 100,
  );
  assert.deepEqual(
    blocked.enemies.map((e) => e.hp),
    [76, 100],
    'walls stop propagation',
  );
  const cycle = attack('traceability', [
    [50, 0],
    [60, 10],
    [60, -10],
    [50, 0],
  ]);
  assert(
    cycle.enemies.every((e) => e.hp === 76),
    'cycles and coincident targets hit once',
  );
  const qa = attack('qa', [
    [40, 0],
    [-40, 0],
    [85, 85],
  ]);
  assert(
    qa.enemies.every((e) => e.hp === 81 && e.abilityStun === 0.6),
    'QA reaches rear and interrupts',
  );
  assert.equal(qa.fx[0].kind, 'scan');
  assert.equal(qa.fx.filter((f) => f.kind === 'scanTarget').length, 3);
  const base = attack('utrace', [
    [30, 60],
    [-30, 0],
  ]);
  const ba = attack('ba', [
    [30, 60],
    [-30, 0],
  ]);
  assert.equal(base.enemies[0].hp, 100);
  assert(ba.enemies[0].hp < 100 && ba.enemies[1].hp === 100, 'BA wider forward sector');
  assert.equal(attack('serialization', []).shots.length, 1);
  const h = await createHarness();
  h.env.Progression.wallet.earn(100);
  h.env.Progression.shop.buyHero('serialization');
  h.session.select('serialization');
  h.session.start();
  const s = h.session.state;
  s.spawn = 9999;
  s.attack = 0;
  const targets = [110, 180].map((dx) => {
    const e = h.session.spawn('l3', false, { x: s.p.x + dx, y: s.p.y });
    e.speed = 0;
    e.cd = 9999;
    return e;
  });
  for (let i = 0; i < 14; i++) h.session.update(0.05);
  // The far target also takes Serialization's long-range passive bonus.
  assert(
    targets.every((e, i) => Math.abs(e.hp - (e.max - 23 * (i ? 1 + s.stats.farBonus : 1))) < 1e-9),
    'one packet pierces two targets exactly once',
  );
  h.session.dispose();
  console.log(
    'PASS: hero purchases, persistence, selection, abilities and distinct attack geometry',
  );
});
