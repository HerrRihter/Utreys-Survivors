// @ts-check
import { incidentRules } from '../../../data/incident-rules.js';
import { learningCourses } from '../../../data/learning-courses.js';

// Read-only questions about a run's incident shift (`state.incident`, src/systems/escalation.js)
// for the systems, the HUD and the renderer. Times are incident minutes from the shift's start.

/**
 * The state of a shift. Times are incident minutes from the shift's start
 * (`run time / clock.minuteSeconds`). Every field exists from the start; the systems of the
 * mode fill them.
 *
 * @typedef {{ status: 'busy' | 'done' | 'error', since: number }} IncidentOp
 *   An operation of a component: grey in progress, green done, red failed; `since` is when it
 *   took this status.
 * @typedef {{ ops: IncidentOp[], queue: number, done: number, faults: number[],
 *   badSince: number | null, starvedSince: number | null, reboots: number[] }} ComponentState
 *   `done` counts finished operations; `faults` are indices into the plan that act on it now
 *   (its own failures and the cascade); `badSince` when its bad share reached the cascade
 *   threshold, `starvedSince` when its sources stopped feeding it; `reboots` when it restarted.
 * @typedef {{ at: number, component: string, fault: string, cause: string | null,
 *   mild: boolean, from: number | null, startedAt: number | null,
 *   endedAt: number | null }} PlannedFault
 *   A failure of the shift: planned from the seed, or spread by the cascade (`from` is the
 *   index of the failure it came from); `cause` is null for a false alarm and a cascade (whose
 *   cause is its root's). It acts from `startedAt` until `endedAt`.
 * @typedef {{ id: string, at: number, fault: number | null,
 *   firedAt: number | null }} PlannedInject
 *   An inject of the shift, bound to the failure `fault` of the plan or to the shift's start.
 * @typedef {{ minute: number, components: Record<string, { errors: number, stalled: number,
 *   done: number, queue: number }> }} HistorySample
 *   One sample a minute: what the metrics draw.
 * @typedef {{ fault: number, monitoringAt: number, clientAt: number,
 *   seenAt: number | null }} IncidentAlert
 *   When monitoring and the client report a planned failure, and when the player first saw it.
 * @typedef {{ orderedAt: number | null, kills: number, openedAt: number | null,
 *   ticket: number | null }} MetricState
 *   An ordered metric counts kills since `orderedAt`; once open it shows the history up to
 *   `openedAt`.
 * @typedef {{ role: string, at: number, attempt: number, answered: boolean,
 *   arriveAt: number | null, workUntil: number | null }} IncidentCall
 *   A call: answered or not; an answering role arrives at `arriveAt`, a fixer works until
 *   `workUntil`.
 * @typedef {{ at: number, required: string[], principles: string[], wording: string | null,
 *   sender: string | null, noProgress: string | null, workaround: string[] | null,
 *   client: string | null }} IncidentUpdate
 *   A client update put together on the console: the parts of incident-22, the principles,
 *   the wording (incident-26), the sender (incident-30), what is said when nothing changed
 *   (incident-23), the workaround template's parts (incident-27) and a client's extra
 *   (incident-33). Option ids are those of the course questions.
 * @typedef {{
 *   id: number, openedAt: number, component: string, target: number | null,
 *   actions: string[], created: string | null, status: string | null,
 *   statusAt: Record<string, number>, refused: string[][], card: Record<string, any>,
 *   severityAt: number | null, severityTruth: string | null, asked: string[] | null,
 *   levels: Record<string, number>, levelDue: Record<string, number>,
 *   calls: IncidentCall[], internal: { at: number, parts: string[], conference: boolean } | null,
 *   updates: IncidentUpdate[], choices: Record<string, { at: number, options: string[] }>,
 *   workaroundKnown: boolean, workaroundAt: number | null, fixedAt: number | null,
 * }} IncidentTicket
 *   A CRIT ticket the player opened on `component` at `openedAt`: `target` is the root of the
 *   real failure there (null: a false escalation); `actions` the protocol's actions in the
 *   order first taken; `created` the option of incident-11 used; `refused` the missing fields
 *   of each refused move to work; `severityTruth` the right severity when the player last set
 *   it; `asked` the severity questions the player asked; `levels` when each escalation level
 *   was reached, `levelDue` when it became due; `choices` the answers to the course questions
 *   asked on the way (matrix levels, statuses).
 * @typedef {{ inject: string, at: number, ticket: number | null, answer: any,
 *   answeredAt: number | null }} InboxItem
 *   An inject that has come (a message or an event) and the player's answer to it.
 * @typedef {{ minute: number, ticket: number | null, action: string,
 *   recorded: boolean }} JournalEntry
 *
 * @typedef {{
 *   rulesVersion: number, course: string, day: number, coordinatorAway: boolean,
 *   plan: PlannedFault[], injects: PlannedInject[],
 *   components: Record<string, ComponentState>, history: HistorySample[],
 *   alerts: IncidentAlert[], tickets: IncidentTicket[], nextTicket: number, inbox: InboxItem[],
 *   metrics: Record<string, MetricState>, journal: JournalEntry[],
 *   impact: number, collapseSince: number | null, review: Record<string, unknown> | null,
 * }} IncidentState
 */
