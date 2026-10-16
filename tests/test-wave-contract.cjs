const assert = require('node:assert/strict');
const { validateSchedules, checkGameContracts } = require('../tools/check-game-contracts.cjs');
const { waveSchedules } = require('../data/enemies/waves.js');
const { mapDefinitions } = require('../data/maps/maps.js');
const { unitDefinitions } = require('../data/enemies/units.js');
const {
  getWaveSchedule,
  normalWave,
  selectWaveUnit,
  createWaveState,
  waveRoster,
} = require('../src/systems/wave-schedule.js');
assert.equal(checkGameContracts(), 2);
for (const mutate of [
  (s) => {
    delete s.empty;
  },
  (s) => {
    s.empty.normal.stages[0].weights = [['typo', 1]];
  },
  (s) => {
    s.empty.normal.stages[0].weights = [['l3', 0]];
  },
  (s) => {
    s.empty.recurring[0].stages[0].every = 0;
  },
  (s) => {
    s.empty.recurring.push(s.empty.recurring[0]);
  },
  (s) => {
    s.empty.normal.stages[1].time = 0;
  },
  (s) => {
    s.empty.extra = true;
  },
  (s) => {
    s.empty.events.types = ['party'];
  },
  (s) => {
    s.serverRoom.elites.every = 0;
  },
]) {
  const s = structuredClone(waveSchedules);
  mutate(s);
  assert.throws(() => validateSchedules(s, mapDefinitions, unitDefinitions), /Game contract/);
}
const schedule = getWaveSchedule('empty');
for (const [time, batch, cap] of [
  [0, 2, 18],
  [59.999, 2, 18],
  [60, 4, 36],
  [149.999, 4, 36],
  [150, 6, 65],
  [240, 8, 110],
]) {
  const wave = normalWave(schedule, time);
  assert.equal(wave.batch, batch);
  assert.equal(wave.cap, cap);
  for (const roll of [0, 0.25, 0.5, 0.99999])
    assert(unitDefinitions[selectWaveUnit(schedule, time, roll)]);
}
assert(waveRoster(schedule).some((e) => e.unit === 'crpt' && e.time === Infinity));
const one = createWaveState(schedule),
  two = createWaveState(schedule);
one.waveNext.inbev = 999;
assert.notEqual(two.waveNext.inbev, 999);
assert.throws(() => getWaveSchedule('missing'), /Unknown/);
console.log('PASS: wave validation, boundary times, roster and independent run timers');
