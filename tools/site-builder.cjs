'use strict';

const fs = require('node:fs');
const path = require('node:path');
const manifest = require('./publication-manifest.cjs');

function publicationFiles(inventory = manifest) {
  const files = [...inventory.pages, ...inventory.groups.flatMap(group => group.files)];
  if (new Set(files).size !== files.length) throw new Error('Duplicate publication path');
  for (const file of files) {
    if (!file || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..') ||
        path.isAbsolute(file) || file.includes(':') || file === '_site' || file.startsWith('_site/')) {
      throw new Error(`Unsafe publication path: ${file}`);
    }
  }
  return files;
}

function buildSite({root = path.resolve(__dirname, '..'), inventory = manifest} = {}) {
  root = fs.realpathSync(root);
  if(inventory===manifest){
    require('./check-structure.cjs').checkStructure({root, inventory});
    require('./check-game-contracts.cjs').checkGameContracts();
    require('./generate-layouts.cjs').generateLayouts({root,check:true});
    require('./generate-file-bundles.cjs').generateFileBundles({root,check:true});
  }
  const out = path.join(root, '_site');
  const files = publicationFiles(inventory);
  // Validate the entire inventory before replacing a previously working build.
  for (const file of files) {
    const source = path.join(root, file);
    if (!fs.existsSync(source) || !fs.statSync(source).isFile()) {
      throw new Error(`Missing publication resource: ${file}`);
    }
    const relative = path.relative(root, fs.realpathSync(source));
    if (relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
      throw new Error(`Publication resource escapes project root: ${file}`);
    }
  }
  if (fs.existsSync(out) && fs.lstatSync(out).isSymbolicLink()) {
    throw new Error('The _site output must not be a symlink or junction');
  }
  fs.rmSync(out, {recursive: true, force: true});
  fs.mkdirSync(out, {recursive: true});
  let bytes = 0;
  for (const file of files) {
    const destination = path.join(out, file);
    fs.mkdirSync(path.dirname(destination), {recursive: true});
    fs.copyFileSync(path.join(root, file), destination);
    bytes += fs.statSync(destination).size;
  }
  fs.writeFileSync(path.join(out, '.nojekyll'), '');
  return {out, files, bytes};
}

module.exports = {buildSite, publicationFiles};