/** @typedef {typeof incidentRules} IncidentRules */

/**
 * The shift's minute at the run's time.
 * @param {{ t: number }} s
 */
export const shiftMinute = (s, rules = incidentRules) => s.t / rules.clock.minuteSeconds;

/**
 * The shift's wall clock at `minute`: the day's name and «HH:MM».
 * @param {IncidentState} inc
 * @param {number} minute
 */
export function shiftClock(inc, minute, rules = incidentRules) {
  const total = rules.clock.start + Math.floor(minute);
  const days = rules.clock.days;
  const day = days[(inc.day + Math.floor(total / (24 * 60))) % days.length];
  const inDay = total % (24 * 60);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return { day: day.name, time: pad(Math.floor(inDay / 60)) + ':' + pad(inDay % 60) };
}

/**
 * Whether `minute` of the shift is night for the clients' night triggers.
 * @param {number} minute
 */
export function isNight(minute, rules = incidentRules) {
  const inDay = (rules.clock.start + Math.floor(minute)) % (24 * 60);
  const { from, to } = rules.clock.night;
  return from <= to ? inDay >= from && inDay < to : inDay >= from || inDay < to;
}

/** @param {string} id */
export const componentDef = (id, rules = incidentRules) =>
  rules.components.find((c) => c.id === id);

/**
 * An operation in progress for longer than it should be: grey and stuck.
 * @param {{ status: string, since: number }} op
 * @param {{ cycle: number }} def
 * @param {number} minute
 */
export const opStuck = (op, def, minute, rules = incidentRules) =>
  op.status === 'busy' && minute - op.since > def.cycle + rules.cascade.stuckAfter;

/**
 * The share of a component's operations that are red or stuck.
 * @param {IncidentState} inc
 * @param {string} id
 * @param {number} minute
 */
export function badShare(inc, id, minute, rules = incidentRules) {
  const def = componentDef(id, rules);
  if (!def) return 0;
  const ops = inc.components[id].ops;
  return (
    ops.filter((op) => op.status === 'error' || opStuck(op, def, minute, rules)).length / ops.length
  );
}

/**
 * The failure a cascade came from, followed back to the one the plan started.
 * @param {IncidentState} inc
 * @param {number} index
 */
export function rootFault(inc, index) {
  let i = index;
  while (inc.plan[i]?.from != null) i = /** @type {number} */ (inc.plan[i].from);
  return i;
}

/**
 * The failures acting on a component now.
 * @param {IncidentState} inc
 * @param {string} id
 */
export const activeFaults = (inc, id) => inc.components[id].faults.map((i) => inc.plan[i]);

/**
 * Whether the outside receiver gets nothing: its source is failing.
 * @param {IncidentState} inc
 * @param {number} minute
 */
export const receiverDown = (inc, minute, rules = incidentRules) =>
  badShare(inc, rules.receiver.from, minute, rules) >= rules.cascade.share;

// --- What is right: the truth the escalation is graded against. ---

