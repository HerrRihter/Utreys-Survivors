import React, { useState } from 'react';
import { GameView } from './components/GameView';
import { ArenaView } from './components/ArenaView';
import { OpponentsView } from './components/OpponentsView';

export function App() {
  const [currentView, setCurrentView] = useState<'game' | 'arena' | 'opponents'>('game');

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Top Quick Navigation Bar when in menu or browsing */}
      {currentView !== 'game' && (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            left: '16px',
            zIndex: 60,
            display: 'flex',
            gap: '8px',
            background: 'rgba(10, 22, 25, 0.95)',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #1a5763',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
          }}
        >
          <button
            type="button"
            className="small"
            onClick={() => setCurrentView('game')}
            style={{
              borderColor: '#00e5ff',
              color: '#00e5ff',
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
              borderColor: currentView === 'arena' ? '#00e5ff' : undefined,
              color: currentView === 'arena' ? '#00e5ff' : undefined,
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
              borderColor: currentView === 'opponents' ? '#00e5ff' : undefined,
              color: currentView === 'opponents' ? '#00e5ff' : undefined,
              cursor: 'pointer',
            }}
          >
            Враги и клиенты
          </button>
        </div>
      )}

      {/* Main Game View kept mounted to maintain canvas context, audio state and game session */}
      <div style={{ display: currentView === 'game' ? 'block' : 'none', width: '100vw', height: '100vh' }}>
        <GameView
          onNavigateToArena={() => setCurrentView('arena')}
          onNavigateToOpponents={() => setCurrentView('opponents')}
        />
      </div>

      {currentView === 'arena' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <ArenaView onBackToGame={() => setCurrentView('game')} />
        </div>
      )}

      {currentView === 'opponents' && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <OpponentsView onBackToGame={() => setCurrentView('game')} />
        </div>
      )}
    </div>
  );
}

export default App;
