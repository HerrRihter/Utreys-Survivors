// @ts-check
// The grade of an incident shift (docs/INCIDENT-ESCALATION-PLAN.md, point 14): every step the
// player took or missed becomes an item of a group, scored 0…1 and tied to the course question
// it teaches, so the result screen can show that question's key and explanation. Groups are
// weighted by `grading.weights`; the weighted share picks the grade.
import { incidentRules } from '../../data/incident-rules.js';
import { requiredFields, reviewQuestions } from './escalation.js';
import {
  affectedBy,
  clientsOf,
  impactDown,
  incidentCourse,
  keyMatches,
  progressBetween,
  trueCard,
} from './queries/incident.js';

/** @typedef {import('./queries/incident.js').IncidentState} IncidentState */
/** @typedef {import('./queries/incident.js').IncidentTicket} IncidentTicket */
/**
 * @typedef {{ group: string, score: number, question: string | null, ticket: number | null,
 *   note: string }} GradeItem
 * @typedef {{ groups: Record<string, { score: number, items: number }>, share: number,
 *   grade: string, items: GradeItem[], mistakes: GradeItem[] }} ShiftGrade
 */

/**
 * The grade of the shift at `minute` (its end, or now for an interim one).
 * @param {IncidentState} inc
 * @param {number} minute
 * @returns {ShiftGrade}
 */
