import { useState } from 'react';
import { AccountPanel } from '../Account';
import type { Account } from '../../app/types';
import type { CloudProgress } from '../../app/useGameSession';
import { Overlay } from '../Overlay';
import { StatsDialog } from '../StatsView';
import { LeaderboardDialog } from '../LeaderboardView';
import { useStore } from '../cloud-context';
import { useSession } from '../session';
import { primary } from '../primary';
import { GoalList } from './GoalList';

export function MainMenu({
  account,
  cloud,
  onNavigateToArena,
  onNavigateToOpponents,
}: {
  account: Account;
  cloud: CloudProgress | null;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
}) {
  const session = useSession();
  const view = session.views.menu();
  const { commands } = session;
  const [statsOpen, setStatsOpen] = useState(false);
  const [leadersOpen, setLeadersOpen] = useState(false);
  useStore(account);
  return (
    <Overlay id="menu" modal={false}>
      <main className="menu">
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          СИСТЕМА МАРКИРОВКИ И ТРАССИРОВКИ
        </div>
        <h1 className="title">
          UTRACE
          <br />
          <span style={{ color: 'var(--cyan)' }}>SURVIVORS</span>
        </h1>
        <p className="intro">
          Стресс-тест ядра Utrace в условиях пиковой нагрузки: выдержи наплыв клиентов и пройди
          проверку ЦРПТ.
        </p>
        <button
          type="button"
          id="collection"
          className="rule collection"
          title="Открыть энциклопедию"
          onClick={commands.openEncyclopedia}
        >
          {view.collection.map((item, i) => (
            <span key={item.label}>
              {i > 0 && <span aria-hidden="true">·</span>}
              {item.label} <b>{item.have}</b>/{item.total}
            </span>
          ))}
        </button>
        <AccountPanel account={account} cloud={cloud} />
        <div className="startline">
          <button id="shopOpen" className="small" onClick={commands.openShop}>
            УЛУЧШЕНИЯ
          </button>
          <button id="achievementsOpen" className="small" onClick={commands.openAchievements}>
            {view.achievementsLabel}
          </button>
          <button id="encyclopediaOpen" className="small" onClick={commands.openEncyclopedia}>
            ЭНЦИКЛОПЕДИЯ
          </button>
          <button type="button" className="small" onClick={onNavigateToOpponents}>
            ВРАГИ И КЛИЕНТЫ
          </button>
          <button type="button" className="small" onClick={onNavigateToArena}>
            КАРТА
          </button>
          <button id="statsOpen" className="small" onClick={() => setStatsOpen(true)}>
            СТАТИСТИКА
          </button>
          {account.state.status !== 'disabled' && (
            <button id="leadersOpen" className="small" onClick={() => setLeadersOpen(true)}>
              ЛИДЕРЫ
            </button>
          )}
          <button id="settingsOpen" className="small" onClick={() => commands.openSettings('menu')}>
            НАСТРОЙКИ
          </button>
          <span id="wallet">{view.wallet}</span>
          {view.resume && (
            <button
              id="resumeRun"
              className="primary"
              style={primary}
              title={view.resume}
              onClick={commands.resume}
            >
              ПРОДОЛЖИТЬ ЗАБЕГ · {view.resume}
            </button>
          )}
          <button
            id="start"
            className={view.resume ? 'small' : 'primary'}
            style={view.resume ? undefined : primary}
            onClick={commands.openHeroSelect}
          >
            {view.resume ? 'НОВЫЙ ЗАБЕГ' : 'ЗАПУСК СЕССИИ →'}
          </button>
          <div className="record" id="record">
            {view.record}
          </div>
        </div>
        <GoalList goals={view.goals} title="Ближайшие открытия" />
        {statsOpen && <StatsDialog onClose={() => setStatsOpen(false)} />}
        {leadersOpen && <LeaderboardDialog onClose={() => setLeadersOpen(false)} />}
      </main>
    </Overlay>
  );
}
