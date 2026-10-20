import assert from 'node:assert/strict';
import { unitDefinitions } from '../data/enemies/units.js';
import { waveSchedules } from '../data/enemies/waves.js';
import { validateUnits } from '../tools/check-game-contracts.cjs';
import { createHarness } from './helpers/game-harness.js';
import { drawEnemyShot } from '../src/rendering/projectiles.js';
import { mitigation } from '../src/systems/enemy-behaviors.js';
import { test } from 'vitest';

test('expanded-roster', async () => {
  const added = [
    'mars_petfood',
    'baltika',
    'multon',
    'loreal',
    'procter_gamble',
    'progress',
    'royal_canin',
    'cherkizovo',
    'ferrero',
    'mondelez',
    'vetis',
  ];
  validateUnits(unitDefinitions);
  for (const patch of [
    { attack: 'typo' },
    { hp: NaN },
    { frontDamageMultiplier: 2 },
    { color: 'red' },
    { burst: { reach: 16, ring: { r: 0, life: 0.2, color: '#00e676' }, sound: 'hit' } },
    { attack: 'pulse', burst: unitDefinitions.l3.burst },
  ])
    assert.throws(
      () => validateUnits({ invalid: { ...unitDefinitions.l3, ...patch } }),
      /Unit contract/,
    );
  const scheduled = new Set(
    waveSchedules.empty.normal.stages.flatMap((s) => s.weights.map(([id]) => id)),
  );
  for (const id of added) {
    assert(scheduled.has(id), `${id} reachable in waves`);
    const h = await createHarness();
    const s = h.session;
    s.start();
    s.state.spawn = 9999;
    s.state.attack = 9999;
    const u = unitDefinitions[id];
    const p = s.state.p;
    const e = s.spawn(id, false, { x: p.x - 40, y: p.y });
    e.heading = 0;
    e.cd = 9999;
    e.action = { elapsed: 0, duration: u.wind, hit: false, aim: { x: p.x, y: p.y } };
    const hp = p.hp;
    // A mortar mark goes off after its own delay.
    const settle = u.wind + (u.mortar?.delay || 0) + 0.4;
    for (let i = 0; i < Math.ceil(settle / 0.05); i++) s.update(0.05);
    assert(p.hp < hp, `${id} actual attack damages player`);
    assert.equal(s.state.bossSpawned, false, `${id} does not trigger boss progression`);
    const enemies = h.env.createEnemyRenderer();
    enemies.draw(h.context, e);
    e.action = { aim: p, hit: false };
    enemies.telegraph(h.context, e);
    drawEnemyShot(h.context, { x: 0, y: 0, kind: id });
    if (u.frontDamageMultiplier) {
      assert.equal(mitigation(e, { x: e.x + 20, y: e.y }), u.frontDamageMultiplier);
      assert.equal(mitigation(e, { x: e.x - 20, y: e.y }), 1);
    }
    const kills = s.state.kills;
    s.damage(e, e.hp / (u.frontDamageMultiplier || 1) + 1);
    assert.equal(s.state.kills, kills + 1);
    assert.equal(s.state.gems.at(-1).v, u.xp);
    assert.equal(s.state.bossDead, false);
    s.dispose();
  }
  console.log(
    'PASS: eleven opponents spawn, attack, render, reward XP and preserve boss progression',
  );
});
