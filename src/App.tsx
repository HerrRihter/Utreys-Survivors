import { useState, useEffect } from 'react';
import { GameView } from './components/GameView';
import { ArenaView } from './components/ArenaView';
import { OpponentsView } from './components/OpponentsView';

export function App() {
  const [currentView, setCurrentView] = useState<'game' | 'arena' | 'opponents'>(() => {
    const requested = new URLSearchParams(window.location.search).get('view');
    return requested === 'arena' || requested === 'opponents' ? requested : 'game';
  });
  useEffect(() => {
    document.body.dataset.view = currentView;
  }, [currentView]);
  // A pinch zoom in mobile Chrome can leave the page scrolled once it is back to 100%, with
  // the top of the UI off screen and no way to scroll it back: return it to the origin.
  useEffect(() => {
    const viewport = window.visualViewport;
    const settle = () => {
      if ((!viewport || viewport.scale <= 1.01) && (window.scrollX || window.scrollY))
        window.scrollTo(0, 0);
    };
    viewport?.addEventListener('resize', settle);
    window.addEventListener('scroll', settle);
    return () => {
      viewport?.removeEventListener('resize', settle);
      window.removeEventListener('scroll', settle);
    };
  }, []);

  return (
    // Pinned to the visible viewport: 100vh is taller than the screen in mobile Chrome while
    // its address bar is shown, and the page could then scroll the top of the UI away.
    <div className="app-root">
      {/* Top Quick Navigation Bar when in menu or browsing */}
      {currentView !== 'game' && (
        <nav className="view-navigation" aria-label="Разделы игры">
          <button type="button" className="small is-current" onClick={() => setCurrentView('game')}>
            ← В игру
          </button>
          <button
            type="button"
            className={currentView === 'arena' ? 'small is-current' : 'small'}
            onClick={() => setCurrentView('arena')}
          >
            Дата-центр Utrace
          </button>
          <button
            type="button"
            className={currentView === 'opponents' ? 'small is-current' : 'small'}
            onClick={() => setCurrentView('opponents')}
          >
            Враги и клиенты
          </button>
        </nav>
      )}

      {/* Main Game View kept mounted to maintain canvas context, audio state and game session */}
      <div className={currentView === 'game' ? 'game-frame' : 'game-frame is-hidden'}>
        <GameView
          active={currentView === 'game'}
          onNavigateToArena={() => setCurrentView('arena')}
          onNavigateToOpponents={() => setCurrentView('opponents')}
        />
      </div>

      {currentView === 'arena' && (
        <div className="view-frame">
          <ArenaView />
        </div>
      )}

      {currentView === 'opponents' && (
        <div className="view-frame">
          <OpponentsView />
        </div>
      )}
    </div>
  );
}

export default App;
