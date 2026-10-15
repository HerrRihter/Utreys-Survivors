'use strict';
const fs = require('node:fs');
const path = require('node:path');
const contract = require('./structure-contract.json');

function validateAssetPath(file, published = false) {
  if (!file.startsWith('assets/')) return;
  if (!published && file.startsWith('assets/source/')) return;
  if (!contract.runtimeAssetPatterns.some(pattern => new RegExp(pattern).test(file))) {
    throw new Error(`Asset violates structure contract: ${file}`);
  }
}

function walk(root, directory) {
  return fs.readdirSync(path.join(root, directory), {withFileTypes: true}).flatMap(entry => {
    const file = directory + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Structure must not contain symlinks: ${file}`);
    return entry.isDirectory() ? walk(root, file) : [file];
  });
}

function checkStructure({root = path.resolve(__dirname, '..'), inventory = require('./publication-manifest.cjs')} = {}) {
  for (const [directory, allowed] of Object.entries(contract.directories)) {
    for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes: true})) {
      if (entry.isDirectory() && !allowed.includes(entry.name)) {
        throw new Error(`Unexpected directory: ${directory}/${entry.name}`);
      }
    }
  }
  const assets = walk(root, 'assets');
  assets.forEach(file => validateAssetPath(file));
  for (const file of [...inventory.pages, ...inventory.groups.flatMap(group => group.files)]) validateAssetPath(file, true);
  const frames = JSON.parse(fs.readFileSync(path.join(root, 'data/animations/character-frames.json'), 'utf8'));
  const framePattern = new RegExp(contract.framePattern);
  for (const [id, character] of Object.entries(frames.characters)) {
    const folders = new Set();
    for (const file of Object.values(character.actions).flat()) {
      const match = framePattern.exec(file);
      if (!match) throw new Error(`Invalid frame path for ${id}: ${file}`);
      folders.add(match[1] + '/' + match[2]);
      if (!fs.existsSync(path.join(root, 'assets/runtime', file))) throw new Error(`Missing frame: ${file}`);
    }
    if (folders.size !== 1) throw new Error(`Character ${id} spans multiple asset folders`);
  }
  const references = [...contract.referenceFiles, ...contract.referenceRoots.flatMap(dir => walk(root, dir)),
    ...walk(root, 'tools').filter(file => /\.(cjs|ps1)$/.test(file) && file !== 'tools/check-structure.cjs')];
  for (const file of references.filter(file => /\.(js|cjs|json|html|css|ps1)$/.test(file))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const obsolete of contract.forbiddenReferences) {
      if (source.includes(obsolete)) throw new Error(`Obsolete asset reference in ${file}: ${obsolete}`);
    }
  }
  for (const file of [...fs.readdirSync(root), ...['src', 'data', 'previews', 'runtime', 'styles', 'tools', 'tests'].flatMap(dir => walk(root, dir))]) {
    if (/\.(png|jpe?g|webp|gif|mp3|ogg|wav)$/i.test(file)) throw new Error(`Media outside assets: ${file}`);
  }
  return {assets: assets.length, characters: Object.keys(frames.characters).length};
}

if (require.main === module) console.log('Structure contract OK:', checkStructure());
module.exports = {checkStructure, validateAssetPath};
