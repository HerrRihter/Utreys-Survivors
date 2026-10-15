const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, 'assets/runtime/characters'))) {
  require('./check-structure.cjs').checkStructure({ root });
  require('./generate-layouts.cjs').generateLayouts({ root, check: true });
}
require('./check-game-contracts.cjs').checkGameContracts();
const tests = fs
  .readdirSync(path.join(root, 'tests'))
  .filter((file) => /^test.*\.cjs$/.test(file))
  .filter((file) => {
    if (!fs.existsSync(path.join(root, 'assets/runtime/characters'))) {
      if (file === 'test-character-frames.cjs' || file === 'test-structure.cjs') return false;
    }
    return true;
  })
  .sort();
let failed = 0;
for (const test of tests) {
  const result = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', path.join(root, 'tests', test)],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error || result.status !== 0) {
    failed++;
    console.error('FAIL: ' + test);
  }
}
console.log(tests.length - failed + '/' + tests.length + ' test suites passed.');
process.exitCode = failed ? 1 : 0;
