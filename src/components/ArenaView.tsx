import React, { useEffect, useRef, useState } from 'react';
import { createPreviewKit } from '../app/preview-kit.js';
import type { MapId } from '../app/types';
import { MapSelect } from './MapSelect';

export const ArenaView: React.FC = () => {
  const [selectedArena, setSelectedArena] = useState<MapId>('empty');
  const [isClose, setIsClose] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [kit] = useState(createPreviewKit);

  useEffect(() => {
    const g = canvasRef.current?.getContext('2d');
    if (g)
      kit.drawArenaPlan(g, selectedArena, {
        close: isClose,
        labels: showLabels,
        bounds: showBounds,
      });
  }, [kit, selectedArena, isClose, showLabels, showBounds]);

  const arena = kit.map(selectedArena);

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
          <MapSelect maps={kit.maps} value={selectedArena} onChange={setSelectedArena} />

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
