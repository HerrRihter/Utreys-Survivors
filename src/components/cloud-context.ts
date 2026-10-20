import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Account, Leaderboard } from '../app/types';
import type { CloudProgress, RunStats } from '../app/useGameSession';
type CloudServices = {
  account: Account;
  cloud: CloudProgress | null;
  runStats: RunStats | null;
  leaderboard: Leaderboard;
};

// Account, cloud progress, run statistics and leaderboards for screens deep in the tree.
export const CloudContext = createContext<CloudServices | null>(null);

export function useCloud(): CloudServices {
  const services = useContext(CloudContext);
  if (!services) throw new Error('useCloud outside of <CloudContext>');
  return services;
}

// Re-renders on every change of a service store (account, sync, statistics).
const never = () => () => {};
export function useStore(
  store: { subscribe(listener: () => void): () => void; getVersion(): number } | null,
) {
  useSyncExternalStore(store?.subscribe ?? never, store?.getVersion ?? (() => 0));
}
