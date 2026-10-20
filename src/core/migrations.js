// Conversions of saves left by older builds. Each says when it can go: after that date every
// player who still has the old format has had months to open the game once.

// The run snapshot's own format chain (utreys-run-v1…v3 → v4) stays with the snapshot in
// src/systems/run-snapshot.js, and old card ids in the run journal with src/systems/run-log.js.

// Progression saves from when codes were helmets (already in the build of 2026-10-15, the
// start of this repository): `helmets` held the codes and the achievement codes_100 was
// helmets_100. Remove after 2027-04-20.
export function migrateProgressionNames(saved) {
  if (!saved || typeof saved !== 'object') return saved;
  const { helmets, ...current } = saved;
  current.codes = saved.codes ?? helmets;
  if (Array.isArray(current.claimedAchievements))
    current.claimedAchievements = current.claimedAchievements.map((id) =>
      id === 'helmets_100' ? 'codes_100' : id,
    );
  return current;
}

// The audio mix under the name of the game this one grew from (also in the 2026-10-15
// build); read once into 'utreys-audio'. Remove after 2027-04-20.
export const LEGACY_AUDIO_KEYS = ['gaul-audio'];

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
