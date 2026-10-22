// @ts-check
import { incidentRules } from '../../data/incident-rules.js';
import { createRng, shuffle } from '../core/rng.js';
import { badShare, componentDef } from './queries/incident.js';

// The production line of an incident shift (docs/INCIDENT-ESCALATION-PLAN.md, stage 3): the
// failures planned from the seed, the components' operations, the cascade along the feeds,
// the minute samples the metrics draw. Times are incident minutes. The line draws no
// randomness while it runs: what fails and when comes from the plan, which operations a
// failure hits from a fixed order, so the same seed and the same repairs give the same shift.

/** @typedef {import('./queries/incident.js').IncidentState} IncidentState */
/** @typedef {import('./queries/incident.js').PlannedFault} PlannedFault */
/** @typedef {typeof incidentRules} IncidentRules */

// The shift plan's own random stream: planning draws nothing from the run's game source.
const SHIFT_STREAM = 0x5f3759df;

/**
 * Components reachable from `id` along the feeds, both ways.
 * @param {string} id
 * @param {IncidentRules} rules
 */
export function linked(id, rules = incidentRules) {
  const seen = new Set([id]);
  for (const forward of [true, false]) {
    const queue = [id];
    while (queue.length) {
      const at = /** @type {string} */ (queue.pop());
      for (const f of rules.feeds) {
        const [from, to] = forward ? [f.from, f.to] : [f.to, f.from];
        if (from === at && !seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
  }
  return seen;
}

/**
 * Plans a fresh shift from the seed: its day, its failures with their causes, the false
 * alarms, the injects (unseen ids first) bound to failures that fit them, and when monitoring
 * and the client report each planned failure.
 * @param {IncidentState} inc
 * @param {number} seed
 * @param {string[]} seen ids of injects the player met in earlier shifts
 */
export function planShift(inc, seed, seen = [], rules = incidentRules) {
  const random = createRng((seed ^ SHIFT_STREAM) >>> 0).random;
  const int = (/** @type {number[]} */ [a, b]) => a + Math.floor(random() * (b - a + 1));
  /** @type {<T>(list: T[]) => T} */
  const pick = (list) => list[Math.floor(random() * list.length)];
  const { shift, clock } = rules;

  const chosen = [
    ...shuffle(
      rules.injects.filter((i) => !seen.includes(i.id)),
      random,
    ),
    ...shuffle(
      rules.injects.filter((i) => seen.includes(i.id)),
      random,
    ),
  ].slice(0, int(shift.injects));
  const days = clock.days
    .map((d, i) => ({ ...d, i }))
    .filter((d) => !chosen.some((/** @type {any} */ i) => i.weekend) || d.weekend);
  inc.day = pick(days).i;

  // One failure per inject that needs a particular one, more when the shift asks for more.
  // A parallel incident needs a failure on a component that some other one has no link to.
  /** @param {any} i */
  const parallel = (i) => i?.kind === 'second-fault';
  /** @param {any} i */
  const needsOwn = (i) =>
    i.after != null &&
    !!(i.component || i.fault || i.client || i.workaround || i.mild || parallel(i));
  const constrained = chosen.filter(needsOwn);
  const slots = Math.max(int(shift.faults), constrained.length);
  const order = shuffle(
    Array.from({ length: slots }, (_, k) => k),
    random,
  );
  /** @type {any[]} */
  const needOf = [];
  constrained.forEach((i, j) => (needOf[order[j]] = i));
  const specs = /** @type {Record<string, any>} */ (rules.faults);
  const realFaults = Object.keys(specs).filter((id) => specs[id].kind !== 'flap');
  /** @param {any} need @param {number} at @param {string[]} [avoid] */
  const failure = (need, at, avoid = []) => {
    const fault = need?.fault ?? pick(realFaults);
    const causes = rules.causes.filter(
      (c) => c.faults.includes(fault) && (!need?.workaround || c.workaround),
    );
    const components = rules.components.filter(
      (c) =>
        (!need?.component || c.id === need.component) &&
        (!need?.client || c.clients.includes(need.client)) &&
        (!parallel(need) || linked(c.id, rules).size < rules.components.length) &&
        !avoid.includes(c.id),
    );
    return /** @type {PlannedFault} */ ({
      at,
      component: pick(components).id,
      fault,
      cause: pick(causes).id,
      mild: !!need?.mild,
      from: null,
      startedAt: null,
      endedAt: null,
    });
  };
  /** @type {PlannedFault[]} */
  const faults = [];
  for (let k = 0; k < slots; k++)
    faults.push(
      failure(needOf[k], shift.firstAfter + k * shift.gap + Math.floor((random() * shift.gap) / 4)),
    );

  /** @type {{ inject: any, fault: PlannedFault | null }[]} */
  const bound = chosen.map((i) => ({
    inject: i,
    fault:
      i.after == null
        ? null
        : needOf.includes(i)
          ? faults[needOf.indexOf(i)]
          : // Any failure but a mild one: the inject is about a real incident.
            pick(faults.filter((f) => !f.mild).length ? faults.filter((f) => !f.mild) : faults),
  }));
  // A parallel failure, on a component with no link to the bound one.
  for (const b of bound)
    if (parallel(b.inject) && b.fault)
      faults.push(
        failure(null, b.fault.at + b.inject.after, [...linked(b.fault.component, rules)]),
      );
  const flap = Object.keys(specs).find((id) => specs[id].kind === 'flap');
  if (flap)
    for (let k = 0; k < shift.falseAlarms; k++)
      faults.push({
        at: int([shift.firstAfter, clock.minutes - specs[flap].minutes - 1]),
        component: pick(rules.components).id,
        fault: flap,
        cause: null,
        mild: false,
        from: null,
        startedAt: null,
        endedAt: null,
      });

  inc.plan = faults.sort((a, b) => a.at - b.at);
  inc.injects = bound
    .map((b) => ({
      id: b.inject.id,
      at: b.fault ? b.fault.at + b.inject.after : 0,
      fault: b.fault ? inc.plan.indexOf(b.fault) : null,
      firedAt: null,
    }))
    .sort((a, b) => a.at - b.at);
  inc.alerts = inc.plan.flatMap((f, i) =>
    f.cause == null
      ? []
      : [
          {
            fault: i,
            monitoringAt: f.at + rules.detection.monitoring,
            clientAt: f.at + rules.detection.client,
            seenAt: null,
          },
        ],
  );
  return inc;
}

/**
 * Ends a failure: repaired, passed by itself or no longer fed by its cascade. Its red
 * operations start over; the cascade it caused ends once its component recovers.
 * @param {IncidentState} inc
 * @param {number} index
 * @param {number} minute
 */
export function endFault(inc, index, minute) {
  const f = inc.plan[index];
  if (!f || f.endedAt != null) return false;
  f.endedAt = minute;
  const c = inc.components[f.component];
  c.faults = c.faults.filter((i) => i !== index);
  return true;
}

/**
 * Advances the line to `minute` of the shift: planned failures start, operations finish or
 * fail, queues fill and drain, failures spread and end, one sample a minute is kept.
 * @param {IncidentState} inc
 * @param {number} minute
 */
export function updateShift(inc, minute, rules = incidentRules) {
  const { cascade } = rules;
  const kinds = /** @type {Record<string, any>} */ (rules.faults);
  inc.plan.forEach((f, i) => {
    if (f.startedAt != null || f.endedAt != null || f.at > minute) return;
    f.startedAt = f.at;
    inc.components[f.component].faults.push(i);
  });
  // False alarms pass by themselves.
  inc.plan.forEach((f, i) => {
    const spec = kinds[f.fault];
    if (spec.kind === 'flap' && f.startedAt != null && minute >= f.startedAt + spec.minutes)
      endFault(inc, i, f.startedAt + spec.minutes);
  });

  rules.components.forEach((def, ci) => stepComponent(inc, def, ci, minute, rules));

  for (const def of rules.components) {
    const c = inc.components[def.id];
    if (badShare(inc, def.id, minute, rules) >= cascade.share) c.badSince ??= minute;
    else c.badSince = null;
  }
  spread(inc, minute, rules);

  const impacted = rules.components.filter(
    (c) => badShare(inc, c.id, minute, rules) >= rules.severity.impactShare,
  ).length;
  inc.impact = impacted / rules.components.length;
  // The impact held at the collapse level ends the shift (src/systems/queries/incident.js).
  if (inc.impact >= rules.shift.collapse.impact) inc.collapseSince ??= minute;
  else inc.collapseSince = null;

  while (inc.history.length <= minute && inc.history.length <= rules.clock.minutes)
    inc.history.push({
      minute: inc.history.length,
      components: Object.fromEntries(
        rules.components.map((def) => {
          const c = inc.components[def.id];
          return [
            def.id,
            {
              errors: c.ops.filter((op) => op.status === 'error').length,
              stalled: c.ops.filter((op) => op.status === 'busy' && minute - op.since > def.cycle)
                .length,
              done: c.done,
              queue: Math.round(c.queue),
            },
          ];
        }),
      ),
    });
}

/**
 * One component's operations at `minute`. A failure hits the operations first in a fixed
 * order of the component (its `share` of them): a stall keeps them grey, an error turns
 * them red as they finish, a reboot starts all of them over and finishes nothing while down.
 * @param {IncidentState} inc
 * @param {IncidentRules['components'][number]} def
 * @param {number} ci the component's place in the rules
 * @param {number} minute
 * @param {IncidentRules} rules
 */
function stepComponent(inc, def, ci, minute, rules) {
  const c = inc.components[def.id];
  const n = def.ops;
  let errorShare = 0,
    stallShare = 0,
    downSince = null;
  for (const index of c.faults) {
    const f = inc.plan[index];
    const spec = /** @type {Record<string, any>} */ (rules.faults)[f.fault];
    if (spec.kind === 'error')
      errorShare = Math.max(errorShare, f.mild ? spec.mildShare : spec.share);
    else if (spec.kind === 'stall' || spec.kind === 'flap')
      stallShare = Math.max(stallShare, spec.share);
    else if (spec.kind === 'reboot') {
      const since = /** @type {number} */ (f.startedAt);
      const start = since + Math.floor((minute - since) / spec.every) * spec.every;
      if (minute - start < spec.down) {
        downSince = start;
        if (!c.reboots.includes(start)) c.reboots.push(start);
      }
    }
  }
  // The fixed order: 7 is prime to every count of operations below 7 × 7.
  const hit = (/** @type {number} */ i, /** @type {number} */ share) =>
    (i * 7 + ci * 3) % n < Math.round(share * n);
  const sinks = rules.feeds
    .filter((f) => f.from === def.id)
    .map((f) => ({ c: inc.components[f.to], queue: componentDef(f.to, rules)?.queue }));
  c.ops.forEach((op, i) => {
    if (downSince != null) {
      op.status = 'busy';
      op.since = Math.max(op.since, downSince);
      return;
    }
    // A long step may pass more than one change of an operation.
    for (let turns = 0; turns < 4; turns++) {
      if (op.status === 'busy') {
        if (minute - op.since < def.cycle || hit(i, stallShare)) return;
        // Long overdue (it was stalled or the step was long): the next one starts now.
        op.since = minute - op.since >= 2 * def.cycle ? minute : op.since + def.cycle;
        if (hit(i, errorShare)) op.status = 'error';
        else {
          op.status = 'done';
          c.done++;
          if (def.queue) c.queue = Math.max(0, c.queue - def.queue.docsPerOp);
          for (const sink of sinks) if (sink.queue) sink.c.queue += sink.queue.docsPerOp;
        }
      } else if (op.status === 'done') {
        if (minute - op.since < def.cycle / 2) return;
        op.status = 'busy';
        op.since = minute - op.since >= def.cycle ? minute : op.since + def.cycle / 2;
      } else {
        // A red operation is done over once its failure has ended.
        if (hit(i, errorShare)) return;
        op.status = 'busy';
        op.since = minute;
      }
    }
  });
}

/**
 * The cascade: a component bad for `after` minutes starves those it feeds `delay` minutes
 * later (a stall), which turns into a failure after `errorAfter` more while the source stays
 * bad. A cascade ends when its source recovers.
 * @param {IncidentState} inc
 * @param {number} minute
 * @param {IncidentRules} rules
 */
function spread(inc, minute, rules) {
  const { cascade } = rules;
  /** @type {any} */
  const numbers = (/** @type {any} */ feed) => ({
    after: feed.after ?? cascade.after,
    delay: feed.delay ?? cascade.delay,
    errorAfter: feed.errorAfter ?? cascade.errorAfter,
  });
  const sourceOf = (/** @type {PlannedFault} */ f) =>
    f.from == null ? null : inc.plan[f.from].component;
  for (const feed of rules.feeds) {
    const src = inc.components[feed.from];
    const { after, delay } = numbers(feed);
    if (src.badSince == null || minute - src.badSince < after || !src.faults.length) continue;
    const exists = inc.plan.some(
      (f) => f.component === feed.to && f.endedAt == null && sourceOf(f) === feed.from,
    );
    if (!exists)
      inc.plan.push({
        at: minute + delay,
        component: feed.to,
        fault: cascade.stall,
        cause: null,
        mild: false,
        from: src.faults[0],
        startedAt: null,
        endedAt: null,
      });
  }
  inc.plan.forEach((f, i) => {
    const from = sourceOf(f);
    if (from == null || f.endedAt != null) return;
    const feed = rules.feeds.find((x) => x.from === from && x.to === f.component);
    const src = inc.components[from];
    if (src.badSince == null) {
      // The source recovered: a cascade not yet started never starts.
      if (f.startedAt == null) f.endedAt = minute;
      else endFault(inc, i, minute);
    } else if (
      f.startedAt != null &&
      f.fault === cascade.stall &&
      minute - f.startedAt >= numbers(feed).errorAfter
    )
      f.fault = cascade.fail;
  });
}