export function gradeShift(inc, minute, rules = incidentRules) {
  /** @type {GradeItem[]} */
  const items = [];
  const add = (
    /** @type {string} */ group,
    /** @type {number | boolean} */ score,
    /** @type {string | null} */ question,
    /** @type {string} */ note,
    /** @type {number | null} */ ticket = null,
  ) => items.push({ group, score: Number(score), question, ticket, note });
  const roles = /** @type {Record<string, any>} */ (rules.roles);
  const matrix = /** @type {any[]} */ (rules.matrix);
  const levels = /** @type {any[]} */ (rules.severity.levels);
  const grace = rules.escalation.grace;
  const injectSpec = (/** @type {string} */ id) =>
    /** @type {any} */ (rules.injects.find((i) => i.id === id));
  /** Whether the parts chosen are all the right ones and none of the wrong. */
  const partsRight = (/** @type {any[]} */ parts, /** @type {string[]} */ chosen) =>
    parts.every((p) => chosen.includes(p.id) === p.right);
  /** The question a wrong choice of parts teaches: a wrong part's own, else `fallback`. */
  const partsQuestion = (
    /** @type {any[]} */ parts,
    /** @type {string[]} */ chosen,
    /** @type {string} */ fallback,
  ) => parts.find((p) => !p.right && chosen.includes(p.id) && p.covers)?.covers[0] ?? fallback;

  // Detection: every real failure noticed early, no false escalation (incident-1).
  const roots = inc.plan
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => f.cause != null && f.from == null && f.startedAt != null);
  for (const { f, i } of roots) {
    const t = inc.tickets.find((x) => x.target === i);
    const alert = inc.alerts.find((a) => a.fault === i);
    const score = !t
      ? 0
      : !alert || t.openedAt < alert.monitoringAt
        ? 1
        : t.openedAt < alert.clientAt
          ? 0.7
          : 0.4;
    add('detection', score, 'incident-1', 'Сбой: ' + f.component, t?.id ?? null);
  }
  for (const t of inc.tickets.filter((x) => x.target == null))
    add('detection', 0, 'incident-1', 'Ложная эскалация: ' + t.component, t.id);
  inc.plan.forEach((f) => {
    if (f.cause != null || f.from != null || f.startedAt == null) return;
    const raised = inc.tickets.some(
      (t) =>
        t.target == null &&
        t.component === f.component &&
        t.openedAt >= /** @type {number} */ (f.startedAt) &&
        t.openedAt <= (f.endedAt ?? minute),
    );
    if (!raised) add('detection', 1, 'incident-1', 'Ложная тревога не эскалирована');
  });

  const firstKey = /** @type {any} */ (rules.protocol.first.actions)[
    courseKey(rules.protocol.first.question, rules)[0]
  ];
  const real = inc.tickets.filter((t) => t.target != null);
  const open = (/** @type {IncidentTicket} */ t) => [
    t.openedAt,
    t.fixedAt ?? t.workaroundAt ?? minute,
  ];
  for (const t of real) {
    const root = inc.plan[/** @type {number} */ (t.target)];
    const truth = /** @type {Record<string, any>} */ (trueCard(inc, t, rules));
    const clients = clientsOf(inc, /** @type {number} */ (t.target), rules);
    const cause = rules.causes.find((c) => c.id === root.cause);

    add('first', t.actions[0] === firstKey, 'incident-10', 'Первое действие', t.id);
    add(
      'creation',
      keyMatches(rules.protocol.creation.question, t.created, rules),
      'incident-11',
      'Заведение тикета',
      t.id,
    );

    // The card.
    const tolerance = rules.ticket.startTolerance;
    for (const field of requiredFields(rules)) {
      const value = t.card[field];
      const right =
        field === 'times'
          ? !!value &&
            Math.abs(value.start - truth.times.start) <= tolerance &&
            Math.abs(value.detected - truth.times.detected) <= tolerance
          : value === truth[field];
      const question =
        field === 'coordinator'
          ? inc.coordinatorAway
            ? 'incident-8'
            : 'incident-6'
          : field === 'moderator'
            ? 'incident-7'
            : 'incident-12';
      add('card', right, question, 'Поле карточки: ' + field, t.id);
    }
    add('card', t.card.component === truth.component, null, 'Исходный компонент', t.id);
    add('card', t.card.cause === truth.cause, null, 'Причина', t.id);
    for (const missing of t.refused)
      add('card', 0, 'incident-12', 'Перевод в работу без полей: ' + missing.join(', '), t.id);

    // Severity and the questions that assess it.
    add(
      'severity',
      t.card.severity != null && t.card.severity === t.severityTruth,
      // A client's own trigger teaches its question.
      rules.clientTriggers.find(
        (tr) =>
          clients.includes(tr.client) &&
          affectedBy(inc, /** @type {number} */ (t.target), rules).includes(tr.component),
      )?.covers?.[0] ?? 'incident-3',
      'Критичность',
      t.id,
    );
    const asked = t.asked ?? [];
    add(
      'severity',
      t.asked != null && partsRight(rules.severity.questions, asked),
      partsQuestion(rules.severity.questions, asked, 'incident-5'),
      'Вопросы для оценки критичности',
      t.id,
    );

    // The matrix.
    add(
      'matrix',
      t.levels[1] != null && t.levels[1] <= t.openedAt + matrix[0].within + grace,
      'incident-15',
      'Уровень 1 в срок',
      t.id,
    );
    add('matrix', t.levels[2] != null, 'incident-16', 'Уровень 2: продуктовые команды', t.id);
    const firstRole = rules.clientEscalation.find((e) => clients.includes(e.client));
    if (firstRole) {
      const first = t.calls.find((c) => roles[c.role].level === 2);
      add('matrix', first?.role === firstRole.first, 'incident-32', 'Первым на уровне 2', t.id);
    }
    for (const level of [3, 4]) {
      const due = t.levelDue[level];
      const question = level === 3 ? 'incident-20' : 'incident-17';
      if (due != null)
        add(
          'matrix',
          t.levels[level] != null && t.levels[level] <= due + grace,
          question,
          'Уровень ' + level + ' в срок',
          t.id,
        );
      else if (t.levels[level] != null)
        add('matrix', 0, question, 'Уровень ' + level + ' без оснований', t.id);
    }
    if (t.levelDue[3] != null)
      add(
        'matrix',
        t.severityAt != null && t.severityAt >= t.levelDue[3],
        'incident-20',
        'Переоценка критичности',
        t.id,
      );
    for (const [key, answer] of Object.entries(t.choices)) {
      const question = questionOfKey(key, rules);
      add(
        key.startsWith('status.') ? 'statuses' : 'matrix',
        keyMatches(question, answer.options, rules),
        question,
        'Вопрос: ' + key,
        t.id,
      );
    }

    // Calls: the rule for unanswered calls, nobody extra.
    for (const role of new Set(t.calls.filter((c) => !c.answered).map((c) => c.role))) {
      const tries = t.calls.filter((c) => c.role === role);
      const manager = roles[role].manager;
      const managerAt = t.calls.find((c) => c.role === manager && c.at >= tries[0].at)?.at;
      const before = tries.filter((c) => managerAt == null || c.at <= managerAt);
      const [low, high] = rules.calls.interval;
      const spaced = before.every(
        (c, i) => !i || (c.at - before[i - 1].at >= low && c.at - before[i - 1].at <= high),
      );
      const reached = tries.some((c) => c.answered);
      add(
        'calls',
        (reached && managerAt == null && spaced) ||
          (managerAt != null && before.length >= rules.calls.attempts && spaced),
        'incident-19',
        'Недозвон: ' + role,
        t.id,
      );
    }
    const needed = new Set([cause?.fixer, rules.coordinator.moderator]);
    if (firstRole) needed.add(firstRole.first);
    if (t.levelDue[3] != null) for (const r of matrix[2].roles) needed.add(r);
    if (t.levelDue[4] != null) for (const r of matrix[3].roles) needed.add(r);
    for (const c of t.calls)
      if (!c.answered && roles[c.role].manager) needed.add(roles[c.role].manager);
    const extra = [...new Set(t.calls.map((c) => c.role))].filter((r) => !needed.has(r));
    for (const r of extra) add('calls', 0, 'incident-9', 'Лишний в War Room: ' + r, t.id);
    if (!extra.length) add('calls', 1, 'incident-9', 'Состав War Room', t.id);

    // Communications.
    const internalParts = t.internal?.parts ?? [];
    add(
      'updates',
      !!t.internal && partsRight(rules.internal.parts, internalParts) && t.internal.conference,
      partsQuestion(rules.internal.parts, internalParts, 'incident-21'),
      'Сообщение в #CS_Critical и конференция',
      t.id,
    );
    const declared =
      levels.find((l) => l.id === (t.card.severity ?? t.severityTruth)) ?? levels.at(-1);
    const solvedStatus = /** @type {any[]} */ (rules.statuses).find((st) => st.solved);
    const end = t.statusAt[solvedStatus.id] ?? minute;
    const cadenceQuestion = declared === levels[0] ? 'incident-18' : 'incident-23';
    let due = t.openedAt + matrix[0].within;
    let last = -Infinity;
    for (let guard = 0; due <= end && guard < 100; guard++) {
      const sent = t.updates.find((u) => u.at > last && u.at <= due + grace);
      add('updates', !!sent, cadenceQuestion, 'Update к ' + Math.round(due) + '-й минуте', t.id);
      last = sent?.at ?? due;
      due = (sent?.at ?? due) + declared.update;
    }
    // After a workaround the client hears of it by its template (incident-27).
    if (
      t.workaroundAt != null &&
      !t.updates.some((u) => u.at >= /** @type {number} */ (t.workaroundAt))
    )
      add('updates', 0, 'incident-27', 'Update после обходного решения', t.id);
    const extraUpdate = rules.clientUpdates.find((u) => clients.includes(u.client));
    t.updates.forEach((u, i) => {
      const prev = i ? t.updates[i - 1].at : t.openedAt;
      const progress = progressBetween(t, prev, u.at);
      const note = 'Update ' + (i + 1);
      add(
        'updates',
        keyMatches(rules.update.parts.question, u.required, rules),
        'incident-22',
        note,
        t.id,
      );
      add(
        'updates',
        partsRight(rules.update.principles, u.principles),
        partsQuestion(rules.update.principles, u.principles, 'incident-28'),
        note,
        t.id,
      );
      add(
        'updates',
        keyMatches(rules.update.wording.question, u.wording, rules),
        'incident-26',
        note,
        t.id,
      );
      add(
        'updates',
        keyMatches(rules.update.sender.question, u.sender, rules),
        'incident-30',
        note,
        t.id,
      );
      if (i && !progress)
        add(
          'updates',
          keyMatches(rules.update.noProgress.question, u.noProgress, rules),
          'incident-23',
          note,
          t.id,
        );
      if (t.workaroundAt != null && t.workaroundAt <= u.at)
        add(
          'updates',
          keyMatches(rules.update.workaround.question, u.workaround, rules),
          'incident-27',
          note,
          t.id,
        );
      if (extraUpdate)
        add(
          'updates',
          keyMatches(extraUpdate.parts.question, u.client, rules),
          extraUpdate.parts.question,
          note,
          t.id,
        );
    });

    // Statuses.
    const statuses = /** @type {any[]} */ (rules.statuses);
    const work = statuses.find((st) => st.card);
    const paused = statuses.find((st) => st.slaPaused);
    const after = statuses.find((st) => st.slaStopped);
    add('statuses', t.statusAt[work.id] != null, 'incident-12', 'Тикет в работе', t.id);
    if (impactDown(inc, t))
      add('statuses', t.statusAt[solvedStatus.id] != null, 'incident-2', 'Тикет решён', t.id);
    if (t.statusAt[solvedStatus.id] != null)
      add('statuses', t.statusAt[after.id] != null, 'incident-14', 'Постмортем', t.id);
    if (t.workaroundAt != null)
      add(
        'statuses',
        t.statusAt[paused.id] != null,
        'incident-13',
        'Мониторинг после обходного решения',
        t.id,
      );
  }

  // A parallel incident needs the moderator (incident-7).
  const overlap = real.some((a) =>
    real.some((b) => a !== b && open(a)[0] < open(b)[1] && open(b)[0] < open(a)[1]),
  );
  if (overlap)
    add(
      'calls',
      real.some((t) => t.calls.some((c) => c.role === rules.coordinator.moderator)),
      'incident-7',
      'Модератор при параллельных инцидентах',
    );

  // The tracker's journal (incident-7).
  if (inc.journal.length)
    add(
      'journal',
      inc.journal.filter((e) => e.recorded).length / inc.journal.length,
      'incident-7',
      'Действия зафиксированы в трекере',
    );

  // Injects.
  for (const item of inc.inbox) {
    const spec = injectSpec(item.inject);
    const t = item.ticket != null ? inc.tickets.find((x) => x.id === item.ticket) : null;
    const forFault = inc.injects.find((i) => i.id === item.inject)?.fault;
    const ticket = t ?? (forFault != null ? inc.tickets.find((x) => x.target === forFault) : null);
    const question = spec.choice?.question ?? spec.covers?.[0] ?? null;
    const note = 'Вводная: ' + item.inject;
    if (spec.choice)
      add(
        'injects',
        keyMatches(spec.choice.question, item.answer, rules),
        spec.choice.question,
        note,
        ticket?.id ?? null,
      );
    if (spec.steps) {
      const order = Array.isArray(item.answer) ? item.answer : [];
      add(
        'injects',
        spec.steps.filter((/** @type {any} */ _, /** @type {number} */ i) => order[i] === i)
          .length / spec.steps.length,
        spec.covers?.[0] ?? question,
        note,
        ticket?.id ?? null,
      );
    }
    const expects = spec.expects ?? {};
    if (expects.severity)
      add(
        'injects',
        ticket?.card.severity === expects.severity,
        question,
        note,
        ticket?.id ?? null,
      );
    // A shift-wide inject (no failure of its own) is judged on every real ticket after it.
    const judged = ticket ? [ticket] : real.filter((x) => x.openedAt >= item.at);
    if (expects.coordinator && judged.length)
      add(
        'injects',
        judged.every((x) => x.card.coordinator === expects.coordinator),
        question,
        note,
        ticket?.id ?? null,
      );
    if (expects.level)
      add('injects', ticket?.levels[expects.level] != null, question, note, ticket?.id ?? null);
    if (expects.status)
      add('injects', ticket?.statusAt[expects.status] != null, question, note, ticket?.id ?? null);
    if (expects.moderator)
      add(
        'injects',
        inc.tickets.some((x) => x.calls.some((c) => c.role === rules.coordinator.moderator)),
        question,
        note,
        ticket?.id ?? null,
      );
  }

  // The review after the shift.
  for (const [key, step] of Object.entries(reviewQuestions(rules))) {
    const answer = inc.review?.[key];
    const right = !Array.isArray(answer)
      ? false
      : step.parts
        ? partsRight(step.parts, answer)
        : keyMatches(step.question, answer, rules);
    add('review', right, step.question ?? step.covers?.[0] ?? null, 'Разбор: ' + key);
  }

  /** @type {Record<string, { score: number, items: number }>} */
  const groups = {};
  for (const item of items) {
    const g = (groups[item.group] ??= { score: 0, items: 0 });
    g.score += item.score;
    g.items++;
  }
  for (const g of Object.values(groups)) g.score /= g.items;
  const weights = /** @type {Record<string, number>} */ (rules.grading.weights);
  const total = Object.keys(groups).reduce((sum, g) => sum + (weights[g] ?? 0), 0);
  const share = total
    ? Object.entries(groups).reduce((sum, [g, v]) => sum + (weights[g] ?? 0) * v.score, 0) / total
    : 0;
  const grade = rules.grading.grades.find((g) => share >= g.min) ?? rules.grading.grades.at(-1);
  return {
    groups,
    share,
    grade: /** @type {{ name: string }} */ (grade).name,
    items,
    mistakes: items.filter((item) => item.score < 1),
  };
}

/**
 * The course key of question `id`.
 * @param {string} id
 * @returns {string[]}
 */
function courseKey(id, rules = incidentRules) {
  const course = incidentCourse(rules);
  return course.questions.find((/** @type {any} */ q) => q.id === id).correct;
}

/**
 * The course question behind a ticket question key (`matrix.<level>`, `status.<id>`).
 * @param {string} key
 */
function questionOfKey(key, rules = incidentRules) {
  const [kind, id] = key.split('.');
  const list = /** @type {any[]} */ (kind === 'matrix' ? rules.matrix : rules.statuses);
  return list.find((x) => String(kind === 'matrix' ? x.level : x.id) === id).choice.question;
}
