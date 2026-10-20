import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, vi } from 'vitest';
import assets from '../tools/active-assets.json' with { type: 'json' };

// The published runtime assets are listed one by one, and importing the engine requests no
// image: the art is drawn on Canvas.
test('site', async () => {
  assert.equal(new Set(assets).size, assets.length);
  for (const file of assets) {
    assert(!file.includes('..'));
    assert(fs.statSync(path.resolve(import.meta.dirname, '../assets/runtime', file)).isFile());
  }
  const requested = [];
  vi.stubGlobal(
    'Image',
    class {
      set src(value) {
        requested.push(value);
      }
    },
  );
  vi.resetModules();
  await import('../src/app/game-session.js');
  await import('../src/rendering/enemies.js');
  await import('../src/rendering/corpses.js');
  await import('../src/systems/corpses.js');
  vi.unstubAllGlobals();
  assert.deepEqual(requested, [], 'Active engine imports must not eagerly load legacy art');
  assert(
    assets.every((file) => file.startsWith('audio/')),
    'Current Canvas art needs no raster assets',
  );
});
