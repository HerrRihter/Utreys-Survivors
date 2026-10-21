import assert from 'node:assert/strict';
import { test } from 'vitest';
import { incidentRules as rules } from '../data/incident-rules.js';
import { mapDefinitions } from '../data/maps/maps.js';
import { waveSchedules } from '../data/enemies/waves.js';
import { unitDefinitions } from '../data/enemies/units.js';
import { shiftEnd, shiftEscalated, shiftMinute } from '../src/systems/queries/incident.js';
import { edgeTargets } from '../src/rendering/edge-arrows.js';
import { createHarness } from './helpers/game-harness.js';
import { createArenas } from '../src/world/arenas.js';

const MAP = Object.keys(mapDefinitions).find(
  (id) => mapDefinitions[id].objective?.type === 'escalation',
);

async function open(seed = 11) {
  const h = await createHarness({ createSession: false });
  const game = h.createSession();
  game.selectMap(MAP);
  game.views.run().nextSeed = seed;
  game.start();
  // The tests drive the shift; the waves must not end the run meanwhile.
  game.state.p.hp = game.state.p.max = 1e7;
  return { h, game };
}
// Every component fails from the start: the impact climbs to the top within minutes.
const everythingFails = (inc) => {
  inc.plan = rules.components.map((c) => ({
    at: 0,
    component: c.id,
    fault: 'error',
    cause: 'release',
    mild: false,
    from: null,
    startedAt: null,
    endedAt: null,
  }));
  inc.injects = [];
  inc.alerts = [];
};
// Plays on (level-ups answered) until `seconds` pass or the run ends.
const run = (game, seconds) => {
  for (let i = 0; i < seconds * 60 && game.mode !== 'end'; i++) {
    for (let k = 0; k < 20 && game.mode === 'level'; k++) game.pickUpgrade(0);
    game.state.p.hp = game.state.p.max;
    game.update(1 / 60);
  }
  for (let k = 0; k < 20 && game.mode === 'level'; k++) game.pickUpgrade(0);
};

test('the shift map: rooms behind walls, no bug nodes, a planned shift', async () => {
  const { game } = await open();
  const s = game.state;
  assert.equal(s.map, MAP);
  assert.equal(game.mode, 'play');
  assert.deepEqual(s.nodes, [], 'no bug nodes');
  assert(s.incident && s.incident.plan.length > 0, 'a planned shift');
  const shift = mapDefinitions[MAP].shift;
  const arena = createArenas().get(MAP);
  for (const c of rules.components) {
    const { panel, box } = shift.rooms[c.id];
    assert(!arena.blocked(panel.x, panel.y, 30), c.id + ' panel clear');
    // The room's wall to the hall is solid beside its doorway, open in it.
    const wallY = box[1] === 0 ? box[3] + 20 : box[1] - 20;
    assert(arena.blocked(box[0] + 60, wallY, 5), c.id + ' wall');
    assert(!arena.blocked(panel.x, wallY, 5), c.id + ' doorway');
  }
  assert(!arena.blocked(s.p.x, s.p.y, 14), 'the hero starts in the hall');
  // The monitoring foes come only here, at a small weight in every stage.
  for (const stage of waveSchedules[MAP].normal.stages)
    for (const id of ['grafana_filter', 'log_query'].filter((u) => unitDefinitions[u]))
      assert(stage.weights.some(([u]) => u === id));
  run(game, 60);
  assert.equal(game.mode, 'play');
  assert(s.incident.history.length > 25, 'the line runs');
});

test('monitoring points at an unescalated failure', async () => {
  const { game } = await open(5);
  const s = game.state;
  const first = s.incident.alerts[0];
  s.t = (first.monitoringAt - 0.5) * rules.clock.minuteSeconds;
  run(game, 0.1);
  assert(!edgeTargets(s).some((t) => t.label.startsWith('АЛЕРТ')), 'not before the alert');
  s.t = (first.monitoringAt + 0.5) * rules.clock.minuteSeconds;
  run(game, 0.1);
  const component = s.incident.plan[first.fault].component;
  const panel = mapDefinitions[MAP].shift.rooms[component].panel;
  assert(edgeTargets(s).some((t) => t.label.startsWith('АЛЕРТ') && t.x === panel.x));
});

test('an incident left to grow brings the boss; beating it does not end the shift', async () => {
  const { game } = await open();
  const s = game.state;
  everythingFails(s.incident);
  assert(!s.bossSpawned);
  run(game, 30);
  assert(shiftEscalated(s.incident, shiftMinute(s)));
  assert(s.bossSpawned, 'the critical incident came');
  const boss = s.enemies.find((e) => e.boss);
  assert.equal(boss.unit, waveSchedules[MAP].boss.unit);
  game.damage(boss, boss.hp + 1);
  run(game, 1);
  assert.equal(s.bossDead, false);
  assert.equal(game.mode, 'play', 'the shift goes on');
});

test('the shift is lost when production collapses and won when it is over', async () => {
  const lost = await open();
  everythingFails(lost.game.state.incident);
  run(lost.game, 30);
  assert.equal(lost.game.state.incident.impact, 1);
  run(lost.game, rules.shift.collapse.minutes * rules.clock.minuteSeconds + 5);
  assert.equal(shiftEnd(lost.game.state.incident, shiftMinute(lost.game.state)), 'collapse');
  assert.equal(lost.game.mode, 'end');
  assert.equal(lost.game.views.run().result.win, false);

  const won = await open();
  won.game.state.incident.plan = [];
  won.game.state.incident.alerts = [];
  won.game.state.t = (rules.clock.minutes - 0.2) * rules.clock.minuteSeconds;
  run(won.game, 2);
  assert.equal(won.game.mode, 'end');
  assert.equal(won.game.views.run().result.win, true);
});
