import { Overlay } from '../Overlay';
import { useSession } from '../session';

type Entry = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  locked: boolean;
  condition: string;
  evolution: { name: string; desc: string; recipe: string; discovered: boolean } | null;
};

function EntryCard({ entry }: { entry: Entry }) {
  return (
    <div className={'codex-card' + (entry.locked ? ' locked' : '')}>
      <div className="codex-head">
        <i aria-hidden="true">{entry.icon}</i>
        <div>
          <h4>{entry.name}</h4>
          <p>{entry.desc}</p>
        </div>
      </div>
      {entry.condition && <small className="codex-condition">{entry.condition}</small>}
      {entry.evolution && (
        <div className={'codex-evo' + (entry.evolution.discovered ? ' found' : '')}>
          <b>Эволюция: {entry.evolution.name}</b>
          <small>{entry.evolution.desc}</small>
          <small>Рецепт: {entry.evolution.recipe}</small>
        </div>
      )}
    </div>
  );
}

// Weapons, passives and evolutions next to the bestiary.
export function Encyclopedia() {
  const session = useSession();
  const view = session.views.encyclopedia();
  return (
    <Overlay id="encyclopedia">
      <section
        className="achievements-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="encyclopediaTitle"
      >
        <button
          id="encyclopediaClose"
          className="small"
          style={{ float: 'right' }}
          onClick={session.commands.backToMenu}
        >
          ← В МЕНЮ
        </button>
        <h2 id="encyclopediaTitle" style={{ color: 'var(--cyan)' }}>
          Энциклопедия
        </h2>
        <p>
          Эволюций открыто: {view.found} из {view.total}. Неоткрытое оружие показано силуэтом с
          условием.
        </p>
        <h3>Оружие</h3>
        <div className="codex-grid">
          {view.weapons.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
        <h3>Атаки героев</h3>
        <div className="codex-grid">
          {view.heroes.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
        <h3>Пассивки</h3>
        <div className="codex-grid">
          {view.passives.map((entry) => (
            <EntryCard key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </Overlay>
  );
}
