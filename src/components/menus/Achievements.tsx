import { Overlay } from '../Overlay';
import { AchievementIcon } from '../AchievementIcon';
import { useSession } from '../session';

export function Achievements() {
  const session = useSession();
  const view = session.views.achievements();
  const { commands } = session;
  return (
    <Overlay id="achievements">
      <section
        className="achievements-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="achievementsTitle"
      >
        <button
          id="achievementsClose"
          className="small"
          style={{ float: 'right' }}
          onClick={commands.backToMenu}
        >
          ← В МЕНЮ
        </button>
        <h2 id="achievementsTitle" style={{ color: 'var(--cyan)' }}>
          Достижения Utrace
        </h2>
        <p>Выполняй задачи по обработке потоков маркировки и получай премиальные коды.</p>
        <div id="achievementsSummary" className="achievements-summary">
          <div className="achievements-summary-header">
            <span>
              Выполнено: {view.completed} из {view.total} ({view.percent}%)
            </span>
            <span>
              Получено наград: {view.claimed} / {view.total}
            </span>
          </div>
          <div className="achievements-bar">
            <i style={{ width: `${view.percent}%` }} />
          </div>
        </div>
        <div id="achievementsList" className="achievements-grid">
          {view.cards.map((card) => (
            <div
              key={card.id}
              className={`achievement-card${card.done ? ' completed' : ''}${card.claimed ? ' claimed' : ''}`}
            >
              <div className="achievement-head">
                <div className="achievement-icon">
                  <AchievementIcon id={card.id} />
                </div>
                <div className="achievement-info">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
                  {card.unlock && <p className="achievement-unlock">Открывает: {card.unlock}</p>}
                </div>
              </div>
              <div className="achievement-progress">
                <div className="achievement-progress-info">
                  <span>{card.progressText}</span>
                  <span>{card.percent}%</span>
                </div>
                <div className="achievements-bar">
                  <i style={{ width: `${card.percent}%` }} />
                </div>
              </div>
              <div className="achievement-foot">
                <span className="achievement-reward">
                  {card.rewardText}
                  {card.codeToken && <i className="ach-codeToken-icon" aria-hidden="true" />}
                </span>
                {card.claimed ? (
                  <span className="ach-badge claimed">✓ ПОЛУЧЕНО</span>
                ) : card.done ? (
                  <button
                    className="primary ach-claim"
                    aria-label={`Забрать награду «${card.title}»: +${card.reward}`}
                    onClick={() => commands.claimAchievement(card.id)}
                  >
                    <span>ЗАБРАТЬ +{card.reward}</span>
                    {card.codeToken && <i className="ach-codeToken-icon" aria-hidden="true" />}
                  </button>
                ) : (
                  <span className="ach-badge in-progress">В ПРОЦЕССЕ</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Overlay>
  );
}
