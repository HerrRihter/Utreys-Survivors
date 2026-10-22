import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createHarness } from './helpers/game-harness.js';
import { penzaRun } from '../data/difficulty.js';

// The Penza mode as a run modifier: the hero and the enemies are 30% faster and stronger,
// the flag is fixed at the run's start and saved with it, and the run stays out of records.
test('penza run', async () => {
  const h = await createHarness();
  const game = h.session,
    P = h.env.Progression;
  game.select('utrace');

  game.start();
  const plain = game.state;
  assert.equal(plain.penza, false);
  plain.spawn = 9999;
  const usual = game.spawn('l3', false, { x: plain.p.x + 300, y: plain.p.y });

  game.commands.togglePenza();
  game.start();
  const s = game.state;
  assert.equal(s.penza, true);
  assert.equal(s.stats.damage, 1 + penzaRun.hero.damage);
  assert.equal(s.stats.haste, 1 + penzaRun.hero.haste);
  assert.equal(s.stats.speed, 1 + penzaRun.hero.speed);
  assert.equal(s.healFactor, plain.healFactor * (1 + penzaRun.hero.heal));
  s.spawn = 9999;
  const fast = game.spawn('l3', false, { x: s.p.x + 300, y: s.p.y });
  assert.equal(fast.max, usual.max, 'enemy health is unchanged');
  assert(Math.abs(fast.speed - usual.speed * 1.3) < 1e-9, 'enemies 30% faster');
  assert.equal(fast.damage, Math.max(1, Math.round(usual.damage * 1.3)));

  // Switching the mode mid-run changes only looks: the run keeps its own flag.
  game.commands.togglePenza();
  assert.equal(game.state.penza, true);

  // No records, rating or best time from a Penza run; load progress still counts.
  const before = JSON.stringify(P.data.runStats);
  s.t = 400;
  s.kills = 50;
  game.finish(true);
  assert.equal(JSON.stringify(P.data.runStats), before, 'run statistics untouched');
  assert.match(game.views.run().result.text, /не идёт в рейтинг/);
  assert.equal(P.loads.loadCleared('utrace'), 1);
});
