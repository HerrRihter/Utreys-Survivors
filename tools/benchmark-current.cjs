// Repeatable CPU baseline for the current simulation, not a browser FPS claim.
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('../tests/helpers/game-harness.cjs');

(async () => {
  const h = await createHarness();
  let seed = 123456;
  h.env.Math.random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const game = h.session;
  const samples = [];
  let maxEnemies = 0;
  game.start();
  for (let frame = 0; frame < 18000 && game.mode !== 'end'; frame++) {
    if (game.mode === 'level') game.pickUpgrade(0);
    // Keep the stationary player alive to exercise the late-wave workload.
    game.state.p.hp = game.state.p.max;
    game.state.p.inv = 1;
    const start = performance.now();
    game.update(1 / 60);
    samples.push(performance.now() - start);
    maxEnemies = Math.max(maxEnemies, game.state.enemies.length);
  }
  samples.sort((a, b) => a - b);
  const result = {
    scenario:
      '300 simulation seconds; seed=123456; stationary invulnerable player; first upgrade chosen; no Canvas rendering',
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTree: 'uncommitted audit remediation',
    steps: samples.length,
    simulatedSeconds: game.state.t,
    maxEnemies,
    milliseconds: {
      median: samples[Math.floor(samples.length * 0.5)],
      p95: samples[Math.floor(samples.length * 0.95)],
      p99: samples[Math.floor(samples.length * 0.99)],
      maximum: samples.at(-1),
    },
  };
  game.dispose();
  const output = path.resolve(__dirname, '../docs/benchmarks/current-simulation.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
