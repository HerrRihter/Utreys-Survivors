import { baHealthPerKill } from '../../data/characters/ba-specialization.js';
import { Overlay } from './Overlay';
import { Portrait } from './Portrait';
import { useSession } from './session';

const primary = { background: 'var(--cyan)', color: '#041724', boxShadow: '4px 4px 0 #008ba3' };

export function MainMenu({
  hints,
  onNavigateToArena,
  onNavigateToOpponents,
}: {
  hints: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
}) {
  const session = useSession();
  const view = session.views.menu();
  const { commands } = session;
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
          Стресс-тест ядра Utrace в условиях пиковой нагрузки. Обрабатывай миллионы кодов
          маркировки, выдерживай наплыв запросов от клиентов (Пепси, Инбев, Марс) и отражай проверки
          контура! Освободите пять узлов от багов, затем победите ЦРПТ.
        </p>
        <div className="rule">
          <span>5 ГЕРОЕВ · 8 ВИДОВ ОРУЖИЯ · ЭВОЛЮЦИИ</span>
          <span>·</span>
          <span>5 УЗЛОВ · БАГИ-МИНИБОССЫ · КЛИЕНТЫ</span>
        </div>
        <div className="startline">
          <button id="shopOpen" className="small" onClick={commands.openShop}>
            УЛУЧШЕНИЯ
          </button>
          <button id="achievementsOpen" className="small" onClick={commands.openAchievements}>
            {view.achievementsLabel}
          </button>
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
          <button
            type="button"
            className="small"
            onClick={onNavigateToArena}
            style={{ color: 'var(--cyan)', cursor: 'pointer' }}
          >
            СЕРВЕРНЫЙ КОНТУР
          </button>
          <button
            type="button"
            className="small"
            onClick={onNavigateToOpponents}
            style={{ color: 'var(--cyan)', cursor: 'pointer' }}
          >
            ВРАГИ И КЛИЕНТЫ
          </button>
          <div className="record" id="record">
            {view.record}
          </div>
        </div>
        {hints && (
          <div id="menuHint" className="footer">
            WASD или стрелки — перемещение · трассировка кодов выполняется автоматически · сенсорный
            джойстик на мобильных
          </div>
        )}
      </main>
    </Overlay>
  );
}

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
              Конфигурация ядра
            </h2>
            <p>Выберите ядро для забега. Новые модификации открываются за коды в магазине.</p>
          </div>
          <button id="runHeroBack" className="small" onClick={commands.closeHeroSelect}>
            ← НАЗАД
          </button>
        </header>
        <div className="map-select">
          <label htmlFor="runMap">СЕРВЕРНЫЙ КОНТУР</label>
          <select
            id="runMap"
            value={view.map}
            disabled={view.mapLocked}
            onChange={(event) => commands.chooseMap(event.target.value)}
          >
            {view.maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
          <p id="mapDescription">{view.mapDescription}</p>
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
              className={`run-hero${hero.id === view.pending ? ' selected' : ''}`}
              data-hero={hero.id}
              onClick={() => commands.chooseHero(hero.id)}
            >
              <Portrait hero={hero.id} width={64} height={80} />
              <span className="run-hero-copy">
                <strong>{hero.name}</strong>
                <small>{hero.weapon}</small>
                {hero.role && <small className="run-hero-role">{hero.role}</small>}
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

export function Shop() {
  const session = useSession();
  const view = session.views.shop();
  const { commands } = session;
  return (
    <Overlay id="shop">
      <section className="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shopTitle">
        <button
          id="shopClose"
          className="small"
          style={{ float: 'right' }}
          onClick={commands.backToMenu}
        >
          ← В МЕНЮ
        </button>
        <h2 id="shopTitle" style={{ color: 'var(--cyan)' }}>
          Улучшения Utrace
        </h2>
        <p>Постоянные апгрейды серверной инфраструктуры за валидированные коды.</p>
        <p id="shopWallet">{view.wallet}</p>
        <p style={{ fontSize: '12px', lineHeight: 1.7 }}>
          Накопленные коды и апгрейды сохраняются между сессиями.
        </p>
        <h3>Ядро</h3>
        <div id="shopHeroes" className="shopgrid">
          {view.heroes.map((hero) => (
            <div key={hero.id} className="shopcard">
              <Portrait hero={hero.id} width={96} height={96} />
              <h3>{hero.name}</h3>
              <p>{hero.desc}</p>
              <small>{hero.info}</small>
              <button
                className="small"
                disabled={hero.disabled}
                onClick={() => commands.buyHero(hero.id)}
              >
                {hero.label}
              </button>
            </div>
          ))}
        </div>
        <h3>Постоянная оптимизация</h3>
        <p style={{ fontSize: '12px' }}>Улучшения применяются со следующей сессии.</p>
        <div id="shopUpgrades">
          {view.groups.map((group) => [
            <h4 key={group.title}>{group.title}</h4>,
            ...group.items.map((item) => (
              <button
                key={item.id}
                className="small"
                disabled={item.disabled}
                onClick={() => commands.buyUpgrade(item.id)}
              >
                {item.label}
              </button>
            )),
          ])}
        </div>
      </section>
    </Overlay>
  );
}

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
                <div className="achievement-icon">{card.icon}</div>
                <div className="achievement-info">
                  <h3>{card.title}</h3>
                  <p>{card.desc}</p>
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

function Toggle({ id, on, onClick }: { id: string; on: boolean; onClick: () => void }) {
  return (
    <button
      id={id}
      className="small"
      type="button"
      style={{ color: on ? 'var(--gold)' : '#99a896' }}
      onClick={onClick}
    >
      {on ? 'ВКЛ' : 'ВЫКЛ'}
    </button>
  );
}

export function SoundButton({ id, enabled }: { id: string; enabled: boolean }) {
  const session = useSession();
  return (
    <button
      id={id}
      className="small"
      type="button"
      aria-label="Переключить звук"
      aria-pressed={enabled}
      onClick={session.commands.toggleSound}
    >
      ЗВУК: {enabled ? 'ВКЛ' : 'ВЫКЛ'}
    </button>
  );
}

function VolumeSlider({
  id,
  label,
  kind,
  value,
}: {
  id: string;
  label: string;
  kind: 'music' | 'effects';
  value: number;
}) {
  const session = useSession();
  const percent = Math.round(value * 100);
  // A short cue confirms the level when the user lets go of the slider.
  const commit = (event: { currentTarget: HTMLInputElement }) =>
    session.commands.setVolume(kind, event.currentTarget.value, true);
  return (
    <div className="settings-slider-row">
      <div className="settings-slider-label">
        <span>{label}</span>
        <span id={`${id}Val`} className="settings-val">
          {percent}%
        </span>
      </div>
      <input
        id={id}
        type="range"
        min="0"
        max="100"
        value={percent}
        aria-label={kind === 'music' ? 'Громкость музыки' : 'Громкость эффектов'}
        onChange={(event) => session.commands.setVolume(kind, event.target.value)}
        onPointerUp={commit}
        onKeyUp={commit}
      />
    </div>
  );
}

function SettingRow({
  title,
  note,
  id,
  on,
  onClick,
}: {
  title: string;
  note: string;
  id: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <strong>{title}</strong>
        <small className="settings-note">{note}</small>
      </div>
      <Toggle id={id} on={on} onClick={onClick} />
    </div>
  );
}

export function Settings() {
  const session = useSession();
  const view = session.views.settings();
  const { commands } = session;
  return (
    <Overlay id="settings">
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settingsTitle"
      >
        <div className="settings-head">
          <div>
            <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
              ПАРАМЕТРЫ СИСТЕМЫ
            </div>
            <h2 id="settingsTitle">Настройки</h2>
          </div>
          <button id="settingsClose" className="small" onClick={commands.closeSettings}>
            ← НАЗАД
          </button>
        </div>
        <p>Звук, интерфейс и клавиши.</p>
        <div className="settings-grid">
          <div className="settings-card">
            <h3>♫ Звук</h3>
            <div className="settings-row">
              <span>Звуковые эффекты и фоновая музыка</span>
              <SoundButton id="settingsSound" enabled={view.enabled} />
            </div>
            <VolumeSlider id="musicVolume" label="Музыка" kind="music" value={view.music} />
            <VolumeSlider id="effectsVolume" label="Эффекты" kind="effects" value={view.effects} />
          </div>
          <div className="settings-card">
            <h3>Интерфейс и отклик</h3>
            <SettingRow
              title="Тряска экрана"
              note="Сотрясение камеры при критических перегрузках"
              id="settingShake"
              on={view.shake}
              onClick={() => commands.toggleSetting('shake')}
            />
            <SettingRow
              title="Подсказки управления"
              note="Горячие клавиши внизу экрана и советы первого забега"
              id="settingHints"
              on={view.hints}
              onClick={() => commands.toggleSetting('hints')}
            />
            <SettingRow
              title="Цифры урона"
              note="Числа над врагами при попадании"
              id="settingDamageNumbers"
              on={view.damageNumbers}
              onClick={() => commands.toggleSetting('damageNumbers')}
            />
            <div className="settings-row">
              <div>
                <strong>Масштаб интерфейса</strong>
                <small className="settings-note">Размер HUD, меню и кнопок</small>
              </div>
              <select
                id="settingUiScale"
                value={view.uiScale}
                aria-label="Масштаб интерфейса"
                onChange={(event) => commands.setUiScale(Number(event.target.value))}
              >
                {view.scales.map((scale: number) => (
                  <option key={scale} value={scale}>
                    {Math.round(scale * 100)}%
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="settings-card settings-keys">
            <h3>Управление</h3>
            <p className="settings-note">
              Нажми на клавишу действия, затем новую клавишу. Esc отменяет. Стрелки всегда двигают
              героя, Esc всегда ставит паузу.
            </p>
            {view.bindings.map((binding: { action: string; label: string; key: string }) => (
              <div key={binding.action} className="settings-row">
                <span>{binding.label}</span>
                <button
                  id={'bind-' + binding.action}
                  className={'small key-button' + (view.capture === binding.action ? ' armed' : '')}
                  type="button"
                  onClick={() => commands.startCapture(binding.action)}
                >
                  {view.capture === binding.action ? 'НАЖМИТЕ КЛАВИШУ…' : binding.key}
                </button>
              </div>
            ))}
            <button
              id="resetBindings"
              className="small"
              type="button"
              onClick={commands.resetBindings}
            >
              СБРОСИТЬ КЛАВИШИ
            </button>
          </div>
        </div>
        <div style={{ marginTop: '24px', textAlign: 'right' }}>
          <button
            id="settingsBack"
            className="primary"
            style={primary}
            onClick={commands.closeSettings}
          >
            ГОТОВО →
          </button>
        </div>
      </section>
    </Overlay>
  );
}
