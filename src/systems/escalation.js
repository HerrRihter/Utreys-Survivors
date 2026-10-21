// @ts-check
// The incident escalation mode (docs/INCIDENT-ESCALATION-PLAN.md): the shift's state in a
// run (`state.incident`) and the escalation the player runs on it. The rules are checked by
// src/systems/incident-validation.js.
import { incidentRules } from '../../data/incident-rules.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { endFault, planShift } from './production-line.js';
import {
  courseQuestion,
  impactDown,
  metricDef,
  metricPending,
  metricUnits,
  metricWindow,
  realRootsOn,
  slaUsed,
  ticketFor,
  trueSeverity,
} from './queries/incident.js';

// The objective type of the maps that run a shift.
const SHIFT_OBJECTIVE = 'escalation';
const maps = /** @type {Record<string, any>} */ (mapDefinitions);

/** @typedef {import('./queries/incident.js').IncidentState} IncidentState */
/** @typedef {import('./queries/incident.js').PlannedFault} PlannedFault */

/**
 * A shift before planning: every component's operations in progress, staggered so they do
 * not finish all at once; no failures, injects or alerts yet (`planShift` fills `day`,
 * `plan`, `injects` and `alerts` from the seed). Draws no randomness.
 * @returns {IncidentState}
 */
export function newIncidentState(rules = incidentRules) {
  return {
    rulesVersion: rules.version,
    course: rules.course,
    day: 0,
    coordinatorAway: false,
    plan: [],
    injects: [],
    components: Object.fromEntries(
      rules.components.map((c) => [
        c.id,
        {
          ops: Array.from({ length: c.ops }, (_, i) => ({
            status: /** @type {const} */ ('busy'),
            since: -(i * c.cycle) / c.ops,
          })),
          queue: 0,
          done: 0,
          faults: [],
          badSince: null,
          starvedSince: null,
          reboots: [],
        },
      ]),
    ),
    history: [],
    alerts: [],
    tickets: [],
    nextTicket: 1,
    inbox: [],
    metrics: Object.fromEntries(
      rules.metrics.map((m) => [m.id, { orderedAt: null, kills: 0, openedAt: null, ticket: null }]),
    ),
    journal: [],
    impact: 0,
    collapseSince: null,
    review: null,
  };
}

/**
 * The shift of a run on `map`, planned from the run's seed: null on maps of other objectives.
 * @param {string} map
 * @param {number} seed
 * @param {string[]} seen ids of injects the player met in earlier shifts
 */
export function createIncidentState(map, seed, seen = []) {
  return maps[map]?.objective?.type === SHIFT_OBJECTIVE
    ? planShift(newIncidentState(), seed, seen)
    : null;
}

/**
 * Whether a saved shift can go on with these rules: the same rules version and course, the
 * same components and metrics, every list in place. A save of other rules is refused rather
 * than judged by rules it was not played with.
 * @param {any} inc
 * @param {string} map
 */
export function validIncident(inc, map, rules = incidentRules) {
  const sameKeys = (/** @type {any} */ record, /** @type {{ id: string }[]} */ list) =>
    !!record &&
    typeof record === 'object' &&
    Object.keys(record).sort().join() ===
      list
        .map((item) => item.id)
        .sort()
        .join();
  return (
    !!inc &&
    maps[map]?.objective?.type === SHIFT_OBJECTIVE &&
    inc.rulesVersion === rules.version &&
    inc.course === rules.course &&
    Number.isInteger(inc.day) &&
    inc.day >= 0 &&
    inc.day < rules.clock.days.length &&
    typeof inc.coordinatorAway === 'boolean' &&
    sameKeys(inc.components, rules.components) &&
    rules.components.every(
      (c) =>
        Array.isArray(inc.components[c.id].ops) &&
        inc.components[c.id].ops.length === c.ops &&
        Array.isArray(inc.components[c.id].faults) &&
        Array.isArray(inc.components[c.id].reboots),
    ) &&
    sameKeys(inc.metrics, rules.metrics) &&
    ['plan', 'injects', 'history', 'alerts', 'tickets', 'journal', 'inbox'].every((key) =>
      Array.isArray(inc[key]),
    ) &&
    Number.isInteger(inc.nextTicket) &&
    inc.nextTicket > inc.tickets.length &&
    Number.isFinite(inc.impact) &&
    (inc.collapseSince === null || Number.isFinite(inc.collapseSince))
  );
}

