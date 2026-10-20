// One localStorage key holding JSON. Every saved thing in the game goes through here, so a
// blocked, full or corrupt storage never throws into the game: a read that fails is "nothing
// saved", a write that fails returns false.
//
//   normalize(saved)   turns what was read (null when nothing) into a clean value; it must
//                      return the same value for its own output (that is what gets saved)
//   migrate(old, key)  converts a value found under one of `legacyKeys` (older names of the
//                      same data, newest first); it is written under `key` once and the old
//                      keys removed, unless that write fails
/**
 * @template T
 * @param {{ getItem(key: string): string | null, setItem(key: string, value: string): void,
 *   removeItem?(key: string): void }} storage
 * @param {string} key
 * @param {{ normalize?: (saved: any) => T, migrate?: (old: any, key: string) => any,
 *   legacyKeys?: string[] }} [options]
 */
export function persisted(
  storage,
  key,
  { normalize = (saved) => saved, migrate = (old) => old, legacyKeys = [] } = {},
) {
  function read(name) {
    try {
      const text = storage.getItem(name);
      return text == null ? null : JSON.parse(text);
    } catch {
      return null;
    }
  }
  function remove(name) {
    try {
      if (storage.removeItem) storage.removeItem(name);
      else storage.setItem(name, 'null');
    } catch {}
  }
  /** @returns {boolean} whether the value was stored */
  function save(value) {
    try {
      storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  // A saved value of an unexpected shape counts as nothing saved. `legacy`: the older key it
  // was found under.
  function clean(saved, legacy = '') {
    try {
      return normalize(legacy ? migrate(saved, legacy) : saved);
    } catch {
      return normalize(null);
    }
  }
  /** @returns {T} */
  function load() {
    const saved = read(key);
    if (saved !== null) return clean(saved);
    for (const legacy of legacyKeys) {
      const old = read(legacy);
      if (old === null) continue;
      const value = clean(old, legacy);
      if (value == null || save(value)) for (const name of legacyKeys) remove(name);
      return value;
    }
    return clean(null);
  }
  return {
    key,
    load,
    save,
    // Removes the value and any older copies of it.
    clear() {
      remove(key);
      for (const name of legacyKeys) remove(name);
    },
  };
}
