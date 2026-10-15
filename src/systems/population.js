import { getWaveSchedule } from './wave-schedule.js';

// `c` = { state, units, arena, rand, spawn }.
export function seedPopulation(c) {
  const spec = getWaveSchedule(c.state.map).population;
  if (!spec) return;
  const radius = c.units[spec.unit].r;
  for (let i = 0; i < spec.initial; i++) {
    for (let attempt = 0; attempt < 80; attempt++) {
      const position = { x: c.rand(100, c.arena.size - 100), y: c.rand(120, c.arena.size - 100) };
      if (
        Math.hypot(position.x - c.state.p.x, position.y - c.state.p.y) < 140 ||
        c.arena.blocked(position.x, position.y, radius)
      )
        continue;
      c.spawn(spec.unit, false, { ...position, variant: i % spec.variants });
      break;
    }
  }
}

export function replenishPopulation(c) {
  const s = c.state,
    spec = getWaveSchedule(s.map).population;
  if (!spec || s.t < s.populationNext) return;
  s.populationNext = s.t + spec.every;
  const count = s.enemies.filter((e) => e.unit === spec.unit && e.hp > 0).length;
  const desired = Math.min(spec.maximum, spec.initial + Math.floor(s.t / spec.growthEvery));
  if (count < desired) c.spawn(spec.unit);
}
