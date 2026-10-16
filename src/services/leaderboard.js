// Leaderboards read from stats/{uid}: the top of one metric overall or on one map, and a
// player's place. Anyone can read them, signed in or not. Answers are cached for a minute
// so switching tabs does not spend the daily read quota.

export const TABLE_SIZE = 50;
// Places are counted exactly up to this many better players (the rules' query limit).
export const RANK_LIMIT = 1000;
const CACHE_MS = 60000;

export const statPath = (scope, field) =>
  scope === 'all' ? `all.${field}` : `maps.${scope}.${field}`;

export function createLeaderboard({ account, now = () => Date.now() }) {
  const cache = new Map();
  /**
   * @template T
   * @param {string} key
   * @param {() => Promise<T>} load
   * @returns {Promise<T>}
   */
  function cached(key, load) {
    const hit = cache.get(key);
    if (hit && now() - hit.at < CACHE_MS) return hit.value;
    const value = load();
    cache.set(key, { at: now(), value });
    value.catch(() => cache.delete(key));
    return value;
  }

  // Rows: place, uid, login and the whole scope (for the hero and load of records).
  function top(field, scope) {
    return cached(`top|${scope}|${field}`, async () => {
      const sdk = await account.firebase();
      const { collection, query, where, orderBy, limit, getDocs } = sdk.firestore;
      const path = statPath(scope, field);
      const snap = await getDocs(
        query(
          collection(sdk.db, 'stats'),
          where(path, '>', 0),
          orderBy(path, 'desc'),
          limit(TABLE_SIZE),
        ),
      );
      return snap.docs.map((doc, index) => {
        const data = doc.data();
        return {
          place: index + 1,
          uid: doc.id,
          login: String(data.login ?? ''),
          scope: (scope === 'all' ? data.all : data.maps?.[scope]) ?? {},
        };
      });
    });
  }

  // 1 + the number of players with a better value; Infinity beyond RANK_LIMIT.
  function place(field, scope, value) {
    if (!(value > 0)) return Promise.resolve(null);
    return cached(`place|${scope}|${field}|${value}`, async () => {
      const sdk = await account.firebase();
      const { collection, query, where, limit, getCount } = sdk.firestore;
      const snap = await getCount(
        query(
          collection(sdk.db, 'stats'),
          where(statPath(scope, field), '>', value),
          limit(RANK_LIMIT),
        ),
      );
      const better = snap.data().count;
      return better >= RANK_LIMIT ? Infinity : better + 1;
    });
  }

  // After the player's own statistics changed.
  const invalidate = () => cache.clear();

  return { top, place, invalidate };
}
