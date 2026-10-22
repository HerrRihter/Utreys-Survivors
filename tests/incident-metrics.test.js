import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules as rules } from '../data/incident-rules.js';
import { unitDefinitions } from '../data/enemies/units.js';
import {
  applyWorkaround,
  countKill,
  newIncidentState,
  openTicket,
  orderMetric,
  ticketById,
  updateEscalation,
} from '../src/systems/escalation.js';
import { planShift, updateShift } from '../src/systems/production-line.js';
import {
  clientsOf,
  metricBoost,
  metricPending,
  metricSeries,
  metricUnits,
  metricWindow,
  shiftMinute,
} from '../src/systems/queries/incident.js';
import { selectWaveUnit } from '../src/systems/wave-schedule.js';
import { unitArt } from '../src/rendering/art/enemy-art.js';
import { createHarness } from './helpers/game-harness.js';

const metric = (id) => rules.metrics.find((m) => m.id === id);
const grafana = metric('grafana');
const logs = metric('logs');
const clientsMetric = metric('clients');

// A shift with one failure, run to `minute`.
function shift(fault, minute) {
  const inc = newIncidentState();
  inc.plan = [{ mild: false, from: null, startedAt: null, endedAt: null, ...fault }];
  for (let m = 0; m <= minute + 1e-9; m += 0.25) {
    updateShift(inc, m);
    updateEscalation(inc, m);
  }
  return inc;
}

test('an ordered metric opens after enough kills of its kind and shows the past', () => {
  const inc = shift({ at: 5, component: 'artemis', fault: 'stall', cause: 'consumer' }, 30);
  assert(!countKill(inc, grafana.units[0], 30), 'nothing ordered, nothing counted');
  assert.equal(inc.metrics.grafana.kills, 0);
  assert(orderMetric(inc, 'grafana', null, 30));
  assert(!orderMetric(inc, 'grafana', null, 30), 'already ordered');
  assert(metricPending(inc, 'grafana'));
  countKill(inc, 'l3', 30.1);
  assert.equal(inc.metrics.grafana.kills, 0, 'another kind does not count');
  for (let i = 0; i < grafana.kills - 1; i++) countKill(inc, grafana.units[0], 30.2);
  assert.equal(metricSeries(inc, 'grafana'), null, 'not open yet');
  countKill(inc, grafana.units[0], 31);
  assert.equal(inc.metrics.grafana.openedAt, 31);
  assert(!metricPending(inc, 'grafana'));
  const shown = metricSeries(inc, 'grafana');
  // Every minute sampled so far (the line ran to minute 30), up to the opening.
  assert.deepEqual(
    shown.minutes,
    Array.from({ length: 31 }, (_, i) => i),
  );
  for (const name of grafana.series)
    assert.deepEqual(
      Object.keys(shown.series[name]),
      rules.components.map((c) => c.id),
    );
  // The stall shows on Artemis: its queue grows, its stalled operations pile up.
  const queue = shown.series.queue.artemis;
  assert(queue.at(-1) > queue[5]);
  assert(shown.series.stalled.artemis.at(-1) > 0);
  assert.equal(shown.series.stalled['goods-reports'][10], 0);
  // A later picture: the old one shows until the new order opens.
  for (let m = 31; m <= 50; m += 0.25) updateShift(inc, m);
  assert(orderMetric(inc, 'grafana', null, 50));
  assert.equal(metricSeries(inc, 'grafana').openedAt, 31);
  for (let i = 0; i < grafana.kills; i++) countKill(inc, grafana.units[0], 50.5);
  assert.equal(metricSeries(inc, 'grafana').minutes.at(-1), 50);
});

test('an order runs out after its window and its kills are lost', () => {
  const inc = shift({ at: 5, component: 'goods-reports', fault: 'error', cause: 'release' }, 6);
  const window = metricWindow(grafana);
  assert.equal(window, grafana.withinSeconds / rules.clock.minuteSeconds);
  orderMetric(inc, 'grafana', null, 6);
  for (let i = 0; i < grafana.kills - 1; i++) countKill(inc, grafana.units[0], 6 + window / 2);
  updateEscalation(inc, 6 + window + 0.1);
  assert.equal(inc.metrics.grafana.orderedAt, null);
  assert.equal(inc.metrics.grafana.kills, 0);
  countKill(inc, grafana.units[0], 6 + window + 0.2);
  assert.equal(inc.metrics.grafana.openedAt, null, 'a late kill opens nothing');
});

