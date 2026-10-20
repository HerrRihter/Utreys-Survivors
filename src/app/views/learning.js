import { learningCourse } from '../../../data/learning-questions.js';
import { learningRules } from '../../../data/learning-rules.js';
import { availableTerminal, availableExit, currentRoom } from '../../systems/queries/learning.js';

export function learningView({ run }) {
  const s = run.state,
    l = s?.learning;
  if (!l) return null;
  const a = l.active;
  const q = a && learningCourse.questions.find((q) => q.id === a.questions[a.index].id);
  const reveal = a?.phase === 'feedback';
  return {
    room: currentRoom(s).name,
    roomNumber: l.roomIndex + 1,
    points: l.points,
    reviveAvailable: !l.reviveUsed,
    terminals: s.nodes
      .filter((n) => availableTerminal(s, n.id))
      .map((n) => ({ id: n.id, label: n.label })),
    exit: availableExit(s),
    selfChecks: learningCourse.questions
      .filter((q) => q.type === 'open')
      .map((q) => ({ id: q.id, text: q.text, reference: q.reference })),
    active: a
      ? {
          id: a.id,
          phase: a.phase,
          reason: a.reason,
          index: a.index + 1,
          total: a.questions.length,
          note:
            a.topic === null
              ? 'Ответь правильно минимум на 2 вопроса из 3: вернёшься в бой с половиной здоровья. При провале или отказе забег закончится.'
              : learningCourse.topics[a.topic].note,
          title:
            a.reason === 'revive'
              ? 'Вторая жизнь за знания'
              : a.reason === 'bonus'
                ? 'Бонус знаний'
                : learningCourse.topics[a.topic].name,
          question: q.text,
          multiple: q.type === 'multiple',
          options: a.questions[a.index].options.map((id) => ({
            id,
            text: q.options.find((o) => o.id === id).text,
            selected: a.selected.includes(id),
            correct: reveal && q.correct.includes(id),
          })),
          canSubmit: a.selected.length > 0,
          correct: a.correct,
          passed: a.passed,
          lastCorrect: a.lastCorrect,
          explanation: reveal ? q.explanation : '',
          source: learningCourse.source,
          pointsPerAnswer: learningRules.points,
        }
      : null,
  };
}
