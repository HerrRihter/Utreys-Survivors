import { Overlay } from '../Overlay';
import { useSession } from '../session';
import { SoundButton } from './SoundButton';

function Toggle({
  id,
  on,
  onClick,
  label,
}: {
  id: string;
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      id={id}
      className="small"
      type="button"
      aria-pressed={on}
      aria-label={`${label}: ${on ? 'включено' : 'выключено'}`}
      style={{ color: on ? 'var(--gold)' : '#99a896' }}
      onClick={onClick}
    >
      {on ? 'ВКЛ' : 'ВЫКЛ'}
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
      <Toggle id={id} on={on} onClick={onClick} label={title} />
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
        <p>{view.keyboard ? 'Звук, интерфейс и клавиши.' : 'Звук и интерфейс.'}</p>
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
              note={
                view.keyboard
                  ? 'Горячие клавиши внизу экрана и советы первого забега'
                  : 'Советы первого забега и пояснения на экранах'
              }
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
          <div className="settings-card">
            <h3>Журнал забегов</h3>
            <p className="settings-note">
              Каждый забег записывается на этом устройстве: герой, нагрузка, время, причина
              поражения, выбранные карточки и урон по источникам.
            </p>
            <div className="settings-row">
              <span id="runLogCount">Записей: {view.runLogCount}</span>
              <span>
                <button
                  id="exportRunLog"
                  className="small"
                  type="button"
                  disabled={!view.runLogCount}
                  onClick={commands.exportRunLog}
                >
                  ЭКСПОРТ JSON
                </button>{' '}
                <button
                  id="clearRunLog"
                  className="small"
                  type="button"
                  disabled={!view.runLogCount}
                  onClick={commands.clearRunLog}
                >
                  ОЧИСТИТЬ
                </button>
              </span>
            </div>
          </div>
          {view.keyboard && (
            <details className="settings-card settings-keys">
              <summary>
                <h3>Управление с клавиатуры</h3>
              </summary>
              <p className="settings-note">
                Нажми на клавишу действия, затем новую клавишу. Esc отменяет. Стрелки всегда двигают
                героя, Esc всегда ставит паузу.
              </p>
              {view.bindings.map((binding: { action: string; label: string; key: string }) => (
                <div key={binding.action} className="settings-row">
                  <span>{binding.label}</span>
                  <button
                    id={'bind-' + binding.action}
                    className={
                      'small key-button' + (view.capture === binding.action ? ' armed' : '')
                    }
                    type="button"
                    onClick={() => commands.startCapture(binding.action)}
                  >
                    {view.capture === binding.action ? 'НАЖМИ КЛАВИШУ…' : binding.key}
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
            </details>
          )}
        </div>
      </section>
    </Overlay>
  );
}
