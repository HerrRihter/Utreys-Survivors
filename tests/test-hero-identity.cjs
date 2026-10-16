const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { abilityDefinitions } = require('../data/characters/abilities.js');
const { heroPassives, critMultiplier } = require('../data/characters/hero-passives.js');
const { heroTrainingDefinitions, heroUnlockPrices } = require('../data/upgrades.js');
const { passiveDamage, countCrowd } = require('../src/systems/hero-passives.js');

// Stage 2: every hero has a shared Q dash, an own E ability and an own passive that its
// shop training strengthens.
(async () => {
  const heroes = Object.keys(abilityDefinitions);
  assert(
    heroes.every((id) => abilityDefinitions[id][0].id === 'dash'),
    'Q is the shared dash',
  );
  const eIds = heroes.map((id) => abilityDefinitions[id][1].id);
  assert.equal(new Set(eIds).size, heroes.length, 'E abilities are distinct');
  for (const id of heroes) {
    const passive = heroPassives[id];
    assert(passive.role && passive.name && passive.desc, `${id} has role and passive`);
    assert(heroTrainingDefinitions[id].stat in passive.stats, `${id} training feeds its passive`);
  }

  // Passive damage maths, isolated from the session.
  const p = { x: 0, y: 0 };
  const near = { x: 50, y: 0 },
    far = { x: 300, y: 0 };
  const never = () => 1,
    always = () => 0;
  const st = (stats, extra = {}) => ({ p, t: 10, stats, ...extra });
  assert.equal(passiveDamage(st({}), near, 10, 'hero', never).n, 10, 'no passive, no change');
  assert.equal(passiveDamage(st({ weaponBonus: 0.5 }), near, 10, 'mine', never).n, 15);
  assert.equal(passiveDamage(st({ weaponBonus: 0.5 }), near, 10, 'hero', never).n, 10);
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert(
    close(
      passiveDamage(st({ crowdPer: 0.03, crowdCap: 0.3 }, { crowd: 4 }), near, 100, 'hero', never)
        .n,
      112,
    ),
    'crowd bonus per enemy',
  );
  assert(
    close(
      passiveDamage(st({ crowdPer: 0.03, crowdCap: 0.3 }, { crowd: 40 }), near, 100, 'hero', never)
        .n,
      130,
    ),
    'crowd bonus is capped',
  );
  assert.equal(passiveDamage(st({ farBonus: 0.2 }), near, 10, 'hero', never).n, 10);
  assert.equal(passiveDamage(st({ farBonus: 0.2 }), far, 10, 'hero', never).n, 12);
  const crit = passiveDamage(st({ crit: 0.1 }), near, 10, 'hero', always);
  assert.deepEqual(crit, { n: 10 * critMultiplier, crit: true });
  const roll = () => 0.3;
  assert(!passiveDamage(st({ crit: 0.1, scanCrit: 0.35 }), near, 10, 'hero', roll).crit);
  assert(
    passiveDamage(st({ crit: 0.1, scanCrit: 0.35 }), { ...near, scannedUntil: 11 }, 10, 'x', roll)
      .crit,
    'scanned targets are easier to crit',
  );
  const crowdState = {
    p,
    stats: { crowdPer: 0.03 },
    enemies: [
      { x: 30, y: 0, hp: 1 },
      { x: 0, y: 150, hp: 1 },
      { x: 200, y: 0, hp: 1 },
      { x: 20, y: 0, hp: 0 },
    ],
  };
  assert.equal(countCrowd(crowdState), 2, 'crowd counts living enemies in range');

  // Each hero's E inside a running session.
  async function session(id) {
    const h = await createHarness();
    h.env.Progression.earn(1000);
    if (heroUnlockPrices[id]) assert(h.env.Progression.buyHero(id));
    h.session.select(id);
    h.session.start();
    const s = h.session.state;
    s.spawn = 9999;
    const spawn = (unit, dx, dy = 0) => {
      const e = h.session.spawn(unit, false, { x: s.p.x + dx, y: s.p.y + dy });
      e.speed = 0;
      return e;
    };
    return { h, s, spawn };
  }

  {
    const { h, s } = await session('utrace');
    assert.equal(s.stats.weaponSlots, 1);
    assert.equal(h.session.upgrades.build('utrace', s).weaponSlots, 5, 'Utrace has five slots');
    for (const id of ['orbit', 'homing', 'mine', 'ping'])
      s.weapons.push({ id, level: 1, cd: 1, evolved: false, phase: 0 });
    const pool = h.session.upgrades.pool('utrace', s);
    assert(!pool.some((u) => u.kind === 'weapon' && u.isNew), 'four extra weapons fill slots');
    h.session.dispose();
  }
  {
    const { h, s } = await session('traceability');
    assert(h.session.activateAbility(1));
    h.session.update(0.02);
    const { effectiveStats } = require('../src/systems/ability-state.js');
    assert(effectiveStats(s).chainUnlimited, 'Registry lifts the chain cap');
    s.t += 10;
    assert(!effectiveStats(s).chainUnlimited, 'and ends');
    h.session.dispose();
  }
  {
    const { h, s } = await session('serialization');
    s.attack = 999;
    const before = s.shots.length;
    assert(h.session.activateAbility(1));
    const volley = s.shots.slice(before);
    assert.equal(volley.length, 12, 'Volley fires 12 packets');
    assert(volley.every((b) => b.tag === 'volley'));
    const target = h.session.spawn('l3', false, {
      x: s.p.x + volley[0].vx * 0.1,
      y: s.p.y + volley[0].vy * 0.1 + 10,
    });
    target.speed = 0;
    for (let i = 0; i < 8; i++) h.session.update(0.03);
    assert(target.hp < target.max, 'Volley packets hit');
    assert(s.damageBy.volley > 0, 'Volley damage is attributed');
    h.session.dispose();
  }
  {
    const { h, s, spawn } = await session('ba');
    const client = s.baSpecialization.client;
    const nearby = spawn('l3', 30),
      distant = spawn('l3', 700),
      clientFar = spawn(client, -700);
    assert(h.session.activateAbility(1));
    assert(nearby.pacifiedUntil > s.t, 'nearby enemies negotiate');
    assert(clientFar.pacifiedUntil > s.t, 'the client negotiates anywhere');
    assert(!(distant.pacifiedUntil > s.t), 'distant ordinary enemies keep fighting');
    nearby.cd = 0;
    s.attack = 999;
    for (let i = 0; i < 10; i++) {
      h.session.update(0.05);
      assert(!nearby.action, 'pacified enemy does not start an attack');
    }
    s.t = nearby.pacifiedUntil + 0.01;
    nearby.cd = 0;
    h.session.update(0.05);
    assert(nearby.action, 'and attacks again when negotiations end');
    h.session.dispose();
  }
  {
    const { h, s, spawn } = await session('qa');
    s.attack = 999;
    const inside = spawn('l3', 80),
      outside = spawn('l3', 400);
    assert(h.session.activateAbility(1));
    h.session.update(0.02);
    assert(inside.abilityStun > 1.5, 'Regress freezes enemies in the zone');
    assert.equal(outside.abilityStun || 0, 0);
    h.session.dispose();
  }

  console.log('PASS: per-hero E abilities, passives, trainings and hero select data');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
