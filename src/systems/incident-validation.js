// @ts-check
// The check of the incident escalation rules (data/incident-rules.js) against the course they
// teach and the units they name: run by check:contracts and the tests.
import { linked } from './production-line.js';
import { protocolActions } from './escalation.js';

// Behaviours the rules may name; the systems that run them dispatch on these kinds.
export const faultKinds = ['error', 'stall', 'reboot', 'flap'];
export const injectKinds = [
  'client-message',
  'role-away',
  'call-missed',
  'workaround',
  'second-fault',
  'scenario',
];
export const metricKinds = ['units', 'clients'];
export const matrixTriggers = ['critical', 'sla-risk', 'client-top'];
export const triggerKinds = ['queue', 'reboots'];
// Groups of the shift's grade (src/systems/incident-grading.js).
export const gradeGroups = [
  'detection',
  'first',
  'creation',
  'card',
  'severity',
  'matrix',
  'calls',
  'updates',
  'statuses',
  'journal',
  'injects',
  'review',
];
const fieldKinds = ['role', 'detection', 'time', 'times'];

/**
 * Every course question the rules teach: the ids in `covers` lists and in `{ question }`
 * references, anywhere in the rules.
 * @param {unknown} rules
 * @returns {Set<string>}
 */
export function coveredQuestions(rules) {
  const ids = new Set();
  (function walk(value) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      const v = /** @type {Record<string, unknown>} */ (value);
      if (typeof v.question === 'string') ids.add(v.question);
      if (Array.isArray(v.covers)) for (const id of v.covers) ids.add(id);
      Object.values(v).forEach(walk);
    }
  })(rules);
  return ids;
}

/**
 * Throws on the first broken rule; true when the rules hold together.
 * @param {any} rules data/incident-rules.js `incidentRules`
 * @param {{ course: any, units: Record<string, any> }} context the course named by
 *   `rules.course` and the unit definitions
 */