test('the client metric counts the clients of its ticket and shows their components', () => {
  const inc = shift(
    { at: 5, component: 'code-usage-report', fault: 'error', cause: 'release' },
    20,
  );
  assert(!orderMetric(inc, 'clients', null, 20), 'needs a ticket');
  const id = openTicket(inc, 'code-usage-report', 20);
  assert(orderMetric(inc, 'clients', id, 20));
  const clients = clientsOf(inc, ticketById(inc, id).target);
  assert.deepEqual(metricUnits(inc, 'clients'), clients);
  const outsider = rules.components.flatMap((c) => c.clients).find((c) => !clients.includes(c));
  countKill(inc, outsider, 20.5);
  assert.equal(inc.metrics.clients.kills, 0);
  for (let i = 0; i < clientsMetric.kills; i++) countKill(inc, clients[i % clients.length], 21);
  const shown = metricSeries(inc, 'clients');
  assert.deepEqual(shown.clients, clients);
  const covered = rules.components.filter((c) => c.clients.some((x) => clients.includes(x)));
  assert.deepEqual(
    Object.keys(shown.series.queue),
    covered.map((c) => c.id),
  );
});

test('the logs make the workaround of the cause known', () => {
  const inc = shift({ at: 5, component: 'artemis', fault: 'stall', cause: 'consumer' }, 15);
  const id = openTicket(inc, 'artemis', 15);
  assert(!applyWorkaround(inc, id, 15), 'not known yet');
  orderMetric(inc, 'logs', id, 15);
  for (let i = 0; i < logs.kills; i++) countKill(inc, logs.units[0], 16);
  assert(ticketById(inc, id).workaroundKnown);
  assert(applyWorkaround(inc, id, 16));
  // A cause without a workaround stays without one.
  const other = shift({ at: 5, component: 'artemis', fault: 'stall', cause: 'db-lock' }, 15);
  const t = openTicket(other, 'artemis', 15);
  orderMetric(other, 'logs', t, 15);
  for (let i = 0; i < logs.kills; i++) countKill(other, logs.units[0], 16);
  assert(other.metrics.logs.openedAt != null);
  assert(!ticketById(other, t).workaroundKnown);
});

test('an ordered metric brings its enemies more often; nothing ordered changes nothing', () => {
  const schedule = {
    normal: {
      stages: [
        {
          time: 0,
          weights: [
            ['l3', 9],
            [grafana.units[0], 1],
          ],
        },
      ],
    },
  };
  const rolls = Array.from({ length: 1000 }, (_, i) => (i + 0.5) / 1000);
  const share = (boost) =>
    rolls.filter((r) => selectWaveUnit(schedule, 0, r, null, null, boost) === grafana.units[0])
      .length / rolls.length;
  const inc = newIncidentState();
  assert.equal(metricBoost(inc), null);
  assert.equal(metricBoost(null), null);
  for (const r of rolls)
    assert.equal(
      selectWaveUnit(schedule, 0, r, null, null, metricBoost(inc)),
      selectWaveUnit(schedule, 0, r),
    );
  orderMetric(inc, 'grafana', null, 0);
  const boost = metricBoost(inc);
  assert.deepEqual(boost, { [grafana.units[0]]: grafana.weight });
  assert(Math.abs(share(null) - 0.1) < 0.01);
  assert(Math.abs(share(boost) - grafana.weight / (9 + grafana.weight)) < 0.01);
});

test('a kill in a run counts for the ordered metric', async () => {
  const h = await createHarness();
  const game = h.session;
  game.start();
  // A run with a shift (borrowed: no map has one yet).
  const inc = planShift(newIncidentState(), 3);
  game.state.incident = inc;
  orderMetric(inc, 'grafana', null, shiftMinute(game.state));
  const p = game.state.p;
  for (let i = 0; i < grafana.kills; i++) {
    const e = game.spawn(grafana.units[0], false, { x: p.x + 200, y: p.y });
    game.damage(e, e.hp + 1);
  }
  assert.equal(inc.metrics.grafana.kills, grafana.kills);
  assert(inc.metrics.grafana.openedAt != null);
});

test('the monitoring foes have their own art', () => {
  for (const id of [...grafana.units, ...logs.units]) {
    assert(unitArt[id], id);
    assert.equal(unitDefinitions[id].onlyIn, 'escalation');
  }
});
