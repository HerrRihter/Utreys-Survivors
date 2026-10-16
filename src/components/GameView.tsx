import { hudScale } from '../app/run-state.js';
import { useEffect, useRef } from 'react';
import { useGameSession } from '../app/useGameSession';
import { GameHud } from './GameHud';
import {
  Achievements,
  Encyclopedia,
  HeroSelect,
  MainMenu,
  Settings,
  Shop,
  SoundButton,
} from './GameMenus';
import { createPortal } from 'react-dom';
import { EndScreen, LevelUpScreen, PauseScreen } from './GameRunScreens';
import { SessionContext, useUiVersion, type Session } from './session';

interface GameViewProps {
  active: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
}

export function GameView({ active, onNavigateToArena, onNavigateToOpponents }: GameViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const session = useGameSession(canvasRef, active);
  return (
    <>
      <canvas
        id="game"
        ref={canvasRef}
        aria-label="Контур валидации Utrace"
        style={{ width: '100vw', height: '100vh', display: 'block', imageRendering: 'pixelated' }}
      />
      {session && (
        <SessionContext.Provider value={session}>
          <GameScreens
            session={session}
            active={active}
            onNavigateToArena={onNavigateToArena}
            onNavigateToOpponents={onNavigateToOpponents}
          />
        </SessionContext.Provider>
      )}
    </>
  );
}

// Which panel is open follows the run state: mode (menu/play/pause/level/end) and screen.
function GameScreens({
  session,
  active,
  onNavigateToArena,
  onNavigateToOpponents,
}: {
  session: Session;
  active: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
}) {
  useUiVersion(session);
  const run = session.views.run();
  const settings = session.views.settings();
  const { mode, screen } = run;

  useEffect(() => {
    document.body.dataset.mode = mode;
    document.body.classList.toggle('hide-hints', !settings.hints);
  }, [mode, settings.hints]);
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-scale', String(settings.uiScale));
    const fit = () =>
      root.style.setProperty(
        '--hud-scale',
        String(hudScale(settings.uiScale, window.innerWidth, window.innerHeight)),
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
          hints={settings.hints}
          onNavigateToArena={onNavigateToArena}
          onNavigateToOpponents={onNavigateToOpponents}
        />
      )}
      {mode === 'menu' && screen === 'heroSelect' && <HeroSelect />}
      {mode === 'menu' && screen === 'shop' && <Shop />}
      {mode === 'menu' && screen === 'achievements' && <Achievements />}
      {mode === 'menu' && screen === 'encyclopedia' && <Encyclopedia />}
      {mode === 'level' && <LevelUpScreen hints={settings.hints} />}
      {mode === 'pause' && screen !== 'settings' && <PauseScreen />}
      {mode === 'end' && <EndScreen />}
      {screen === 'settings' && <Settings />}
    </>
  );
}