// --- The escalation: what the player does on the console, and what time does to it. ---
// Every command checks its arguments and returns false (or null) without a change when they do
// not fit, so a repeated or stale command changes nothing. Times are incident minutes.

/** @typedef {import('./queries/incident.js').IncidentTicket} IncidentTicket */
/** @typedef {typeof incidentRules} IncidentRules */

// The protocol's actions (data/incident-rules.js `protocol.first.actions` names them):
// the #CS_Critical message, calling the moderator, the client update, creating the ticket.
export const protocolActions = {
  notify: 'notify',
  moderator: 'call-teamlead',
  update: 'update',
  ticket: 'ticket',
};

/**
 * @param {IncidentState} inc
 * @param {number} id
 */
export const ticketById = (inc, id) => inc.tickets.find((t) => t.id === id) ?? null;

/** @param {string} id */
const injectSpec = (id, rules = incidentRules) =>
  /** @type {any} */ (rules.injects.find((i) => i.id === id));

/**
 * @param {IncidentState} inc
 * @param {number | null} ticket
 * @param {string} action
 * @param {number} minute
 */
function log(inc, ticket, action, minute) {
  inc.journal.push({ minute, ticket, action, recorded: false });
}

/**
 * @param {IncidentTicket} t
 * @param {string} action
 */
function act(t, action) {
  if (!t.actions.includes(action)) t.actions.push(action);
}

/**
 * Whether an inject of `kind` bound to the ticket's failure has come.
 * @param {IncidentState} inc
 * @param {IncidentTicket} t
 * @param {string} kind
 */
const injectCame = (inc, t, kind, rules = incidentRules) =>
  inc.injects.some(
    (i) => i.firedAt != null && i.fault === t.target && injectSpec(i.id, rules).kind === kind,
  );

/**
 * Opens a CRIT ticket on the component where the player sees trouble. The ticket is about the
 * root of a real failure there (a cascade leads back to its source) that has no ticket yet;
 * with none (healthy, or a false alarm) it is a false escalation. When every failure there
 * already has a ticket, the first one's id comes back instead of a second ticket.
 * @param {IncidentState} inc
 * @param {string} component
 * @param {number} minute
 * @returns {number | null}
 */
export function openTicket(inc, component, minute, rules = incidentRules) {
  if (!inc.components[component]) return null;
  const roots = realRootsOn(inc, component);
  const target = roots.find((r) => !ticketFor(inc, r)) ?? null;
  if (target == null && roots.length)
    return /** @type {IncidentTicket} */ (ticketFor(inc, roots[0])).id;
  /** @type {IncidentTicket} */
  const t = {
    id: inc.nextTicket++,
    openedAt: minute,
    component,
    target,
    actions: [],
    created: null,
    status: null,
    statusAt: {},
    refused: [],
    card: {},
    severityAt: null,
    severityTruth: null,
    asked: null,
    levels: {},
    levelDue: {},
    calls: [],
    internal: null,
    updates: [],
    choices: {},
    workaroundKnown: false,
    workaroundAt: null,
    fixedAt: null,
  };
  t.workaroundKnown = injectCame(inc, t, 'workaround', rules);
  const alert = inc.alerts.find((a) => a.fault === target);
  if (alert) alert.seenAt ??= minute;
  inc.tickets.push(t);
  log(inc, t.id, 'open', minute);
  return t.id;
}

/**
 * Creates the ticket in the tracker the way the player picks (an option of incident-11).
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string} option
 * @param {number} minute
 */
export function createTicket(inc, id, option, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const q = courseQuestion(rules.protocol.creation.question, rules);
  if (!t || t.created != null || !q.options.some((/** @type {any} */ o) => o.id === option))
    return false;
  t.created = option;
  t.status = rules.statuses[0].id;
  t.statusAt[t.status] = minute;
  act(t, protocolActions.ticket);
  log(inc, id, 'create', minute);
  return true;
}

/**
 * Whether `value` fits the ticket field `field`.
 * @param {string} field
 * @param {any} value
 * @param {IncidentRules} rules
 */
