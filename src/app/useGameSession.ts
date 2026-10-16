import { useEffect, useState, type RefObject } from 'react';
import { GameSession } from './game-session.js';
import { createProgression } from '../systems/persistence.js';
import type { Session } from '../components/session';

// Mounts one game session on the canvas and keeps it running only while the game view is shown.
export function useGameSession(canvasRef: RefObject<HTMLCanvasElement | null>, active: boolean) {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const storage = {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
    };
    const progression = createProgression({ storage, events: window, document });
    const created = GameSession.create({
      document,
      window,
      storage,
      performance,
      requestAnimationFrame: (callback: FrameRequestCallback) =>
        window.requestAnimationFrame(callback),
      cancelAnimationFrame: (id: number) => window.cancelAnimationFrame(id),
      canvas,
      progression,
    });
    // Opt-in handle for tools/benchmark-render.cjs; inert without ?bench in the URL.
    if (new URLSearchParams(window.location.search).has('bench'))
      (window as unknown as { __utraceSession?: Session }).__utraceSession = created;
    setSession(created);
    return () => {
      created.dispose();
      progression.dispose();
      setSession(null);
    };
  }, [canvasRef]);

  useEffect(() => {
    if (!session) return;
    if (active) session.run();
    else session.sleep();
  }, [active, session]);

  return session;
}
