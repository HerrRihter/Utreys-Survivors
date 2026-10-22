import { incidentRules as rules } from '../../../data/incident-rules.js';
import { unitDefinitions } from '../../../data/enemies/units.js';
import { requiredFields, reviewQuestions, ticketQuestions } from '../../systems/escalation.js';
import { gradeShift } from '../../systems/incident-grading.js';
import {
  componentDef,
  consoleOpenable,
  courseQuestion,
  impactDown,
  incidentCourse,
  metricPending,
  metricSeries,
  metricUnits,
  metricWindow,
  shiftClock,
  shiftMinute,
} from '../../systems/queries/incident.js';

// What the escalation console, the shift's HUD line and its results show
// (docs/INCIDENT-ESCALATION-PLAN.md, stage 7). Plain data: texts from the rules and the
// course, times as the shift's clock. Null on runs without a shift.

const clockAt = (inc, minute) => {
  const c = shiftClock(inc, minute);
  return c.time;
};
// A course question as the console asks it.
const asked = (id) => {
  const q = courseQuestion(id);
  return {
    id,
    text: q.text,
    multiple: q.type === 'multiple',
    options: q.options.map((o) => ({ id: o.id, text: o.text })),
  };
};
const roleName = (id) => rules.roles[id]?.name ?? id;
const statusName = (id) => rules.statuses.find((st) => st.id === id)?.name ?? id;
const fieldNames = Object.fromEntries(
  rules.ticket.fields.map((f) => [
    f.id,
    courseQuestion(rules.ticket.question)
      .options.find((o) => o.id === f.option)
      .text.replace(/\s*\(.*\)$/, ''),
  ]),
);
const situationNames = {
  component: 'Исходный компонент',
  cause: 'Причина',
  severity: 'Критичность',
};
const fieldName = (id) => fieldNames[id] ?? situationNames[id] ?? id;

// A journal action in words.
function actionText(action) {
  const [kind, arg] = action.split(':');
  const texts = {
    open: () => 'Открыта эскалация',
    create: () => 'Заведён тикет',
    card: () => 'Карточка: ' + fieldName(arg),
    'severity-questions': () => 'Вопросы для оценки критичности',
    status: () => 'Статус: ' + statusName(arg),
    answer: () => 'Ответ на вопрос регламента',
    call: () => 'Звонок: ' + roleName(arg),
    internal: () => 'Сообщение в #CS_Critical',
    update: () => 'Update клиенту',
    workaround: () => 'Применено обходное решение',
    metric: () => 'Заказана метрика: ' + (rules.metrics.find((m) => m.id === arg)?.name ?? arg),
    'metric-open': () =>
      'Открыта метрика: ' + (rules.metrics.find((m) => m.id === arg)?.name ?? arg),
    inject: () => 'Ответ на вводную',
  };
  return (texts[kind] ?? (() => action))();
}

// What an inject says, by its kind when it has no text of its own.
function injectText(spec) {
  if (spec.text) return spec.text;
  const kinds = {
    'role-away': `${roleName(spec.role)} недоступен до утра.`,
    'call-missed': `${roleName(spec.role)} не берёт трубку.`,
    workaround: 'Команда нашла обходное решение.',
    'second-fault': 'Пока идёт инцидент, сбоит ещё один компонент.',
    scenario: 'Мониторинг: повторяющиеся перезагрузки.',
  };
  return kinds[spec.kind] ?? '';
}