function fieldFits(field, value, rules) {
  const spec = rules.ticket.fields.find((f) => f.id === field);
  const kind = spec?.kind ?? field;
  const finite = (/** @type {any} */ n) => typeof n === 'number' && Number.isFinite(n);
  switch (kind) {
    case 'role':
      return Object.hasOwn(rules.roles, value);
    case 'detection':
      return rules.detection.methods.some((m) => m.id === value);
    case 'time':
      return finite(value);
    case 'times':
      return !!value && finite(value.start) && finite(value.detected);
    case 'component':
      return rules.components.some((c) => c.id === value);
    case 'cause':
      return rules.causes.some((c) => c.id === value);
    case 'severity':
      return rules.severity.levels.some((l) => l.id === value);
    default:
      return false;
  }
}

/**
 * Fills a field of the card: one of the tracker's fields (incident-12) or the source
 * component, the cause, the severity. Setting the severity keeps what was right at that
 * moment, so a later reassessment is judged on its own time.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string} field
 * @param {any} value
 * @param {number} minute
 */
export function setCardField(inc, id, field, value, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const known =
    rules.ticket.fields.some((f) => f.id === field) ||
    /** @type {string[]} */ (rules.ticket.situation).includes(field);
  if (!t || !known || !fieldFits(field, value, rules)) return false;
  t.card[field] = field === 'times' ? { start: value.start, detected: value.detected } : value;
  if (field === 'severity') {
    t.severityAt = minute;
    t.severityTruth = trueSeverity(inc, t, minute, rules);
  }
  log(inc, id, 'card:' + field, minute);
  return true;
}

/**
 * The questions the player asks to assess severity (incident-5), some of them wrong ones.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string[]} questions
 * @param {number} minute
 */
export function askSeverity(inc, id, questions, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const known = rules.severity.questions.map((q) => q.id);
  if (!t || !Array.isArray(questions) || !questions.every((q) => known.includes(q))) return false;
  t.asked = [...new Set(questions)];
  log(inc, id, 'severity-questions', minute);
  return true;
}

/**
 * The card's fields the tracker requires to take the ticket into work: those the course's key
 * names (incident-12).
 */
export const requiredFields = (rules = incidentRules) => {
  const key = courseQuestion(rules.ticket.question, rules).correct;
  return rules.ticket.fields.filter((f) => key.includes(f.option)).map((f) => f.id);
};

/**
 * Moves the ticket forward. Into work only with the required fields filled (the missing ones
 * come back and the refusal is kept); to solved only once the impact is down; optional
 * statuses may be skipped.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string} status
 * @param {number} minute
 * @returns {{ ok: boolean, missing: string[], reason: string | null }}
 */
export function moveStatus(inc, id, status, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const list = /** @type {any[]} */ (rules.statuses);
  const to = list.findIndex((st) => st.id === status);
  const from = list.findIndex((st) => st.id === t?.status);
  const no = (/** @type {string} */ reason, missing = /** @type {string[]} */ ([])) => ({
    ok: false,
    missing,
    reason,
  });
  if (!t || t.status == null || to <= from) return no('order');
  if (
    !list
      .slice(from + 1, to)
      .every((st) => /** @type {string[]} */ (rules.optionalStatuses).includes(st.id))
  )
    return no('order');
  // Every status from the one requiring the card on needs it.
  if (list.slice(0, to + 1).some((st) => st.card)) {
    const missing = requiredFields(rules).filter((f) => t.card[f] == null);
    if (missing.length) {
      if (list[to].card) t.refused.push(missing);
      return no('card', missing);
    }
  }
  if (list.slice(0, to + 1).some((st) => st.solved) && !impactDown(inc, t)) return no('impact');
  t.status = status;
  t.statusAt[status] = minute;
  log(inc, id, 'status:' + status, minute);
  return { ok: true, missing: [], reason: null };
}

/**
 * The course questions asked on the ticket's way, by key: a matrix level's
 * (`matrix.<level>`) and a status's (`status.<id>`).
 */
