import { learningSummary } from './learning.js';
import { currentCardId } from '../../data/characters/abilities.js';
import { persisted } from '../core/storage.js';

// Local journal of finished runs for balance work. Each ending adds one entry; the settings
// screen exports the journal as JSON for `tools/run-stats.cjs`. Only the newest `MAX_ENTRIES`
// are kept so storage stays small.
export const RUN_LOG_KEY = 'utreys-run-log-v1';
export const RUN_LOG_VERSION = 2;
export const MAX_ENTRIES = 300;

// Level-up bookkeeping on the run state: every offer, what was taken and how.
//   s.offers: [{ level, cards: [id], picked: id | null, action: 'pick' | 'skip', rerolls, banned }]
export function logOffer(s, cards) {
  s.offers.push({
    level: s.level,
    cards: cards.map((c) => c.id),
    picked: null,
    action: null,
    rerolls: 0,
    banned: [],
  });
}
// The same level-up showing new cards (reroll or ban) replaces the open offer's cards.
export function logReoffer(s, cards, change) {
  const offer = s.offers.at(-1);
  if (!offer || offer.action) return logOffer(s, cards);
  if (change.reroll) offer.rerolls++;
  if (change.banned) offer.banned.push(change.banned);
  offer.cards = cards.map((c) => c.id);
}
export function logChoice(s, picked, action) {
  const offer = s.offers.at(-1);
  if (!offer || offer.action) return;
  offer.picked = picked;
  offer.action = action;
}

// One finished run as plain data.
export function logEntry({ s, hero, win, build, date = new Date() }) {
  return {
    version: RUN_LOG_VERSION,
    learning: learningSummary(s),
    date: date.toISOString(),
    hero,
    map: s.map,
    load: s.load,
    seed: s.seed,
    win: !!win,
    endless: !!s.endless,
    time: Math.round(s.t * 10) / 10,
    productionTime: s.endless ? Math.round((s.t - s.endlessStart) * 10) / 10 : 0,
    level: s.level,
    kills: s.kills,
    cause: win ? null : s.p.hp <= 0 ? s.lastHitBy || 'unknown' : 'quit',
    nodes: s.nodes.map((n) => n.status),
    events: s.eventsDone,
    damage: Object.fromEntries(Object.entries(s.damageBy).map(([tag, n]) => [tag, Math.round(n)])),
    build: {
      weapons: build.weapons.map((w) => ({ id: w.id, level: w.level, evolved: !!w.evolved })),
      passives: build.passives.map((p) => ({ id: p.id, level: p.level })),
    },
    offers: s.offers.filter((o) => o.action),
  };
}

// An entry as the current build names things: level-up cards of renamed abilities (an older
// journal has `ability_potion`) get their current ids. Entries are not rewritten in storage.
export function normalizeLogEntry(entry) {
  if (entry?.version === 1) entry = { ...entry, version: RUN_LOG_VERSION, learning: null };
  if (!Array.isArray(entry?.offers)) return entry;
  const cards = (list) => (Array.isArray(list) ? list.map(currentCardId) : list);
  return {
    ...entry,
    offers: entry.offers.map((o) => ({
      ...o,
      cards: cards(o.cards),
      picked: currentCardId(o.picked),
      banned: cards(o.banned),
    })),
  };
}

export function createRunLog({ storage }) {
  // Settings read the count on every render; keep it without parsing the journal each time.
  let count = null;
  const file = persisted(storage, RUN_LOG_KEY, {
    normalize: (saved) => (Array.isArray(saved) ? saved.map(normalizeLogEntry) : []),
  });
  const entries = file.load;
  return {
    entries,
    count: () => (count ??= entries().length),
    record(entry) {
      const list = entries();
      list.push(entry);
      const kept = list.slice(-MAX_ENTRIES);
      if (!file.save(kept)) return false;
      count = kept.length;
      return true;
    },
    clear() {
      if (file.save([])) count = 0;
    },
    // The export file's content.
    json: () =>
      JSON.stringify(
        { format: 'utreys-run-log', version: RUN_LOG_VERSION, runs: entries() },
        null,
        2,
      ),
  };
}
