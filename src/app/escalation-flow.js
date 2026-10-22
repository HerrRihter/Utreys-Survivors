import {
  answerInject,
  answerReview,
  answerTicketQuestion,
  applyWorkaround,
  askSeverity,
  callRole,
  createTicket,
  moveStatus,
  openTicket,
  orderMetric,
  recordJournal,
  sendInternal,
  sendUpdate,
  setCardField,
} from '../systems/escalation.js';
import { gradeShift } from '../systems/incident-grading.js';
import { consoleOpenable, courseQuestion, shiftMinute } from '../systems/queries/incident.js';
import { incidentRules } from '../../data/incident-rules.js';

// The escalation console of the incident shift (docs/INCIDENT-ESCALATION-PLAN.md, stage 7):
// opening and closing it (the fight stops meanwhile, like a quiz), the player's commands, a
// save after each one, and a toast when a command makes a new mistake — with the course's
// explanation at the lower loads. The rules themselves are src/systems/escalation.js.
export function createEscalationFlow({ run, input, snapshots, runLog, toast, setMode, changed }) {
  function save() {
    if (!snapshots.save(run)) toast('Не удалось сохранить забег. Не закрывай вкладку.');
    changed();
  }
  const minute = () => shiftMinute(run.state);
  const mistakeKey = (m) => `${m.group}|${m.ticket}|${m.question}|${m.note}`;
  // The mistakes a command makes, from the grade before and after it: a step taken wrong now,
  // not one still to take.
  function teach(before) {
    const s = run.state;
    const known = new Set(before.filter((m) => !m.pending).map(mistakeKey));
    const fresh = gradeShift(s.incident, minute()).mistakes.find(
      (m) => !m.pending && m.group !== 'review' && !known.has(mistakeKey(m)),
    );
    if (!fresh) return;
    const q = fresh.question ? courseQuestion(fresh.question) : null;
    if (s.load <= incidentRules.console.fullFeedback && q?.explanation)
      toast(`${fresh.note}: ${q.explanation}`);
    else toast(`Ошибка: ${fresh.note}`);
  }
  // A console command: only with the console open; saved and taught when it changed something.
  const act =
    (fn) =>
    (...args) => {
      const s = run.state;
      if (run.mode !== 'console' || !s?.incident) return false;
      const before = gradeShift(s.incident, minute()).mistakes;
      const result = fn(s, ...args);
      if (!result || result.ok === false) {
        if (result?.reason === 'card')
          toast('Не заполнены обязательные поля: ' + result.missing.join(', '));
        else if (result?.reason === 'impact') toast('Влияние ещё не снято');
        if (result?.missing?.length) save();
        return result || false;
      }
      teach(before);
      save();
      return result;
    };
  return {
    // The console opens in play with no enemy close by; the fight stops.
    openConsole() {
      const s = run.state;
      if (run.mode !== 'play' || !s?.incident || !consoleOpenable(s)) return false;
      setMode('console');
      input.resetInput();
      save();
      return true;
    },
    closeConsole() {
      if (run.mode !== 'console') return false;
      setMode('play');
      input.resetInput();
      save();
      return true;
    },
    escalationOpen: act((s, component) => openTicket(s.incident, component, minute())),
    escalationCreate: act((s, id, option) => createTicket(s.incident, id, option, minute())),
    escalationField: act((s, id, field, value) =>
      setCardField(s.incident, id, field, value, minute()),
    ),
    escalationSeverityQuestions: act((s, id, questions) =>
      askSeverity(s.incident, id, questions, minute()),
    ),
    escalationStatus: act((s, id, status) => moveStatus(s.incident, id, status, minute())),
    escalationAnswer: act((s, id, key, options) =>
      answerTicketQuestion(s.incident, id, key, options, minute()),
    ),
    escalationCall: act((s, id, role) => {
      const call = callRole(s.incident, id, role, minute(), s.rng.random);
      if (call && !call.answered) toast('Не дозвонились: ' + incidentRules.roles[role].name);
      return call;
    }),
    escalationInternal: act((s, id, parts, conference) =>
      sendInternal(s.incident, id, parts, conference, minute()),
    ),
    escalationUpdate: act((s, id, payload) => sendUpdate(s.incident, id, payload, minute())),
    escalationWorkaround: act((s, id) => applyWorkaround(s.incident, id, minute())),
    escalationOrderMetric: act((s, metric, ticket) =>
      orderMetric(s.incident, metric, ticket, minute()),
    ),
    escalationRecord: act((s, index) => recordJournal(s.incident, index)),
    escalationInject: act((s, inject, answer) =>
      answerInject(s.incident, inject, answer, minute()),
    ),
    // The review after the shift, on the results screen.
    escalationReview(key, answer) {
      const s = run.state;
      if (run.mode !== 'end' || !s?.incident || !answerReview(s.incident, key, answer))
        return false;
      runLog?.updateIncident(s);
      changed();
      return true;
    },
  };
}