export function ticketQuestions(rules = incidentRules) {
  /** @type {Record<string, string>} */
  const keys = {};
  for (const level of /** @type {any[]} */ (rules.matrix))
    if (level.choice) keys['matrix.' + level.level] = level.choice.question;
  for (const st of /** @type {any[]} */ (rules.statuses))
    if (st.choice) keys['status.' + st.id] = st.choice.question;
  return keys;
}

/**
 * Answers a course question asked on the ticket's way; the first answer counts.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string} key
 * @param {string[]} options
 * @param {number} minute
 */
export function answerTicketQuestion(inc, id, key, options, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const question = ticketQuestions(rules)[key];
  const known =
    question && courseQuestion(question, rules).options.map((/** @type {any} */ o) => o.id);
  if (!t || !known || t.choices[key] || !Array.isArray(options) || !options.length) return false;
  if (!options.every((o) => known.includes(o))) return false;
  t.choices[key] = { at: minute, options: [...new Set(options)] };
  log(inc, id, 'answer:' + key, minute);
  return true;
}

/**
 * Calls someone for the ticket. A call may go unanswered (the role's `miss`, from `random`);
 * the role an unanswered-call inject names does not answer for this failure until its manager
 * has been reached. An answered call brings the role after its `arrive` minutes. A call
 * reaches the role's escalation level.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string} role
 * @param {number} minute
 * @param {() => number} random the run's game random source
 */
export function callRole(inc, id, role, minute, random, rules = incidentRules) {
  const t = ticketById(inc, id);
  const spec = /** @type {any} */ (rules.roles)[role];
  if (!t || !spec) return null;
  const managerReached = t.calls.some((c) => c.role === spec.manager && c.answered);
  const blocked =
    !managerReached &&
    inc.injects.some(
      (i) =>
        i.firedAt != null &&
        i.fault === t.target &&
        injectSpec(i.id, rules).kind === 'call-missed' &&
        injectSpec(i.id, rules).role === role,
    );
  const answered = !blocked && (managerReached || spec.miss === 0 || random() >= spec.miss);
  const call = {
    role,
    at: minute,
    attempt: t.calls.filter((c) => c.role === role).length + 1,
    answered,
    arriveAt: answered ? minute + spec.arrive : null,
    workUntil: null,
  };
  t.calls.push(call);
  if (spec.level > 1) t.levels[spec.level] ??= minute;
  if (role === rules.coordinator.moderator) act(t, protocolActions.moderator);
  log(inc, id, 'call:' + role, minute);
  return call;
}

/**
 * The message in #CS_Critical (incident-21), with the crisis call set up or not.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {string[]} parts
 * @param {boolean} conference
 * @param {number} minute
 */
export function sendInternal(inc, id, parts, conference, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  const known = rules.internal.parts.map((p) => p.id);
  if (!t || t.internal || !Array.isArray(parts) || !parts.every((p) => known.includes(p)))
    return false;
  t.internal = { at: minute, parts: [...new Set(parts)], conference: !!conference };
  act(t, protocolActions.notify);
  log(inc, id, 'internal', minute);
  return true;
}

/**
 * A client update put together on the console. Unknown parts are dropped, not guessed.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {Partial<import('./queries/incident.js').IncidentUpdate>} payload
 * @param {number} minute
 */
export function sendUpdate(inc, id, payload, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  if (!t || !payload) return false;
  const optionsOf = (/** @type {string} */ q) =>
    courseQuestion(q, rules).options.map((/** @type {any} */ o) => o.id);
  const list = (/** @type {any} */ value, /** @type {string[]} */ known) =>
    Array.isArray(value) ? [...new Set(value.filter((v) => known.includes(v)))] : [];
  const one = (/** @type {any} */ value, /** @type {string[]} */ known) =>
    known.includes(value) ? value : null;
  const u = rules.update;
  const extra = rules.clientUpdates[0]?.parts.question;
  t.updates.push({
    at: minute,
    required: list(payload.required, optionsOf(u.parts.question)),
    principles: list(
      payload.principles,
      u.principles.map((p) => p.id),
    ),
    wording: one(payload.wording, optionsOf(u.wording.question)),
    sender: one(payload.sender, optionsOf(u.sender.question)),
    noProgress: one(payload.noProgress, optionsOf(u.noProgress.question)),
    workaround: payload.workaround
      ? list(payload.workaround, optionsOf(u.workaround.question))
      : null,
    client: extra ? one(payload.client, optionsOf(extra)) : null,
  });
  act(t, protocolActions.update);
  log(inc, id, 'update', minute);
  return true;
}

