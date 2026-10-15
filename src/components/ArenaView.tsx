import { drawNodes } from '../rendering/node-objectives.js';
import { createNodeState } from '../systems/node-objectives.js';
import React, { useEffect, useRef, useState } from 'react';
import { createArenas, arenaDefinitions } from '../world/arenas.js';

export const ArenaView: React.FC = () => {
  const selectedArena = 'empty';
  const [isClose, setIsClose] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;

    const arenas = createArenas();

    const render = () => {
      const world = arenas.get(selectedArena);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);

      const scale = isClose ? 0.95 : 0.43;
      g.translate(660, 500);
      g.scale(scale, scale);
      g.translate(-1100, isClose ? -1070 : -1090);

      world.draw(g);
      drawNodes(g, createNodeState());

      if (showBounds && world.collision) {
        world.collision.draw(g);
        g.strokeStyle = '#00e5ff';
        g.lineWidth = 5;
        g.strokeRect(0, 0, world.size, world.size);
      }

      if (showLabels) {
        g.fillStyle = '#00e5ff';
        g.font = 'bold 24px monospace';
        g.textAlign = 'center';
        g.fillText('ЯДРО UTRACE', world.size / 2, world.size / 2);
      }
    };

    render();
  }, [selectedArena, isClose, showLabels, showBounds]);

  const arena = (
    arenaDefinitions as Record<string, { name: string; description: string; notes?: string }>
  )[selectedArena] || {
    name: 'Дата-центр Utrace',
    description: 'Высоконагруженный серверный контур',
    notes: '',
  };

  return (
    <div
      className="overlay"
      style={{
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        background: '#0a1619',
        color: 'var(--ink)',
        padding: '80px 24px 24px',
      }}
    >
      <main style={{ maxWidth: '1220px', margin: '0 auto', width: '100%', flexShrink: 0 }}>
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            marginBottom: '16px',
          }}
        >
          <div>
            <div
              className="eyebrow"
              style={{
                color: 'var(--cyan)',
                fontSize: '11px',
                letterSpacing: '2px',
                marginBottom: '4px',
              }}
            >
              СЕРВЕРНАЯ ИНФРАСТРУКТУРА
            </div>
            <h1 style={{ margin: 0, fontSize: '32px', color: 'var(--cyan)' }}>{arena.name}</h1>
            <p
              style={{
                color: '#a0bec7',
                maxWidth: '880px',
                margin: '8px 0 0',
                fontSize: '14px',
                lineHeight: 1.6,
              }}
            >
              {arena.description}
            </p>
          </div>
        </header>

        <nav
          style={{
            display: 'flex',
            gap: '14px',
            flexWrap: 'wrap',
            margin: '16px 0',
            alignItems: 'center',
          }}
        >
          <button
            type="button"
            className="small"
            onClick={() => setIsClose(false)}
            style={{
              borderColor: !isClose ? 'var(--cyan)' : undefined,
              color: !isClose ? 'var(--cyan)' : undefined,
            }}
          >
            Весь кластер
          </button>

          <button
            type="button"
            className="small"
            onClick={() => setIsClose(true)}
            style={{
              borderColor: isClose ? 'var(--cyan)' : undefined,
              color: isClose ? 'var(--cyan)' : undefined,
            }}
          >
            Центральное ядро
          </button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#90b4bc',
            }}
          >
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Узлы сети
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              color: '#90b4bc',
            }}
          >
            <input
              type="checkbox"
              checked={showBounds}
              onChange={(e) => setShowBounds(e.target.checked)}
            />
            Границы контура
          </label>
        </nav>

        {arena.notes && (
          <p style={{ fontSize: '12px', color: '#00e5ffaa', margin: '4px 0 16px' }}>
            {arena.notes}
          </p>
        )}

        <canvas
          ref={canvasRef}
          width={1320}
          height={1000}
          aria-label={`План дата-центра: ${arena.name}`}
          style={{
            display: 'block',
            width: '100%',
            border: '1px solid #1a5763',
            background: '#0a1619',
            borderRadius: '4px',
          }}
        />
      </main>
    </div>
  );
};