export function validateIncidentRules(rules, { course, units }) {
  const fail = (/** @type {boolean} */ ok, /** @type {string} */ message) => {
    if (!ok) throw new Error('Incident rules: ' + message);
  };
  const positive = (/** @type {unknown} */ n, /** @type {string} */ what) =>
    fail(typeof n === 'number' && Number.isFinite(n) && n > 0, what + ' must be positive');
  const share = (/** @type {unknown} */ n, /** @type {string} */ what) =>
    fail(typeof n === 'number' && n >= 0 && n < 1, what + ' must be a share below 1');
  const unique = (/** @type {string[]} */ ids, /** @type {string} */ what) =>
    fail(new Set(ids).size === ids.length, 'duplicate ' + what);

  fail(Number.isInteger(rules.version) && rules.version > 0, 'version');
  fail(!!course && course.id === rules.course, 'course ' + rules.course + ' not given');
  const questions = new Map(course.questions.map((/** @type {any} */ q) => [q.id, q]));

  // References to the course: known questions, closed ones where the console checks a key.
  const covered = coveredQuestions(rules);
  for (const id of covered) fail(questions.has(id), 'unknown course question ' + id);
  (function walk(value) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      if (typeof value.question === 'string')
        fail(questions.get(value.question).type !== 'open', value.question + ' is open');
      Object.values(value).forEach(walk);
    }
  })(rules);
  // The whole course is taught: no question is left out of the mode.
  for (const id of questions.keys()) fail(covered.has(id), 'course question not covered: ' + id);

  // Parts put together by the player: at least one right and one wrong, unique ids.
  const parts = (/** @type {any[]} */ list, /** @type {string} */ what) => {
    fail(Array.isArray(list) && list.length > 1, what + ' parts');
    unique(
      list.map((p) => p.id),
      what + ' part',
    );
    for (const p of list) fail(typeof p.text === 'string' && !!p.text, what + ' part text');
    fail(
      list.some((p) => p.right === true) && list.some((p) => p.right === false),
      what + ' needs right and wrong parts',
    );
  };
  const steps = (/** @type {unknown} */ list, /** @type {string} */ what) =>
    fail(
      Array.isArray(list) && list.length > 1 && list.every((s) => typeof s === 'string' && s),
      what + ' steps',
    );

  // Clock and shift.
  const { clock, shift } = rules;
  positive(clock.minuteSeconds, 'clock.minuteSeconds');
  positive(clock.minutes, 'clock.minutes');
  fail(clock.start >= 0 && clock.start < 24 * 60, 'clock.start');
  fail(
    [clock.night.from, clock.night.to].every((m) => m >= 0 && m < 24 * 60),
    'clock.night',
  );
  fail(
    clock.days.length === 7 && clock.days.some((/** @type {any} */ d) => d.weekend),
    'clock.days',
  );
  for (const range of [shift.faults, shift.injects])
    fail(
      Number.isInteger(range[0]) && range[0] > 0 && range[1] >= range[0],
      'shift range ' + range,
    );
  fail(Number.isInteger(shift.falseAlarms) && shift.falseAlarms >= 0, 'shift.falseAlarms');
  positive(shift.firstAfter, 'shift.firstAfter');
  positive(shift.gap, 'shift.gap');
  fail(
    // Injects bound to a particular failure may each ask for one of their own.
    shift.firstAfter + shift.gap * (Math.max(shift.faults[1], shift.injects[1]) - 1) <
      clock.minutes,
    'the shift fits its faults',
  );
  fail(shift.injects[1] <= rules.injects.length, 'more injects asked than defined');

  // Components and their links.
  const components = new Map(rules.components.map((/** @type {any} */ c) => [c.id, c]));
  unique(
    rules.components.map((/** @type {any} */ c) => c.id),
    'component',
  );
  const clients = new Set();
  for (const c of rules.components) {
    fail(typeof c.label === 'string' && !!c.label, c.id + '.label');
    fail(Number.isInteger(c.ops) && c.ops > 0, c.id + '.ops');
    positive(c.cycle, c.id + '.cycle');
    // The fixed order in which failures hit operations needs a count prime to 7.
    fail(c.ops % 7 !== 0, c.id + '.ops must not be a multiple of 7');
    if (c.queue) positive(c.queue.docsPerOp, c.id + '.queue.docsPerOp');
    fail(c.clients.length > 0, c.id + ' has no clients');
    for (const client of c.clients) {
      fail(!!units[client] && !units[client].boss, c.id + ' client ' + client);
      clients.add(client);
    }
  }
  fail(components.has(rules.receiver.from), 'receiver.from');
  const feeds = new Map([...components.keys()].map((id) => [id, /** @type {string[]} */ ([])]));
  for (const f of rules.feeds) {
    fail(components.has(f.from) && components.has(f.to) && f.from !== f.to, 'feed ' + f.from);
    feeds.get(f.from)?.push(f.to);
  }
  // No cycles: a failure spreads downstream and stops.
  const state = new Map();
  const visit = (/** @type {string} */ id) => {
    fail(state.get(id) !== 1, 'feeds form a cycle through ' + id);
    if (state.get(id) === 2) return;
    state.set(id, 1);
    for (const next of feeds.get(id) || []) visit(next);
    state.set(id, 2);
  };
  for (const id of components.keys()) visit(id);
  const cascade = rules.cascade;
  share(cascade.share, 'cascade.share');
  for (const key of ['stuckAfter', 'after', 'delay', 'errorAfter'])
    positive(cascade[key], 'cascade.' + key);
  for (const f of rules.feeds)
    for (const key of ['after', 'delay', 'errorAfter'])
      if (key in f) positive(f[key], 'feed ' + f.from + '.' + key);
  fail(rules.faults[cascade.stall]?.kind === 'stall', 'cascade.stall must be a stall');
  fail(rules.faults[cascade.fail]?.kind === 'error', 'cascade.fail must be an error');

  // Faults and causes.
  const roles = rules.roles;
  for (const [id, f] of Object.entries(rules.faults)) {
    const spec = /** @type {any} */ (f);
    fail(faultKinds.includes(spec.kind), 'fault kind of ' + id);
    fail(!!spec.name, 'fault name of ' + id);
    if (spec.kind !== 'reboot') fail(spec.share > 0 && spec.share <= 1, 'fault share of ' + id);
    if (spec.kind === 'flap') positive(spec.minutes, 'fault minutes of ' + id);
    if (spec.kind === 'reboot')
      fail(spec.every > spec.down && spec.down > 0, 'reboot every and down of ' + id);
    // A mild failure stays below the cascade and the business impact.
    if (spec.mildShare != null)
      fail(
        spec.mildShare > 0 &&
          spec.mildShare < cascade.share &&
          spec.mildShare < rules.severity.impactShare,
        'fault mildShare of ' + id,
      );
  }
  fail(
    Object.values(rules.faults).filter((/** @type {any} */ f) => f.kind === 'flap').length <= 1,
    'one false alarm kind',
  );
  const causeIds = rules.causes.map((/** @type {any} */ c) => c.id);
  unique(causeIds, 'cause');
  for (const c of rules.causes) {
    fail(
      c.faults.length > 0 && c.faults.every((/** @type {string} */ f) => rules.faults[f]),
      'cause faults of ' + c.id,
    );
    fail(!!c.text && !!roles[c.fixer], 'cause ' + c.id);
    positive(c.fix, 'cause ' + c.id + '.fix');
  }
  // Every fault but the self-healing one has causes to pick from, more than one in the card.
  for (const [id, f] of Object.entries(rules.faults))
    if (/** @type {any} */ (f).kind !== 'flap')
      fail(
        rules.causes.some((/** @type {any} */ c) => c.faults.includes(id)),
        'no cause for fault ' + id,
      );
  fail(causeIds.length > 1, 'the card needs causes to choose from');

  // People, calls and the matrix.
  for (const [id, r] of Object.entries(roles)) {
    const role = /** @type {any} */ (r);
    fail(!!role.name && [1, 2, 3, 4].includes(role.level), 'role ' + id);
    fail(role.arrive >= 0, 'role ' + id + '.arrive');
    share(role.miss, 'role ' + id + '.miss');
    if (role.manager) fail(!!roles[role.manager], 'role ' + id + '.manager');
    if (role.miss > 0) fail(!!role.manager, 'role ' + id + ' may miss calls but has no manager');
  }
  fail(!!roles[rules.coordinator.role] && !!roles[rules.coordinator.standIn], 'coordinator');
  fail(
    Number.isInteger(rules.calls.attempts) &&
      rules.calls.attempts > 0 &&
      rules.calls.interval[0] > 0 &&
      rules.calls.interval[1] >= rules.calls.interval[0],
    'calls',
  );
  rules.matrix.forEach((/** @type {any} */ level, /** @type {number} */ i) => {
    fail(level.level === i + 1 && !!level.name, 'matrix level ' + (i + 1));
    fail(
      level.roles.length > 0 &&
        level.roles.every((/** @type {string} */ r) => roles[r]?.level === level.level),
      'matrix level ' + level.level + ' roles',
    );
    for (const t of level.triggers || []) fail(matrixTriggers.includes(t), 'matrix trigger ' + t);
  });
  fail(rules.matrix.length === 4, 'four matrix levels');
  positive(rules.matrix[0].within, 'level 1 deadline');
  positive(rules.matrix[2].stuck, 'level 3 delay');
  fail(rules.matrix[2].stuck > rules.matrix[0].within, 'level 3 comes after level 1');

  // Severity.
  const severity = rules.severity;
  parts(severity.questions, 'severity');
  share(severity.impactShare, 'severity.impactShare');
  fail(Number.isInteger(severity.massClients) && severity.massClients > 1, 'massClients');
  fail(Number.isInteger(severity.massComponents) && severity.massComponents > 1, 'massComponents');
  const levels = severity.levels.map((/** @type {any} */ l) => l.id);
  unique(levels, 'severity level');
  for (const l of severity.levels) {
    positive(l.update, l.id + '.update');
    positive(l.sla, l.id + '.sla');
    for (const key of Object.keys(l.when))
      fail(['impact', 'mass', 'workaround'].includes(key), l.id + ' condition ' + key);
  }
  fail(Object.keys(severity.levels.at(-1).when).length === 0, 'last severity level catches all');
  for (const i of severity.levels.keys())
    if (i) fail(severity.levels[i].update >= severity.levels[i - 1].update, 'update cadences');
  for (const t of rules.clientTriggers) {
    fail(triggerKinds.includes(t.kind), 'client trigger kind ' + t.kind);
    fail(clients.has(t.client), 'trigger client ' + t.client);
    fail(components.get(t.component)?.clients.includes(t.client), 'trigger component');
    fail(levels.includes(t.severity), 'trigger severity');
    positive(t.minutes, 'trigger minutes');
    if (t.kind === 'queue') {
      fail(!!components.get(t.component).queue, 'queue trigger on a component without queue');
      positive(t.min, 'trigger min');
    } else fail(Number.isInteger(t.count) && t.count > 1, 'trigger count');
  }
  for (const e of rules.clientEscalation)
    fail(clients.has(e.client) && roles[e.first]?.level === 2, 'client escalation ' + e.client);
  for (const u of rules.clientUpdates) fail(clients.has(u.client), 'client update ' + u.client);

  // Protocol, card and statuses: option maps cover their question exactly.
  const optionsOf = (/** @type {string} */ id) =>
    questions.get(id).options.map((/** @type {any} */ o) => o.id);
  const first = rules.protocol.first;
  fail(
    Object.values(first.actions).every((a) =>
      Object.values(protocolActions).includes(/** @type {string} */ (a)),
    ),
    'protocol.first names unknown actions',
  );
  fail(
    optionsOf(first.question).every((/** @type {string} */ o) => first.actions[o]) &&
      Object.keys(first.actions).length === optionsOf(first.question).length,
    'protocol.first maps every option',
  );
  const ticket = rules.ticket;
  fail(
    ticket.fields
      .map((/** @type {any} */ f) => f.option)
      .sort()
      .join() === optionsOf(ticket.question).sort().join(),
    'ticket fields are the options of ' + ticket.question,
  );
  unique(
    ticket.fields.map((/** @type {any} */ f) => f.id),
    'ticket field',
  );
  for (const f of ticket.fields) fail(fieldKinds.includes(f.kind), 'ticket field kind ' + f.kind);
  fail(
    ticket.fields.some(
      (/** @type {any} */ f) => !questions.get(ticket.question).correct.includes(f.option),
    ),
    'the card needs an optional field',
  );
  positive(ticket.startTolerance, 'ticket.startTolerance');
  const detection = rules.detection;
  positive(detection.monitoring, 'detection.monitoring');
  fail(detection.client > detection.monitoring, 'the client notices after monitoring');
  unique(
    detection.methods.map((/** @type {any} */ m) => m.id),
    'detection method',
  );
  fail(detection.methods.length > 1, 'detection methods');
  unique(
    rules.statuses.map((/** @type {any} */ s) => s.id),
    'status',
  );
  fail(
    rules.statuses.some((/** @type {any} */ s) => s.slaPaused),
    'a status pauses the SLA',
  );
  for (const flag of ['card', 'solved', 'slaStopped'])
    fail(
      rules.statuses.filter((/** @type {any} */ s) => s[flag]).length === 1,
      'one status is ' + flag,
    );
  fail(
    rules.optionalStatuses.every((/** @type {string} */ id) =>
      rules.statuses.some((/** @type {any} */ s) => s.id === id && !s.card && !s.solved),
    ),
    'optional statuses',
  );
  fail(!!roles[rules.coordinator.moderator], 'coordinator.moderator');
  positive(rules.escalation.fixPenalty, 'escalation.fixPenalty');
  share(rules.escalation.slaRisk, 'escalation.slaRisk');
  fail(rules.escalation.grace >= 0, 'escalation.grace');
  fail(
    Object.keys(rules.grading.weights).every((g) => gradeGroups.includes(g)),
    'grading weights name unknown groups',
  );
  positive(rules.journal.missPenalty, 'journal.missPenalty');
  positive(rules.warRoom.extraPenalty, 'warRoom.extraPenalty');

  // Messages.
  parts(rules.internal.parts, 'internal message');
  parts(rules.update.principles, 'update principles');

  // Metrics.
  unique(
    rules.metrics.map((/** @type {any} */ m) => m.id),
    'metric',
  );
  for (const m of rules.metrics) {
    fail(metricKinds.includes(m.kind) && !!m.name, 'metric ' + m.id);
    if (m.kind === 'units')
      fail(
        m.units.length > 0 &&
          m.units.every((/** @type {string} */ u) => units[u] && !units[u].boss),
        'metric ' + m.id + ' units',
      );
    fail(Number.isInteger(m.kills) && m.kills > 0, 'metric ' + m.id + '.kills');
    positive(m.withinSeconds, 'metric ' + m.id + '.withinSeconds');
    positive(m.weight, 'metric ' + m.id + '.weight');
    fail(m.series.length > 0 && m.reveals.length > 0, 'metric ' + m.id + ' shows nothing');
  }

  // Injects.
  unique(
    rules.injects.map((/** @type {any} */ i) => i.id),
    'inject',
  );
  for (const i of rules.injects) {
    fail(injectKinds.includes(i.kind), 'inject kind ' + i.kind);
    if (i.client) fail(clients.has(i.client), 'inject client ' + i.client);
    if (i.component) fail(components.has(i.component), 'inject component ' + i.component);
    if (i.role) fail(!!roles[i.role], 'inject role ' + i.role);
    if (i.fault) fail(!!rules.faults[i.fault], 'inject fault ' + i.fault);
    if (i.after != null) fail(Number.isFinite(i.after) && i.after >= 0, 'inject after ' + i.id);
    // The failure an inject asks for exists: a component, a cause, a mild form.
    // A parallel incident needs two components with no link between them.
    if (i.kind === 'second-fault')
      fail(
        i.after != null &&
          rules.components.some(
            (/** @type {any} */ c) => linked(c.id, rules).size < rules.components.length,
          ),
        'no room for a parallel incident ' + i.id,
      );
    const constrained = i.component || i.fault || i.client || i.workaround || i.mild;
    if (constrained) {
      fail(i.after != null, 'inject ' + i.id + ' asks for a failure but has no `after`');
      fail(
        rules.components.some(
          (/** @type {any} */ c) =>
            (!i.component || c.id === i.component) && (!i.client || c.clients.includes(i.client)),
        ),
        'no component fits inject ' + i.id,
      );
      fail(
        rules.causes.some(
          (/** @type {any} */ c) =>
            (!i.fault || c.faults.includes(i.fault)) && (!i.workaround || c.workaround),
        ),
        'no cause fits inject ' + i.id,
      );
      if (i.mild) fail(rules.faults[i.fault ?? '']?.mildShare != null, 'inject mild ' + i.id);
      fail(rules.faults[i.fault ?? '']?.kind !== 'flap', 'inject on a false alarm ' + i.id);
    }
    if (i.steps) steps(i.steps, 'inject ' + i.id);
    if (i.expects?.severity) fail(levels.includes(i.expects.severity), 'inject severity');
    if (i.expects?.status)
      fail(
        rules.statuses.some((/** @type {any} */ s) => s.id === i.expects.status),
        'inject status',
      );
  }

  // The review after the shift.
  for (const r of rules.review)
    fail(!!r.question || (!!r.text && (parts(r.parts, 'review ' + r.id), true)), 'review step');

  // Grading.
  for (const [key, w] of Object.entries(rules.grading.weights)) positive(w, 'weight ' + key);
  const grades = rules.grading.grades;
  fail(grades.at(-1).min === 0, 'the last grade starts at 0');
  for (const i of grades.keys()) if (i) fail(grades[i].min < grades[i - 1].min, 'grade order');
  return true;
}