/** The course the rules teach. */
export const incidentCourse = (rules = incidentRules) =>
  /** @type {any} */ (learningCourses)[rules.course];

/**
 * A course question of the rules' course.
 * @param {string} id
 */
export const courseQuestion = (id, rules = incidentRules) =>
  incidentCourse(rules).questions.find((/** @type {any} */ q) => q.id === id);

/**
 * Whether `options` are exactly the key of the course question `id` (order aside).
 * @param {string} id
 * @param {string[] | string | null | undefined} options
 */
export function keyMatches(id, options, rules = incidentRules) {
  const key = courseQuestion(id, rules)?.correct ?? [];
  const given = options == null ? [] : Array.isArray(options) ? options : [options];
  return given.length === key.length && key.every((/** @type {string} */ o) => given.includes(o));
}

/**
 * Roots of the real failures acting on a component now (false alarms are no failure).
 * @param {IncidentState} inc
 * @param {string} id
 */
export const realRootsOn = (inc, id) => [
  ...new Set(
    (inc.components[id]?.faults ?? [])
      .map((i) => rootFault(inc, i))
      .filter((i) => inc.plan[i].cause != null),
  ),
];

/**
 * The components a root failure acts on now: its own and those its cascade reached.
 * @param {IncidentState} inc
 * @param {number} root
 */
export const affectedBy = (inc, root, rules = incidentRules) =>
  rules.components
    .filter((c) => inc.components[c.id].faults.some((i) => rootFault(inc, i) === root))
    .map((c) => c.id);

/**
 * The clients of what a root failure acts on now (its own component's at least).
 * @param {IncidentState} inc
 * @param {number} root
 */
export function clientsOf(inc, root, rules = incidentRules) {
  const ids = new Set([inc.plan[root].component, ...affectedBy(inc, root, rules)]);
  return [...new Set(rules.components.filter((c) => ids.has(c.id)).flatMap((c) => c.clients))];
}

/**
 * The right severity of a ticket at `minute`: the first level of the rules whose conditions
 * hold (incident-3), raised by a client's own trigger (incident-31). A false escalation is
 * the lowest.
 * @param {IncidentState} inc
 * @param {IncidentTicket} t
 * @param {number} minute
 */
export function trueSeverity(inc, t, minute, rules = incidentRules) {
  const levels = /** @type {any[]} */ (rules.severity.levels);
  if (t.target == null) return levels.at(-1).id;
  const root = inc.plan[t.target];
  const affected = affectedBy(inc, t.target, rules);
  const clients = clientsOf(inc, t.target, rules);
  const cause = rules.causes.find((c) => c.id === root.cause);
  /** @type {Record<string, boolean>} */
  const facts = {
    impact: affected.some((id) => badShare(inc, id, minute, rules) >= rules.severity.impactShare),
    mass:
      clients.length >= rules.severity.massClients ||
      affected.length >= rules.severity.massComponents,
    workaround: !!cause?.workaround,
  };
  let index = levels.findIndex((l) =>
    Object.entries(l.when).every(([key, value]) => facts[key] === value),
  );
  for (const trigger of /** @type {any[]} */ (rules.clientTriggers)) {
    if (!clients.includes(trigger.client) || !affected.includes(trigger.component)) continue;
    if (triggerHolds(inc, trigger, minute, rules))
      index = Math.min(
        index,
        levels.findIndex((l) => l.id === trigger.severity),
      );
  }
  return levels[index].id;
}

/**
 * Whether a client's Critical trigger holds at `minute`: a queue at `min` or more for the
 * last `minutes`, or `count` restarts within the last `minutes` (at night if it says so).
 * @param {IncidentState} inc
 * @param {any} trigger
 * @param {number} minute
 */
export function triggerHolds(inc, trigger, minute, rules = incidentRules) {
  if (trigger.night && !isNight(minute, rules)) return false;
  if (trigger.kind === 'queue') {
    const from = Math.ceil(minute - trigger.minutes);
    if (from < 0) return false;
    const window = inc.history.slice(from, Math.floor(minute) + 1);
    return (
      window.length >= trigger.minutes &&
      window.every((h) => h.components[trigger.component].queue >= trigger.min)
    );
  }
  return (
    inc.components[trigger.component].reboots.filter((at) => minute - at <= trigger.minutes)
      .length >= trigger.count
  );
}

