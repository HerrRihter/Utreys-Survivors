import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'vitest';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

// The folder layout, layers and asset rules (tools/structure-contract.json) and the game's
// content contracts, as `npm run check:structure` and `npm run check:contracts` check them.
test('structure contract', () => {
  require('../tools/check-structure.cjs').checkStructure({ root });
});

test('game contracts', () => {
  require('../tools/check-game-contracts.cjs').checkGameContracts();
});
