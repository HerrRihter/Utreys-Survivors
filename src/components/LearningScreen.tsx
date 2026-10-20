import type { LearningOption } from '../app/types';
import { Overlay } from './Overlay';
import { useSession } from './session';

export function LearningScreen() {
  const { views, commands } = useSession();
  const view = views.learning();
  const a = view?.active;
  if (!a) return null;
  const feedback = a.phase === 'feedback';
  return (
    <Overlay id="learning">
      <div
        className="modal learning-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="learning-title"
      >
        <div className="eyebrow">УЧЕБНЫЙ ПОЛИГОН · БОЙ ПРИОСТАНОВЛЕН</div>
        <h2 id="learning-title">{a.title}</h2>
        {a.phase === 'intro' && (
          <>
            <p>{a.note}</p>
            <p>{a.terms}</p>
            <p className="learning-source">{a.source}</p>
            <details className="learning-selfcheck">
              <summary>Открытые вопросы для самопроверки</summary>
              {view.selfChecks.map((q: { id: string; text: string; reference: string }) => (
                <div key={q.id}>
                  <p>{q.text}</p>
                  <small>{q.reference}</small>
                </div>
              ))}
            </details>
          </>
        )}
        {(a.phase === 'question' || feedback) && (
          <>
            <p className="learning-counter">
              Вопрос {a.index} из {a.total} ·{' '}
              {a.multiple ? 'Выбери все верные варианты' : 'Выбери один вариант'}
            </p>
            <fieldset className="learning-options" disabled={feedback}>
              <legend>{a.question}</legend>
              {a.options.map((o: LearningOption) => (
                <label
                  key={o.id}
                  className={
                    'learning-option' +
                    (o.correct ? ' correct' : '') +
                    (o.selected ? ' selected' : '')
                  }
                >
                  <input
                    type={a.multiple ? 'checkbox' : 'radio'}
                    name={'answer-' + a.id}
                    checked={o.selected}
                    onChange={() => commands.selectLearningAnswer(a.id, o.id)}
                  />
                  <span>
                    {o.text}
                    {o.correct && <strong> · Верный ответ</strong>}
                  </span>
                </label>
              ))}
            </fieldset>
            {!feedback && (
              <button
                className="primary"
                disabled={!a.canSubmit}
                onClick={() => commands.submitLearningAnswer(a.id)}
              >
                Подтвердить ответ
              </button>
            )}
            {feedback && (
              <>
                <div className="learning-feedback" role="status">
                  <strong>{a.lastCorrect ? 'Верно!' : 'Разберём ошибку'}</strong>
                  <p>{a.explanation}</p>
                </div>
                <button className="primary" onClick={() => commands.advanceLearning(a.id)}>
                  Продолжить
                </button>
              </>
            )}
          </>
        )}
        {a.phase === 'result' && (
          <>
            <p className="learning-result">
              {a.passed ? 'Тест пройден' : 'Нужно ещё немного практики'} · {a.correct}/{a.total}
            </p>
            <p>
              {a.passed
                ? a.reward
                : a.reason === 'revive'
                  ? 'Попытка возрождения не удалась. Забег завершится.'
                  : a.reason === 'bonus'
                    ? 'Бонусная попытка использована.'
                    : 'Вернись к терминалу, прочитай памятку и попробуй ещё раз.'}
            </p>
            <button className="primary" onClick={() => commands.closeLearning(a.id)}>
              {a.reason === 'revive' && !a.passed ? 'К результатам' : 'Продолжить'}
            </button>
          </>
        )}
        {a.phase === 'intro' && (
          <button className="primary" onClick={() => commands.advanceLearning(a.id)}>
            Начать тест
          </button>
        )}
        {a.phase !== 'result' && (
          <button className="small" onClick={() => commands.closeLearning(a.id)}>
            {a.reason === 'revive'
              ? 'Отказаться и завершить забег'
              : a.reason === 'bonus'
                ? 'Отказаться от бонуса'
                : 'Вернуться в комнату'}
          </button>
        )}
      </div>
    </Overlay>
  );
}
