// The golden replays' final hashes as JSON on stdout, from a process of their own:
// `node tests/helpers/replay-child.js`. tests/golden-replay.test.js compares them with its own;
// the same output from two commits shows that a change kept every run the same.
import { goldenScenarios, replayContinuous, scenarioLabel } from './replay.js';

const out = {};
for (const s of goldenScenarios)
  out[scenarioLabel(s)] = (await replayContinuous(s)).hashes[s.steps];
process.stdout.write(JSON.stringify(out));
