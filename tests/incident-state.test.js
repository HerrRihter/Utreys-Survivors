import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'vitest';
import { incidentRules } from '../data/incident-rules.js';
import { mapDefinitions } from '../data/maps/maps.js';
import { createIncidentState, newIncidentState, validIncident } from '../src/systems/escalation.js';
import { runFields } from '../src/systems/run-model.js';
import { planShift } from '../src/systems/production-line.js';
import {
  RUN_SNAPSHOT_KEY,
  LEGACY_RUN_SNAPSHOT_KEYS,
  migrateRunSnapshot,
} from '../src/systems/run-snapshot.js';
import { toGraphJson, fromGraphJson } from '../src/core/graph-json.js';
import { createHarness } from './helpers/game-harness.js';
import { goldenScenarios, replayContinuous, scenarioLabel } from './helpers/replay.js';

// validIncident takes a map whose objective runs a shift; none is in the game before stage 6,
// so the checks below borrow one by its objective type.
const shiftMap = 'shift-test';
const withShiftMap = (fn) => {
  mapDefinitions[shiftMap] = { name: 'Смена', objective: { type: 'escalation' } };
  try {
    return fn();
  } finally {
    delete mapDefinitions[shiftMap];
  }
};

test('a shift starts with every field in place and survives a save', () => {
  const inc = newIncidentState();
  assert.equal(inc.rulesVersion, incidentRules.version);
  assert.deepEqual(
    Object.keys(inc.components),
    incidentRules.components.map((c) => c.id),
  );
  for (const c of incidentRules.components) {
    const ops = inc.components[c.id].ops;
    assert.equal(ops.length, c.ops);
    assert(ops.every((op) => op.status === 'busy'));
    // Staggered: no two operations of a component finish at the same time.
    assert.equal(new Set(ops.map((op) => op.since)).size, c.ops);
  }
  assert.deepEqual(
    Object.keys(inc.metrics),
    incidentRules.metrics.map((m) => m.id),
  );
  // The same state twice: the factory draws no randomness.
  assert.deepEqual(newIncidentState(), inc);
  // A save keeps it as it is.
  const restored = fromGraphJson(JSON.parse(JSON.stringify(toGraphJson({ inc })))).inc;
  assert.deepEqual(restored, inc);
  withShiftMap(() => {
    assert(validIncident(restored, shiftMap));
    // On a shift map the run's shift is planned from its seed.
    assert.deepEqual(createIncidentState(shiftMap, 5), planShift(newIncidentState(), 5));
    assert(createIncidentState(shiftMap, 5).plan.length > 0);
  });
});

test('a saved shift of other rules or another map is refused', () => {
  withShiftMap(() => {
    const changed = (change) => {
      const inc = newIncidentState();
      change(inc);
      return validIncident(inc, shiftMap);
    };
    assert(!validIncident(newIncidentState(), 'empty'), 'not on a map without shifts');
    assert(!validIncident(null, shiftMap));
    assert(!changed((inc) => (inc.rulesVersion = incidentRules.version + 1)));
    assert(!changed((inc) => (inc.course = 'batch-accounting')));
    assert(!changed((inc) => delete inc.components.artemis));
    assert(!changed((inc) => inc.components.artemis.ops.pop()));
    assert(!changed((inc) => (inc.metrics.tracing = inc.metrics.logs)));
    assert(!changed((inc) => (inc.day = 7)));
    assert(!changed((inc) => (inc.history = null)));
    assert(!changed((inc) => (inc.nextTicket = 0)));
  });
});

test('only the shift map has a shift, and the field is saved', () => {
  assert.equal(runFields.incident, 'save');
  for (const [map, def] of Object.entries(mapDefinitions))
    if (def.objective?.type === 'escalation')
      assert(validIncident(createIncidentState(map, 1), map));
    else assert.equal(createIncidentState(map, 1), null, map);
});

test('version 6 saves become version 7 without a shift', async () => {
  assert.equal(RUN_SNAPSHOT_KEY, 'utreys-run-v7');
  assert.equal(LEGACY_RUN_SNAPSHOT_KEYS[0], 'utreys-run-v6');
  // A real version 6 save: the current build's save without the new field.
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  let game = h.createSession();
  game.start();
  for (let i = 0; i < 600; i++) game.update(1 / 60);
  game.pause();
  const v7 = JSON.parse(store.get(RUN_SNAPSHOT_KEY));
  const { incident, ...state } = v7.state;
  assert.equal(incident, null);
  const v6 = { ...v7, version: 6, state };
  game.dispose();

  assert.deepEqual(migrateRunSnapshot(v6), v7);
  // The menu converts the old save once and plays it on.
  store.clear();
  store.set('utreys-run-v6', JSON.stringify(v6));
  game = h.createSession();
  assert(game.views.menu().resume, 'Continue is offered');
  assert(!store.has('utreys-run-v6'));
  assert.deepEqual(JSON.parse(store.get(RUN_SNAPSHOT_KEY)), v7);
  assert(game.resume());
  assert.equal(game.state.incident, null);
  assert.equal(game.state.t, v7.state.t);
  game.dispose();
});

test('the new field changes no outcome of the earlier maps', async () => {
  // Hashes of the golden replays taken before `incident` existed, compared without it.
  const before = JSON.parse(
    fs.readFileSync(new URL('./fixtures/pre-incident-replay.json', import.meta.url), 'utf8'),
  );
  for (const scenario of goldenScenarios) {
    const after = await replayContinuous({ ...scenario, projection: 'pre-incident' });
    assert.equal(
      after.hashes[scenario.steps],
      before[scenarioLabel(scenario)],
      scenarioLabel(scenario),
    );
  }
});
