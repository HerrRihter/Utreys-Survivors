import { memo } from 'react';
import { Overlay } from './Overlay';
import { GoalList } from './menus/GoalList';
import { primary } from './primary';
import { RunRecords } from './LeaderboardView';
import { useSession } from './session';

type BuildItem = {
  id: string;
  icon: string;
  name: string;
  level: number;
  max: number;
  evolved?: boolean;
  evolution?: string;
  needs?: string;
};
type Build = {
  weapons: BuildItem[];
  passives: BuildItem[];
  emptyWeapons: number;
  emptyPassives: number;
  archives: number;
  stats?: { label: string; value: string }[];
};

// Weapons and passives of the current run with their levels; empty slots are shown too.
// Memoized: the HUD passes the same build object until the build changes.
export const BuildPanel = memo(function BuildPanel({
  build,
  detailed,
}: {
  build: Build | null;
  detailed: boolean;
}) {
  if (!build) return null;
  const row = (items: BuildItem[], empty: number, label: string) => (
    <div className="build-row" aria-label={label}>
      {items.map((item) => (
        <div
          key={item.id}
          className={'build-slot' + (item.evolved ? ' evolved' : '')}
          title={`${item.name} · ур. ${item.level}/${item.max}`}
        >
          <i aria-hidden="true">{item.icon}</i>
          <b>{item.level}</b>
          {detailed && (
            <span>
              {item.name}
              {item.evolution && !item.evolved && (
                <small>
                  Эволюция: {item.evolution}
                  {item.needs ? ` (ур. ${item.max} + ${item.needs})` : ` (ур. ${item.max})`}
                </small>
              )}
              {item.evolved && <small>Эволюционировало</small>}
            </span>
          )}
        </div>
      ))}
      {Array.from({ length: empty }, (_, i) => (
        <div key={'empty' + i} className="build-slot empty" aria-hidden="true">
          <i>·</i>
        </div>
      ))}
    </div>
  );
  return (
    <div className={'build-panel' + (detailed ? ' detailed' : '')}>
      {detailed && <h3>Оружие</h3>}
      {row(build.weapons, build.emptyWeapons, 'Оружие')}
      {detailed && <h3>Пассивки</h3>}
      {row(build.passives, build.emptyPassives, 'Пассивки')}
      {detailed && build.stats && (
        <>
          <h3>Итоговые статы</h3>
          <dl className="build-stats">
            {build.stats.map((row) => (
              <div key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      {detailed && build.archives > 0 && (
        <p className="build-note">
          Архивов багов в запасе: {build.archives}. Они эволюционируют первое готовое оружие.
        </p>
      )}
    </div>
  );
});

export function PauseScreen() {
  const session = useSession();
  const { commands } = session;
  const build = session.views.build();
  return (
    <Overlay id="paused">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pausedTitle">
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          ПАУЗА
        </div>
        <h2 id="pausedTitle">Обработка приостановлена</h2>
        <BuildPanel build={build} detailed />
        <button id="resume" className="primary" style={primary} onClick={commands.pause}>
          ПРОДОЛЖИТЬ →
        </button>
        <button
          id="pauseSettings"
          className="small"
          onClick={() => commands.openSettings('paused')}
        >
          НАСТРОЙКИ
        </button>
        <button id="quit" className="small" onClick={commands.menu}>
          В МЕНЮ
        </button>
      </div>
    </Overlay>
  );
}

export function LevelUpScreen({ hints }: { hints: boolean }) {
  const session = useSession();
  const cards = session.views.levelUp();
  const controls = session.views.levelControls();
  const locked = (session.views.run().levelLock ?? 0) > 0;
  const { commands } = session;
  return (
    <Overlay id="levelup">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="levelupTitle">
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          ОПТИМИЗАЦИЯ СЕРВЕРНОГО ЯДРА
        </div>
        <h2 id="levelupTitle">
          {controls?.banishArmed ? 'Какую карточку убрать из забега?' : 'Выбери улучшение'}
        </h2>
        <div
          id="cards"
          className={'cards' + (locked ? ' locked' : '') + (controls?.banishArmed ? ' banish' : '')}
        >
          {cards.map((card, i) => (
            <button
              key={card.name + i}
              className={
                'upgrade' +
                (card.isNew ? ' is-new' : '') +
                (card.evolves ? ' evolves' : '') +
                ' kind-' +
                card.kind
              }
              aria-disabled={locked}
              onClick={() => session.commands.pickUpgrade(i)}
            >
              {card.isNew && <mark className="upgrade-badge">НОВОЕ</mark>}
              <em>{card.icon}</em>
              <strong>{card.name}</strong>
              <span className="upgrade-group">
                {card.group}
                {card.detail ? ' · ' + card.detail : ''}
              </span>
              <span>{card.desc}</span>
              {controls?.keyboard !== false && <span className="upgrade-key">[ {i + 1} ]</span>}
            </button>
          ))}
        </div>
        {controls && (
          <div className="level-controls">
            <button
              id="reroll"
              className="small"
              disabled={locked || controls.rerolls < 1}
              onClick={commands.reroll}
            >
              РЕРОЛЛ · {controls.rerolls}
              {controls.keys && ` [${controls.keys.reroll}]`}
            </button>
            <button
              id="banish"
              className={'small' + (controls.banishArmed ? ' armed' : '')}
              aria-pressed={controls.banishArmed}
              disabled={locked || controls.banishes < 1}
              onClick={commands.armBanish}
            >
              БАН · {controls.banishes}
              {controls.keys && ` [${controls.keys.banish}]`}
            </button>
            <button
              id="skip"
              className="small"
              disabled={locked || controls.skips < 1}
              onClick={commands.skip}
            >
              ПРОПУСТИТЬ · {controls.skips}
              {controls.keys && ` [${controls.keys.skip}]`}
            </button>
          </div>
        )}
        {hints && (
          <div id="levelupHint" className="footer">
            {controls?.keyboard !== false && 'Нажми 1, 2, 3 или 4 · '}одно из предложений всегда
            оружие · оружие 6 ур. + нужная пассивка эволюционирует от архива бага
          </div>
        )}
      </div>
    </Overlay>
  );
}

export function EndScreen() {
  const session = useSession();
  const run = session.views.run();
  const result = run.result;
  if (!result) return null;
  const top = result.damage.slice(0, 6);
  const runId: string = run.state?.runId ?? '';
  return (
    <Overlay id="end">
      <div className="modal end-modal" role="dialog" aria-modal="true" aria-labelledby="endTitle">
        <div id="endTag" className="eyebrow" style={{ color: 'var(--cyan)' }}>
          {result.tag}
        </div>
        <h2 id="endTitle">{result.title}</h2>
        <p id="endText">{result.text}</p>
        <div id="endStats" className="stats">
          {result.stats.map((stat: { value: string; label: string; best?: boolean }) => (
            <div key={stat.label} className={stat.best ? 'record-stat' : undefined}>
              <strong>{stat.value}</strong>
              <span>
                {stat.label}
                {stat.best ? ' · РЕКОРД' : ''}
              </span>
            </div>
          ))}
        </div>
        {top.length > 0 && (
          <div className="damage-report" aria-label="Урон по источникам">
            <h3>Урон по источникам</h3>
            {top.map((row: { tag: string; name: string; amount: number; share: number }) => (
              <div key={row.tag} className="damage-row">
                <span>{row.name}</span>
                <i style={{ width: `${Math.max(2, row.share)}%` }} />
                <b>
                  {row.amount.toLocaleString('ru-RU')} · {row.share}%
                </b>
              </div>
            ))}
          </div>
        )}
        <BuildPanel
          build={{ ...result.build, emptyWeapons: 0, emptyPassives: 0, archives: 0 }}
          detailed={false}
        />
        {result.unlocked.length > 0 && (
          <div id="endUnlocked" className="goal-list">
            <h3>Новое за забег</h3>
            {result.unlocked.map((item) => (
              <div key={item.id} className="goal done">
                <strong>✓ {item.title}</strong>
                {item.unlock && <small>Открыто: {item.unlock}</small>}
              </div>
            ))}
          </div>
        )}
        {runId && <RunRecords runId={runId} />}
        <GoalList goals={result.goals} title="Ближе всего к открытию" />
        {result.canContinue && (
          <button
            id="production"
            className="primary"
            style={primary}
            onClick={session.commands.continueProduction}
          >
            ПРОДОЛЖИТЬ В ПРОДАКШЕНЕ →
          </button>
        )}
        <p id="endSeed" className="end-seed">
          Сид забега: <b>{result.seed}</b> · узлы, баги и события повторятся с тем же сидом
        </p>
        <button id="againSeed" className="small" onClick={session.commands.restartSameSeed}>
          ТОТ ЖЕ СИД
        </button>
        <button id="again" className="primary" style={primary} onClick={session.commands.restart}>
          ПОВТОРИТЬ СЕССИЮ →
        </button>
        <button id="back" className="small" onClick={session.commands.menu}>
          В МЕНЮ
        </button>
      </div>
    </Overlay>
  );
}
