// Conversions of saves left by older builds. Each says when it can go: after that date every
// player who still has the old format has had months to open the game once.

// 'utreys-best' ({ time, kills } of the best finished run) lived outside the progression and
// was not synced. Since 2026-10-20 the progression keeps `stats.maxTime` and `stats.maxKills`;
// the old record is merged once and the key removed. Remove after 2027-04-20.
export const LEGACY_BEST_KEY = 'utreys-best';
export function legacyBest(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const time = typeof saved.time === 'number' && saved.time > 0 ? saved.time : 0,
    kills = Number.isSafeInteger(saved.kills) && saved.kills > 0 ? saved.kills : 0;
  return time || kills ? { time, kills } : null;
}
export function mergeLegacyBest(data, best) {
  data.stats.maxTime = Math.max(data.stats.maxTime, best.time);
  data.stats.maxKills = Math.max(data.stats.maxKills, best.kills);
}
// The save as a build before 2026-10-20 normalized it (no `stats.maxKills`), so cloud sync
// can tell a save changed only by this migration from one the player changed; null when the
// save already has the field. Remove with the merge above.
export function previousProgressionShape(saved, normalized) {
  if (!saved || typeof saved !== 'object' || Object.hasOwn(saved.stats ?? {}, 'maxKills'))
    return null;
  const previous = JSON.parse(JSON.stringify(normalized));
  delete previous.stats.maxKills;
  return previous;
}
