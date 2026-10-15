import { Overlay } from './Overlay';
import { SoundButton } from './GameMenus';
import { useSession } from './session';

const primary = { background: 'var(--cyan)', color: '#041724', boxShadow: '4px 4px 0 #008ba3' };

export function PauseScreen({ soundEnabled }: { soundEnabled: boolean }) {
  const { commands } = useSession();
  return (
    <Overlay id="paused">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="pausedTitle">
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          ПАУЗА
        </div>
        <h2 id="pausedTitle">Обработка приостановлена</h2>
        <p>Буфер удерживает текущее состояние сессии.</p>
        <button id="resume" className="primary" style={primary} onClick={commands.pause}>
          ПРОДОЛЖИТЬ →
        </button>
        <SoundButton id="pauseSound" enabled={soundEnabled} />
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
  return (
    <Overlay id="levelup">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="levelupTitle">
        <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
          ОПТИМИЗАЦИЯ СЕРВЕРНОГО ЯДРА
        </div>
        <h2 id="levelupTitle">Выбери улучшение</h2>
        <p>Увеличь пропускную способность и стабильность Utrace.</p>
        <div id="cards" className="cards">
          {cards.map((card, i) => (
            <button
              key={card.name + i}
              className="upgrade"
              onClick={() => session.commands.pickUpgrade(i)}
            >
              <em>{card.icon}</em>
              <strong>{card.name}</strong>
              <span>{card.detail}</span>
              <span>{card.desc}</span>
              <span style={{ marginTop: '16px', color: '#00e5ff' }}>[ {i + 1} ]</span>
            </button>
          ))}
        </div>
        {hints && (
          <div id="levelupHint" className="footer">
            Нажми 1, 2, 3 или 4 для выбора
          </div>
        )}
      </div>
    </Overlay>
  );
}

export function EndScreen() {
  const session = useSession();
  const result = session.views.run().result;
  if (!result) return null;
  return (
    <Overlay id="end">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="endTitle">
        <div id="endTag" className="eyebrow" style={{ color: 'var(--cyan)' }}>
          {result.tag}
        </div>
        <h2 id="endTitle">{result.title}</h2>
        <p id="endText">{result.text}</p>
        <div id="endStats" className="stats">
          {result.stats.map((stat) => (
            <div key={stat.label}>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
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