/**
 * How a ticket's failure got noticed: by the player before monitoring, by monitoring before
 * the client, by the client. The methods are listed in that order in the rules.
 * @param {IncidentState} inc
 * @param {IncidentTicket} t
 */
export function trueDetection(inc, t, rules = incidentRules) {
  const methods = rules.detection.methods;
  const alert = inc.alerts.find((a) => a.fault === t.target);
  if (!alert || t.openedAt < alert.monitoringAt) return methods[0].id;
  return t.openedAt < alert.clientAt ? methods[1].id : methods[2].id;
}

/**
 * The right card of a ticket: who coordinates (the senior, or the stand-in while the senior
 * is away), moderates and repairs, how it was noticed, when it started and was noticed, the
 * source component and the cause. Null for a false escalation.
 * @param {IncidentState} inc
 * @param {IncidentTicket} t
 */
export function trueCard(inc, t, rules = incidentRules) {
  if (t.target == null) return null;
  const root = inc.plan[t.target];
  const cause = rules.causes.find((c) => c.id === root.cause);
  return {
    coordinator: inc.coordinatorAway ? rules.coordinator.standIn : rules.coordinator.role,
    moderator: rules.coordinator.moderator,
    executor: cause?.fixer ?? null,
    detection: trueDetection(inc, t, rules),
    times: { start: root.startedAt ?? root.at, detected: t.openedAt },
    component: root.component,
    cause: root.cause,
  };
}

/**
 * Minutes of SLA a ticket has used: from opening until a status that pauses or stops it.
 * @param {IncidentTicket} t
 * @param {number} minute
 */
export function slaUsed(t, minute, rules = incidentRules) {
  const stops = rules.statuses
    .filter((/** @type {any} */ st) => st.slaPaused || st.slaStopped || st.solved)
    .map((st) => t.statusAt[st.id])
    .filter((at) => at != null);
  return Math.min(minute, ...stops) - t.openedAt;
}

/**
 * The ticket the player opened for a root failure, if any.
 * @param {IncidentState} inc
 * @param {number | null} root
 */
export const ticketFor = (inc, root) =>
  root == null ? null : (inc.tickets.find((t) => t.target === root) ?? null);

/**
 * Whether a ticket's impact is down: its failure repaired or worked around.
 * @param {IncidentState} inc
 * @param {IncidentTicket} t
 */
export const impactDown = (inc, t) =>
  t.target == null || t.workaroundAt != null || inc.plan[t.target].endedAt != null;

/**
 * Whether anything moved on a ticket in (`from`, `to`]: a status, a repair, a workaround, a
 * call. An update with nothing new says so (incident-23).
 * @param {IncidentTicket} t
 * @param {number} from
 * @param {number} to
 */
export const progressBetween = (t, from, to) =>
  Object.values(t.statusAt).some((at) => at > from && at <= to) ||
  [t.fixedAt, t.workaroundAt].some((at) => at != null && at > from && at <= to) ||
  t.calls.some((c) => c.at > from && c.at <= to);

// --- Metrics: ordered on the console, opened by beating enemies of their kind. ---

/** @param {string} id */
export const metricDef = (id, rules = incidentRules) =>
  /** @type {any} */ (rules.metrics.find((m) => m.id === id));

/**
 * The minutes a metric's order stays open: its `withinSeconds` of play.
 * @param {any} metric
 */
export const metricWindow = (metric, rules = incidentRules) =>
  metric.withinSeconds / rules.clock.minuteSeconds;

/**
 * Whether a metric is ordered and not yet opened for this order.
 * @param {IncidentState} inc
 * @param {string} id
 */
export function metricPending(inc, id) {
  const m = inc.metrics[id];
  return !!m && m.orderedAt != null && !(m.openedAt != null && m.openedAt >= m.orderedAt);
}

/**
 * The enemy units whose defeat counts for a metric: its own units, or for a client metric
 * the clients of its ticket's failure.
 * @param {IncidentState} inc
 * @param {string} id
 * @returns {string[]}
 */
