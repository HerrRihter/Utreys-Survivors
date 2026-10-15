const assert = require('node:assert/strict');
const { traceabilityCharge } = require('../src/rendering/hero-charge.js');
const { actionTiming } = require('../data/animations/action-timing.js');
const { createHarness } = require('./helpers/game-harness.cjs');

(async () => {
  const s = { t: 1, attack: 0.9, attackCycle: 0.9, p: {} };
  assert.equal(traceabilityCharge(s).charge, 0);
  s.attack = 0.45;
  assert.equal(traceabilityCharge(s).charge, 0.35);
  s.p.action = { elapsed: (0.4 * actionTiming.impactProgress) / 2, duration: 0.4, hit: false };
  assert.equal(traceabilityCharge(s).charge, 0.85);
  s.p.action.elapsed *= 2;
  assert.equal(traceabilityCharge(s).charge, 1);
  s.p.action.hit = true;
  s.p.chainImpactAt = s.t;
  assert.deepEqual(traceabilityCharge(s), { charge: 0, flash: 1 });
  const frozen = traceabilityCharge(s);
  assert.deepEqual(traceabilityCharge(s), frozen, 'rendering does not advance charge');
  s.t += 0.2;
  assert.equal(traceabilityCharge(s).flash, 0);
  assert.equal(traceabilityCharge(s, true).charge, 0);
  s.p.stun = 1;
  assert.equal(traceabilityCharge(s).charge, 0);
  s.p = {};
  s.attack = 0.225;
  s.attackCycle = 0.45;
  assert.equal(traceabilityCharge(s).charge, 0.35, 'haste uses actual cycle duration');

  const h = await createHarness();
  h.env.Progression.earn(80);
  h.env.Progression.buyHero('traceability');
  h.session.select('traceability');
  h.session.start();
  h.session.state.spawn = 9999;
  let flashed = false;
  for (let i = 0; i < 30; i++) {
    h.session.update(0.025);
    h.session.draw();
    const state = h.session.state;
    if (state.p.chainImpactAt === state.t) {
      assert(state.p.action.hit, 'flash is emitted by the actual impact');
      assert.equal(traceabilityCharge(state).flash, 1);
      flashed = true;
    }
  }
  assert(flashed, 'attack cycle produces an impact flash even with no targets');
  h.session.start();
  assert.equal(h.session.state.p.chainImpactAt, undefined, 'new run clears flash');
  h.session.dispose();
  console.log('PASS: charge timing, windup, impact flash, pause, haste and run reset');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
