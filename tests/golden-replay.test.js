import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'vitest';
import {
  goldenScenarios as scenarios,
  replayContinuous,
  replaySaved,
  scenarioLabel as label,
} from './helpers/replay.js';

// A run is the same run again from its seed and the player's input: replayed twice in this
// process, in another process, and saved halfway then continued in a new session.
test('golden-replay', async () => {
  const child = promisify(execFile)(
    process.execPath,
    [path.join(import.meta.dirname, 'helpers/replay-child.js')],
    { maxBuffer: 1024 * 1024 },
  ).then(({ stdout }) => JSON.parse(stdout));
  const finals = {};
  for (const s of scenarios) {
    const half = Math.floor(s.steps / 2);
    const run = await replayContinuous(s, [half]);
    assert(run.t > s.steps / 60 - 0.01, label(s) + ' plays the whole tape: ' + run.t);
    assert(run.kills > 0, label(s) + ' the tape fights: ' + JSON.stringify(run));
    const saved = await replaySaved(s, half);
    assert.equal(saved.atSave, run.hashes[half], label(s) + ' a second replay is the same');
    assert.equal(saved.resumed, saved.atSave, label(s) + ' the saved run comes back as it was');
    assert.equal(saved.end, run.hashes[s.steps], label(s) + ' a continued run ends the same');
    finals[label(s)] = run.hashes[s.steps];
  }
  // The account's earlier kills change nothing in the run (codes for every tenth kill count
  // the run's kills): hashes every ten seconds match a fresh account's.
  {
    const s = scenarios[1],
      marks = Array.from({ length: s.steps / 600 - 1 }, (_, i) => (i + 1) * 600);
    const fresh = await replayContinuous(s, marks),
      seasoned = await replayContinuous({ ...s, accountKills: 5 }, marks);
    assert.deepEqual(seasoned.hashes, fresh.hashes, label(s) + ' does not depend on the account');
  }
  assert.deepEqual(await child, finals, 'another process replays the same runs');
});
