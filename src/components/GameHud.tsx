import type { LearningTerminal } from '../app/types';
import { SoundButton } from './menus/SoundButton';
import { BuildPanel } from './GameRunScreens';
import { useHudVersion, useSession } from './session';

const hidden = (visible: boolean, className = '') =>
  [className, visible ? '' : 'hidden'].filter(Boolean).join(' ') || undefined;

// In-run overlay, re-rendered from the session's HUD store (about 10 Hz).
export function GameHud({ soundEnabled }: { soundEnabled: boolean }) {
  const session = useSession();
  useHudVersion(session);
  const hud = session.views.hud();
  const run = session.views.run();
  const { commands } = session;
  const learning = session.views.learning();
  const stick = hud?.stick;
  // The corner sound button stays above every screen; settings have their own sound toggle.
  const ownSound = run.screen === 'settings';
  return (
    <>
      <div id="hud" className={hidden(!!hud, 'hud')}>
        {hud?.event && (
          <div id="runEvent" className="run-event">
            {hud.event}
          </div>
        )}
        <div id="nodeProgress" className="node-progress">
          {hud?.progress}
        </div>
        <div className="hudbox">
          <div className="label" id="heroLabel">
            {hud?.heroLabel ?? 'UTRACE'}
          </div>
          <div className="bar">
            <i id="health" style={{ width: `${hud?.healthPct ?? 100}%` }}></i>
          </div>
          <div className="bar xp">
            <i id="xp" style={{ width: `${hud?.xpPct ?? 0}%` }}></i>
          </div>
          <div style={{ fontSize: '10px', marginTop: '8px' }} id="levelText">
            {hud?.levelText}
          </div>
          <BuildPanel build={hud?.build ?? null} detailed={false} />
        </div>
        <div className="topcenter">
          <div className="clock" id="time">
            {hud?.time ?? '00:00'}
          </div>
          <div className="label">ВРЕМЯ СЕССИИ</div>
        </div>
        <div className="hudbox hudright">
          <div id="kills">{hud?.kills}</div>
          <div id="weapon">{hud?.weapon}</div>
          <div id="codes" style={{ color: 'var(--cyan)' }}>
            {hud?.codes}
          </div>
        </div>
      </div>

      {learning && run.mode === 'play' && (
        <div className="learning-hud">
          <strong>
            Комната {learning.roomNumber}/4 · {learning.room}
          </strong>
          <span>
            {learning.points} очков ·{' '}
            {learning.reviveAvailable ? 'Вторая жизнь доступна' : 'Вторая жизнь использована'}
          </span>
          {learning.terminals.map((n: LearningTerminal) => (
            <button key={n.id} onClick={() => commands.startLearningTest(n.id)}>
              Тест: {n.label}
            </button>
          ))}
          {learning.exit && (
            <>
              <button onClick={commands.moveLearningRoom}>В следующую комнату →</button>
              <small>Неподобранные предметы останутся здесь</small>
            </>
          )}
        </div>
      )}
      <div id="hint" className={hidden(!!hud?.showHint, 'controls')}>
        {hud?.hint}
      </div>

      <div id="actions" className="actions">
        {!ownSound && <SoundButton id="sound" enabled={soundEnabled} />}
        <button
          id="pause"
          className={hidden(!!hud?.showPause, 'small')}
          aria-label="Пауза"
          onClick={commands.pause}
        >
          Ⅱ ПАУЗА
        </button>
      </div>

      <div id="tip" className="tip" role="status" style={{ opacity: hud?.tip ? 1 : 0 }}>
        {hud?.tip}
      </div>

      <div id="toast" style={{ opacity: run.toast.left > 0 ? 1 : 0 }}>
        {run.toast.text}
      </div>

      <div id="bossbar" className={hidden(!!hud?.boss)}>
        <span id="bossname">{hud?.boss?.name ?? 'ШЛЮЗ ЦРПТ'}</span>
        <div className="bossfill">
          <i id="bosshealth" style={{ width: `${hud?.boss?.pct ?? 100}%` }}></i>
        </div>
      </div>

      <div
        id="abilities"
        className={hidden(!!hud?.showAbilities, 'ability-controls')}
        aria-label="Умения Utrace"
      >
        {[0, 1].map((slot) => {
          const ability = hud?.abilities[slot];
          return (
            <button
              key={slot}
              id={'ability' + slot}
              type="button"
              data-name={ability?.name}
              data-status={ability?.status}
              aria-label={ability ? `${ability.name}: ${ability.status}` : undefined}
              title={ability?.title}
              disabled={ability ? ability.disabled : true}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => commands.activateAbility(slot)}
            >
              {ability?.label}
            </button>
          );
        })}
      </div>

      <div
        id="stick"
        className={hidden(!!hud && hud.showPause, 'touch' + (stick ? ' engaged' : ''))}
        style={
          stick
            ? {
                left: stick.x,
                top: stick.y,
                bottom: 'auto',
                right: 'auto',
                transform: 'translate(-50%, -50%)',
              }
            : undefined
        }
      >
        <i
          id="knob"
          style={stick ? { transform: `translate(${stick.knobX}px,${stick.knobY}px)` } : undefined}
        ></i>
      </div>
    </>
  );
}
