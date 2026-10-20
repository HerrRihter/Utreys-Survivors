import assert from 'node:assert/strict';
import { nodeGuardian } from '../src/systems/node-objectives.js';
import { createHarness } from './helpers/game-harness.js';
import { weaponDefinitions } from '../data/weapons.js';
import { test, vi } from 'vitest';

// Every extra weapon damages enemies, levels change its numbers, a bug archive evolves a
// ready weapon, evolved forms keep working and live effects stay bounded.
test('weapons', async () => {
  const h = await createHarness();
  let seed = 7;
  vi.spyOn(Math, 'random').mockImplementation(
    () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
  );
  const game = h.session;
  game.start();
  const s = game.state;
  assert.deepEqual([...s.weapons], [], 'a run starts with the hero attack only');
  const U = game.upgrades;
  const ids = U.weapons.map((u) => u.weapon);
  assert.equal(ids.length, 8);

  // Own all eight at level 1 (bypassing slots) and surround the hero.
  for (const id of ids) s.weapons.push({ id, level: 1, cd: 0.1, evolved: false, phase: 0 });
  function surround() {
    s.spawn = 1e9;
    for (const e of s.enemies) if (!e.nodeId) e.hp = 0;
    let k = 0;
    while (s.enemies.filter((e) => e.hp > 0 && !e.nodeId).length < 60) {
      const a = k * 2.399,
        r = 40 + ((k * 23) % 200);
      const e = game.spawn('inbev', false, {
        x: s.p.x + Math.cos(a) * r,
        y: s.p.y + Math.sin(a) * r,
      });
      e.hp = e.max = 5000;
      e.speed = 0;
      e.cd = 1e9;
      k++;
    }
  }
  surround();
  for (let i = 0; i < 600; i++) {
    s.p.hp = s.p.max;
    s.p.inv = 1;
    if (game.mode === 'level') game.pickUpgrade(0);
    game.update(1 / 60);
    if (i % 60 === 0) game.keys[i % 120 ? 'add' : 'delete']('KeyD');
  }
  for (const id of ids) assert(s.damageBy[id] > 0, id + ' deals damage');
  assert(s.wfx.length < 200, 'live weapon effects stay bounded');

  // Max level plus the matching passive makes a weapon eligible; an archive evolves it.
  s.weapons.length = 0;
  for (const id of ids) s.weapons.push({ id, level: 6, cd: 0.1, evolved: false, phase: 0 });
  s.upgradeRanks.might = 1;
  s.evoTokens = 0;
  const bug =
    nodeGuardian(s, s.nodes[0]) ||
    game.spawn('bug_aggregation', false, { x: s.p.x + 300, y: s.p.y });
  game.damage(bug, bug.hp + 1);
  assert.equal(s.evoTokens, 1, 'a node guardian leaves an archive');
  game.update(1 / 60);
  assert(s.weapons.find((w) => w.id === 'homing').evolved, 'homing + might evolves');
  assert.equal(s.evoTokens, 0);
  // Archives wait for an eligible weapon instead of being lost.
  s.evoTokens = 2;
  game.update(1 / 60);
  assert.equal(s.evoTokens, 2, 'no eligible weapon: the archive is kept');
  for (const id of ['area', 'tempo', 'armor', 'vitality', 'magnet', 'recovery', 'boots'])
    s.upgradeRanks[id] = 1;
  s.evoTokens = 7;
  game.update(1 / 60);
  assert(
    s.weapons.every((w) => w.evolved),
    'all eight weapons evolve',
  );
  for (const key of Object.keys(s.damageBy)) s.damageBy[key] = 0;
  surround();
  for (let i = 0; i < 600; i++) {
    s.p.hp = s.p.max;
    s.p.inv = 1;
    game.update(1 / 60);
  }
  for (const id of ids) assert(s.damageBy[id] > 0, 'evolved ' + id + ' deals damage');
  assert(s.wfx.length < 300, 'evolved effects stay bounded');
  // Firewall: enemies in the aura lose the data's share of their speed.
  const aura = weaponDefinitions.ping.evolution.aura;
  assert.equal(aura.slow, 0.35);
  const slowed = s.enemies.find((e) => e.hp > 0 && e.weaponSlowUntil > s.t);
  assert(slowed, 'the aura slows enemies');
  assert.equal(slowed.weaponSlow, aura.slow);
  game.draw();
  game.dispose();

  // Hero evolutions: each hero's level-6 attack still lands.
  for (const hero of ['utrace', 'traceability', 'serialization', 'ba', 'qa']) {
    const check = await createHarness();
    check.env.Progression.wallet.earn(1e6);
    check.env.Progression.shop.buyHero(hero);
    const g = check.session;
    g.select(hero);
    g.start();
    const st = g.state;
    st.spawn = 1e9;
    st.stats.heroEvo = true;
    const targets = [];
    for (let i = 0; i < 6; i++) {
      const e = g.spawn('l3', false, { x: st.p.x + 60 + i * 30, y: st.p.y + (i % 2) * 20 });
      e.hp = e.max = 5000;
      e.speed = 0;
      e.cd = 1e9;
      targets.push(e);
    }
    for (let i = 0; i < 240; i++) {
      st.p.hp = st.p.max;
      g.update(1 / 60);
    }
    assert(st.damageBy.hero > 0, hero + ' evolved attack deals damage');
    if (hero === 'qa')
      assert(
        targets.some((e) => e.markedUntil > st.t),
        'QA marks targets',
      );
    g.dispose();
  }
  console.log('PASS: eight weapons, level curve, bug archives, evolutions and hero evolutions');
});
