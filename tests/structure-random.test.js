import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkNoGlobalRandom } from '../tools/check-structure.cjs';
import { test } from 'vitest';

// The real systems and world draw only from the run's seed.
test('structure-random', async () => {
  assert(checkNoGlobalRandom().files > 0);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utrace-random-'));
  const write = (file, text = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const violation = (pattern) => assert.throws(() => checkNoGlobalRandom({ root }), pattern);
  try {
    // The run's random source, prose about Math.random and randomness outside the simulation pass.
    write(
      'src/systems/combat.js',
      [
        '// Never Math.random() here: drops draw from s.rng.',
        '/* Date.now() would make a replay differ */',
        'export const roll = (s) => s.rng.random() < 0.5 && s.rng.rand(0, Math.PI);',
      ].join('\n'),
    );
    write('src/world/arenas.js', 'export const size = 2200;');
    write('src/rendering/fx.js', 'export const jitter = () => Math.random();');
    write('src/app/game-flow.js', 'export const runId = () => Date.now() + Math.random();');
    assert.equal(checkNoGlobalRandom({ root }).files, 2, 'only systems and world are checked');

    // Each global is caught with its file and line; spacing does not hide it.
    for (const [code, name] of [
      ['Math.random()', 'Math.random'],
      ['Math . random()', 'Math.random'],
      ['Date.now()', 'Date.now'],
      ['performance.now()', 'performance.now'],
    ]) {
      write('src/systems/corpses.js', `export const x = 1;\nexport const t = () => ${code};`);
      violation(new RegExp(`src/systems/corpses\\.js:2 uses ${name.replace('.', '\\.')}`));
    }
    write('src/systems/corpses.js');

    // A sublayer and the world are covered too.
    write('src/systems/weapons/zone.js', 'export const a = Math.random() * 2;');
    violation(/src\/systems\/weapons\/zone\.js:1 uses Math\.random/);
    write('src/systems/weapons/zone.js');
    write('src/world/navigation.js', 'export const stamp = () => performance.now();');
    violation(/src\/world\/navigation\.js:1 uses performance\.now/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log(
    'PASS: no global random source or wall clock in systems and world, and one is caught',
  );
});
