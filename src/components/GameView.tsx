import { LearningScreen } from './LearningScreen';
import { EscalationConsole } from './EscalationConsole';
import { hudScale } from '../app/run-state.js';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameSession } from '../app/useGameSession';
import { createAccount } from '../app/cloud.js';
import { ConflictDialog } from './Account';
import type { Account, Session } from '../app/types';
import type { CloudProgress } from '../app/useGameSession';
import { CloudContext } from './cloud-context';
import { GameHud } from './GameHud';
import { Achievements } from './menus/Achievements';
import { Encyclopedia } from './menus/Encyclopedia';
import { HeroSelect } from './menus/HeroSelect';
import { MainMenu } from './menus/MainMenu';
import { Settings } from './menus/Settings';
import { Shop } from './menus/Shop';
import { SoundButton } from './menus/SoundButton';
import { createPortal } from 'react-dom';
import { EndScreen, LevelUpScreen, PauseScreen } from './GameRunScreens';
import { SessionContext, useUiVersion } from './session';

interface GameViewProps {
  active: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
  // The catalog pages live outside the session: they learn the Penza mode from here.
  onPenzaChange: (penza: boolean) => void;
}

export function GameView({
  active,
  onNavigateToArena,
  onNavigateToOpponents,
  onPenzaChange,
}: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const account = useAccount();
  const { session, cloud, runStats, leaderboard } = useGameSession(canvasRef, active, account);
  const services = useMemo(
    () => ({ account, cloud, runStats, leaderboard }),
    [account, cloud, runStats, leaderboard],
  );
  return (
    <>
      <canvas
        id="game"
        ref={canvasRef}
        aria-label="Контур валидации Utrace"
        style={{ width: '100%', height: '100%', display: 'block', imageRendering: 'pixelated' }}
      />
      {session && (
        <SessionContext.Provider value={session}>
          <CloudContext.Provider value={services}>
            <GameScreens
              session={session}
              account={account}
              cloud={cloud}
              active={active}
              onNavigateToArena={onNavigateToArena}
              onNavigateToOpponents={onNavigateToOpponents}
              onPenzaChange={onPenzaChange}
            />
          </CloudContext.Provider>
        </SessionContext.Provider>
      )}
    </>
  );
}

// The account lives as long as the game view; the Firebase SDK loads once the menu is idle.
function useAccount() {
  const [account] = useState(() => createAccount());
  useEffect(() => {
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(() => account.start(), { timeout: 3000 })
      : window.setTimeout(() => account.start(), 1000);
    return () => {
      if (window.cancelIdleCallback) window.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      account.dispose();
    };
  }, [account]);
  return account;
}

// Which panel is open follows the run state: mode (menu/play/pause/level/end) and screen.
function GameScreens({
  session,
  account,
  cloud,
  active,
  onNavigateToArena,
  onNavigateToOpponents,
  onPenzaChange,
}: {
  session: Session;
  account: Account;
  cloud: CloudProgress | null;
  active: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
  onPenzaChange: (penza: boolean) => void;
}) {
  useUiVersion(session);
  const run = session.views.run();
  const settings = session.views.settings();
  const { mode, screen } = run;

  useEffect(() => {
    document.body.dataset.mode = mode;
    document.body.classList.toggle('hide-hints', !settings.hints);
    // The Penza mini-mode paints the interface red (styles/game.css, body.penza).
    document.body.classList.toggle('penza', settings.penza);
  }, [mode, settings.hints, settings.penza]);
  useEffect(() => onPenzaChange(settings.penza), [onPenzaChange, settings.penza]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.uiScale));
    const fit = () =>
      root.style.setProperty(
        '--hud-scale',
        String(
          // The layout viewport: innerWidth/innerHeight shrink while the page is pinch-zoomed.
          hudScale(settings.uiScale, root.clientWidth, root.clientHeight),
        ),
      );
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [settings.uiScale]);

  return (
    <>
      <GameHud soundEnabled={settings.enabled} />
      {/* The game view is hidden behind the arena or bestiary page: keep the sound toggle. */}
      {!active &&
        createPortal(
          <div className="view-sound">
            <SoundButton id="viewSound" enabled={settings.enabled} />
          </div>,
          document.body,
        )}
      {mode === 'menu' && screen === 'menu' && (
        <MainMenu
          account={account}
          cloud={cloud}
          onNavigateToArena={onNavigateToArena}
          onNavigateToOpponents={onNavigateToOpponents}
        />
      )}
      {mode === 'menu' && screen === 'heroSelect' && <HeroSelect />}
      {mode === 'menu' && screen === 'shop' && <Shop />}
      {mode === 'menu' && screen === 'achievements' && <Achievements />}
      {mode === 'menu' && screen === 'encyclopedia' && <Encyclopedia />}
      {mode === 'quiz' && <LearningScreen />}
      {mode === 'console' && <EscalationConsole />}
      {mode === 'level' && <LevelUpScreen hints={settings.hints} />}
      {mode === 'pause' && screen !== 'settings' && <PauseScreen />}
      {mode === 'end' && <EndScreen />}
      {screen === 'settings' && <Settings />}
      {/* Never over a running fight: the choice waits for the menu, pause or results. */}
      {cloud && mode !== 'play' && mode !== 'level' && mode !== 'quiz' && mode !== 'console' && (
        <ConflictDialog cloud={cloud} />
      )}
    </>
  );
}
