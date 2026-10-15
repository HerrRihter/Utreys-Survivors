import {waveSchedules} from '../../data/enemies/waves.js';

export function getWaveSchedule(map) {
  if (!Object.hasOwn(waveSchedules, map)) throw new Error('Unknown wave schedule: ' + map);
  return waveSchedules[map];
}

export function scheduleStage(stages, time) {
  for (let index = stages.length - 1; index >= 0; index--) {
    if (time >= stages[index].time) return stages[index];
  }
  return stages[0];
}

export function normalWave(schedule, time) {
  const stage = scheduleStage(schedule.normal.stages, time);
  return {
    interval: Math.max(stage.minInterval, stage.interval - time * stage.timeFactor),
    batch: stage.batch + (stage.batchEvery === null ? 0 : Math.floor(time / stage.batchEvery)),
    cap: stage.cap,
    weights: stage.weights
  };
}

export function selectWaveUnit(schedule, time, roll = Math.random()) {
  const {weights} = scheduleStage(schedule.normal.stages, time);
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let cumulative = 0;
  for (const [unit, weight] of weights) {
    cumulative += weight;
    if (roll < cumulative / total) return unit;
  }
  return weights.at(-1)[0];
}

export function createWaveState(schedule) {
  return {
    spawn: schedule.normal.firstDelay,
    waveNext: Object.fromEntries(schedule.recurring.map(spec => [spec.unit, spec.first])),
    populationNext: schedule.population?.every ?? null,
    bossSpawned: false
  };
}

// The preview uses the same schedules as gameplay, including residents and population.
export function waveRoster(schedule) {
  const arrivals = new Map();
  const add = (unit, time) => arrivals.set(unit, Math.min(arrivals.get(unit) ?? Infinity, time));
  for (const stage of schedule.normal.stages) for (const [unit] of stage.weights) add(unit, stage.time);
  for (const spec of schedule.recurring) add(spec.unit, spec.first);
  if (schedule.boss) add(schedule.boss.unit, schedule.boss.time);
  for (const unit of schedule.residents) add(unit, 0);
  if (schedule.population) add(schedule.population.unit, 0);
  return [...arrivals].sort((a, b) => a[1] - b[1]).map(([unit, time]) => ({unit, time}));
}
