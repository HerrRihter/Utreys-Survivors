import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules } from '../data/incident-rules.js';
import { mapDefinitions } from '../data/maps/maps.js';
import { newIncidentState, validIncident } from '../src/systems/escalation.js';
import { endFault, planShift, updateShift } from '../src/systems/production-line.js';
import {
  badShare,
  isNight,
  receiverDown,
  rootFault,
  shiftClock,
  shiftMinute,
} from '../src/systems/queries/incident.js';
import { createHarness } from './helpers/game-harness.js';

const rules = incidentRules;
const ids = rules.components.map((c) => c.id);
const STEP = 1 / 30; // a game step of 1/60 s at 2 s a minute is 1/120; this is close enough

// A shift with the given failures and nothing else, run minute by minute; `at[m]` is called
// before the line reaches minute m.
function run(plan, minutes, at = {}) {
  const inc = newIncidentState();
  inc.plan = plan.map((f) => ({
    cause: 'release',
    mild: false,
    from: null,
    startedAt: null,
    endedAt: null,
    ...f,
  }));
  const bad = [];
  for (let k = 0; k * STEP <= minutes + 1e-9; k++) {
    const m = k * STEP;
    at[Math.round(m * 1e6) / 1e6]?.(inc, m);
    updateShift(inc, m);
    if (Number.isInteger(Math.round(m * 1e6) / 1e6))
      bad[Math.round(m)] = Object.fromEntries(ids.map((id) => [id, badShare(inc, id, m)]));
  }
  return { inc, bad };
}
const cascades = (inc) => inc.plan.filter((f) => f.from != null);
const feeds = (to) => rules.feeds.filter((f) => f.to === to).map((f) => f.from);

test('a healthy line keeps working and samples every minute', () => {
  const { inc, bad } = run([], 120);
  for (const row of bad) for (const id of ids) assert.equal(row[id], 0, id);
  for (const id of ids) assert(inc.components[id].done > 10, id + ' finishes work');
  assert.equal(inc.impact, 0);
  assert.equal(inc.history.length, 121);
  assert.deepEqual(
    inc.history.map((h) => h.minute),
    inc.history.map((_, i) => i),
  );
  assert.equal(inc.plan.length, 0, 'nothing fails by itself');
});

test('a failure spreads downstream along the feeds with the rule delays', () => {
  const { inc, bad } = run([{ at: 10, component: ids[0], fault: 'error' }], 120);
  const spread = cascades(inc);
  // Every component downstream of the import was reached, each once.
  assert.deepEqual(spread.map((f) => f.component).sort(), ids.slice(1).sort());
  for (const f of spread) {
    const source = inc.plan[f.from];
    assert(feeds(f.component).includes(source.component), f.component + ' fed by its source');
    assert.equal(rootFault(inc, inc.plan.indexOf(f)), 0, 'traced back to the import');
    // Starved `after` + `delay` minutes after the source went bad.
    assert(f.at - source.startedAt >= rules.cascade.after + rules.cascade.delay - 1e-9);
    // A stall first, a failure after `errorAfter` minutes.
    assert.equal(f.fault, rules.cascade.fail);
    assert.equal(f.cause, null);
  }
  // In order: the source fails before what it feeds.
  const at = (id) => spread.find((f) => f.component === id)?.at ?? 0;
  for (const feed of rules.feeds) if (feed.from !== ids[0]) assert(at(feed.to) > at(feed.from));
  assert(bad[15][ids[0]] >= rules.cascade.share, 'the import is bad');
  assert.equal(bad[15][ids.at(-1)], 0, 'the end of the line is still fine');
  assert(inc.impact > 0.5, 'most of the line is hit');
  assert(receiverDown(inc, 120), 'the receiver gets nothing');
});

