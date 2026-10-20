import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Session } from '../app/types';

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession outside of <SessionContext>');
  return session;
}

// Menus, purchases, mode changes: re-render on every discrete change.
export function useUiVersion(session: Session) {
  return useSyncExternalStore(session.ui.subscribe, session.ui.getVersion);
}

// In-run overlay: the session emits about ten times a second.
export function useHudVersion(session: Session) {
  return useSyncExternalStore(session.hud.subscribe, session.hud.getVersion);
}
