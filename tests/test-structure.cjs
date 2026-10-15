'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {checkStructure, validateAssetPath} = require('../tools/check-structure.cjs');
const contract = require('../tools/structure-contract.json');

checkStructure();
for (const file of ['assets/runtime/lutetia/atlas-v1.png', 'assets/ui/achievements/a.png',
  'assets/audio/sfx/hit.ogg', 'assets/runtime/characters/frames/asterix/walk/0.png',
  'assets/runtime/ui/achivements/a.png', 'assets/runtime/world/../lutetia/a.png']) {
  assert.throws(() => validateAssetPath(file), /structure contract/, file);
}
assert.throws(() => validateAssetPath('assets/source/reference.png', true), /structure contract/);

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gaul-structure-'));
function write(file, text = '') {
  fs.mkdirSync(path.dirname(path.join(root, file)), {recursive: true});
  fs.writeFileSync(path.join(root, file), text);
}
const inventory = {pages: [], groups: []};
try {
  for (const dir of [...Object.keys(contract.directories), 'tools', 'tests', 'styles', 'previews']) {
    fs.mkdirSync(path.join(root, dir), {recursive: true});
  }
  for (const file of contract.referenceFiles) write(file);
  const frame = 'characters/heroes/asterix/animations/walk/0.png';
  write('assets/runtime/' + frame);
  write('data/animations/character-frames.json', JSON.stringify({characters: {asterix: {actions: {walk: [frame]}}}}));
  assert.equal(checkStructure({root, inventory}).characters, 1);
  write('assets/runtime/lutetia/atlas.png');
  assert.throws(() => checkStructure({root, inventory}), /Unexpected directory/);
  fs.unlinkSync(path.join(root, 'assets/runtime/lutetia/atlas.png'));
  fs.rmdirSync(path.join(root, 'assets/runtime/lutetia'));
  write('assets/runtime/world/lutetia/atlas.png');
  checkStructure({root, inventory});
  write('src/main.js', "const image = 'assets/runtime/lutetia/atlas.png';");
  assert.throws(() => checkStructure({root, inventory}), /Obsolete asset reference/);
  write('src/main.js');
  fs.unlinkSync(path.join(root, 'assets/runtime', frame));
  assert.throws(() => checkStructure({root, inventory}), /Missing frame/);
} finally {
  fs.rmSync(root, {recursive: true, force: true});
}
console.log('PASS: structure contract rejects misplaced assets, obsolete references, source publication and missing frames.');
