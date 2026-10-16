import { nodeDefinitions } from '../../data/enemies/nodes.js';
import { waveSchedules } from '../../data/enemies/waves.js';

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
    weights: stage.weights,
  };
}

// Wave roles with a limited share of the field: shooters keep their distance and tanks
// shrug off hits, so both outlive the light crowd and would otherwise pile up.
export function unitRole(u) {
  if (u?.attack === 'projectile' || u?.attack === 'mortar') return 'shooter';
  if (!u?.miniboss && (u?.poise || u?.heavy || u?.frontDamageMultiplier)) return 'tank';
  return 'light';
}

// `units` + `full`: a set of roles whose share is used up; those are skipped.
export function selectWaveUnit(schedule, time, roll = Math.random(), units = null, full = null) {
  let { weights } = scheduleStage(schedule.normal.stages, time);
  if (full?.size && units) {
    const open = weights.filter(([id]) => !full.has(unitRole(units[id])));
    if (open.length) weights = open;
  }
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
    waveNext: Object.fromEntries(schedule.recurring.map((spec) => [spec.unit, spec.first])),
    bossSpawned: false,
    eliteNext: schedule.elites?.first ?? Infinity,
  };
}

// The preview uses the same schedules as gameplay.
export function waveRoster(schedule) {
  const arrivals = new Map();
  const add = (unit, time) => arrivals.set(unit, Math.min(arrivals.get(unit) ?? Infinity, time));
  for (const stage of schedule.normal.stages)
    for (const [unit] of stage.weights) add(unit, stage.time);
  for (const spec of schedule.recurring) add(spec.unit, spec.first);
  for (const node of nodeDefinitions) add(node.bug, 0);
  if (schedule.boss) add(schedule.boss.unit, Infinity);
  return [...arrivals].sort((a, b) => a[1] - b[1]).map(([unit, time]) => ({ unit, time }));
}
