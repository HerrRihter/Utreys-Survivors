const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { checkStructure, validateAssetPath } = require('../tools/check-structure.cjs');
const contract = require('../tools/structure-contract.json');
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
  for (const file of contract.referenceFiles) write(file);
  const inventory = { pages: [], groups: [{ files: ['assets/runtime/audio/sfx/hit.ogg'] }] };
  assert.throws(() => checkStructure({ root, inventory }), /Missing publication resource/);
  write('assets/runtime/audio/sfx/hit.ogg');
  assert.equal(checkStructure({ root, inventory }).published, 1);
  write('src/main.js', "const path='assets/audio/invalid.ogg';");
  assert.throws(() => checkStructure({ root, inventory }), /Obsolete asset reference/);
  write('src/main.js', 'export const Legion = {};');
  assert.throws(() => checkStructure({ root, inventory }), /Obsolete identifier/);
  write('src/main.js');
  write('src/leak.png');
  assert.throws(() => checkStructure({ root, inventory }), /Media outside assets/);
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
console.log('PASS: publication inventory, unsafe paths, obsolete references and media placement');