function ticketView(inc, t, minute) {
  const root = t.target == null ? null : inc.plan[t.target];
  const statuses = rules.statuses;
  const at = statuses.findIndex((st) => st.id === t.status);
  const questions = ticketQuestions();
  const pending = Object.keys(questions).filter((key) => {
    if (t.choices[key]) return false;
    const [kind, id] = key.split('.');
    return kind === 'matrix' ? t.levels[id] != null : t.statusAt[id] != null;
  });
  const level = rules.severity.levels.find((l) => l.id === t.card.severity);
  const lastUpdate = t.updates.at(-1)?.at ?? null;
  return {
    id: t.id,
    title: 'CRIT-' + t.id,
    component: componentDef(t.component)?.label ?? t.component,
    opened: clockAt(inc, t.openedAt),
    created: t.created,
    status: t.status,
    statusName: t.status ? statusName(t.status) : 'Не заведён',
    next:
      t.status == null ? [] : statuses.slice(at + 1).map((st) => ({ id: st.id, name: st.name })),
    card: { ...t.card },
    asked: t.asked ?? [],
    levels: rules.matrix.map((l) => ({
      level: l.level,
      name: l.name,
      reached: t.levels[l.level] != null ? clockAt(inc, t.levels[l.level]) : '',
      due: t.levelDue[l.level] != null ? clockAt(inc, t.levelDue[l.level]) : '',
    })),
    calls: t.calls.map((c) => ({
      role: roleName(c.role),
      at: clockAt(inc, c.at),
      answered: c.answered,
      arrive: c.arriveAt != null ? clockAt(inc, c.arriveAt) : '',
      working: c.workUntil != null && t.fixedAt == null,
    })),
    internal: !!t.internal,
    updates: t.updates.length,
    lastUpdate: lastUpdate != null ? clockAt(inc, lastUpdate) : '',
    // Minutes until the next update by the card's severity; negative when late.
    nextUpdateIn:
      level && t.statusAt[statuses.find((st) => st.solved).id] == null
        ? Math.round((lastUpdate ?? t.openedAt) + level.update - minute)
        : null,
    workaroundKnown: t.workaroundKnown,
    workaroundApplied: t.workaroundAt != null,
    fixed: t.fixedAt != null,
    impactDown: root != null && impactDown(inc, t),
    questions: pending.map((key) => ({ key, ...asked(questions[key]) })),
  };
}

function metricView(inc, def, minute) {
  const state = inc.metrics[def.id];
  const pending = metricPending(inc, def.id);
  const series = metricSeries(inc, def.id);
  const units =
    def.kind === 'units'
      ? def.units.map((u) => unitDefinitions[u].name)
      : metricUnits(inc, def.id).map((u) => unitDefinitions[u]?.name ?? u);
  const names = {
    throughput: 'Обработано в минуту',
    errors: 'Ошибки',
    stalled: 'Зависшие',
    queue: 'Очередь',
  };
  return {
    id: def.id,
    name: def.name,
    needsTicket: def.kind === 'clients',
    units: units.join(', ') || 'клиенты тикета',
    need: def.kills,
    kills: state.kills,
    pending,
    secondsLeft: pending
      ? Math.max(
          0,
          Math.ceil((state.orderedAt + metricWindow(def) - minute) * rules.clock.minuteSeconds),
        )
      : 0,
    openedAt: series ? clockAt(inc, series.openedAt) : '',
    reveals: def.reveals,
    charts: series
      ? Object.entries(series.series).map(([name, byComponent]) => ({
          name: names[name] ?? name,
          lines: Object.entries(byComponent).map(([id, points]) => ({
            component: componentDef(id).label,
            points,
          })),
        }))
      : [],
  };
}

// Steps of an inject in a fixed shuffled order (no randomness): the player puts them in order.
const stepOrder = (n) => Array.from({ length: n }, (_, i) => (i * 5 + 3) % n);

/** The console's data; null on runs without a shift. */
export function escalationView({ run }) {
  const s = run.state;
  const inc = s?.incident;
  if (!inc) return null;
  const minute = shiftMinute(s);
  const clock = shiftClock(inc, minute);
  const course = incidentCourse();
  const required = requiredFields();
  return {
    clock: `${clock.day}, ${clock.time}`,
    // Card times are typed as the shift's clock; this is its start, minutes after midnight.
    clockStart: rules.clock.start,
    minute: Math.floor(minute),
    canOpen: consoleOpenable(s),
    components: rules.components.map((c) => ({ id: c.id, label: c.label })),
    roles: Object.entries(rules.roles).map(([id, r]) => ({ id, name: r.name, level: r.level })),
    detection: rules.detection.methods.map((m) => ({ id: m.id, text: m.text })),
    causes: rules.causes.map((c) => ({ id: c.id, text: c.text })),
    severities: rules.severity.levels.map((l) => ({ id: l.id, name: l.name })),
    creation: asked(rules.protocol.creation.question),
    fields: [
      ...rules.ticket.fields.map((f) => ({
        id: f.id,
        kind: f.kind,
        label: fieldName(f.id),
        required: required.includes(f.id),
      })),
      ...rules.ticket.situation.map((id) => ({
        id,
        kind: id,
        label: fieldName(id),
        required: false,
      })),
    ],
    severityQuestions: rules.severity.questions.map((q) => ({ id: q.id, text: q.text })),
    internalParts: rules.internal.parts.map((p) => ({ id: p.id, text: p.text })),
    update: {
      required: asked(rules.update.parts.question),
      principles: rules.update.principles.map((p) => ({ id: p.id, text: p.text })),
      wording: asked(rules.update.wording.question),
      sender: asked(rules.update.sender.question),
      noProgress: asked(rules.update.noProgress.question),
      workaround: asked(rules.update.workaround.question),
      client: rules.clientUpdates.length
        ? {
            clients: rules.clientUpdates.map((u) => unitDefinitions[u.client]?.name ?? u.client),
            ...asked(rules.clientUpdates[0].parts.question),
          }
        : null,
    },
    notes: course.topics.map((t) => ({ name: t.name, note: t.note })),
    tickets: inc.tickets.map((t) => ticketView(inc, t, minute)),
    metrics: rules.metrics.map((def) => metricView(inc, def, minute)),
    inbox: inc.inbox.map((item) => {
      const spec = rules.injects.find((i) => i.id === item.inject);
      const order = spec.steps ? stepOrder(spec.steps.length) : [];
      return {
        inject: item.inject,
        at: clockAt(inc, item.at),
        text: injectText(spec),
        answered: item.answeredAt != null,
        question: spec.choice ? asked(spec.choice.question) : null,
        steps: order.map((i) => ({ index: i, text: spec.steps[i] })),
      };
    }),
    journal: inc.journal.map((e, index) => ({
      index,
      at: clockAt(inc, e.minute),
      ticket: e.ticket != null ? 'CRIT-' + e.ticket : '',
      text: actionText(e.action),
      recorded: e.recorded,
    })),
  };
}

