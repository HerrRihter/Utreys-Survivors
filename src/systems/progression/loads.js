import { maxLoad } from '../../../data/difficulty.js';

// Load levels opened per hero and the production records per hero and level.
export function createLoads(store) {
  const loadCleared = (hero) => store.data.loads[hero] || 0;
  // Highest level this hero may start: one above the best win.
  const loadAvailable = (hero) => Math.min(maxLoad, loadCleared(hero) + 1);
  function recordLoadWin(hero, level) {
    if (!Number.isSafeInteger(level) || level < 1 || level > maxLoad) return false;
    if (level <= loadCleared(hero)) return false;
    store.data.loads[hero] = level;
    store.save();
    return true;
  }
  const productionRecord = (hero, level) => store.data.production[hero]?.[level] || null;
  // Keeps the longer production time and the larger kill count separately.
  function recordProduction(hero, level, time, kills) {
    if (!(time > 0)) return { time: false, kills: false };
    const old = productionRecord(hero, level) || { time: 0, kills: 0 };
    const better = { time: time > old.time, kills: kills > old.kills };
    if (better.time || better.kills) {
      (store.data.production[hero] ||= {})[level] = {
        time: Math.max(old.time, time),
        kills: Math.max(old.kills, kills),
      };
      store.save();
    }
    return better;
  }
  return { loadCleared, loadAvailable, recordLoadWin, productionRecord, recordProduction };
}
