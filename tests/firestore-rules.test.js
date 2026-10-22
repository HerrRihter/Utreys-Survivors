import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { mapDefinitions } from '../data/maps/maps.js';
import { heroUnlockPrices, permanentUpgrades } from '../data/upgrades.js';
import { achievementDefinitions } from '../data/achievements.js';
import { normalizeProgression } from '../src/systems/progression/normalize.js';
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

  // saveOk() lets through exactly the fields of a save, and every list and map of a full one.
  const save = rules.match(/function saveOk\(d\) \{\s*return d\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)/);
  assert.ok(save, 'firestore.rules defines saveOk()');
  assert.deepEqual(
    [...save[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort(),
    Object.keys(normalizeProgression(null)).sort(),
    'saveOk() in firestore.rules lists the fields of normalizeProgression(); redeploy the rules after changing it',
  );
  const limit = (field) => {
    const found = rules.match(
      new RegExp(String.raw`d\.get\('${field}', [^)]*\)\.size\(\) <= (\d+)`),
    );
    assert.ok(found, `saveOk() limits ${field}`);
    return Number(found[1]);
  };
  const heroes = Object.keys(heroUnlockPrices).length;
  assert.ok(
    heroes <= limit('unlocked') && heroes <= limit('loads') && heroes <= limit('production'),
  );
  assert.ok(Object.keys(permanentUpgrades).length <= limit('levels'));
  assert.ok(Object.keys(normalizeProgression(null).stats).length <= limit('stats'));
  assert.ok(achievementDefinitions.length <= limit('claimedAchievements'));

  console.log('Firestore rules contract passed.');
});
