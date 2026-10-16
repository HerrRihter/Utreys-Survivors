const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { mapDefinitions } = require('../data/maps/maps.js');

// firestore.rules lists the maps; the list must follow the data. The rules themselves
// are tested on the emulator by `npm run test:rules`.
const rules = fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8');

const maps = rules.match(/function knownMaps\(\) \{\s*return \[([^\]]*)\];/);
assert.ok(maps, 'firestore.rules defines knownMaps()');
assert.deepEqual(
  [...maps[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(),
  Object.keys(mapDefinitions).sort(),
  'knownMaps() in firestore.rules lists every map in data/maps/maps.js; redeploy the rules after changing it',
);

console.log('Firestore rules contract passed.');
