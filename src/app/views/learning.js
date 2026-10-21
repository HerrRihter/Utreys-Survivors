import { learningRules } from '../../../data/learning-rules.js';
import {
  availableTerminal,
  availableExit,
  courseOf,
  roomNodes,
} from '../../systems/queries/learning.js';
import { mapDefinitions } from '../../../data/maps/maps.js';

const percent = (share) => Math.round(share * 100) + '%';

const nextRoomName = (s) => mapDefinitions[s.map].rooms[s.learning.roomIndex + 1]?.name ?? '';

export function learningView({ run }) {
  const s = run.state,
    l = s?.learning;
  if (!l) return null;
  const a = l.active,
    course = courseOf(s.map);
  const q = a && course.questions.find((q) => q.id === a.questions[a.index].id);
  const reveal = a?.phase === 'feedback';
  const r = learningRules,
    revival = `вернёшься в бой с ${percent(r.reviveHealth)} здоровья и защитой на ${r.reviveInvulnerability} с`;
  return {
    terminals: roomNodes(s)
      .filter((n) => availableTerminal(s, n.id))
      .map((n) => ({ id: n.id, label: n.label })),
    // The door's button names where it leads.
    exit: availableExit(s) ? `В ${nextRoomName(s).toLowerCase()} →` : '',
    selfChecks: course.questions
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
              ? `Ответь верно хотя бы на ${r.passing} из ${r.questions}: ${revival}. При провале или отказе забег закончится.`
              : course.topics[a.topic].note,
          title: a.reason === 'revive' ? 'Вторая жизнь за знания' : course.topics[a.topic].name,
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
          // Quiz terms and rewards, from the rules.
          terms: `Вопросов: ${r.questions}, нужно верных: ${r.passing}. Каждая ошибка приведёт проверку.`,
          reward:
            a.reason === 'revive'
              ? revival[0].toUpperCase() + revival.slice(1) + '.'
              : 'Награда: пакет обновлений у терминала.',
        }
      : null,
  };
}
