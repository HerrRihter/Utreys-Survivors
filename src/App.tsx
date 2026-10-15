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

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Quick Navigation Bar when in menu or browsing */}
      {currentView !== 'game' && (
        <nav className="view-navigation" aria-label="Разделы игры">
          <button
            type="button"
            className="small"
            onClick={() => setCurrentView('game')}
            style={{
              borderColor: 'var(--cyan)',
              color: 'var(--cyan)',
              cursor: 'pointer',
            }}
          >
            ← В игру
          </button>
          <button
            type="button"
            className="small"
            onClick={() => setCurrentView('arena')}
            style={{
              borderColor: currentView === 'arena' ? 'var(--cyan)' : undefined,
              color: currentView === 'arena' ? 'var(--cyan)' : undefined,
              cursor: 'pointer',
            }}
          >
            Дата-центр Utrace
          </button>
          <button
            type="button"
            className="small"
            onClick={() => setCurrentView('opponents')}
            style={{
              borderColor: currentView === 'opponents' ? 'var(--cyan)' : undefined,
              color: currentView === 'opponents' ? 'var(--cyan)' : undefined,
              cursor: 'pointer',
            }}
          >
            Враги и клиенты
          </button>
        </nav>
      )}

      {/* Main Game View kept mounted to maintain canvas context, audio state and game session */}
      <div
        style={{
          display: currentView === 'game' ? 'block' : 'none',
          width: '100vw',
          height: '100vh',
        }}
      >
        <GameView
          active={currentView === 'game'}
          onNavigateToArena={() => setCurrentView('arena')}
          onNavigateToOpponents={() => setCurrentView('opponents')}
        />
      </div>

      {currentView === 'arena' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <ArenaView />
        </div>
      )}

      {currentView === 'opponents' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <OpponentsView />
        </div>
      )}
    </div>
  );
}

export default App;