/**
 * Throws when a shift map does not fit the rules: a room and a panel for every component and
 * nothing else, panels inside their rooms and clear of walls, the receiver's lamp clear, a pipe
 * lane for every feed.
 * @param {any} map a map whose objective is `escalation`
 * @param {any} rules
 */
export function validateShiftMap(map, rules) {
  const fail = (/** @type {boolean} */ ok, /** @type {string} */ message) => {
    if (!ok) throw new Error('Shift map ' + map.name + ': ' + message);
  };
  const shift = map.shift;
  fail(!!shift, 'no shift floor');
  const ids = rules.components.map((/** @type {any} */ c) => c.id);
  fail(
    Object.keys(shift.rooms).sort().join() === [...ids].sort().join(),
    'a room for every component',
  );
  const inWall = (/** @type {{ x: number, y: number }} */ p) =>
    map.racks.some(
      (/** @type {number[]} */ [x, y, w, h]) =>
        p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h,
    );
  for (const id of ids) {
    const { box, panel } = shift.rooms[id];
    const [x, y, w, h] = box;
    fail(panel.x > x && panel.x < x + w && panel.y > y && panel.y < y + h, id + ' panel outside');
    fail(!inWall(panel), id + ' panel in a wall');
  }
  fail(!inWall(shift.lamp), 'lamp in a wall');
  fail(shift.lanes.length >= rules.feeds.length, 'a pipe lane for every feed');
}
