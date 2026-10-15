import { useEffect, useRef } from 'react';
import { GameSession } from './game-session.js';
import { Heroes } from '../entities/heroes.js';
import { Progression } from '../systems/persistence.js';
import { UpgradeSystem } from '../systems/upgrades.js';
import { Enemies } from '../entities/enemies.js';
import { Corpses } from '../systems/corpses.js';
import { MenuPortraits } from '../ui/menu-portraits.js';

export function useGameSession(active: boolean) {
  const sessionRef = useRef<ReturnType<typeof GameSession.create> | null>(null);

  useEffect(() => {
    const session = GameSession.create({
      document,
      window,
      localStorage: {
        getItem(key: string) {
          return window.localStorage.getItem(key);
        },
        setItem(key: string, value: string) {
          window.localStorage.setItem(key, value);
        },
      },
      performance,
      Math,
      requestAnimationFrame: (callback: FrameRequestCallback) =>
        window.requestAnimationFrame(callback),
      cancelAnimationFrame: (id: number) => window.cancelAnimationFrame(id),
      Heroes,
      Progression,
      UpgradeSystem,
      Enemies,
      Corpses,
      MenuPortraits,
    });

    sessionRef.current = session;
    // Opt-in handle for tools/benchmark-render.cjs; inert without ?bench in the URL.
    if (new URLSearchParams(window.location.search).has('bench'))
      (window as unknown as { __utraceSession?: typeof session }).__utraceSession = session;
    session.run();

    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (active) sessionRef.current?.run();
    else sessionRef.current?.stop();
  }, [active]);
}
