import { useEffect, useRef } from 'react';
import { GameSession } from './game-session.js';
import { Villagers } from '../entities/heroes.js';
import { Progression } from '../systems/persistence.js';
import { UpgradeSystem } from '../systems/upgrades.js';
import { Legion } from '../entities/legion.js';
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
      Villagers,
      Progression,
      UpgradeSystem,
      Legion,
      Corpses,
      MenuPortraits,
    });

    sessionRef.current = session;
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
