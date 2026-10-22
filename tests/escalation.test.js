import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules as rules } from '../data/incident-rules.js';
import {
  answerInject,
  answerReview,
  answerTicketQuestion,
  applyWorkaround,
  askSeverity,
  callRole,
  createTicket,
  moveStatus,
  newIncidentState,
  openTicket,
  recordJournal,
  requiredFields,
  reviewQuestions,
  sendInternal,
  sendUpdate,
  setCardField,
  ticketById,
  ticketQuestions,
  updateEscalation,
} from '../src/systems/escalation.js';
import { gradeShift } from '../src/systems/incident-grading.js';
import { planShift, updateShift } from '../src/systems/production-line.js';
import {
  clientsOf,
  courseQuestion,
  impactDown,
  progressBetween,
  realRootsOn,
  trueCard,
  trueSeverity,
} from '../src/systems/queries/incident.js';

const key = (id) => courseQuestion(id).correct;
const wrong = (id) =>
  courseQuestion(id)
    .options.map((o) => o.id)
    .filter((o) => !key(id).includes(o));
const right = (parts) => parts.filter((p) => p.right).map((p) => p.id);
const STEP = 0.25;

// A shift with the given failures (and injects), nothing planned besides.
function shift(plan, injects = []) {
  const inc = newIncidentState();
  inc.plan = plan.map((f) => ({
    cause: 'release',
    mild: false,
    from: null,
    startedAt: null,
    endedAt: null,
    ...f,
  }));
  inc.injects = injects.map((i) => ({ firedAt: null, ...i }));
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
// Runs the line and the escalation from `from` to `to`, calling `each(m)` before each step.
function advance(inc, from, to, each = () => {}) {
  for (let m = from; m <= to + 1e-9; m += STEP) {
    each(m);
    updateShift(inc, m);
    updateEscalation(inc, m);
  }
}

// A model player who knows the rules: opens a ticket as soon as a failure starts and does
// everything the course asks, from the truth the grade uses. `careless` does it wrong.
function player(inc, { careless = false, random = () => 0.99 } = {}) {
  const state = new Map(); // ticket id -> { nextUpdate, retryAt }
  const update = (t, m) => {
    const prev = t.updates.at(-1)?.at ?? t.openedAt;
    const clients = clientsOf(inc, t.target);
    sendUpdate(
      inc,
      t.id,
      careless
        ? { required: wrong(rules.update.parts.question), principles: ['tech'] }
        : {
            required: key(rules.update.parts.question),
            principles: right(rules.update.principles),
            wording: key(rules.update.wording.question)[0],
            sender: key(rules.update.sender.question)[0],
            noProgress:
              t.updates.length && !progressBetween(t, prev, m)
                ? key(rules.update.noProgress.question)[0]
                : null,
            workaround: t.workaroundAt != null ? key(rules.update.workaround.question) : null,
            client: rules.clientUpdates.some((u) => clients.includes(u.client))
              ? key(rules.clientUpdates[0].parts.question)[0]
              : null,
          },
      m,
    );
    const level = rules.severity.levels.find((l) => l.id === t.card.severity);
    state.get(t.id).nextUpdate = m + (level?.update ?? 30);
  };
  const call = (t, role, m) => {
    const c = callRole(inc, t.id, role, m, random);
    if (!c.answered) state.get(t.id).missed = { role, at: m, tries: 1 };
  };
  return (m) => {
    // Open a ticket where a real failure starts (a careless one waits for the client).
    for (const c of rules.components)
      for (const root of realRootsOn(inc, c.id)) {
        if (inc.tickets.some((t) => t.target === root)) continue;
        if (careless && m < inc.plan[root].at + rules.detection.client + 1) continue;
        const id = openTicket(inc, inc.plan[root].component, m);
        const t = ticketById(inc, id);
        state.set(id, { nextUpdate: Infinity });
        if (careless) {
          update(t, m);
          createTicket(inc, id, wrong(rules.protocol.creation.question)[0], m);
          setCardField(inc, id, 'coordinator', 'dev', m);
          askSeverity(
            inc,
            id,
            rules.severity.questions.map((q) => q.id),
            m,
          );
          setCardField(inc, id, 'severity', 'minor', m);
          call(t, 'cto', m);
          continue;
        }
        sendInternal(inc, id, right(rules.internal.parts), true, m);
        createTicket(inc, id, key(rules.protocol.creation.question)[0], m);
        const truth = trueCard(inc, t);
        for (const field of [...requiredFields(), 'component', 'cause'])
          setCardField(inc, id, field, truth[field], m);
        askSeverity(inc, id, right(rules.severity.questions), m);
        setCardField(inc, id, 'severity', trueSeverity(inc, t, m), m);
        update(t, m);
        moveStatus(inc, id, rules.statuses.find((s) => s.card).id, m);
        answerTicketQuestion(inc, id, 'matrix.2', key(ticketQuestions()['matrix.2']), m);
        const first = rules.clientEscalation.find((e) => clientsOf(inc, root).includes(e.client));
        if (first) call(t, first.first, m);
        const fixer = rules.causes.find((x) => x.id === inc.plan[root].cause).fixer;
        call(t, fixer, m);
        // A parallel incident: the moderator comes.
        if (inc.tickets.filter((x) => x.target != null && !impactDown(inc, x)).length > 1)
          call(t, rules.coordinator.moderator, m);
      }
    if (careless) return;
    for (const t of inc.tickets) {
      if (t.target == null) continue;
      const st = state.get(t.id);
      // An unanswered call: try again within the interval, then the manager, then again.
      if (st.missed) {
        const { role, at, tries } = st.missed;
        const manager = rules.roles[role].manager;
        if (m >= at + 6) {
          if (tries < rules.calls.attempts) {
            const c = callRole(inc, t.id, role, m, random);
            st.missed = c.answered ? null : { role, at: m, tries: tries + 1 };
          } else {
            callRole(inc, t.id, manager, m, random);
            callRole(inc, t.id, role, m, random);
            st.missed = null;
          }
        }
      }
      if (t.levelDue[3] != null && t.levels[3] == null) {
        callRole(inc, t.id, rules.matrix[2].roles[0], m, random);
        setCardField(inc, t.id, 'severity', trueSeverity(inc, t, m), m);
        answerTicketQuestion(inc, t.id, 'matrix.3', key(ticketQuestions()['matrix.3']), m);
      }
      if (t.levelDue[4] != null && t.levels[4] == null) {
        callRole(inc, t.id, rules.matrix[3].roles[0], m, random);
        answerTicketQuestion(inc, t.id, 'matrix.4', key(ticketQuestions()['matrix.4']), m);
      }
      if (t.workaroundKnown && t.workaroundAt == null && applyWorkaround(inc, t.id, m)) {
        const monitoring = rules.statuses.find((s) => s.slaPaused).id;
        moveStatus(inc, t.id, monitoring, m);
        update(t, m);
        answerTicketQuestion(
          inc,
          t.id,
          'status.' + monitoring,
          key(ticketQuestions()['status.' + monitoring]),
          m,
        );
      }
      const solved = rules.statuses.find((s) => s.solved).id;
      if (impactDown(inc, t) && t.statusAt[solved] == null && moveStatus(inc, t.id, solved, m).ok) {
        answerTicketQuestion(
          inc,
          t.id,
          'status.' + solved,
          key(ticketQuestions()['status.' + solved]),
          m,
        );
        const pm = rules.statuses.find((s) => s.slaStopped).id;
        moveStatus(inc, t.id, pm, m);
        answerTicketQuestion(inc, t.id, 'status.' + pm, key(ticketQuestions()['status.' + pm]), m);
      }
      if (t.statusAt[solved] == null && m >= st.nextUpdate) update(t, m);
    }
    for (const item of inc.inbox) {
      if (item.answeredAt != null) continue;
      const spec = rules.injects.find((i) => i.id === item.inject);
      answerInject(
        inc,
        item.inject,
        spec.steps ? spec.steps.map((_, i) => i) : spec.choice ? key(spec.choice.question) : true,
        m,
      );
    }
  };
}
// The end of a shift: the journal recorded and the review answered (by a model player).
function finish(inc, careless) {
  if (!careless) inc.journal.forEach((_, i) => recordJournal(inc, i));
  for (const [k, step] of Object.entries(reviewQuestions()))
    answerReview(
      inc,
      k,
      careless
        ? step.parts
          ? step.parts.filter((p) => !p.right).map((p) => p.id)
          : wrong(step.question).slice(0, 1)
        : step.parts
          ? right(step.parts)
          : key(step.question),
    );
}
function playShift(seed, options = {}) {
  const inc = planShift(newIncidentState(), seed);
  advance(inc, 0, rules.clock.minutes, player(inc, options));
  finish(inc, options.careless);
  return { inc, grade: gradeShift(inc, rules.clock.minutes) };
}

test('a model player gets a top grade, a careless one fails, the same play grades the same', () => {
  for (let seed = 1; seed <= 12; seed++) {
    const good = playShift(seed);
    assert(
      good.grade.share >= 0.9,
      `seed ${seed}: ${good.grade.share.toFixed(2)} ` +
        JSON.stringify(good.grade.mistakes.map((m) => [m.group, m.note, m.score])),
    );
    assert.equal(good.grade.grade, 'Отлично');
    const bad = playShift(seed, { careless: true, random: () => 0 });
    assert(bad.grade.share < 0.6, `seed ${seed} careless: ${bad.grade.share.toFixed(2)}`);
    assert.equal(bad.grade.grade, 'Не сдано');
    assert.deepEqual(playShift(seed).grade, good.grade);
  }
});

test('over a few shifts the grade reaches every question of the course', () => {
  const reached = new Set();
  for (let seed = 1; seed <= 40; seed++)
    for (const careless of [false, true])
      for (const item of playShift(seed, { careless, random: careless ? () => 0 : () => 0.99 })
        .grade.items)
        if (item.question) reached.add(item.question);
  const course = courseQuestion('incident-1') && rules.course;
  assert(course);
  const missing = Array.from({ length: 40 }, (_, i) => 'incident-' + (i + 1)).filter(
    (id) => !reached.has(id),
  );
  assert.deepEqual(missing, []);
});

test('the ticket follows the root failure; a healthy component is a false escalation', () => {
  const inc = shift([{ at: 5, component: 'inport-operation-processor', fault: 'error' }]);
  advance(inc, 0, 40);
  // The cascade reached Artemis: a ticket opened there is about the import's failure.
  assert(realRootsOn(inc, 'artemis').includes(0));
  const id = openTicket(inc, 'artemis', 40);
  assert.equal(ticketById(inc, id).target, 0);
  assert.equal(openTicket(inc, 'inport-operation-processor', 41), id, 'no second ticket');
  // The card's component is the source, not where the player looked.
  assert.equal(trueCard(inc, ticketById(inc, id)).component, 'inport-operation-processor');
  const healthy = shift([]);
  advance(healthy, 0, 10);
  const other = openTicket(healthy, 'goods-reports', 10);
  assert.equal(ticketById(healthy, other).target, null);
  const grade = gradeShift(healthy, 10);
  assert(grade.mistakes.some((m) => m.question === 'incident-1' && m.group === 'detection'));
});

test('the card gates the work status and wrong fields slow the repair', () => {
  const inc = shift([{ at: 5, component: 'goods-reports', fault: 'error', cause: 'release' }]);
  advance(inc, 0, 6);
  const id = openTicket(inc, 'goods-reports', 6);
  const t = ticketById(inc, id);
  assert.deepEqual(moveStatus(inc, id, 'work', 6), { ok: false, missing: [], reason: 'order' });
  assert(createTicket(inc, id, key(rules.protocol.creation.question)[0], 6));
  assert(!createTicket(inc, id, key(rules.protocol.creation.question)[0], 6), 'only once');
  const refused = moveStatus(inc, id, 'work', 6);
  assert.equal(refused.reason, 'card');
  assert.deepEqual(refused.missing, requiredFields());
  assert.deepEqual(t.refused, [requiredFields()]);
  // The optional field (incident-12's wrong option) is not required.
  assert(!requiredFields().includes('eta'));
  assert(!setCardField(inc, id, 'coordinator', 'nobody', 6), 'unknown role');
  assert(!setCardField(inc, id, 'times', { start: 'x' }, 6));
  const truth = trueCard(inc, t);
  for (const field of requiredFields()) assert(setCardField(inc, id, field, truth[field], 6));
  // The wrong component on the card: the developer repairs it more slowly.
  setCardField(inc, id, 'component', 'artemis', 6);
  setCardField(inc, id, 'cause', 'release', 6);
  assert(moveStatus(inc, id, 'work', 6).ok);
  assert.equal(moveStatus(inc, id, 'solved', 6).reason, 'impact', 'not while the impact lasts');
  const c = callRole(inc, id, 'dev', 6, () => 0.99);
  advance(inc, 6, 120);
  const cause = rules.causes.find((x) => x.id === 'release');
  assert.equal(c.workUntil, c.arriveAt + cause.fix * rules.escalation.fixPenalty);
  assert.equal(t.fixedAt, c.workUntil);
  assert(inc.plan[0].endedAt != null);
  assert(moveStatus(inc, id, 'solved', 120).ok);
  const grade = gradeShift(inc, 120);
  assert(grade.mistakes.some((m) => m.note === 'Исходный компонент'));
  assert(grade.mistakes.some((m) => m.question === 'incident-12' && m.group === 'card'));
});

test('an unanswered duty role: two tries in the interval, then the manager', () => {
  const run = (script) => {
    const inc = shift(
      [{ at: 5, component: 'artemis', fault: 'stall', cause: 'consumer' }],
      [{ id: 'no-answer', at: 5, fault: 0 }],
    );
    advance(inc, 0, 6);
    const id = openTicket(inc, 'artemis', 6);
    script(inc, id);
    return gradeShift(inc, 30).items.find((i) => i.question === 'incident-19');
  };
  const proper = run((inc, id) => {
    assert(!callRole(inc, id, 'devops', 6, () => 0.99).answered, 'blocked by the inject');
    assert(!callRole(inc, id, 'devops', 12, () => 0.99).answered);
    assert(callRole(inc, id, 'techlead', 13, () => 0.99).answered);
    assert(callRole(inc, id, 'devops', 14, () => 0.99).answered, 'reached after the manager');
  });
  assert.equal(proper.score, 1);
  const hasty = run((inc, id) => {
    callRole(inc, id, 'devops', 6, () => 0.99);
    callRole(inc, id, 'techlead', 7, () => 0.99);
  });
  assert.equal(hasty.score, 0);
});

test('injects: the senior away, a workaround found, a client top manager', () => {
  const inc = shift(
    [{ at: 10, component: 'code-usage-report', fault: 'error', cause: 'format' }],
    [
      { id: 'senior-away', at: 0, fault: null },
      { id: 'workaround-found', at: 20, fault: 0 },
      { id: 'client-top', at: 25, fault: 0 },
    ],
  );
  advance(inc, 0, 11);
  assert(inc.coordinatorAway);
  const id = openTicket(inc, 'code-usage-report', 11);
  const t = ticketById(inc, id);
  assert.equal(trueCard(inc, t).coordinator, rules.coordinator.standIn);
  assert(!applyWorkaround(inc, id, 11), 'not known yet');
  advance(inc, 11.25, 26);
  assert(t.workaroundKnown);
  assert(t.levelDue[4] != null, 'the client top manager makes level 4 due');
  assert(applyWorkaround(inc, id, 26));
  assert(inc.plan[0].endedAt != null && impactDown(inc, t));
  assert.equal(inc.inbox.length, 3);
  assert(answerInject(inc, 'client-top', [0, 1, 2, 3], 26));
  assert(!answerInject(inc, 'client-top', [3, 2, 1, 0], 27), 'answered once');
});

test('stale and unknown commands change nothing', () => {
  const inc = shift([{ at: 5, component: 'goods-reports', fault: 'error' }]);
  advance(inc, 0, 6);
  const id = openTicket(inc, 'goods-reports', 6);
  assert.equal(openTicket(inc, 'nowhere', 6), null);
  assert(!createTicket(inc, 99, 'answer-1', 6));
  assert(!createTicket(inc, id, 'answer-9', 6));
  assert(!answerTicketQuestion(inc, id, 'matrix.9', ['answer-1'], 6));
  assert(answerTicketQuestion(inc, id, 'matrix.2', ['answer-2'], 6));
  assert(!answerTicketQuestion(inc, id, 'matrix.2', key(ticketQuestions()['matrix.2']), 7));
  assert(!sendInternal(inc, id, ['gossip'], true, 6));
  assert(sendInternal(inc, id, ['symptom'], false, 6));
  assert(!sendInternal(inc, id, ['symptom'], true, 7), 'one internal message');
  assert(!askSeverity(inc, id, ['astrology'], 6));
  assert(!answerReview(inc, 'unknown', ['x']));
  assert(answerReview(inc, 'incident-39', ['answer-1']));
  assert(!answerReview(inc, 'incident-39', ['answer-2']));
  assert(!recordJournal(inc, 999));
  assert(recordJournal(inc, 0));
  assert(!recordJournal(inc, 0));
});