// The shift's HUD line: the clock, open tickets, a metric order's progress.
export function shiftLine(s) {
  const inc = s.incident;
  const minute = shiftMinute(s);
  const c = shiftClock(inc, minute);
  const open = inc.tickets.filter((t) => t.target != null && !impactDown(inc, t)).length;
  const order = rules.metrics.find((def) => metricPending(inc, def.id));
  const left = order
    ? Math.max(
        0,
        Math.ceil(
          (inc.metrics[order.id].orderedAt + metricWindow(order) - minute) *
            rules.clock.minuteSeconds,
        ),
      )
    : 0;
  return (
    `Смена · ${c.day} ${c.time}` +
    ` · открытых инцидентов: ${open}` +
    (inc.inbox.some((m) => m.answeredAt == null) ? ' · есть входящие' : '') +
    (order ? ` · ${order.name}: ${inc.metrics[order.id].kills}/${order.kills}, ${left} с` : '')
  );
}

const groupNames = {
  detection: 'Обнаружение',
  first: 'Первое действие',
  creation: 'Заведение тикета',
  card: 'Карточка',
  severity: 'Критичность',
  matrix: 'Матрица эскалации',
  calls: 'Вызовы и War Room',
  updates: 'Коммуникации',
  statuses: 'Статусы',
  journal: 'Журнал трекера',
  injects: 'Вводные',
  review: 'Разбор',
};

/** The shift's results: the review still to answer, then the grade and every mistake. */
export function escalationResult(s, win) {
  const inc = s?.incident;
  if (!inc) return null;
  const review = Object.entries(reviewQuestions())
    .filter(([key]) => !Object.hasOwn(inc.review ?? {}, key))
    .map(([key, step]) =>
      step.parts
        ? {
            key,
            text: step.text,
            multiple: true,
            options: step.parts.map((p) => ({ id: p.id, text: p.text })),
          }
        : { key, ...asked(step.question) },
    );
  const grade = gradeShift(inc, shiftMinute(s));
  return {
    review,
    grade: grade.grade,
    percent: Math.round(grade.share * 100) + '%',
    preliminary: !win,
    groups: Object.entries(grade.groups).map(([id, g]) => ({
      name: groupNames[id] ?? id,
      percent: Math.round(g.score * 100) + '%',
    })),
    mistakes: grade.mistakes.map((m) => {
      const q = m.question ? courseQuestion(m.question) : null;
      const correct = q?.correct?.map((id) => q.options.find((o) => o.id === id)?.text ?? id) ?? [];
      const explanation = q?.explanation || q?.reference || '';
      // An explanation that only repeats the key is not shown twice.
      const same = (a) => a.replace(/[.;\s]+/g, ' ').trim();
      return {
        note: m.note,
        ticket: m.ticket != null ? 'CRIT-' + m.ticket : '',
        question: q?.text ?? '',
        correct,
        explanation: same(explanation) === same(correct.join('; ')) ? '' : explanation,
      };
    }),
  };
}
