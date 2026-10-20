import { addRunToStats, normalizeRunEntry } from '../run-records.js';
import { integer } from './normalize.js';

// What runs leave behind: play time, levels, boss kills, abilities, mastery facts, the
// statistics of «Моя статистика» and the evolutions ever assembled.
export function createRecords(store) {
  // `counted` is the part of `t` already added to the total (a run continued in production).
  function recordTime(t, counted = 0) {
    if (typeof t === 'number' && t > 0) {
      const stats = store.data.stats;
      stats.totalTime += Math.max(0, t - counted);
      stats.maxTime = Math.max(stats.maxTime, t);
      store.deferSave();
    }
  }
  function recordBossKill() {
    store.data.stats.bossKills++;
    store.deferSave();
  }
  function recordAbility() {
    store.data.stats.abilitiesUsed++;
    store.deferSave();
  }
  function recordLevel(lvl) {
    if (typeof lvl === 'number' && lvl > 0) {
      store.data.stats.maxLevel = Math.max(store.data.stats.maxLevel, lvl);
      store.deferSave();
    }
  }
  // One run's mastery facts; called once per run when it ends.
  function recordRunStats(run) {
    const st = store.data.stats;
    if (run.untouched) st.untouchedRuns++;
    st.maxEvolutions = Math.max(st.maxEvolutions, integer(run.evolutions));
    if (run.win) {
      st.wins++;
      st.heroWins[run.hero] = (st.heroWins[run.hero] || 0) + 1;
      if (run.map) st.mapWins[run.map] = (st.mapWins[run.map] || 0) + 1;
      if (run.time > 0 && (!st.bestWinTime || run.time < st.bestWinTime)) st.bestWinTime = run.time;
      if (run.cleanSweep) st.cleanSweeps++;
      if (run.allWorkaround) st.workaroundWins++;
      if (run.noFood) st.noFoodWins++;
    }
    store.save();
  }
  // A run ending for the statistics; returns the records it improved, or null when the
  // ending does not count (too short, nothing new since the last ending of this run).
  function recordRunResult(entry) {
    const clean = normalizeRunEntry(entry);
    if (!clean) return null;
    const { stats, improved } = addRunToStats(store.data.runStats, clean);
    store.data.runStats = stats;
    store.save();
    store.notify('run', clean);
    return improved;
  }
  const evolutionSeen = (id) => store.data.evolutionsSeen.includes(id);
  function recordEvolution(id) {
    if (typeof id !== 'string' || !/^[a-z_]+$/.test(id) || evolutionSeen(id)) return false;
    store.data.evolutionsSeen.push(id);
    store.deferSave();
    return true;
  }
  return {
    recordTime,
    recordBossKill,
    recordAbility,
    recordLevel,
    recordRunStats,
    recordRunResult,
    evolutionSeen,
    recordEvolution,
  };
}
