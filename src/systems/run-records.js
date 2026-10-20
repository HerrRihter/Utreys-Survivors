import { mapDefinitions } from '../../data/maps/maps.js';
import { maxLoad } from '../../data/difficulty.js';

// Run statistics for «Моя статистика» and the leaderboards: totals and records, overall and
// per map. The same scope shape is kept in the local save (runStats) and in stats/{uid};
// the limits match firestore.rules.

// Runs shorter than this are not counted: start and quit would only inflate the games.
export const MIN_COUNTED_RUN = 10;

export const statNumbers = [
  'games',
  'totalKills',
  'totalCodes',
  'bestTime',
  'bestKills',
  'bestCodes',
  'victoryScore',
  'productionTime',
];

// Hero and load next to each record, for the table row.
const recordLabels = {
  bestTime: ['bestTimeHero', 'bestTimeLoad'],
  bestKills: ['bestKillsHero', 'bestKillsLoad'],
  bestCodes: ['bestCodesHero', 'bestCodesLoad'],
  victoryScore: ['victoryHero', null],
  productionTime: ['productionHero', 'productionLoad'],
};

const limits = {
  time: 21600,
  kills: 200000,
  codes: 1000000,
  games: 1000000,
  total: 1000000000,
};

const integer = (v, max) => (Number.isSafeInteger(v) && v >= 0 ? Math.min(max, v) : 0);
const seconds = (v) =>
  typeof v === 'number' && Number.isFinite(v) && v > 0
    ? Math.min(limits.time, Math.round(v * 10) / 10)
    : 0;
const heroId = (v) => (typeof v === 'string' && /^[a-z_]{1,24}$/.test(v) ? v : '');
const loadLevel = (v) => integer(v, maxLoad);

// A victory sorts by load first, then by speed: load × 100000 − tenths of a second.
export const victoryScore = (load, time) =>
  Math.max(0, loadLevel(load) * 100000 - Math.round(seconds(time) * 10));
export const victoryFromScore = (score) => {
  const load = Math.ceil(score / 100000);
  return { load, time: (load * 100000 - score) / 10 };
};

export const emptyScope = () => Object.fromEntries(statNumbers.map((field) => [field, 0]));

// Every number present and in range; labels kept only when valid.
export function normalizeScope(saved) {
  const scope = emptyScope();
  if (!saved || typeof saved !== 'object') return scope;
  scope.games = integer(saved.games, limits.games);
  scope.totalKills = integer(saved.totalKills, limits.total);
  scope.totalCodes = integer(saved.totalCodes, limits.total);
  scope.bestTime = seconds(saved.bestTime);
  scope.bestKills = integer(saved.bestKills, limits.kills);
  scope.bestCodes = integer(saved.bestCodes, limits.codes);
  scope.victoryScore = integer(saved.victoryScore, maxLoad * 100000);
  scope.productionTime = seconds(saved.productionTime);
  for (const [hero, load] of Object.values(recordLabels)) {
    if (heroId(saved[hero])) scope[hero] = saved[hero];
    if (load && loadLevel(saved[load])) scope[load] = saved[load];
  }
  return scope;
}

export function normalizeRunStats(saved) {
  const stats = { all: normalizeScope(saved?.all), maps: {} };
  if (saved?.maps && typeof saved.maps === 'object')
    for (const [map, scope] of Object.entries(saved.maps))
      if (Object.hasOwn(mapDefinitions, map)) stats.maps[map] = normalizeScope(scope);
  return stats;
}

// One run ending as the game reports it, checked and clamped; null when it does not count.
export function normalizeRunEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  if (typeof entry.runId !== 'string' || !/^[a-z0-9-]{1,40}$/.test(entry.runId)) return null;
  if (!Object.hasOwn(mapDefinitions, entry.map) || mapDefinitions[entry.map].ranked === false)
    return null;
  const time = seconds(entry.time);
  if (time < MIN_COUNTED_RUN) return null;
  const clean = {
    runId: entry.runId,
    map: entry.map,
    hero: heroId(entry.hero),
    load: loadLevel(entry.load) || 1,
    newGame: !!entry.newGame,
    addKills: integer(entry.addKills, limits.kills),
    addCodes: integer(entry.addCodes, limits.codes),
    time,
    kills: integer(entry.kills, limits.kills),
    codes: integer(entry.codes, limits.codes),
    victory: !!entry.victory,
    production: seconds(entry.production),
  };
  if (!clean.newGame && !clean.addKills && !clean.addCodes && !clean.victory && !clean.production)
    return null;
  return clean;
}

// Adds a run to a scope. Returns the new scope and the records it improved.
export function applyRun(scope, entry) {
  const next = { ...normalizeScope(scope) },
    improved = [];
  if (entry.newGame) next.games = Math.min(limits.games, next.games + 1);
  next.totalKills = Math.min(limits.total, next.totalKills + entry.addKills);
  next.totalCodes = Math.min(limits.total, next.totalCodes + entry.addCodes);
  const record = (field, value) => {
    if (!(value > next[field])) return;
    next[field] = value;
    improved.push(field);
    const [hero, load] = recordLabels[field];
    if (entry.hero) next[hero] = entry.hero;
    if (load) next[load] = entry.load;
  };
  record('bestTime', entry.time);
  record('bestKills', entry.kills);
  record('bestCodes', entry.codes);
  if (entry.victory) record('victoryScore', victoryScore(entry.load, entry.time));
  if (entry.production) record('productionTime', entry.production);
  return { scope: next, improved };
}

// The whole statistics with one run added: overall and on the run's map.
export function addRunToStats(stats, entry) {
  const all = applyRun(stats.all, entry),
    map = applyRun(stats.maps[entry.map], entry);
  return {
    stats: { all: all.scope, maps: { ...stats.maps, [entry.map]: map.scope } },
    improved: { all: all.improved, map: map.improved },
  };
}
