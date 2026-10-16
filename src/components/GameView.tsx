import { useEffect, useRef } from 'react';
import { useGameSession } from '../app/useGameSession';
import { GameHud } from './GameHud';
import { Achievements, HeroSelect, MainMenu, Settings, Shop } from './GameMenus';
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
  onNavigateToArena,
  onNavigateToOpponents,
}: {
  session: Session;
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
    document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  }, [settings.uiScale]);

  return (
    <>
      <GameHud soundEnabled={settings.enabled} />
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
      {mode === 'level' && <LevelUpScreen hints={settings.hints} />}
      {mode === 'pause' && screen !== 'settings' && <PauseScreen soundEnabled={settings.enabled} />}
      {mode === 'end' && <EndScreen />}
      {screen === 'settings' && <Settings />}
    </>
  );
}
