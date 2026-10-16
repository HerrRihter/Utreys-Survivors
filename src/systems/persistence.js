import { heroUnlockPrices, permanentUpgrades } from '../../data/upgrades.js';
import { achievementDefinitions } from '../../data/achievements.js';
import { maxLoad } from '../../data/difficulty.js';
// Saved meta-progression (codes, heroes, upgrades, achievements). Nothing runs at import:
// the session creates one per mount with its storage and page-lifecycle event targets.
/**
 * @param {{
 *   storage: { getItem(key: string): string | null, setItem(key: string, value: string): void },
 *   events?: any,
 *   document?: any,
 * }} options
 */
export function createProgression({
  storage,
  events = globalThis,
  document = globalThis.document,
} = {}) {
  const key = 'utreys-progression-v1',
    prices = heroUnlockPrices,
    upgrades = permanentUpgrades;
  let data = {
      codes: 0,
      kills: 0,
      unlocked: ['utrace'],
      levels: { health: 0, power: 0, speed: 0 },
      stats: { totalTime: 0, maxTime: 0, bossKills: 0, abilitiesUsed: 0, maxLevel: 0 },
      claimedAchievements: [],
      // Highest load level won per hero, and production records per hero and level.
      loads: {},
      production: {},
    },
    persistent = true;
  for (const id of Object.keys(upgrades)) data.levels[id] = 0;
  const integer = (v, max = 1e9) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : 0);
  try {
    const saved = JSON.parse(storage.getItem(key));
    if (saved && typeof saved === 'object') {
      data.codes = integer(saved.codes ?? saved.helmets ?? 0);
      data.kills = integer(saved.kills);
      if (Array.isArray(saved.unlocked))
        data.unlocked = [
          ...new Set(['utrace', ...saved.unlocked.filter((id) => Object.hasOwn(prices, id))]),
        ];
      for (const id of Object.keys(upgrades))
        data.levels[id] = integer(saved.levels?.[id], upgrades[id].max);
      if (saved.stats && typeof saved.stats === 'object') {
        data.stats.totalTime =
          typeof saved.stats.totalTime === 'number' && saved.stats.totalTime >= 0
            ? saved.stats.totalTime
            : 0;
        data.stats.maxTime =
          typeof saved.stats.maxTime === 'number' && saved.stats.maxTime >= 0
            ? saved.stats.maxTime
            : 0;
        data.stats.bossKills = integer(saved.stats.bossKills);
        data.stats.abilitiesUsed = integer(saved.stats.abilitiesUsed);
        data.stats.maxLevel = integer(saved.stats.maxLevel);
      }
      if (saved.loads && typeof saved.loads === 'object')
        for (const [hero, level] of Object.entries(saved.loads))
          if (integer(level, maxLoad) > 0) data.loads[hero] = integer(level, maxLoad);
      if (saved.production && typeof saved.production === 'object')
        for (const [hero, levels] of Object.entries(saved.production)) {
          if (!levels || typeof levels !== 'object') continue;
          for (const [level, record] of Object.entries(levels)) {
            const time = typeof record?.time === 'number' && record.time > 0 ? record.time : 0;
            if (!time || !(integer(Number(level), maxLoad) > 0)) continue;
            (data.production[hero] ||= {})[level] = { time, kills: integer(record.kills) };
          }
        }
      if (Array.isArray(saved.claimedAchievements))
        data.claimedAchievements = [
          ...new Set(
            saved.claimedAchievements
              .map((id) => (id === 'helmets_100' ? 'codes_100' : id))
              .filter((id) => achievementDefinitions.some((a) => a.id === id)),
          ),
        ];
    }
  } catch {}
  let dirty = false,
    pending = null,
    idle = null;
  function flush() {
    if (pending !== null) {
      clearTimeout(pending);
      pending = null;
    }
    if (idle !== null) {
      globalThis.cancelIdleCallback?.(idle);
      idle = null;
    }
    if (!dirty) return;
    try {
      storage.setItem(key, JSON.stringify(data));
      persistent = true;
      dirty = false;
    } catch {
      persistent = false;
    }
  }
  function save() {
    dirty = true;
    flush();
  }
  // Combat only updates memory. Coalesce rewards into one write outside the
  // simulation, preferably when the browser has idle time between frames.
  function deferSave() {
    dirty = true;
    if (pending !== null || idle !== null) return;
    if (typeof setTimeout !== 'function') {
      flush();
      return;
    }
    pending = setTimeout(() => {
      pending = null;
      if (globalThis.requestIdleCallback)
        idle = globalThis.requestIdleCallback(
          () => {
            idle = null;
            flush();
          },
          { timeout: 2000 },
        );
      else flush();
    }, 1000);
  }
  const onVisibility = () => {
    if (document?.hidden) flush();
  };
  events?.addEventListener?.('pagehide', flush);
  document?.addEventListener?.('visibilitychange', onVisibility);
  // Saves anything pending and releases the page listeners.
  function dispose() {
    flush();
    events?.removeEventListener?.('pagehide', flush);
    document?.removeEventListener?.('visibilitychange', onVisibility);
  }
  function earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    data.codes += amount;
    deferSave();
    return amount;
  }
  function kill() {
    data.kills++;
    const reward = data.kills % 10 === 0 ? 1 : 0;
    data.codes += reward;
    deferSave();
    return reward;
  }
  const owned = (id) => data.unlocked.includes(id);
  const cost = (id) =>
    Object.hasOwn(upgrades, id)
      ? (upgrades[id].hero ? 50 : 30) * (data.levels[id] + 1)
      : prices[id];
  function buyHero(id) {
    if (!Object.hasOwn(prices, id) || owned(id) || data.codes < prices[id]) return false;
    data.codes -= prices[id];
    data.unlocked.push(id);
    save();
    return true;
  }
  function buyUpgrade(id) {
    if (
      !Object.hasOwn(upgrades, id) ||
      (upgrades[id].hero && !owned(upgrades[id].hero)) ||
      data.levels[id] >= upgrades[id].max ||
      data.codes < cost(id)
    )
      return false;
    data.codes -= cost(id);
    data.levels[id]++;
    save();
    return true;
  }
  // `counted` is the part of `t` already added to the total (a run continued in production).
  function recordTime(t, counted = 0) {
    if (typeof t === 'number' && t > 0) {
      data.stats.totalTime += Math.max(0, t - counted);
      data.stats.maxTime = Math.max(data.stats.maxTime, t);
      deferSave();
    }
  }
  function recordBossKill() {
    data.stats.bossKills++;
    deferSave();
  }
  function recordAbility() {
    data.stats.abilitiesUsed++;
    deferSave();
  }
  function recordLevel(lvl) {
    if (typeof lvl === 'number' && lvl > 0) {
      data.stats.maxLevel = Math.max(data.stats.maxLevel, lvl);
      deferSave();
    }
  }
  const loadCleared = (hero) => data.loads[hero] || 0;
  // Highest level this hero may start: one above the best win.
  const loadAvailable = (hero) => Math.min(maxLoad, loadCleared(hero) + 1);
  function recordLoadWin(hero, level) {
    if (!Number.isSafeInteger(level) || level < 1 || level > maxLoad) return false;
    if (level <= loadCleared(hero)) return false;
    data.loads[hero] = level;
    save();
    return true;
  }
  const productionRecord = (hero, level) => data.production[hero]?.[level] || null;
  // Keeps the longer production time and the larger kill count separately.
  function recordProduction(hero, level, time, kills) {
    if (!(time > 0)) return { time: false, kills: false };
    const old = productionRecord(hero, level) || { time: 0, kills: 0 };
    const better = { time: time > old.time, kills: kills > old.kills };
    if (better.time || better.kills) {
      (data.production[hero] ||= {})[level] = {
        time: Math.max(old.time, time),
        kills: Math.max(old.kills, kills),
      };
      save();
    }
    return better;
  }
  function claimAchievement(id, best) {
    const a = achievementDefinitions.find((x) => x.id === id);
    if (!a || data.claimedAchievements.includes(id)) return false;
    const progress = a.getProgress(data, best);
    if (progress < a.target) return false;
    data.claimedAchievements.push(id);
    if (a.reward) data.codes += a.reward;
    save();
    return true;
  }
  const isClaimed = (id) => data.claimedAchievements.includes(id);
  return {
    dispose,
    prices,
    upgrades,
    owned,
    cost,
    buyHero,
    buyUpgrade,
    earn,
    kill,
    flush,
    recordTime,
    recordBossKill,
    recordAbility,
    recordLevel,
    loadCleared,
    loadAvailable,
    recordLoadWin,
    productionRecord,
    recordProduction,
    claimAchievement,
    isClaimed,
    get achievements() {
      return achievementDefinitions;
    },
    get codes() {
      return data.codes;
    },
    get data() {
      return JSON.parse(JSON.stringify(data));
    },
    get persistent() {
      return persistent;
    },
  };
}
