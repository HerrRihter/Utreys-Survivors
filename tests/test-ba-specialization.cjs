const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { baClientIds, baHealthPerKill } = require('../data/characters/ba-specialization.js');
const { unitDefinitions } = require('../data/enemies/units.js');

(async () => {
  for (const id of baClientIds) {
    assert(unitDefinitions[id] && !unitDefinitions[id].boss && !unitDefinitions[id].miniboss);
  }
  assert(!baClientIds.includes('vetis') && !baClientIds.includes('l3'));
  const h = await createHarness();
  h.env.Progression.earn(120);
  h.env.Progression.buyHero('ba');
  h.session.select('ba');
  h.session.commands.chooseBaClient('multon');
  h.session.start();
  const s = h.session.state;
  assert.equal(s.baSpecialization.client, 'multon');
  const initialMax = s.p.max;
  s.p.hp -= 20;
  const spawn = (id) => h.session.spawn(id, false, { x: s.p.x + 60, y: s.p.y });
  const target = spawn('multon');
  h.session.damage(target, 1);
  assert.equal(s.p.max, initialMax, 'nonlethal hit grants nothing');
  h.session.damage(target, 10000);
  assert.equal(s.p.max, initialMax + baHealthPerKill);
  assert.equal(s.p.hp, initialMax - 20 + baHealthPerKill);
  h.session.damage(target, 10000);
  h.session.damage(spawn('pepsi'), 10000);
  h.session.damage(spawn('l3'), 10000);
  assert.equal(
    s.baSpecialization.bonus,
    baHealthPerKill,
    'dead and unrelated targets grant nothing',
  );
  s.p.hp = s.p.max;
  h.session.damage(spawn('multon'), 10000);
  assert.equal(s.p.hp, s.p.max, 'full health grows with maximum');
  assert.equal(s.baSpecialization.bonus, 2 * baHealthPerKill);
  h.session.update(0);
  assert.match(h.session.views.hud().weapon, /Мултон.*\+2 HP/);
  h.session.start();
  assert.equal(h.session.state.p.max, initialMax, 'bonus resets each run');
  assert.equal(h.session.state.baSpecialization.bonus, 0);
  h.session.commands.chooseBaClient('crpt');
  h.session.start();
  assert.equal(h.session.state.baSpecialization.client, 'pepsi', 'invalid selection falls back');
  h.session.select('utrace');
  h.session.start();
  assert.equal(h.session.state.baSpecialization, undefined);
  h.session.dispose();
  console.log('PASS: BA client selection, kill-only health, deduplication and per-run reset');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