test('repairing the root failure ends the cascade and the line recovers', () => {
  const { inc, bad } = run([{ at: 10, component: ids[0], fault: 'error' }], 100, {
    70: (inc, m) => endFault(inc, 0, m),
  });
  assert(cascades(inc).every((f) => f.endedAt != null && f.endedAt <= 71));
  assert(inc.plan.every((f) => f.endedAt != null));
  for (const id of ids) {
    assert.equal(bad[80][id], 0, id + ' recovered');
    assert.deepEqual(inc.components[id].faults, []);
  }
  assert.equal(inc.impact, 0);
  // No new cascade after the repair.
  const count = inc.plan.length;
  updateShift(inc, 101);
  assert.equal(inc.plan.length, count);
});

test('a stalled queue fills up and its operations stay grey', () => {
  const { inc } = run([{ at: 10, component: 'artemis', fault: 'stall' }], 60);
  const artemis = inc.components.artemis;
  assert(artemis.ops.filter((op) => op.status === 'busy').length >= 8);
  assert(
    artemis.ops.every((op) => op.status !== 'error'),
    'a stall turns nothing red',
  );
  // The Pepsi trigger's threshold is reached within the shift's first hour.
  const trigger = rules.clientTriggers.find((t) => t.kind === 'queue');
  const reached = inc.history.find((h) => h.components.artemis.queue >= trigger.min);
  assert(reached && reached.minute < 60, 'the queue reaches ' + trigger.min);
  // The history is monotone while nothing drains.
  const queue = inc.history.slice(20).map((h) => h.components.artemis.queue);
  assert(queue.every((q, i) => !i || q >= queue[i - 1]));
});

test('a false alarm passes by itself and spreads nowhere', () => {
  const minutes = rules.faults.flap.minutes;
  const { inc, bad } = run(
    [{ at: 10, component: 'goods-reports', fault: 'flap', cause: null }],
    60,
  );
  assert.equal(inc.plan[0].endedAt, 10 + minutes);
  assert.equal(cascades(inc).length, 0);
  assert(bad.every((row) => row['goods-reports'] < rules.cascade.share));
  assert.equal(bad[30]['goods-reports'], 0);
});

test('a mild failure stays below the cascade and the impact', () => {
  const { inc, bad } = run(
    [{ at: 10, component: 'code-usage-report', fault: 'error', mild: true }],
    90,
  );
  assert(bad[60]['code-usage-report'] > 0, 'some operations fail');
  assert(bad.every((row) => row['code-usage-report'] < rules.cascade.share));
  assert.equal(cascades(inc).length, 0);
  assert.equal(inc.impact, 0);
});

test('a rebooting component restarts on schedule', () => {
  const { every, down } = rules.faults.reboot;
  const { inc } = run([{ at: 10, component: 'artemis', fault: 'reboot' }], 10 + 2 * every + 1);
  assert.deepEqual(inc.components.artemis.reboots, [10, 10 + every, 10 + 2 * every]);
  // While down all its operations start over.
  const mid = run([{ at: 10, component: 'artemis', fault: 'reboot' }], 10 + down / 2).inc;
  assert(mid.components.artemis.ops.every((op) => op.status === 'busy' && op.since >= 10));
});

test('the clock and the night of the shift', () => {
  const inc = newIncidentState();
  inc.day = 6;
  assert.deepEqual(shiftClock(inc, 0), { day: 'Воскресенье', time: '22:00' });
  // After midnight the day moves on.
  assert.deepEqual(shiftClock(inc, 135), { day: 'Понедельник', time: '00:15' });
  assert(isNight(0) && isNight(rules.clock.minutes - 1));
  assert(!isNight(10 * 60 + 1), 'noon is not night');
  assert.equal(shiftMinute({ t: 10 }), 10 / rules.clock.minuteSeconds);
});

