import { drawNodes } from '../rendering/node-objectives.js';
import { createNodeState } from '../systems/node-objectives.js';
import React, { useEffect, useRef, useState } from 'react';
import { createArenas } from '../world/arenas.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { createArenaFloor } from '../rendering/arena-floor.js';
import { drawCollision } from '../rendering/collision.js';
import { MapSelect, type MapId } from './MapSelect';

export const ArenaView: React.FC = () => {
  const [selectedArena, setSelectedArena] = useState<MapId>('empty');
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
    const floor = createArenaFloor();

    const render = () => {
      const world = arenas.get(selectedArena);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);

      const scale = isClose ? 0.95 : 0.43;
      g.translate(660, 500);
      g.scale(scale, scale);
      g.translate(-1100, isClose ? -1070 : -1090);

      floor.draw(g, world);
      drawNodes(g, createNodeState());

      if (showBounds && world.collision) {
        drawCollision(g, world.collision.outlines);
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

  const arena: { name: string; description: string; notes?: string } =
    mapDefinitions[selectedArena];

  return (
    <div id="arenaView" className="overlay catalog">
      <main className="catalog-main">
        <header className="catalog-header">
          <div>
            <div className="eyebrow">СЕРВЕРНАЯ ИНФРАСТРУКТУРА</div>
            <h1>{arena.name}</h1>
            <p>{arena.description}</p>
          </div>
        </header>

        <nav className="catalog-controls">
          <MapSelect value={selectedArena} onChange={setSelectedArena} />

          <button
            type="button"
            className={!isClose ? 'small is-current' : 'small'}
            onClick={() => setIsClose(false)}
          >
            Весь кластер
          </button>

          <button
            type="button"
            className={isClose ? 'small is-current' : 'small'}
            onClick={() => setIsClose(true)}
          >
            Центральное ядро
          </button>

          <label className="catalog-check">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Узлы сети
          </label>

          <label className="catalog-check">
            <input
              type="checkbox"
              checked={showBounds}
              onChange={(e) => setShowBounds(e.target.checked)}
            />
            Границы контура
          </label>
        </nav>

        {arena.notes && <p className="arena-notes">{arena.notes}</p>}

        <canvas
          ref={canvasRef}
          width={1320}
          height={1000}
          aria-label={`План дата-центра: ${arena.name}`}
          className="arena-plan"
        />
      </main>
    </div>
  );
};
