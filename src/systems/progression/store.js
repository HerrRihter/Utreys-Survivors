import { normalizeProgression } from './normalize.js';

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
  return {
    get data() {
      return data;
    },
    get persistent() {
      return persistent;
    },
    save,
    deferSave,
    flush,
    replace,
    notify,
    onChange,
    dispose,
  };
}
