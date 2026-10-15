import React, { useEffect, useRef, useState } from 'react';
import { Village } from '../world/village/village.js';
import { createArenas, arenaDefinitions } from '../world/arenas.js';

interface ArenaViewProps {
  onBackToGame: () => void;
}

export const ArenaView: React.FC<ArenaViewProps> = ({ onBackToGame }) => {
  const [selectedArena, setSelectedArena] = useState<string>('empty');
  const [isClose, setIsClose] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    const arenas = createArenas(Village);
    let animId: number;

    const render = () => {
      const world = arenas.get(selectedArena);
      g.setTransform(1, 0, 0, 1, 0, 0);

      const scale = isClose ? 0.95 : 0.43;
      g.translate(660, 500);
      g.scale(scale, scale);
      g.translate(-1100, isClose ? -1070 : -1090);

      world.draw(g);

      if (showBounds && world.collision) {
        world.collision.draw(g);
      }

      if (showLabels && world.houses) {
        for (const h of world.houses) {
          if (!h.name) continue;
          g.font = 'bold 19px monospace';
          g.textAlign = 'center';
          g.lineWidth = 5;
          g.strokeStyle = '#051114';
          g.strokeText(h.name, h.x + h.w / 2, h.y + h.h + 37);
          g.fillStyle = '#00e5ff';
          g.fillText(h.name, h.x + h.w / 2, h.y + h.h + 37);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [selectedArena, isClose, showLabels, showBounds]);

  const arena = (arenaDefinitions as Record<string, { name: string; description: string; notes?: string }>)[selectedArena] || {
    name: 'Дата-центр Utrace',
    description: 'Высоконагруженный серверный контур',
    notes: '',
  };

  return (
    <div className="overlay" style={{ alignItems: 'flex-start', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflowY: 'auto', background: '#0a1619', color: '#f2ead0', padding: '24px' }}>
      <main style={{ maxWidth: '1220px', margin: '0 auto', width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
          <div>
            <div className="eyebrow" style={{ color: '#00e5ff', fontSize: '11px', letterSpacing: '2px', marginBottom: '4px' }}>СЕРВЕРНАЯ ИНФРАСТРУКТУРА</div>
            <h1 style={{ margin: 0, fontSize: '32px', color: '#00e5ff' }}>{arena.name}</h1>
            <p style={{ color: '#a0bec7', maxWidth: '880px', margin: '8px 0 0', fontSize: '14px', lineHeight: 1.6 }}>{arena.description}</p>
          </div>
          <button className="primary" onClick={onBackToGame} style={{ background: '#00e5ff', color: '#041724', whiteSpace: 'nowrap', boxShadow: '4px 4px 0 #008ba3' }}>
            В игру →
          </button>
        </header>

        <nav style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', margin: '16px 0', alignItems: 'center' }}>
          <button
            type="button"
            className="small"
            onClick={() => setIsClose(false)}
            style={{ borderColor: !isClose ? '#00e5ff' : undefined, color: !isClose ? '#00e5ff' : undefined }}
          >
            Весь кластер
          </button>

          <button
            type="button"
            className="small"
            onClick={() => setIsClose(true)}
            style={{ borderColor: isClose ? '#00e5ff' : undefined, color: isClose ? '#00e5ff' : undefined }}
          >
            Центральное ядро
          </button>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#90b4bc' }}>
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Узлы сети
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#90b4bc' }}>
            <input
              type="checkbox"
              checked={showBounds}
              onChange={(e) => setShowBounds(e.target.checked)}
            />
            Границы контура
          </label>
        </nav>

        {arena.notes && (
          <p style={{ fontSize: '12px', color: '#00e5ffaa', margin: '4px 0 16px' }}>{arena.notes}</p>
        )}

        <canvas
          ref={canvasRef}
          width={1320}
          height={1000}
          aria-label={`План дата-центра: ${arena.name}`}
          style={{ display: 'block', width: '100%', border: '1px solid #1a5763', background: '#0a1619', borderRadius: '4px' }}
        />
      </main>
    </div>
  );
};