export function metricUnits(inc, id, rules = incidentRules) {
  const def = metricDef(id, rules);
  if (!def) return [];
  if (def.kind === 'units') return def.units;
  const t = inc.tickets.find((x) => x.id === inc.metrics[id].ticket);
  return t?.target == null ? [] : clientsOf(inc, t.target, rules);
}

/**
 * How much more often the waves bring each unit while metrics are ordered: the units of every
 * pending metric weigh `weight` times more. Null when nothing is ordered (the waves as usual).
 * @param {IncidentState | null} inc
 * @returns {Record<string, number> | null}
 */
export function metricBoost(inc, rules = incidentRules) {
  if (!inc) return null;
  /** @type {Record<string, number>} */
  const boost = {};
  for (const def of /** @type {any[]} */ (rules.metrics))
    if (metricPending(inc, def.id))
      for (const unit of metricUnits(inc, def.id, rules))
        boost[unit] = Math.max(boost[unit] ?? 1, def.weight);
  return Object.keys(boost).length ? boost : null;
}

/**
 * What an open metric shows: one point a minute up to the moment it opened, for each of its
 * series and each component it covers (a client metric: the components serving the ticket's
 * clients). `throughput` is operations done in that minute. Null while it never opened.
 * @param {IncidentState} inc
 * @param {string} id
 */
export function metricSeries(inc, id, rules = incidentRules) {
  const def = metricDef(id, rules);
  const state = inc.metrics[id];
  if (!def || state?.openedAt == null) return null;
  const clients = def.kind === 'clients' ? metricUnits(inc, id, rules) : null;
  const components = rules.components
    .filter((c) => !clients || c.clients.some((client) => clients.includes(client)))
    .map((c) => c.id);
  const samples = inc.history.filter((h) => h.minute <= /** @type {number} */ (state.openedAt));
  /** @type {Record<string, Record<string, number[]>>} */
  const series = {};
  for (const name of /** @type {string[]} */ (def.series)) {
    series[name] = {};
    for (const c of components)
      series[name][c] = samples.map((h, i) => {
        const v = h.components[c];
        if (name === 'throughput') return i ? v.done - samples[i - 1].components[c].done : 0;
        return name === 'errors' ? v.errors : name === 'stalled' ? v.stalled : v.queue;
      });
  }
  return { openedAt: state.openedAt, minutes: samples.map((h) => h.minute), clients, series };
}

/**
 * How the shift ends at `minute`: lost once the impact has held at the collapse level for its
 * minutes, done at the end of the shift, or not yet (null).
 * @param {IncidentState} inc
 * @param {number} minute
 * @returns {'collapse' | 'done' | null}
 */
export function shiftEnd(inc, minute, rules = incidentRules) {
  const { collapse } = rules.shift;
  if (inc.collapseSince != null && minute - inc.collapseSince >= collapse.minutes)
    return 'collapse';
  return minute >= rules.clock.minutes ? 'done' : null;
}

/**
 * Whether an incident was left to grow: the impact at the punishment level, or a due level 4
 * left uncalled for too long. The shift's boss comes then.
 * @param {IncidentState} inc
 * @param {number} minute
 */
export function shiftEscalated(inc, minute, rules = incidentRules) {
  const { punishment } = rules.shift;
  const top = Math.max(.../** @type {any[]} */ (rules.matrix).map((l) => l.level));
  return (
    inc.impact >= punishment.impact ||
    inc.tickets.some(
      (t) =>
        t.levelDue[top] != null &&
        t.levels[top] == null &&
        minute - t.levelDue[top] >= punishment.overdue,
    )
  );
}

/**
 * Whether the escalation console may open: a shift run with no living enemy within the
 * console's safe radius of the hero.
 * @param {{ incident: IncidentState | null, p: { x: number, y: number },
 *   enemies: { x: number, y: number, hp: number }[] }} s
 */
export function consoleOpenable(s, rules = incidentRules) {
  const r = rules.console.safeRadius;
  return (
    !!s.incident && !s.enemies.some((e) => e.hp > 0 && Math.hypot(e.x - s.p.x, e.y - s.p.y) < r)
  );
}
