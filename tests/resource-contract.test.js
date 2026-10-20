import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkStructure, validateAssetPath } from '../tools/check-structure.cjs';
import contract from '../tools/structure-contract.json' with { type: 'json' };
import { test } from 'vitest';

test('resource-contract', async () => {
  checkStructure();
  for (const file of [
    'assets/runtime/../source/a.png',
    'assets/runtime/audio/../a.ogg',
    'assets/source/a.png',
  ])
    assert.throws(() => validateAssetPath(file, true), /structure contract/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'utrace-structure-'));
  const write = (file, text = '') => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  };
  try {
    for (const dir of [...Object.keys(contract.directories), 'tools', 'tests', 'styles'])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    const inventory = { pages: [], groups: [{ files: ['assets/runtime/audio/sfx/hit.ogg'] }] };
    assert.throws(() => checkStructure({ root, inventory }), /Missing publication resource/);
    write('assets/runtime/audio/sfx/hit.ogg');
    assert.equal(checkStructure({ root, inventory }).published, 1);
    write('src/leak.png');
    assert.throws(() => checkStructure({ root, inventory }), /Media outside assets/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('PASS: publication inventory, unsafe paths and media placement');
});
