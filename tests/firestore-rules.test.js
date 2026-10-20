import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mapDefinitions } from '../data/maps/maps.js';
import { test } from 'vitest';

// firestore.rules lists the maps; the list must follow the data. The rules themselves
// are tested on the emulator by `npm run test:rules`.
test('firestore-rules', async () => {
  const rules = fs.readFileSync(path.join(import.meta.dirname, '..', 'firestore.rules'), 'utf8');

  const maps = rules.match(/function knownMaps\(\) \{\s*return \[([^\]]*)\];/);
  assert.ok(maps, 'firestore.rules defines knownMaps()');
  assert.deepEqual(
    [...maps[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(),
    Object.keys(mapDefinitions)
      .filter((id) => mapDefinitions[id].ranked !== false)
      .sort(),
    'knownMaps() in firestore.rules lists every ranked map in data/maps/maps.js; redeploy the rules after changing it',
  );

  console.log('Firestore rules contract passed.');
});