test('the shift plan comes from the seed and fits its injects', () => {
  const plan = (seed, seen) => planShift(newIncidentState(), seed, seen);
  assert.deepEqual(plan(7), plan(7), 'the same seed, the same shift');
  assert.notDeepEqual(plan(7).plan, plan(8).plan);
  const linked = (a, b) => {
    const down = (from, to, seen = new Set()) =>
      from === to ||
      rules.feeds.some((f) => f.from === from && !seen.has(f.to) && down(f.to, to, seen.add(f.to)));
    return down(a, b) || down(b, a);
  };
  mapDefinitions['shift-test'] = { name: 'Смена', objective: { type: 'escalation' } };
  try {
    for (let seed = 1; seed <= 300; seed++) {
      const inc = plan(seed);
      assert(validIncident(inc, 'shift-test'), 'seed ' + seed);
      const real = inc.plan.filter((f) => f.cause != null);
      assert(real.length >= rules.shift.faults[0]);
      assert(inc.plan.every((f) => f.at >= 0 && f.at < rules.clock.minutes));
      assert.deepEqual(
        inc.plan.map((f) => f.at),
        inc.plan.map((f) => f.at).sort((a, b) => a - b),
      );
      // Monitoring and the client report every real failure, in that order.
      assert.equal(inc.alerts.length, real.length);
      for (const a of inc.alerts) assert(a.clientAt > a.monitoringAt);
      assert(inc.injects.length >= rules.shift.injects[0]);
      for (const i of inc.injects) {
        const spec = rules.injects.find((x) => x.id === i.id);
        if (spec.weekend) assert(rules.clock.days[inc.day].weekend, 'weekend for ' + i.id);
        if (spec.after == null) {
          assert.equal(i.fault, null);
          assert.equal(i.at, 0);
          continue;
        }
        const f = inc.plan[i.fault];
        assert.equal(i.at, f.at + spec.after);
        assert(f.cause != null, i.id + ' bound to a real failure');
        if (spec.component) assert.equal(f.component, spec.component);
        if (spec.fault) assert.equal(f.fault, spec.fault);
        if (spec.client)
          assert(rules.components.find((c) => c.id === f.component).clients.includes(spec.client));
        if (spec.workaround) assert(rules.causes.find((c) => c.id === f.cause).workaround);
        // A mild failure is only for the inject that asks for it.
        assert.equal(f.mild, !!spec.mild);
        if (spec.kind === 'second-fault')
          assert(
            inc.plan.some(
              (g) => g.at === f.at + spec.after && g.cause && !linked(g.component, f.component),
            ),
            'a parallel failure for seed ' + seed,
          );
      }
    }
  } finally {
    delete mapDefinitions['shift-test'];
  }
  // Injects the player has not met come first.
  const all = rules.injects.map((i) => i.id);
  for (let seed = 1; seed <= 50; seed++) {
    const unseen = all.slice(seed % all.length, (seed % all.length) + 2);
    const seen = all.filter((id) => !unseen.includes(id));
    const chosen = plan(seed, seen).injects.map((i) => i.id);
    for (const id of unseen) assert(chosen.includes(id), id + ' unseen, seed ' + seed);
  }
});

test('the simulation runs the line only on a run with a shift', async () => {
  const h = await createHarness();
  const game = h.session;
  game.views.run().nextSeed = 42;
  game.start();
  assert.equal(game.state.incident, null);
  for (let i = 0; i < 60; i++) game.update(1 / 60);
  // A run with a shift (borrowed: no map has one yet) moves its line with the run's time.
  game.state.incident = planShift(newIncidentState(), 1);
  for (let i = 0; i < 600; i++) game.update(1 / 60);
  const minute = shiftMinute(game.state);
  assert(minute > 5);
  assert.equal(game.state.incident.history.length, Math.floor(minute) + 1);
  assert(Object.values(game.state.incident.components).some((c) => c.done > 0));
  // The line itself draws nothing from the run's random source: compare with a run without it.
  const h2 = await createHarness();
  h2.session.views.run().nextSeed = 42;
  h2.session.start();
  for (let i = 0; i < 660; i++) h2.session.update(1 / 60);
  assert.equal(h2.session.state.rng.getState(), game.state.rng.getState());
});
