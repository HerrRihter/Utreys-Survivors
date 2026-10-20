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
    loads,
    ...shop,
    ...records,
    ...loads,
    earn: wallet.earn,
    kill: wallet.kill,
    achievementDone: achievements.achievementDone,
    weaponUnlocked: achievements.weaponUnlocked,
    claimAchievement: achievements.claimAchievement,
    isClaimed: achievements.isClaimed,
    flush: store.flush,
    replace: store.replace,
    onChange: store.onChange,
    dispose: store.dispose,
    get achievements() {
      return achievements.list;
    },
    get codes() {
      return store.data.codes;
    },
    get data() {
      return JSON.parse(JSON.stringify(store.data));
    },
    get persistent() {
      return store.persistent;
    },
  };
}
