// Minimal observable for React's useSyncExternalStore: a version number bumps on every change.
export function createStore() {
  const listeners = new Set();
  let version = 0;
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getVersion: () => version,
    emit() {
      version++;
      for (const listener of [...listeners]) listener();
    },
  };
}
