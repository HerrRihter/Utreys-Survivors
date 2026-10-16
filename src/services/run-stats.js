import { createStore } from '../app/store.js';
import { applyRun, normalizeRunEntry, normalizeScope } from '../systems/run-records.js';

// Sends counted runs of a signed-in player to stats/{uid}, the document the leaderboards
// read. Runs wait in a queue in localStorage until they are written, so a run finished
// offline goes up later. Runs played signed out stay local («Моя статистика» only), except
// the latest one: signing in from its results screen sends it too.
//
// status: 'idle' | 'sending' | 'offline'
// last: the latest written run: its id, map, the records it improved and the new values.
// guestRun: id of the latest run played signed out, until the player signs in.

export const STATS_QUEUE_KEY = 'utreys-stats-queue-v1';
const MAX_QUEUE = 50;

export function createRunStats({
  account,
  progression,
  storage,
  timers = globalThis,
  retry = 60000,
}) {
  const store = createStore();
  /**
   * @typedef {{ all: string[], map: string[] }} Improved
   * @typedef {{ runId: string, map: string, improved: Improved, all: any, mapScope: any }} Written
   * @type {{ status: string, last: null | Written, guestRun: string }}
   */
  let state = { status: 'idle', last: null, guestRun: '' };
  // Endings of the latest guest run, sent if the player signs in.
  let guestEntries = [];
  let uid = '',
    running = null,
    again = false,
    timer = null;
  const set = (next) => {
    state = { ...state, ...next };
    store.emit();
  };

  function readQueue() {
    try {
      const queue = JSON.parse(storage.getItem(STATS_QUEUE_KEY));
      return Array.isArray(queue) ? queue : [];
    } catch {
      return [];
    }
  }
  function writeQueue(queue) {
    try {
      storage.setItem(STATS_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
    } catch {}
  }
  function enqueue(owner, entry) {
    writeQueue([...readQueue(), { uid: owner, entry }]);
  }
  function dropFirst(owner, runId, newGame) {
    const queue = readQueue();
    const index = queue.findIndex(
      (item) =>
        item.uid === owner && item.entry?.runId === runId && !!item.entry?.newGame === newGame,
    );
    if (index >= 0) queue.splice(index, 1);
    writeQueue(queue);
  }

  // Adds one run to stats/{uid}; the login comes from the profile, as the rules demand.
  async function write(sdk, owner, entry) {
    const { doc, runTransaction, serverTimestamp } = sdk.firestore;
    const ref = doc(sdk.db, 'stats', owner);
    return runTransaction(sdk.db, async (tx) => {
      const user = await tx.get(doc(sdk.db, 'users', owner));
      const snap = await tx.get(ref);
      if (!user.exists()) throw Object.assign(new Error('no profile'), { code: 'no-profile' });
      const prev = snap.exists() ? snap.data() : null;
      // Written already (the answer was lost): adding it again would count a second game.
      if (prev?.lastRun?.runId === entry.runId && entry.newGame) return null;
      const all = applyRun(normalizeScope(prev?.all), entry),
        map = applyRun(normalizeScope(prev?.maps?.[entry.map]), entry);
      const written = {
        runId: entry.runId,
        map: entry.map,
        improved: { all: all.improved, map: map.improved },
        all: all.scope,
        mapScope: map.scope,
      };
      tx.set(ref, {
        login: user.data().login,
        all: all.scope,
        maps: { ...(prev?.maps || {}), [entry.map]: map.scope },
        lastRun: { map: entry.map, runId: entry.runId },
        updatedAt: serverTimestamp(),
      });
      return written;
    });
  }

  async function sendOnce() {
    const owner = uid;
    const pending = readQueue().filter((item) => item.uid === owner);
    if (!pending.length) {
      set({ status: 'idle' });
      return;
    }
    set({ status: 'sending' });
    const sdk = await account.firebase();
    for (const { entry: saved } of pending) {
      if (owner !== uid) return;
      const entry = normalizeRunEntry(saved);
      if (entry) {
        try {
          const written = await write(sdk, owner, entry);
          if (written) set({ last: written });
        } catch (e) {
          // Refused by the rules: it would be refused forever, so it is dropped.
          if (e?.code !== 'permission-denied') throw e;
          console.warn('Run statistics refused by the server', entry.runId);
        }
      }
      dropFirst(owner, saved?.runId, !!saved?.newGame);
    }
    set({ status: 'idle' });
  }

  // One sender at a time; runs queued meanwhile go in the next pass.
  function send() {
    if (!uid) return Promise.resolve();
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          await sendOnce();
        } catch {
          set({ status: 'offline' });
          if (timer !== null) timers.clearTimeout(timer);
          timer = timers.setTimeout(() => {
            timer = null;
            send();
          }, retry);
          return;
        }
      } while (again && uid);
    })().finally(() => (running = null));
    return running;
  }

  // The statistics document of the signed-in player, or null.
  async function remote() {
    if (!uid) return null;
    const sdk = await account.firebase();
    const { doc, getDoc } = sdk.firestore;
    const snap = await getDoc(doc(sdk.db, 'stats', uid));
    return snap.exists() ? snap.data() : null;
  }

  function onAccount() {
    const next = account.state.status === 'signedIn' ? account.state.uid : '';
    if (next === uid) return;
    uid = next;
    if (uid && guestEntries.length) for (const entry of guestEntries) enqueue(uid, entry);
    if (uid) guestEntries = [];
    set({ status: 'idle', last: null, guestRun: '' });
    if (uid) send();
  }
  const offAccount = account.subscribe(onAccount);
  const offChange = progression.onChange((reason, entry) => {
    if (reason !== 'run') return;
    if (!uid) {
      if (guestEntries[0]?.runId !== entry.runId) guestEntries = [];
      guestEntries.push(entry);
      set({ guestRun: entry.runId });
      return;
    }
    enqueue(uid, entry);
    send();
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
    get queued() {
      return readQueue().length;
    },
    send,
    remote,
    dispose,
  };
}
