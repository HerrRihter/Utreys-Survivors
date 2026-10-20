import { createStore } from '../core/store.js';
import { persisted } from '../core/storage.js';
import { normalizeProgression } from '../systems/progression/index.js';

// Keeps progress/{uid} in Firestore in step with the local save (docs/FIREBASE-PLAN.md,
// «Синхронизация прогресса»). localStorage stays the source the game reads; the cloud copy
// is compared on sign-in and after purchases and run results.
//
// status: 'off' (signed out) | 'syncing' | 'synced' | 'offline' | 'conflict'
// conflict: { rev, remote, local, cloud } while the player has to pick a save.

export const CLOUD_META_KEY = 'utreys-cloud-v1';
const SCHEMA = 1;

// JSON with sorted keys: Firestore does not keep the order of map keys.
export function stableKey(value) {
  if (Array.isArray(value)) return '[' + value.map(stableKey).join(',') + ']';
  if (value && typeof value === 'object')
    return (
      '{' +
      Object.keys(value)
        .sort()
        .map((key) => JSON.stringify(key) + ':' + stableKey(value[key]))
        .join(',') +
      '}'
    );
  return JSON.stringify(value);
}

// A short fingerprint of a save (cyrb53), so the device remembers what it last synced
// without keeping a second copy of the save.
export function saveHash(data) {
  const text = stableKey(data);
  let h1 = 0xdeadbeef,
    h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}

// What the conflict dialog shows for each save.
const progressSummary = (data) => ({
  codes: data.codes,
  wins: data.stats.wins,
  heroes: data.unlocked.length,
  kills: data.kills,
  time: Math.round(data.stats.totalTime),
});

export function createCloudProgress({
  account,
  progression,
  storage,
  onReplace = () => {},
  timers = globalThis,
  delay = 5000,
  retry = 60000,
}) {
  const store = createStore();
  const emptyKey = stableKey(normalizeProgression(null));
  /**
   * @typedef {{ codes: number, wins: number, heroes: number, kills: number, time: number }} Summary
   * @type {{ status: string, conflict: null | { rev: number, remote: any, local: Summary, cloud: Summary } }}
   */
  let state = { status: 'off', conflict: null };
  let uid = '',
    running = null,
    again = false,
    timer = null;
  const set = (next) => {
    state = { ...state, ...next };
    store.emit();
  };
  const stale = () => Object.assign(new Error('stale'), { code: 'stale' });

  // This device: its id and the cloud revision it last matched, per account.
  const metaFile = persisted(storage, CLOUD_META_KEY, {
    normalize: (meta) => (meta && typeof meta === 'object' ? meta : {}),
  });
  const readMeta = metaFile.load;
  const writeMeta = metaFile.save;
  function deviceId() {
    const meta = readMeta();
    if (typeof meta.device !== 'string' || !meta.device) {
      meta.device = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      writeMeta(meta);
    }
    return meta.device;
  }
  const remember = (owner, rev, data) =>
    writeMeta({ ...readMeta(), uid: owner, rev, hash: saveHash(data) });

  function schedule(ms) {
    if (timer !== null) timers.clearTimeout(timer);
    timer = timers.setTimeout(() => {
      timer = null;
      sync();
    }, ms);
  }

  // Writes `data` as revision prevRev + 1, unless another device got there first.
  async function push(sdk, owner, data, prevRev) {
    const { doc, runTransaction, serverTimestamp } = sdk.firestore;
    const ref = doc(sdk.db, 'progress', owner);
    const device = deviceId();
    await runTransaction(sdk.db, async (tx) => {
      const snap = await tx.get(ref);
      if ((snap.exists() ? snap.data().rev : 0) !== prevRev) throw stale();
      tx.set(ref, {
        data,
        schema: SCHEMA,
        rev: prevRev + 1,
        device,
        updatedAt: serverTimestamp(),
      });
    });
    if (owner !== uid) return;
    remember(owner, prevRev + 1, data);
    set({ status: 'synced' });
  }

  function take(owner, rev, data) {
    progression.replace(data);
    remember(owner, rev, progression.data);
    set({ status: 'synced' });
    onReplace();
  }

  async function syncOnce() {
    const owner = uid;
    set({ status: 'syncing' });
    const sdk = await account.firebase();
    const { doc, getDoc } = sdk.firestore;
    const snap = await getDoc(doc(sdk.db, 'progress', owner));
    if (owner !== uid || state.conflict) return;
    const local = progression.data,
      localKey = stableKey(local),
      localHash = saveHash(local),
      meta = readMeta();
    if (!snap.exists()) return push(sdk, owner, local, 0);
    const remote = snap.data(),
      remoteData = normalizeProgression(remote.data),
      known = meta.uid === owner;
    if (stableKey(remoteData) === localKey) {
      remember(owner, remote.rev, local);
      set({ status: 'synced' });
      return;
    }
    // A save only brought to the current format at load (src/core/migrations.js) is the one
    // this device last synced, not a change of the player's.
    const previous = progression.previous,
      migratedOnly = !!previous && saveHash(previous) === meta.hash;
    const localChanged = !known || (localHash !== meta.hash && !migratedOnly),
      remoteChanged = !known || remote.rev !== meta.rev;
    if (!remoteChanged) return push(sdk, owner, local, remote.rev);
    if (!localChanged || localKey === emptyKey) return take(owner, remote.rev, remoteData);
    // Both sides moved on: only the player knows which save is the real one.
    set({
      status: 'conflict',
      conflict: {
        rev: remote.rev,
        remote: remoteData,
        local: progressSummary(local),
        cloud: progressSummary(remoteData),
      },
    });
  }

  // One sync at a time; changes during a sync run it again afterwards.
  function sync() {
    if (!uid || state.conflict) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          await syncOnce();
        } catch (e) {
          if (e?.code === 'stale') again = true;
          else {
            set({ status: 'offline' });
            schedule(retry);
          }
        }
      } while (again && uid && !state.conflict);
    })().finally(() => (running = null));
    return running;
  }

  // The player's answer to the conflict: keep this device's save or the cloud one.
  async function resolve(choice) {
    const conflict = state.conflict;
    if (!conflict || !uid) return;
    const owner = uid;
    set({ conflict: null, status: 'syncing' });
    if (choice === 'cloud') {
      take(owner, conflict.rev, conflict.remote);
      return;
    }
    try {
      await push(await account.firebase(), owner, progression.data, conflict.rev);
    } catch {
      sync();
    }
  }

  function onAccount() {
    const next = account.state.status === 'signedIn' ? account.state.uid : '';
    if (next === uid) return;
    uid = next;
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    set({ status: uid ? 'syncing' : 'off', conflict: null });
    if (uid) sync();
  }
  const offAccount = account.subscribe(onAccount);
  // Purchases and run results arrive in bursts; the page going away cannot wait.
  const offChange = progression.onChange((reason) => {
    if (!uid || state.conflict) return;
    if (reason === 'hidden') sync();
    else schedule(delay);
  });
  onAccount();

  function dispose() {
    offAccount();
    offChange();
    if (timer !== null) timers.clearTimeout(timer);
    timer = null;
    uid = '';
  }

  return {
    subscribe: store.subscribe,
    getVersion: store.getVersion,
    get state() {
      return state;
    },
    sync,
    resolve,
    dispose,
  };
}
