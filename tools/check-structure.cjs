'use strict';
const fs = require('node:fs');
const path = require('node:path');
const contract = require('./structure-contract.json');

function validateAssetPath(file, published = false) {
  if (!file.startsWith('assets/')) return;
  if (!published && file.startsWith('assets/source/')) return;
  if (!contract.runtimeAssetPatterns.some((pattern) => new RegExp(pattern).test(file))) {
    throw new Error(`Asset violates structure contract: ${file}`);
  }
}

function walk(root, directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const file = directory + '/' + entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Structure must not contain symlinks: ${file}`);
    return entry.isDirectory() ? walk(root, file) : [file];
  });
}

function checkStructure({
  root = path.resolve(__dirname, '..'),
  inventory = {
    pages: ['index.html', 'opponents-preview.html', 'arena-preview.html'],
    groups: [{ files: require('./active-assets.json').map((file) => 'assets/runtime/' + file) }],
  },
} = {}) {
  for (const [directory, allowed] of Object.entries(contract.directories)) {
    for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
      if (entry.isDirectory() && !allowed.includes(entry.name)) {
        throw new Error(`Unexpected directory: ${directory}/${entry.name}`);
      }
    }
  }
  const assets = walk(root, 'assets');
  assets.forEach((file) => validateAssetPath(file));
  for (const file of [...inventory.pages, ...inventory.groups.flatMap((group) => group.files)])
    validateAssetPath(file, true);
  for (const file of [...inventory.pages, ...inventory.groups.flatMap((group) => group.files)]) {
    if (!fs.existsSync(path.join(root, file)))
      throw new Error('Missing publication resource: ' + file);
  }
  const references = [
    ...contract.referenceFiles,
    ...contract.referenceRoots.flatMap((dir) => walk(root, dir)),
    ...walk(root, 'tools').filter(
      (file) => /\.(cjs|ps1)$/.test(file) && file !== 'tools/check-structure.cjs',
    ),
  ];
  for (const file of references.filter((file) => /\.(js|tsx?|cjs|json|html|css|ps1)$/.test(file))) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const obsolete of contract.forbiddenReferences) {
      if (source.includes(obsolete))
        throw new Error(`Obsolete asset reference in ${file}: ${obsolete}`);
    }
    // Names of the retired village game must not creep back into the engine.
    if (!file.startsWith('tools/'))
      for (const name of contract.forbiddenIdentifiers || [])
        if (new RegExp(`\\b${name}\\b`).test(source))
          throw new Error(`Obsolete identifier in ${file}: ${name}`);
  }
  for (const file of [
    ...fs.readdirSync(root),
    ...['src', 'data', 'styles', 'tools', 'tests'].flatMap((dir) => walk(root, dir)),
  ]) {
    if (/\.(png|jpe?g|webp|gif|mp3|ogg|wav)$/i.test(file))
      throw new Error(`Media outside assets: ${file}`);
  }
  return {
    assets: assets.length,
    published: inventory.groups.flatMap((group) => group.files).length,
  };
}

if (require.main === module) console.log('Structure contract OK:', checkStructure());
module.exports = { checkStructure, validateAssetPath };