/**
 * Applies the workaround of the ticket's cause once it is known (an inject or the logs): the
 * impact goes down at once (incident-2); the repair is still owed.
 * @param {IncidentState} inc
 * @param {number} id
 * @param {number} minute
 */
export function applyWorkaround(inc, id, minute, rules = incidentRules) {
  const t = ticketById(inc, id);
  if (!t || t.target == null || t.workaroundAt != null || !t.workaroundKnown) return false;
  const cause = rules.causes.find((c) => c.id === inc.plan[/** @type {number} */ (t.target)].cause);
  if (!cause?.workaround) return false;
  t.workaroundAt = minute;
  endFault(inc, t.target, minute);
  log(inc, id, 'workaround', minute);
  return true;
}

/**
 * Records an action in the tracker (a coordinator's duty, incident-7).
 * @param {IncidentState} inc
 * @param {number} index the action's place in the journal
 */
export function recordJournal(inc, index) {
  const entry = inc.journal[index];
  if (!entry || entry.recorded) return false;
  entry.recorded = true;
  return true;
}

/**
 * Answers an inject that has come: options of its question, the order of its steps (indices),
 * or whatever its `expects` judges (the ticket's card and actions are judged instead).
 * @param {IncidentState} inc
 * @param {string} inject
 * @param {any} answer
 * @param {number} minute
 */
export function answerInject(inc, inject, answer, minute) {
  const item = inc.inbox.find((m) => m.inject === inject);
  if (!item || item.answeredAt != null || answer == null) return false;
  item.answer = Array.isArray(answer) ? [...answer] : answer;
  item.answeredAt = minute;
  log(inc, item.ticket, 'inject:' + inject, minute);
  return true;
}

/**
 * The review's questions by key: the course questions (by id) and the rules' own steps (by
 * their id), with the coordinator's duties (incident-7) asked here too.
 */
export function reviewQuestions(rules = incidentRules) {
  /** @type {Record<string, any>} */
  const keys = {};
  for (const step of /** @type {any[]} */ (rules.review)) keys[step.question ?? step.id] = step;
  keys['journal.duties'] = rules.journal.duties;
  return keys;
}

/**
 * Answers a review question after the shift; the first answer counts.
 * @param {IncidentState} inc
 * @param {string} key
 * @param {string[]} answer option or part ids
 */
export function answerReview(inc, key, answer, rules = incidentRules) {
  if (!reviewQuestions(rules)[key] || !Array.isArray(answer)) return false;
  inc.review ??= {};
  if (Object.hasOwn(inc.review, key)) return false;
  inc.review[key] = [...new Set(answer)];
  return true;
}

/**
 * What time does to the escalation: metric orders run out, injects come, the first level
 * completes, specialists arrive and repair, levels 3 and 4 fall due.
 * @param {IncidentState} inc
 * @param {number} minute
 */
