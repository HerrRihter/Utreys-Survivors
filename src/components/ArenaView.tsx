import React, { useEffect, useRef, useState } from 'react';
import { createPreviewKit } from '../app/preview-kit.js';
import { devToolsEnabled } from '../app/dev-tools.js';
import type { MapId } from '../app/types';
import { MapSelect } from './MapSelect';

// ?dev adds the collision outlines toggle.
const devTools = devToolsEnabled(window.location.search);

export const ArenaView: React.FC<{ penza: boolean }> = ({ penza }) => {
  const [selectedArena, setSelectedArena] = useState<MapId>('empty');
  const [isClose, setIsClose] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showBounds, setShowBounds] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const penzaRef = useRef(penza);
  penzaRef.current = penza;
  const [kit] = useState(() => createPreviewKit({ penza: () => penzaRef.current }));

  useEffect(() => {
    const g = canvasRef.current?.getContext('2d');
    if (g)
      kit.drawArenaPlan(g, selectedArena, {
        close: isClose,
        labels: showLabels,
        bounds: showBounds,
      });
  }, [kit, selectedArena, isClose, showLabels, showBounds, penza]);

  const arena = kit.map(selectedArena);

  return (
    <div id="arenaView" className="overlay catalog">
      <main className="catalog-main">
        <header className="catalog-header">
          <div>
            <div className="eyebrow">КАРТА</div>
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
            Вся карта
          </button>

          <button
            type="button"
            className={isClose ? 'small is-current' : 'small'}
            onClick={() => setIsClose(true)}
          >
            Центр карты
          </button>

          <label className="catalog-check">
            <input
              type="checkbox"
              checked={showLabels}
              onChange={(e) => setShowLabels(e.target.checked)}
            />
            Цели карты
          </label>

          {devTools && (
            <label className="catalog-check">
              <input
                type="checkbox"
                checked={showBounds}
                onChange={(e) => setShowBounds(e.target.checked)}
              />
              Границы контура
            </label>
          )}
        </nav>

        {arena.notes && <p className="arena-notes">{arena.notes}</p>}

        <canvas
          ref={canvasRef}
          width={1320}
          height={1000}
          aria-label={`План карты: ${arena.name}`}
          className="arena-plan"
        />
      </main>
    </div>
  );
};
