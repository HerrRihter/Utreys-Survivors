const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const { loadModule } = require('./helpers/load-modules.cjs');
const assets = require('../tools/active-assets.json');
(async () => {
  assert.equal(new Set(assets).size, assets.length);
  for (const file of assets) {
    assert(!file.includes('..'));
    assert(fs.statSync(path.resolve('assets/runtime', file)).isFile());
  }
  const requested = [];
  const env = {
    Image: class {
      set src(value) {
        requested.push(value);
      }
    },
  };
  for (const file of [
    'src/app/game-session.js',
    'src/entities/heroes.js',
    'src/entities/legion.js',
    'src/systems/corpses.js',
  ])
    await loadModule(env, path.resolve(file));
  assert.deepEqual(requested, [], 'Active engine imports must not eagerly load legacy art');
  assert(
    assets.every((file) => file.startsWith('audio/')),
    'Current Canvas art needs no raster assets',
  );
  console.log('PASS: explicit publication inventory and no eager legacy image requests');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
