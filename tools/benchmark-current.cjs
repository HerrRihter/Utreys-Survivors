// Repeatable CPU baselines for the simulation, not a browser FPS claim (see benchmark-render.cjs).
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { execFileSync } = require('node:child_process');
const { createHarness } = require('../tests/helpers/game-harness.cjs');

const stressUnits = ['l3', 'pepsi', 'inbev', 'mars', 'baltika', 'multon', 'loreal', 'ferrero'];

// The run's seed fixes its waves, drops and every other random choice.
const seeded = (game, seed) => (game.views.run().nextSeed = seed);

function summarize(samples) {
  samples.sort((a, b) => a - b);
  return {
    median: samples[Math.floor(samples.length * 0.5)],
    p95: samples[Math.floor(samples.length * 0.95)],
    p99: samples[Math.floor(samples.length * 0.99)],
    maximum: samples.at(-1),
  };
}

// Natural waves: stationary invulnerable Utrace, first upgrade chosen.
async function waves() {
  const h = await createHarness();
  const game = h.session;
  seeded(game, 123456);
  const samples = [];
  let maxEnemies = 0;
  game.start();
  for (let frame = 0; frame < 18000 && game.mode !== 'end'; frame++) {
    if (game.mode === 'level') game.pickUpgrade(0);
    game.state.p.hp = game.state.p.max;
    game.state.p.inv = 1;
    const start = performance.now();
    game.update(1 / 60);
    samples.push(performance.now() - start);
    maxEnemies = Math.max(maxEnemies, game.state.enemies.length);
  }
  const result = {
    scenario: '300 s of natural waves; seed=123456; stationary invulnerable Utrace',
    steps: samples.length,
    maxEnemies,
    milliseconds: summarize(samples),
  };
  game.dispose();
  return result;
}

// Stress: 300 enemies kept around a moving chain hero; exercises chain, collision and spawning.
async function stress() {
  const h = await createHarness();
  h.env.Progression.earn(1e6);
  h.env.Progression.buyHero('traceability');
  const game = h.session;
  game.select('traceability');
  seeded(game, 424242);
  game.start();
  const samples = [];
  let k = 0;
  for (let frame = 0; frame < 3600 && game.mode !== 'end'; frame++) {
    const s = game.state;
    if (game.mode === 'level') game.pickUpgrade(0);
    s.spawn = 1e9;
    s.p.hp = s.p.max;
    s.p.inv = 1;
    while (s.enemies.length < 300) {
      const a = (k * 2.399) % (Math.PI * 2),
        r = 140 + ((k * 37) % 460);
      game.spawn(stressUnits[k++ % stressUnits.length], false, {
        x: Math.min(2100, Math.max(100, s.p.x + Math.cos(a) * r)),
        y: Math.min(2100, Math.max(120, s.p.y + Math.sin(a) * r)),
      });
    }
    game.keys.clear();
    if (Math.floor(frame / 90) % 3 === 0) game.keys.add(frame % 540 < 270 ? 'KeyD' : 'KeyA');
    const start = performance.now();
    game.update(1 / 60);
    samples.push(performance.now() - start);
  }
  const result = {
    scenario: '60 s with 300 enemies around a moving Traceability hero; seed=424242',
    steps: samples.length,
    milliseconds: summarize(samples),
  };
  game.dispose();
  return result;
}

(async () => {
  let baseCommit = 'unknown';
  try {
    baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    // Benchmarks also run from exported sources without git metadata.
  }
  const result = {
    node: process.version,
    platform: `${process.platform}/${process.arch}`,
    baseCommit,
    date: new Date().toISOString().slice(0, 10),
    waves: await waves(),
    stress: await stress(),
  };
  const output = path.resolve(__dirname, '../docs/benchmarks/current-simulation.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
