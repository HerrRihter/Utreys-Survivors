import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkNoCanvas } from '../tools/check-structure.cjs';
import { test } from 'vitest';

// The real systems and world draw nothing.
test('structure-canvas', async () => {
  assert(checkNoCanvas().files > 0);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utrace-canvas-'));
  const write = (file, text = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  const violation = (pattern) => assert.throws(() => checkNoCanvas({ root }), pattern);
  try {
    // State changes, prose about drawing and drawing in rendering pass.
    write(
      'src/systems/weapons.js',
      [
        '// rendering/weapons.js calls g.arc(x, y, r) and g.fillRect(...) for these.',
        '/* g.drawImage(frame, 0, 0) */',
        'export const fire = (s) => s.fx.push({ kind: "arc", r: Math.atan2(1, 2) });',
      ].join('\n'),
    );
    write('src/world/collision.js', 'export const outlines = [];');
    write(
      'src/rendering/weapons.js',
      'export const draw = (g) => { g.beginPath(); g.arc(0, 0, 1); };',
    );
    assert.equal(checkNoCanvas({ root }).files, 2, 'only systems and world are checked');

    // Each listed call is caught, with its file and line.
    for (const call of [
      'getContext',
      'fillRect',
      'strokeRect',
      'beginPath',
      'arc',
      'drawImage',
      'fillText',
    ]) {
      write(
        'src/systems/corpses.js',
        `export const x = 1;\nexport const draw = (g) => g.${call}(0);`,
      );
      violation(new RegExp(`src/systems/corpses\\.js:2 calls ${call}\\(\\)`));
    }
    write('src/systems/corpses.js');

    // A sublayer and the world are covered too; spacing does not hide a call.
    write('src/systems/queries/orbit.js', 'export const draw = (g) => g\n  .arc (0, 0, 1);');
    violation(/src\/systems\/queries\/orbit\.js:2 calls arc\(\)/);
    write('src/systems/queries/orbit.js');
    write('src/world/collision.js', 'export function draw(g) { g.beginPath(); }');
    violation(/src\/world\/collision\.js:1 calls beginPath\(\)/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('PASS: no Canvas calls in systems and world, and a call there is caught');
});
