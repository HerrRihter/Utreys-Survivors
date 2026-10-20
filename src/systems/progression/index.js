import { createProgressionStore } from './store.js';
import { createWallet } from './wallet.js';
import { createShop } from './shop.js';
import { createRecords } from './records.js';
import { createAchievements } from './achievements.js';
import { createLoads } from './loads.js';
export { normalizeProgression } from './normalize.js';

// Saved meta-progression (codes, heroes, upgrades, achievements). Nothing runs at import:
// the session creates one per mount with its storage and page-lifecycle event targets.
/** @param {Parameters<typeof createProgressionStore>[0]} options */
export function createProgression(options) {
  const store = createProgressionStore(options);
  const wallet = createWallet(store),
    shop = createShop(store),
    records = createRecords(store),
    achievements = createAchievements(store),
    loads = createLoads(store);
  return {
    wallet,
    shop,
    records,
    achievements,
    loads,
    flush: store.flush,
    replace: store.replace,
    onChange: store.onChange,
    dispose: store.dispose,
    // A deep-frozen copy of the save, shared by every read until the next change.
    get data() {
      return store.snapshot();
    },
    get persistent() {
      return store.persistent;
    },
  };
}
