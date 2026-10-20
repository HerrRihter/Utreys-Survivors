import { heroUnlockPrices, permanentUpgrades, starterHeroes } from '../../../data/upgrades.js';
import { achievementDefinitions } from '../../../data/achievements.js';
import { maxLoad } from '../../../data/difficulty.js';
import { normalizeRunStats } from '../run-records.js';
const prices = heroUnlockPrices,
  upgrades = permanentUpgrades;
// A whole count in 0..max; anything else is 0.
export const integer = (v, max = 1e9) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : 0);

// A clean copy of saved progression, from localStorage or the cloud: unknown ids are dropped,
// counters clamped and old formats migrated. Anything unreadable yields a new save.
export function normalizeProgression(saved) {
  const data = {
    codes: 0,
    kills: 0,
    unlocked: [...starterHeroes],
    levels: { health: 0, power: 0, speed: 0 },
    stats: {
      totalTime: 0,
      maxTime: 0,
      // Most enemies defeated in one run (the results screen marks a new record).
      maxKills: 0,
      bossKills: 0,
      abilitiesUsed: 0,
      maxLevel: 0,
      // Mastery, recorded once per run by recordRunStats.
      wins: 0,
      heroWins: {},
      // Victories per map, for map unlocks.
      mapWins: {},
      bestWinTime: 0,
      untouchedRuns: 0,
      cleanSweeps: 0,
      workaroundWins: 0,
      noFoodWins: 0,
      maxEvolutions: 0,
    },
    // Kills per damage source (hero attack, ability or weapon id).
    weaponKills: {},
    // Evolutions ever assembled: weapon ids and 'hero_<id>' for hero attacks.
    evolutionsSeen: [],
    claimedAchievements: [],
    // Highest load level won per hero, and production records per hero and level.
    loads: {},
    production: {},
    // Totals and records per map for «Моя статистика» (src/systems/run-records.js).
    runStats: normalizeRunStats(null),
  };
  for (const id of Object.keys(upgrades)) data.levels[id] = 0;
  try {
    if (saved && typeof saved === 'object') {
      data.runStats = normalizeRunStats(saved.runStats);
      data.codes = integer(saved.codes ?? saved.helmets ?? 0);
      data.kills = integer(saved.kills);
      if (Array.isArray(saved.unlocked))
        data.unlocked = [
          ...new Set([
            ...starterHeroes,
            ...saved.unlocked.filter((id) => Object.hasOwn(prices, id)),
          ]),
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
        data.stats.maxKills = integer(saved.stats.maxKills);
        data.stats.bossKills = integer(saved.stats.bossKills);
        data.stats.abilitiesUsed = integer(saved.stats.abilitiesUsed);
        data.stats.maxLevel = integer(saved.stats.maxLevel);
        for (const key of [
          'untouchedRuns',
          'cleanSweeps',
          'workaroundWins',
          'noFoodWins',
          'maxEvolutions',
        ])
          data.stats[key] = integer(saved.stats[key]);
        // Before wins were counted, every boss kill was a win.
        data.stats.wins =
          saved.stats.wins === undefined ? data.stats.bossKills : integer(saved.stats.wins);
        const best = saved.stats.bestWinTime;
        data.stats.bestWinTime = typeof best === 'number' && best > 0 ? best : 0;
        if (saved.stats.heroWins && typeof saved.stats.heroWins === 'object')
          for (const [hero, n] of Object.entries(saved.stats.heroWins))
            if (integer(n) > 0) data.stats.heroWins[hero] = integer(n);
        if (saved.stats.mapWins && typeof saved.stats.mapWins === 'object')
          for (const [map, n] of Object.entries(saved.stats.mapWins))
            if (/^[a-zA-Z]+$/.test(map) && integer(n) > 0) data.stats.mapWins[map] = integer(n);
      }
      if (Array.isArray(saved.evolutionsSeen))
        data.evolutionsSeen = [
          ...new Set(
            saved.evolutionsSeen.filter((id) => typeof id === 'string' && /^[a-z_]+$/.test(id)),
          ),
        ];
      if (saved.weaponKills && typeof saved.weaponKills === 'object')
        for (const [tag, n] of Object.entries(saved.weaponKills))
          if (/^[a-z_]+$/.test(tag) && integer(n) > 0) data.weaponKills[tag] = integer(n);
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
  return data;
}