export function updateEscalation(inc, minute, rules = incidentRules) {
  expireMetrics(inc, minute, rules);
  for (const i of inc.injects) {
    if (i.firedAt != null || i.at > minute) continue;
    i.firedAt = minute;
    const spec = injectSpec(i.id, rules);
    const t = ticketFor(inc, i.fault);
    inc.inbox.push({
      inject: i.id,
      at: minute,
      ticket: t?.id ?? null,
      answer: null,
      answeredAt: null,
    });
    if (spec.kind === 'role-away') inc.coordinatorAway = true;
    if (spec.kind === 'workaround' && t) t.workaroundKnown = true;
  }
  const matrix = /** @type {any[]} */ (rules.matrix);
  const levels = /** @type {any[]} */ (rules.severity.levels);
  for (const t of inc.tickets) {
    if (t.target == null) continue;
    const root = inc.plan[t.target];
    const cause = rules.causes.find((c) => c.id === root.cause);
    if (t.levels[1] == null && t.card.severity != null && (t.internal || t.updates.length))
      t.levels[1] = minute;
    // The first fixer of the cause to arrive repairs it, slower for each wrong field.
    if (cause && t.fixedAt == null) {
      const working =
        t.calls.find((c) => c.workUntil != null) ??
        t.calls.find(
          (c) =>
            c.answered && c.role === cause.fixer && /** @type {number} */ (c.arriveAt) <= minute,
        );
      if (working) {
        if (working.workUntil == null) {
          const wrong =
            Number(t.card.component !== root.component) + Number(t.card.cause !== root.cause);
          working.workUntil =
            /** @type {number} */ (working.arriveAt) +
            cause.fix * rules.escalation.fixPenalty ** wrong;
        }
        if (working.workUntil <= minute) {
          t.fixedAt = working.workUntil;
          endFault(inc, t.target, minute);
        }
      }
    }
    if (impactDown(inc, t)) continue;
    const stuck = matrix.find((l) => l.stuck)?.stuck;
    if (stuck != null && minute - t.openedAt >= stuck) t.levelDue[3] ??= t.openedAt + stuck;
    const top = matrix.at(-1);
    const severity = trueSeverity(inc, t, minute, rules);
    const sla = levels.find((l) => l.id === severity).sla;
    const due =
      (top.triggers.includes('critical') && severity === levels[0].id) ||
      (top.triggers.includes('sla-risk') &&
        slaUsed(t, minute, rules) >= sla * rules.escalation.slaRisk) ||
      (top.triggers.includes('client-top') &&
        inc.injects.some(
          (i) => i.firedAt != null && i.fault === t.target && injectSpec(i.id, rules).top,
        ));
    if (due) t.levelDue[top.level] ??= minute;
  }
}

/**
 * Orders a metric for a ticket: from now its kind of enemies count, within its window. An open
 * metric may be ordered again for a fresher picture; the old one shows until the new opens.
 * @param {IncidentState} inc
 * @param {string} metric
 * @param {number | null} ticket the ticket it is for (a client metric needs one)
 * @param {number} minute
 */
export function orderMetric(inc, metric, ticket, minute, rules = incidentRules) {
  const def = metricDef(metric, rules);
  const state = inc.metrics[metric];
  const t = ticket == null ? null : ticketById(inc, ticket);
  if (!def || !state || metricPending(inc, metric)) return false;
  if (ticket != null && !t) return false;
  if (def.kind === 'clients' && t?.target == null) return false;
  state.orderedAt = minute;
  state.kills = 0;
  state.ticket = ticket;
  log(inc, ticket, 'metric:' + metric, minute);
  return true;
}

/**
 * Closes the orders whose window ran out: the kills are lost, the metric has to be ordered
 * again.
 * @param {IncidentState} inc
 * @param {number} minute
 */
function expireMetrics(inc, minute, rules = incidentRules) {
  for (const def of /** @type {any[]} */ (rules.metrics)) {
    const state = inc.metrics[def.id];
    if (
      metricPending(inc, def.id) &&
      minute - /** @type {number} */ (state.orderedAt) > metricWindow(def, rules)
    ) {
      state.orderedAt = null;
      state.kills = 0;
    }
  }
}

/**
 * An enemy of `unit` was beaten: it counts for every pending metric of its kind; a metric with
 * enough kills opens now and proves what it reveals (the logs make a workaround known).
 * @param {IncidentState} inc
 * @param {string} unit
 * @param {number} minute
 */
export function countKill(inc, unit, minute, rules = incidentRules) {
  expireMetrics(inc, minute, rules);
  for (const def of /** @type {any[]} */ (rules.metrics)) {
    if (!metricPending(inc, def.id) || !metricUnits(inc, def.id, rules).includes(unit)) continue;
    const state = inc.metrics[def.id];
    if (++state.kills < def.kills) continue;
    state.openedAt = minute;
    const t = state.ticket == null ? null : ticketById(inc, state.ticket);
    if (t?.target != null && def.reveals.includes('workaround')) {
      const cause = rules.causes.find(
        (c) => c.id === inc.plan[/** @type {number} */ (t.target)].cause,
      );
      if (cause?.workaround) t.workaroundKnown = true;
    }
    log(inc, state.ticket, 'metric-open:' + def.id, minute);
  }
}
