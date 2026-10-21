import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';
import { goldenScenarios, replayContinuous, scenarioLabel } from './helpers/replay.js';

test('all previous hero/map outcomes retain their pre-learning fields and RNG', async () => {
  const before = JSON.parse(
    fs.readFileSync(new URL('./fixtures/pre-learning-replay.json', import.meta.url), 'utf8'),
  );
  for (const scenario of goldenScenarios) {
    const after = await replayContinuous({ ...scenario, projection: 'pre-learning' });
    assert.equal(
      after.hashes[scenario.steps],
      before[scenarioLabel(scenario)],
      scenarioLabel(scenario),
    );
  }
});
