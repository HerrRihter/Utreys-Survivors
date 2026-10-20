import assert from 'node:assert/strict';
import { unitDefinitions } from '../data/enemies/units.js';
import { waveSchedules } from '../data/enemies/waves.js';
import { unitRole, selectWaveUnit } from '../src/systems/wave-schedule.js';
import { createHarness } from './helpers/game-harness.js';
import { test } from 'vitest';

test('enemy-roles', async () => {
  const regular = Object.keys(unitDefinitions).filter(
    (id) => !unitDefinitions[id].boss && !unitDefinitions[id].miniboss,
  );

  // A quiet run: no waves, no node guardians nearby, the player far from walls.
  async function quiet() {
    const h = await createHarness();
    const s = h.session;
    s.start();
    s.state.spawn = 9999;
    s.state.attack = 9999;
    s.state.eliteNext = Infinity;
    for (const id of Object.keys(s.state.waveNext)) s.state.waveNext[id] = Infinity;
    s.state.enemies = [];
    for (const node of s.state.nodes) node.status = 'workaround';
    s.state.p.x = s.state.p.y = 1100;
    return { h, s, p: s.state.p };
  }
  const run = (s, seconds) => {
    for (let i = 0; i < Math.ceil(seconds / 0.05); i++) s.update(0.05);
  };

  // Every stage of every map fields the whole roster, and every regular unit has one role.
  for (const schedule of Object.values(waveSchedules))
    for (const stage of schedule.normal.stages) {
      const ids = new Set(stage.weights.map(([id]) => id));
      for (const id of regular) assert(ids.has(id), `${id} in stage ${stage.time}`);
      assert(stage.strength > 0);
    }
  const roles = [
    'burst',
    'dash',
    'pack',
    'flank',
    'keep',
    'heal',
    'aura',
    'deathBlast',
    'enrage',
    'slow',
    'shots',
    'mortar',
    'frontDamageMultiplier',
  ];
  for (const id of regular) {
    const u = unitDefinitions[id];
    assert(
      roles.some((role) => u[role] != null) || u.attack === 'projectile',
      `${id} has a role mechanic`,
    );
  }
  // Bugs differ from each other.
  const bugs = Object.keys(unitDefinitions).filter((id) => unitDefinitions[id].miniboss);
  const signatures = bugs.map((id) => {
    const u = unitDefinitions[id];
    return [u.attack, !!u.summon, !!u.shots, !!u.mortar, !!u.slow, !!u.pools].join();
  });
  assert.equal(new Set(signatures).size, bugs.length, 'each bug has its own mechanic');

  // Shares: with shooters and tanks full, only light units are drawn.
  const schedule = waveSchedules.empty;
  for (const roll of [0, 0.3, 0.6, 0.99]) {
    const id = selectWaveUnit(schedule, 300, roll, unitDefinitions, new Set(['shooter', 'tank']));
    assert.equal(unitRole(unitDefinitions[id]), 'light');
  }

  // Stage strength: an opening L3 is weaker than a late one.
  {
    const { h, s, p } = await quiet();
    const early = s.spawn('l3', false, { x: p.x + 300, y: p.y });
    s.state.t = 300;
    const late = s.spawn('l3', false, { x: p.x - 300, y: p.y });
    assert(early.max < late.max && early.damage <= late.damage);
    h.session.dispose();
  }

  // Charger: winds up in place, then lunges along a line and hits.
  {
    const { h, s, p } = await quiet();
    const e = s.spawn('pepsi', false, { x: p.x - 200, y: p.y });
    e.dashCd = 0;
    s.update(0.05);
    assert.equal(e.dash?.phase, 'wind', 'dash starts with a wind-up');
    const x = e.x;
    run(s, unitDefinitions.pepsi.dash.wind * 0.5);
    assert.equal(e.x, x, 'no movement while winding up');
    const hp = p.hp;
    run(s, unitDefinitions.pepsi.dash.wind + unitDefinitions.pepsi.dash.time);
    assert(e.x > x + 100, 'lunge covers ground');
    assert(p.hp < hp, 'lunge hits the player');
    // A hit during the wind-up cancels the lunge.
    e.dash = null;
    e.dashCd = 0;
    e.x = p.x - 200;
    e.y = p.y;
    p.inv = 9;
    s.update(0.05);
    assert.equal(e.dash?.phase, 'wind');
    s.damage(e, 1);
    assert.equal(e.dash, null, 'a hit cancels the wind-up');
    h.session.dispose();
  }

  // Pack: one wave slot brings the whole pack.
  {
    const { h, s } = await quiet();
    s.state.t = 1;
    s.state.rng.random = () => 0.2; // first weighted entries
    s.state.spawn = 0;
    const before = s.state.enemies.length;
    s.update(0.01);
    const multons = s.state.enemies.filter((e) => e.unit === 'multon').length;
    assert(s.state.enemies.length > before);
    if (multons) assert.equal(multons % unitDefinitions.multon.pack, 0, 'multon comes in packs');
    h.session.dispose();
  }

  // Medic heals wounded neighbours; guard reduces damage around it.
  {
    const { h, s, p } = await quiet();
    p.inv = 99;
    const medic = s.spawn('progress', false, { x: p.x + 300, y: p.y });
    const ally = s.spawn('cherkizovo', false, { x: p.x + 340, y: p.y });
    ally.hp = ally.max / 2;
    medic.healCd = 0.01;
    s.update(0.05);
    assert(ally.hp > ally.max / 2, 'medic heals');
    const guard = s.spawn('baltika', false, { x: p.x + 380, y: p.y + 40 });
    s.update(0.01);
    const hp = ally.hp;
    s.damage(ally, 10);
    assert.equal(
      Math.round((hp - ally.hp) * 100) / 100,
      Math.round(10 * (1 - unitDefinitions.baltika.aura.reduction) * 100) / 100,
      'guard aura reduces damage',
    );
    s.damage(guard, guard.hp + 1);
    h.session.dispose();
  }

  // Volatile: a delayed blast where it died; berserker enrages; inspector slows.
  {
    const { h, s, p } = await quiet();
    const pg = s.spawn('procter_gamble', false, { x: p.x + 30, y: p.y });
    s.damage(pg, pg.hp + 1);
    assert.equal(s.state.hazards.length, 1, 'death leaves a blast mark');
    const hp = p.hp;
    run(s, unitDefinitions.procter_gamble.deathBlast.delay + 0.1);
    assert(p.hp < hp, 'the blast hurts nearby players');
    assert.equal(s.state.hazards.length, 0);

    const berserker = s.spawn('cherkizovo', false, { x: p.x + 400, y: p.y });
    const speed = berserker.speed;
    berserker.hp = berserker.max * 0.4;
    s.update(0.01);
    assert(berserker.enraged, 'wounded berserker enrages');
    assert(speed > 0);

    p.inv = 0;
    const vetis = s.spawn('vetis', false, { x: p.x + 50, y: p.y });
    vetis.cd = 0;
    run(s, unitDefinitions.vetis.wind + 0.2);
    assert(p.slowUntil > s.state.t, 'inspector wave slows the player');
    h.session.dispose();
  }

  // Shooters: fan, burst and ring patterns; mortar marks the ground and explodes later.
  {
    const { h, s, p } = await quiet();
    p.inv = 99;
    for (const [id, count] of [
      ['mars_petfood', 3],
      ['royal_canin', 3],
    ]) {
      s.state.enemyShots = [];
      const e = s.spawn(id, false, { x: p.x - 150, y: p.y });
      e.cd = 0;
      run(s, unitDefinitions[id].wind * 0.6);
      assert.equal(s.state.enemyShots.length, count, `${id} fires ${count}`);
      s.state.enemies = s.state.enemies.filter((x) => x !== e);
    }
    s.state.hazards = [];
    const mortar = s.spawn('ferrero', false, { x: p.x - 200, y: p.y });
    mortar.cd = 0;
    run(s, unitDefinitions.ferrero.wind * 0.6);
    assert.equal(s.state.hazards[0]?.kind, 'blast', 'mortar marks the ground');
    h.session.dispose();
  }

  // Bugs: a summoner calls L3 and a pool-maker leaves zones.
  {
    const { h, s, p } = await quiet();
    const summoner = s.spawn('bug_aggregation', false, { x: p.x + 300, y: p.y });
    summoner.summonCd = 0;
    s.update(0.01);
    const minions = s.state.enemies.filter((e) => e.summonerId === summoner.id);
    assert(minions.length > 0 && minions.length <= unitDefinitions.bug_aggregation.summon.max);
    const pools = s.spawn('bug_goods', false, { x: p.x - 200, y: p.y });
    pools.poolCd = 0;
    s.update(0.01);
    assert(
      s.state.hazards.some((z) => z.kind === 'pool'),
      'bug leaves pools',
    );
    // Poise: interrupted once, then not again for a while.
    pools.action = { elapsed: 0, duration: 1, hit: false, aim: p };
    s.damage(pools, 1);
    assert.equal(pools.action, null);
    pools.action = { elapsed: 0, duration: 1, hit: false, aim: p };
    s.damage(pools, 1);
    assert(pools.action, 'poise keeps the next attack');
    h.session.dispose();
  }

  // Boss phases: summons and new attacks at the health thresholds, once each.
  {
    const { h, s, p } = await quiet();
    const boss = s.spawn('crpt', true, { x: p.x + 400, y: p.y });
    const count = () => s.state.enemies.length;
    const start = count();
    boss.hp = boss.max * 0.6;
    s.update(0.01);
    assert(boss.phaseShots, 'second phase adds a ring of shots');
    assert(count() > start, 'second phase summons');
    const afterOne = count();
    s.update(0.01);
    assert.equal(count(), afterOne, 'a phase fires once');
    boss.hp = boss.max * 0.2;
    s.update(0.01);
    assert(boss.phaseMortar && boss.phaseEnrage, 'third phase adds mortar and tempo');
    h.session.dispose();
  }

  console.log(
    'PASS: full roster in every stage, roles, shares, strength ramp, dash, pack, heal, aura, blast, enrage, slow, patterns, mortar, bug mechanics, poise and boss phases',
  );
});
