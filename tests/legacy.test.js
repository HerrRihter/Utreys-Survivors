import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { test } from 'vitest';

// Suites not yet moved to vitest: each tests/test-*.cjs runs as its own Node process, as the
// former runner did, and passes when it exits cleanly (its output is shown when it fails).
const dir = import.meta.dirname;
const suites = fs.readdirSync(dir).filter((file) => /^test-.*\.cjs$/.test(file));
const run = promisify(execFile);

test.concurrent.each(suites)('%s', async (suite) => {
  await run(process.execPath, ['--experimental-vm-modules', path.join(dir, suite)], {
    cwd: path.resolve(dir, '..'),
    maxBuffer: 16 * 1024 * 1024,
  });
});
