import { normalizeProgression } from './normalize.js';
import { persisted } from '../../core/storage.js';
import {
  LEGACY_BEST_KEY,
  legacyBest,
  mergeLegacyBest,
  previousProgressionShape,
} from '../../core/migrations.js';

// The saved meta-progression shared by the progression modules (wallet, shop, records,
// achievements, loads): one `data` object, its storage and who hears about saves. Modules
// change `store.data` and then call `save()` (purchases, run results: written at once) or
// `deferSave()` (combat income: coalesced into one write outside the simulation).
/**
 * @param {{
 *   storage: { getItem(key: string): string | null, setItem(key: string, value: string): void },
 *   events?: any,
 *   document?: any,
 * }} options
 */
export function createProgressionStore({
  storage,
  events = globalThis,
  document = globalThis.document,
}) {
  const file = persisted(storage, 'utreys-progression-v1');
  const oldBest = persisted(storage, LEGACY_BEST_KEY, { normalize: legacyBest });
  const stored = file.load();
  let data = normalizeProgression(stored),
    persistent = true;
  const previous = deepFreeze(previousProgressionShape(stored, data));
  // This device's record from before it moved into the save; it also joins a save that
  // replaces this one during the session (from the cloud), so it is never lost.
  const best = oldBest.load();
  if (best) mergeLegacyBest(data, best);
  let dirty = false,
    pending = null,
    idle = null;
  // Every change goes through save, deferSave or replace, which bump the version; the
  // read-only copy for other code is rebuilt on the first read after a change.
  let version = 0,
    view = null,
    viewVersion = -1;
  function snapshot() {
    if (viewVersion !== version) {
      view = deepFreeze(JSON.parse(JSON.stringify(data)));
      viewVersion = version;
    }
    return view;
  }
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
    persistent = file.save(data);
    if (persistent) dirty = false;
  }
  // Listeners hear about saves worth syncing elsewhere: purchases, run results ('save'), a
  // counted run ending ('run', with the entry) and the page going away ('hidden'). Combat
  // income alone does not notify.
  const listeners = new Set();
  const notify = (reason, payload) => {
    for (const listener of [...listeners]) listener(reason, payload);
  };
  function onChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }
  function save() {
    version++;
    dirty = true;
    flush();
    notify('save');
  }
  // Takes progression from elsewhere (the cloud) through the same checks as a local save.
  function replace(saved) {
    data = normalizeProgression(saved);
    if (best) mergeLegacyBest(data, best);
    version++;
    dirty = true;
    flush();
  }
  // Combat only updates memory. Coalesce rewards into one write outside the
  // simulation, preferably when the browser has idle time between frames.
  function deferSave() {
    version++;
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
  // The old record is written into the save once; its key goes only when that write worked.
  if (best) {
    dirty = true;
    flush();
    if (persistent) oldBest.clear();
  }
  return {
    get data() {
      return data;
    },
    get persistent() {
      return persistent;
    },
    // The save as the previous build stored it, until anything changes it in this session.
    get previous() {
      return version === 0 ? previous : null;
    },
    snapshot,
    save,
    deferSave,
    flush,
    replace,
    notify,
    onChange,
    dispose,
  };
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
