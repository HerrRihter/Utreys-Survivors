import { useEffect, useState, type RefObject } from 'react';
import { GameSession } from './game-session.js';
import { createProgression } from '../systems/persistence.js';
import { createCloudProgress } from '../services/cloud-progress.js';
import { createRunStats } from '../services/run-stats.js';
import { createLeaderboard } from '../services/leaderboard.js';
import type { Session } from '../components/session';
import type { Account } from '../components/Account';

export type CloudProgress = ReturnType<typeof createCloudProgress>;
export type RunStats = ReturnType<typeof createRunStats>;

// Mounts one game session on the canvas and keeps it running only while the game view is shown.
// The saved progression follows the account's cloud copy while a player is signed in.
export function useGameSession(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  active: boolean,
  account: Account,
) {
  const [session, setSession] = useState<Session | null>(null);
  const [cloud, setCloud] = useState<CloudProgress | null>(null);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [leaderboard] = useState(() => createLeaderboard({ account }));

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
    const synced = createCloudProgress({
      account,
      progression,
      storage,
      onReplace: () => created.ui.emit(),
    });
    const stats = createRunStats({ account, progression, storage });
    // A written run changes the tables: drop cached answers.
    const offStats = stats.subscribe(leaderboard.invalidate);
    setSession(created);
    setCloud(synced);
    setRunStats(stats);
    return () => {
      offStats();
      stats.dispose();
      synced.dispose();
      created.dispose();
      progression.dispose();
      setSession(null);
      setCloud(null);
      setRunStats(null);
    };
  }, [canvasRef, account, leaderboard]);

  useEffect(() => {
    if (!session) return;
    if (active) session.run();
    else session.sleep();
  }, [active, session]);

  return { session, cloud, runStats, leaderboard };
}
