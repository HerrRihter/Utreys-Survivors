import { baHealthPerKill } from '../../../data/characters/ba-specialization.js';
import { Overlay } from '../Overlay';
import { Portrait } from '../Portrait';
import { useSession } from '../session';
import { primary } from '../primary';

export function HeroSelect() {
  const session = useSession();
  const view = session.views.heroSelect();
  const { commands } = session;
  return (
    <Overlay id="runHeroSelect">
      <section
        className="run-hero-select"
        role="dialog"
        aria-modal="true"
        aria-labelledby="runHeroTitle"
      >
        <header className="run-hero-head">
          <div>
            <h2 id="runHeroTitle" style={{ color: 'var(--cyan)' }}>
              Выбор героя
            </h2>
            <p>Выбери героя для забега. Новых героев открывают за коды в разделе «Улучшения».</p>
          </div>
          <button id="runHeroBack" className="small" onClick={commands.closeHeroSelect}>
            ← НАЗАД
          </button>
        </header>
        <div className="map-select">
          <label htmlFor="runMap">КАРТА</label>
          <select
            id="runMap"
            value={view.map}
            disabled={view.mapLocked}
            onChange={(event) => commands.chooseMap(event.target.value)}
          >
            {view.maps.map((map) => (
              <option key={map.id} value={map.id} disabled={map.locked}>
                {map.name}
                {map.locked ? ' · закрыто' : ''}
              </option>
            ))}
          </select>
          <p id="mapDescription">{view.mapDescription}</p>
          {view.mapHint && <p>{view.mapHint}</p>}
          <label htmlFor="runSeed">СИД ЗАБЕГА</label>
          <input
            id="runSeed"
            className="seed-input"
            value={view.seed}
            maxLength={7}
            placeholder="случайный"
            onChange={(event) => commands.chooseSeed(event.target.value)}
          />
        </div>
        <div className="map-select">
          <label htmlFor="runLoad">НАГРУЗКА</label>
          <select
            id="runLoad"
            value={view.load}
            onChange={(event) => commands.chooseLoad(Number(event.target.value))}
          >
            {view.loads.map((entry) => (
              <option key={entry.level} value={entry.level} disabled={entry.locked}>
                {entry.label}
                {entry.locked ? ' · закрыто' : ''}
              </option>
            ))}
          </select>
          <p id="loadDescription">{view.loadDescription}</p>
          <p id="loadProgress">{view.loadProgress}</p>
        </div>
        <div id="runHeroes" className="run-heroes">
          {view.heroes.map((hero) => (
            <button
              key={hero.id}
              type="button"
              className={`run-hero${hero.id === view.pending ? ' selected' : ''}${hero.locked ? ' locked' : ''}`}
              data-hero={hero.id}
              disabled={hero.locked}
              title={
                hero.locked ? `Открывается в разделе «Улучшения» за ${hero.price} кодов` : undefined
              }
              onClick={() => commands.chooseHero(hero.id)}
            >
              <Portrait hero={hero.id} width={64} height={80} />
              <span className="run-hero-copy">
                <strong>{hero.name}</strong>
                <small>{hero.weapon}</small>
                {hero.locked ? (
                  <small className="run-hero-price">Закрыт · {hero.price} кодов</small>
                ) : (
                  hero.role && <small className="run-hero-role">{hero.role}</small>
                )}
              </span>
            </button>
          ))}
        </div>
        {view.showBaClients && (
          <div id="baClientChoice" className="map-select">
            <label htmlFor="baClient">КЛИЕНТ БА</label>
            <select
              id="baClient"
              value={view.baClient}
              onChange={(event) => commands.chooseBaClient(event.target.value)}
            >
              {view.baClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            <p>
              За каждое убийство выбранного клиента: +{baHealthPerKill} к текущему и максимальному
              HP до конца забега.
            </p>
          </div>
        )}
        <footer className="run-hero-foot">
          <div id="runHeroStats" className="run-hero-stats">
            {view.role && <strong className="run-hero-role-line">{view.role}</strong>}
            {view.stats}
          </div>
          <div className="run-hero-actions">
            <button
              id="runHeroStart"
              className="primary"
              style={primary}
              onClick={commands.startSelected}
            >
              СТАРТ →
            </button>
          </div>
        </footer>
      </section>
    </Overlay>
  );
}
