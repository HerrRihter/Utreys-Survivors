import assert from 'node:assert/strict';
import { createFixedStep, STEP, MAX_STEPS } from '../src/core/game-loop.js';
import { createHarness } from './helpers/game-harness.js';
import { toGraphJson } from '../src/core/graph-json.js';
import { persistentKeys } from '../src/systems/run-model.js';
import { test } from 'vitest';

// The simulation steps 1/60 s whatever the frame rate; a stalled frame runs at most five steps.
test('fixed-step', async () => {
  assert.equal(STEP, 1 / 60);
  assert.equal(MAX_STEPS, 5);
  const count = (hz, seconds) => {
    const clock = createFixedStep();
    let steps = 0;
    for (let i = 0; i < Math.round(seconds * hz); i++) steps += clock.advance(1 / hz);
    return steps;
  };
  for (const hz of [30, 60, 75, 120, 144, 240]) assert.equal(count(hz, 10), 600, hz + ' Hz');
  // Display jitter around 60 Hz still gives one step a frame on average.
  const jitter = createFixedStep();
  let steps = 0;
  for (let i = 0; i < 600; i++) steps += jitter.advance(i % 2 ? 0.0166 : 0.01673);
  assert(Math.abs(steps - 600) <= 1, 'jitter ' + steps);
  // A stalled frame runs five steps and drops the rest; reset forgets the time away.
  const stall = createFixedStep();
  assert.equal(stall.advance(2), MAX_STEPS);
  assert.equal(stall.advance(1 / 60), 1, 'the dropped time is not caught up');
  stall.advance(0.01);
  stall.reset();
  assert.equal(stall.advance(0.01), 0);

  // The same run at different frame rates through the session's frame loop.
  async function play(hz) {
    const h = await createHarness({ createSession: false });
    const game = h.createSession();
    game.views.run().nextSeed = 2024;
    game.start();
    // No level-ups: a frame that opens one leaves its remaining steps unplayed.
    game.state.need = 1e9;
    game.run();
    const run = game.views.run();
    const frames = Math.round(20 * hz);
    for (let i = 0; i <= frames; i++) {
      // Input changes each second of play (60 steps), never inside a 30 Hz frame's two steps.
      const second = Math.floor(Math.round(game.state.t * 60) / 60);
      run.stick = { x: Math.cos(second), y: Math.sin(second * 0.7) };
      game.state.p.hp = game.state.p.max;
      h.tick((i * 1000) / hz);
    }
    const s = game.state;
    const fields = toGraphJson(Object.fromEntries(persistentKeys.map((k) => [k, s[k]])));
    delete fields.runId;
    game.dispose();
    return { t: s.t, enemies: s.enemies.length, text: JSON.stringify(fields) + s.rng.getState() };
  }
  const at60 = await play(60);
  assert(Math.abs(at60.t - 20) < 0.1, 'twenty seconds of play: ' + at60.t);
  assert(at60.enemies > 0, 'enemies arrived');
  for (const hz of [30, 120]) {
    const other = await play(hz);
    assert.equal(other.t.toFixed(6), at60.t.toFixed(6), hz + ' Hz plays the same time');
    assert.equal(other.text, at60.text, hz + ' Hz gives the same run');
  }
  console.log(
    'PASS: fixed 1/60 s steps at any frame rate, stalled frames capped, same run at 30/60/120 Hz',
  );
});
