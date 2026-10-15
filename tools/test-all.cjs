'use strict';

const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const tests = ['test-audio.cjs', 'test.cjs', 'test-expansion.cjs', 'test-lutetia.cjs', 'test-city-population.cjs', 'test-expansion-art.cjs', 'test-animation.cjs', 'test-progression.cjs',
  'test-upgrades.cjs', 'test-abilities.cjs', 'test-frame-work.cjs', 'test-projectile-art.cjs', 'test-unit-art.cjs',
  'test-villager-art.cjs', 'test-hero-art.cjs', 'test-menu-portraits.cjs', 'test-village-collision.cjs',
  'test-session.cjs', 'test-rendering.cjs', 'test-character-frames.cjs', 'test-character-preview.cjs', 'test-file-launch.cjs', 'test-site.cjs'];
let failed = 0;
tests.unshift('test-structure.cjs');
require('./check-structure.cjs').checkStructure({root});
require('./check-game-contracts.cjs').checkGameContracts();
tests.unshift('test-wave-contract.cjs');
tests.unshift('test-malosinus.cjs');
const generated=spawnSync(process.execPath,[path.join(root,'tools/generate-layouts.cjs'),'--check'],{cwd:root,stdio:'inherit'});
if(generated.error||generated.status!==0)process.exit(1);
const bundles=spawnSync(process.execPath,[path.join(root,'tools/generate-file-bundles.cjs'),'--check'],{cwd:root,stdio:'inherit'});
if(bundles.error||bundles.status!==0)process.exit(1);
for (const test of tests) {
  console.log(`\nRunning ${test}`);
  const result = spawnSync(process.execPath, ['--experimental-vm-modules',path.join(root, 'tests', test)], {cwd: root, stdio: 'inherit'});
  if (result.error || result.status !== 0) {
    failed++;
    console.error(`FAIL: ${test}: ${result.error?.message || result.signal || result.status}`);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} test suites passed.`);
process.exitCode = failed ? 1 : 0;
