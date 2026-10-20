const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { replayContinuous, replaySaved } = require('./helpers/replay.cjs');

// A run is the same run again from its seed and the player's input: replayed twice in this
// process, in another process, and saved halfway then continued in a new session. Five heroes
// on three maps; one full two-minute replay per hero, shorter ones for the other pairs.
const heroes = ['utrace', 'traceability', 'serialization', 'ba', 'qa'],
  maps = ['empty', 'serverRoom', 'pepsiDesk'];
const scenarios = heroes.flatMap((hero, h) =>
  maps.map((map, m) => ({
    hero,
    map,
    seed: 1000 + h * 31 + m * 7,
    steps: m === h % 3 ? 120 * 60 : 40 * 60,
  })),
);
const label = (s) => `${s.hero}@${s.map}`;

if (process.argv.includes('--child')) {
  // Another process: the continuous replays' final hashes.
  (async () => {
    const out = {};
    for (const s of scenarios) out[label(s)] = (await replayContinuous(s)).hashes[s.steps];
    process.stdout.write(JSON.stringify(out));
  })();
} else {
  (async () => {
    const child = new Promise((resolve, reject) => {
      const proc = spawn(process.execPath, ['--experimental-vm-modules', __filename, '--child'], {
        stdio: ['ignore', 'pipe', 'inherit'],
      });
      let text = '';
      proc.stdout.on('data', (chunk) => (text += chunk));
      proc.on('error', reject);
      proc.on('close', (code) =>
        code === 0 ? resolve(JSON.parse(text)) : reject(new Error('child replay failed')),
      );
    });
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
    assert.deepEqual(await child, finals, 'another process replays the same runs');
    console.log(
      `PASS: ${scenarios.length} hero/map replays repeat in and across processes and after a save`,
    );
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
