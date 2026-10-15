import React from 'react';
import { useGameSession } from '../app/useGameSession';
import { useGameDialogs } from '../ui/useGameDialogs';

interface GameViewProps {
  active: boolean;
  onNavigateToArena: () => void;
  onNavigateToOpponents: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  active,
  onNavigateToArena,
  onNavigateToOpponents,
}) => {
  useGameSession(active);
  useGameDialogs();

  return (
    <>
      <canvas
        id="game"
        aria-label="Контур валидации Utrace"
        style={{ width: '100vw', height: '100vh', display: 'block', imageRendering: 'pixelated' }}
      />

      <div id="hud" className="hud hidden">
        <div id="nodeProgress" className="node-progress" />
        <div className="hudbox">
          <div className="label" id="heroLabel">
            UTRACE
          </div>
          <div className="bar">
            <i id="health"></i>
          </div>
          <div className="bar xp">
            <i id="xp"></i>
          </div>
          <div style={{ fontSize: '10px', marginTop: '8px' }} id="levelText"></div>
        </div>
        <div className="topcenter">
          <div className="clock" id="time">
            00:00
          </div>
          <div className="label">ВРЕМЯ СЕССИИ</div>
        </div>
        <div className="hudbox hudright">
          <div id="kills"></div>
          <div id="weapon"></div>
          <div id="helmets" style={{ color: 'var(--cyan)' }}></div>
        </div>
      </div>

      <div id="hint" className="controls hidden">
        WASD / СТРЕЛКИ — ПЕРЕМЕЩЕНИЕ &nbsp; · &nbsp; ТРАССИРОВКА — АВТОМАТИЧЕСКИ &nbsp; · &nbsp; Q /
        E — УМЕНИЯ &nbsp; · &nbsp; ESC — ПАУЗА · УЗЛЫ: УНИЧТОЖЬТЕ БАГ ИЛИ СТОЙТЕ В КРУГЕ 6 С
      </div>

      <div id="actions" className="actions">
        <button id="sound" className="small" aria-label="Переключить звук">
          ЗВУК: ВКЛ
        </button>
        <button id="pause" className="small hidden" aria-label="Пауза">
          Ⅱ ПАУЗА
        </button>
      </div>

      <div id="toast" style={{ opacity: 0 }}></div>

      <div id="bossbar" className="hidden">
        <span id="bossname">ШЛЮЗ ЦРПТ</span>
        <div className="bossfill">
          <i id="bosshealth"></i>
        </div>
      </div>

      <div id="abilities" className="ability-controls hidden" aria-label="Умения Utrace">
        <button id="ability0" type="button"></button>
        <button id="ability1" type="button"></button>
      </div>

      <div id="stick" className="touch hidden">
        <i id="knob"></i>
      </div>

      {/* Main Menu Overlay */}
      <div id="menu" className="overlay">
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
            маркировки, выдерживай наплыв запросов от клиентов (Пепси, Инбев, Марс) и отражай
            проверки контура! Освободите пять узлов от багов, затем победите ЦРПТ.
          </p>
          <div className="rule">
            <span>1 ГЕРОЙ: UTRACE</span>
            <span>·</span>
            <span>5 УЗЛОВ · БАГИ-МИНИБОССЫ · КЛИЕНТЫ</span>
          </div>
          <div className="startline">
            <button id="shopOpen" className="small">
              УЛУЧШЕНИЯ
            </button>
            <button id="achievementsOpen" className="small">
              ДОСТИЖЕНИЯ
            </button>
            <button id="settingsOpen" className="small">
              НАСТРОЙКИ
            </button>
            <span id="wallet"></span>
            <button
              id="start"
              className="primary"
              style={{
                background: 'var(--cyan)',
                color: '#041724',
                boxShadow: '4px 4px 0 #008ba3',
              }}
            >
              ЗАПУСК СЕССИИ →
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
            <div className="record" id="record"></div>
          </div>
          <div id="menuHint" className="footer">
            WASD или стрелки — перемещение · трассировка кодов выполняется автоматически · сенсорный
            джойстик на мобильных
          </div>
        </main>
      </div>

      {/* Run Hero Select Modal */}
      <div id="runHeroSelect" className="overlay hidden" style={{ zIndex: 40 }}>
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
            <button id="runHeroBack" className="small">
              ← НАЗАД
            </button>
          </header>
          <div className="map-select">
            <label htmlFor="runMap">СЕРВЕРНЫЙ КОНТУР</label>
            <select id="runMap"></select>
            <p id="mapDescription">
              Высоконагруженный контур валидации данных и стресс-тестирования сервисов Utrace.
            </p>
          </div>
          <div id="runHeroes" className="run-heroes"></div>
          <footer className="run-hero-foot">
            <div id="runHeroStats" className="run-hero-stats"></div>
            <div className="run-hero-actions">
              <button
                id="runHeroStart"
                className="primary"
                style={{
                  background: 'var(--cyan)',
                  color: '#041724',
                  boxShadow: '4px 4px 0 #008ba3',
                }}
              >
                СТАРТ →
              </button>
            </div>
          </footer>
        </section>
      </div>

      {/* Level Up Modal */}
      <div id="levelup" className="overlay hidden" style={{ zIndex: 40 }}>
        <div className="modal">
          <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
            ОПТИМИЗАЦИЯ СЕРВЕРНОГО ЯДРА
          </div>
          <h2>Выбери улучшение</h2>
          <p>Увеличь пропускную способность и стабильность Utrace.</p>
          <div id="cards" className="cards"></div>
          <div id="levelupHint" className="footer">
            Нажми 1, 2, 3 или 4 для выбора
          </div>
        </div>
      </div>

      {/* Paused Modal */}
      <div id="paused" className="overlay hidden" style={{ zIndex: 40 }}>
        <div className="modal">
          <div className="eyebrow" style={{ color: 'var(--cyan)' }}>
            ПАУЗА
          </div>
          <h2>Обработка приостановлена</h2>
          <p>Буфер удерживает текущее состояние сессии.</p>
          <button
            id="resume"
            className="primary"
            style={{ background: 'var(--cyan)', color: '#041724', boxShadow: '4px 4px 0 #008ba3' }}
          >
            ПРОДОЛЖИТЬ →
          </button>
          <button id="pauseSound" className="small" aria-label="Переключить звук">
            ЗВУК: ВКЛ
          </button>
          <button id="pauseSettings" className="small">
            НАСТРОЙКИ
          </button>
          <button id="quit" className="small">
            В МЕНЮ
          </button>
        </div>
      </div>

      {/* End Run Modal */}
      <div id="end" className="overlay hidden" style={{ zIndex: 40 }}>
        <div className="modal">
          <div id="endTag" className="eyebrow" style={{ color: 'var(--cyan)' }}></div>
          <h2 id="endTitle"></h2>
          <p id="endText"></p>
          <div id="endStats" className="stats"></div>
          <button
            id="again"
            className="primary"
            style={{ background: 'var(--cyan)', color: '#041724', boxShadow: '4px 4px 0 #008ba3' }}
          >
            ПОВТОРИТЬ СЕССИЮ →
          </button>
          <button id="back" className="small">
            В МЕНЮ
          </button>
        </div>
      </div>

      {/* Shop Modal */}
      <div id="shop" className="overlay hidden" style={{ zIndex: 40 }}>
        <section className="shop-panel" role="dialog" aria-modal="true" aria-labelledby="shopTitle">
          <button id="shopClose" className="small" style={{ float: 'right' }}>
            ← В МЕНЮ
          </button>
          <h2 id="shopTitle" style={{ color: 'var(--cyan)' }}>
            Улучшения Utrace
          </h2>
          <p>Постоянные апгрейды серверной инфраструктуры за валидированные коды.</p>
          <p id="shopWallet"></p>
          <p style={{ fontSize: '12px', lineHeight: 1.7 }}>
            Накопленные коды и апгрейды сохраняются между сессиями.
          </p>
          <h3>Ядро</h3>
          <div id="shopHeroes" className="shopgrid"></div>
          <h3>Постоянная оптимизация</h3>
          <p style={{ fontSize: '12px' }}>Улучшения применяются со следующей сессии.</p>
          <div id="shopUpgrades"></div>
        </section>
      </div>

      {/* Achievements Modal */}
      <div id="achievements" className="overlay hidden" style={{ zIndex: 40 }}>
        <section
          className="achievements-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="achievementsTitle"
        >
          <button id="achievementsClose" className="small" style={{ float: 'right' }}>
            ← В МЕНЮ
          </button>
          <h2 id="achievementsTitle" style={{ color: 'var(--cyan)' }}>
            Достижения Utrace
          </h2>
          <p>Выполняй задачи по обработке потоков маркировки и получай премиальные коды.</p>
          <div id="achievementsSummary" className="achievements-summary"></div>
          <div id="achievementsList" className="achievements-grid"></div>
        </section>
      </div>

      {/* Settings Modal */}
      <div id="settings" className="overlay hidden" style={{ zIndex: 40 }}>
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
            <button id="settingsClose" className="small">
              ← НАЗАД
            </button>
          </div>
          <p>Параметры звука и визуальной отдачи.</p>
          <div className="settings-grid">
            <div className="settings-card">
              <h3>♫ Звук</h3>
              <div className="settings-row">
                <span>Звуковые эффекты и фоновая музыка</span>
                <button
                  id="settingsSound"
                  className="small"
                  type="button"
                  aria-label="Переключить звук"
                >
                  ЗВУК: ВКЛ
                </button>
              </div>
              <div className="settings-slider-row">
                <div className="settings-slider-label">
                  <span>Музыка</span>
                  <span id="musicVolumeVal" className="settings-val">
                    30%
                  </span>
                </div>
                <input
                  id="musicVolume"
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="30"
                  aria-label="Громкость музыки"
                />
              </div>
              <div className="settings-slider-row">
                <div className="settings-slider-label">
                  <span>Эффекты</span>
                  <span id="effectsVolumeVal" className="settings-val">
                    65%
                  </span>
                </div>
                <input
                  id="effectsVolume"
                  type="range"
                  min="0"
                  max="100"
                  defaultValue="65"
                  aria-label="Громкость эффектов"
                />
              </div>
            </div>
            <div className="settings-card">
              <h3>Интерфейс и отклик</h3>
              <div className="settings-row">
                <div>
                  <strong>Тряска экрана</strong>
                  <small style={{ display: 'block', color: '#7e9fa8', fontSize: '11px' }}>
                    Сотрясение камеры при критических перегрузках
                  </small>
                </div>
                <button id="settingShake" className="small" type="button">
                  ВКЛ
                </button>
              </div>
              <div className="settings-row">
                <div>
                  <strong>Подсказки управления</strong>
                  <small style={{ display: 'block', color: '#7e9fa8', fontSize: '11px' }}>
                    Показывать горячие клавиши внизу экрана
                  </small>
                </div>
                <button id="settingHints" className="small" type="button">
                  ВКЛ
                </button>
              </div>
            </div>
          </div>
          <div style={{ marginTop: '24px', textAlign: 'right' }}>
            <button
              id="settingsBack"
              className="primary"
              style={{
                background: 'var(--cyan)',
                color: '#041724',
                boxShadow: '4px 4px 0 #008ba3',
              }}
            >
              ГОТОВО →
            </button>
          </div>
        </section>
      </div>
    </>
  );
};
