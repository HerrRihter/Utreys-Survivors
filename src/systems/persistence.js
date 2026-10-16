import { heroUnlockPrices, permanentUpgrades } from '../../data/upgrades.js';
import { achievementDefinitions } from '../../data/achievements.js';
import { maxLoad } from '../../data/difficulty.js';
const prices = heroUnlockPrices,
  upgrades = permanentUpgrades;
const integer = (v, max = 1e9) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : 0);

// A clean copy of saved progression, from localStorage or the cloud: unknown ids are dropped,
// counters clamped and old formats migrated. Anything unreadable yields a new save.
export function normalizeProgression(saved) {
  const data = {
    codes: 0,
    kills: 0,
    unlocked: ['utrace'],
    levels: { health: 0, power: 0, speed: 0 },
    stats: {
      totalTime: 0,
      maxTime: 0,
      bossKills: 0,
      abilitiesUsed: 0,
      maxLevel: 0,
      // Mastery, recorded once per run by recordRunStats.
      wins: 0,
      heroWins: {},
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
  };
  for (const id of Object.keys(upgrades)) data.levels[id] = 0;
  try {
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
  const key = 'utreys-progression-v1';
  let data = normalizeProgression(readSaved()),
    persistent = true;
  function readSaved() {
    try {
      return JSON.parse(storage.getItem(key));
    } catch {
      return null;
    }
  }
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
  // Listeners hear about saves worth syncing elsewhere: purchases, run results ('save') and
  // the page going away ('hidden'). Combat income alone does not notify.
  const listeners = new Set();
  const notify = (reason) => {
    for (const listener of [...listeners]) listener(reason);
  };
  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function save() {
    dirty = true;
    flush();
    notify('save');
  }
  // Takes progression from elsewhere (the cloud) through the same checks as a local save.
  function replace(saved) {
    data = normalizeProgression(saved);
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
  const onHide = () => {
    flush();
    notify('hidden');
  };
  const onVisibility = () => {
    if (document?.hidden) onHide();
  };
  events?.addEventListener?.('pagehide', onHide);
  document?.addEventListener?.('visibilitychange', onVisibility);
  // Saves anything pending and releases the page listeners.
  function dispose() {
    flush();
    listeners.clear();
    events?.removeEventListener?.('pagehide', onHide);
    document?.removeEventListener?.('visibilitychange', onVisibility);
  }
  function earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    data.codes += amount;
    deferSave();
    return amount;
  }
  function kill(tag) {
    data.kills++;
    if (typeof tag === 'string' && /^[a-z_]+$/.test(tag))
      data.weaponKills[tag] = (data.weaponKills[tag] || 0) + 1;
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
  const hasWon = () => data.stats.wins > 0;
  // Why an upgrade cannot be bought yet, or '' when it can be (prices aside).
  function upgradeLock(id) {
    const u = upgrades[id];
    if (u?.hero && !owned(u.hero)) return 'hero';
    if (u?.requires === 'win' && !hasWon()) return 'win';
    return '';
  }
  function buyUpgrade(id) {
    if (
      !Object.hasOwn(upgrades, id) ||
      upgradeLock(id) ||
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
  // Codes spent on permanent upgrades: ranks 1..n cost base, 2·base, ..., n·base.
  function upgradeSpent() {
    let total = 0;
    for (const [id, level] of Object.entries(data.levels))
      if (Object.hasOwn(upgrades, id))
        total += ((upgrades[id].hero ? 50 : 30) * level * (level + 1)) / 2;
    return total;
  }
  // Returns every code spent on permanent upgrades and resets their ranks.
  function respec() {
    const refund = upgradeSpent();
    if (!refund) return 0;
    for (const id of Object.keys(data.levels)) data.levels[id] = 0;
    data.codes += refund;
    save();
    return refund;
  }
  // One run's mastery facts; called once per run when it ends.
  function recordRunStats(run) {
    const st = data.stats;
    if (run.untouched) st.untouchedRuns++;
    st.maxEvolutions = Math.max(st.maxEvolutions, integer(run.evolutions));
    if (run.win) {
      st.wins++;
      st.heroWins[run.hero] = (st.heroWins[run.hero] || 0) + 1;
      if (run.time > 0 && (!st.bestWinTime || run.time < st.bestWinTime)) st.bestWinTime = run.time;
      if (run.cleanSweep) st.cleanSweeps++;
      if (run.allWorkaround) st.workaroundWins++;
      if (run.noFood) st.noFoodWins++;
    }
    save();
  }
  const evolutionSeen = (id) => data.evolutionsSeen.includes(id);
  function recordEvolution(id) {
    if (typeof id !== 'string' || !/^[a-z_]+$/.test(id) || evolutionSeen(id)) return false;
    data.evolutionsSeen.push(id);
    deferSave();
    return true;
  }
  const achievementDone = (a, best) => a.getProgress(data, best) >= a.target;
  // Content opened by achievements; anything no achievement names is open from the start.
  function weaponUnlocked(id) {
    const gate = achievementDefinitions.find((a) => a.unlocks?.weapon === id);
    return !gate || achievementDone(gate);
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
    replace,
    onChange,
    recordTime,
    recordBossKill,
    recordAbility,
    recordLevel,
    upgradeLock,
    upgradeSpent,
    respec,
    recordRunStats,
    achievementDone,
    weaponUnlocked,
    evolutionSeen,
    recordEvolution,
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
