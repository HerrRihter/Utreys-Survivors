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

// Layer of a source file: `data`, `src` (entry files), `src/<dir>` or a declared sublayer such
// as `systems/queries`. Files outside src and data have none.
function layerOf(file, layers) {
  const parts = file.split('/');
  if (parts[0] === 'data') return 'data';
  if (parts[0] !== 'src') return null;
  if (parts.length === 2) return 'src';
  for (let depth = parts.length - 1; depth > 1; depth--) {
    const name = parts.slice(1, depth).join('/');
    if (Object.hasOwn(layers, name)) return name;
  }
  return parts[1];
}

// Relative module specifiers of every static import/export and dynamic import().
const importPattern =
  /(?:^|[^\w.$])(?:import|export)\s[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]|(?:^|[^\w.$])import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[^\w.$])import\s+['"]([^'"]+)['"]/g;
function importsOf(source) {
  const specifiers = [];
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1] || match[2] || match[3];
    if (specifier.startsWith('.')) specifiers.push(specifier);
  }
  return specifiers;
}

// A file may import its own layer (and its sublayers) and the layers its row of the matrix
// lists; listing `systems` admits `systems/queries` as well.
function importAllowed(from, to, layers) {
  if (to === from || to.startsWith(from + '/')) return true;
  return layers[from].some((allowed) => to === allowed || to.startsWith(allowed + '/'));
}

function checkLayers({ root = path.resolve(__dirname, '..'), layers = contract.layers } = {}) {
  const violations = [];
  const files = ['src', 'data']
    .filter((dir) => fs.existsSync(path.join(root, dir)))
    .flatMap((dir) => walk(root, dir))
    .filter((file) => /\.(js|jsx|ts|tsx|mjs)$/.test(file));
  for (const file of files) {
    const from = layerOf(file, layers);
    if (!Object.hasOwn(layers, from)) {
      violations.push(`${file}: layer "${from}" is missing from structure-contract.json layers`);
      continue;
    }
    for (const specifier of importsOf(fs.readFileSync(path.join(root, file), 'utf8'))) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      const to = layerOf(target, layers);
      if (to === null || importAllowed(from, to, layers)) continue;
      violations.push(
        `${file} (${from}) imports ${target} (${to}); ${from} may import only: ` +
          (layers[from].join(', ') || 'nothing outside itself'),
      );
    }
  }
  if (violations.length)
    throw new Error(
      'Layer violation (see docs/STRUCTURE-CONTRACT.md, tools/structure-contract.json):\n  ' +
        violations.join('\n  '),
    );
  return { files: files.length };
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
  // Every runtime file is published: unused media must be deleted, not left behind.
  const published = new Set(inventory.groups.flatMap((group) => group.files));
  for (const file of assets)
    if (file.startsWith('assets/runtime/') && !published.has(file))
      throw new Error('Unused runtime asset: ' + file);
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
  const { files: modules } = checkLayers({ root });
  return {
    assets: assets.length,
    modules,
    published: inventory.groups.flatMap((group) => group.files).length,
  };
}

if (require.main === module) console.log('Structure contract OK:', checkStructure());
module.exports = { checkStructure, checkLayers, validateAssetPath };
