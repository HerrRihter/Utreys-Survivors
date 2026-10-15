import { updateNodes, allNodesResolved } from './node-objectives.js';
import { getWaveSchedule, normalWave, selectWaveUnit, scheduleStage } from './wave-schedule.js';
import { replenishPopulation } from './population.js';
export const EnemySpawning = {
  create(sessionContext) {
    function spawn(unit, boss = false, position = null) {
      const s = sessionContext.state,
        p = s.p,
        u = sessionContext.Enemies.units[unit];
      if (!u) throw new Error('Unknown unit: ' + unit);
      let x, y;
      if (position) {
        x = position.x;
        y = position.y;
      }
      for (let i = 0; !position && i < 100; i++) {
        const a = sessionContext.rand(0, sessionContext.Math.PI * 2),
          r = sessionContext.rand(520, 640);
        x = sessionContext.clamp(
          p.x + sessionContext.Math.cos(a) * r,
          u.r + 10,
          sessionContext.WORLD - u.r - 10,
        );
        y = sessionContext.clamp(
          p.y + sessionContext.Math.sin(a) * r,
          u.r + 10,
          sessionContext.WORLD - u.r - 10,
        );
        if (
          !sessionContext.Arena.blocked(x, y, u.r) &&
          sessionContext.Math.hypot(x - p.x, y - p.y) > 260
        )
          break;
      }
      if (sessionContext.Arena.blocked(x, y, u.r)) return;
      const e = {
        x,
        y,
        unit,
        type: boss ? 'boss' : 'enemy',
        hp: u.hp,
        max: u.hp,
        r: u.r,
        speed: u.speed,
        damage: u.damage,
        boss,
        hit: 0,
        cd: 0,
        phase: sessionContext.rand(0, 3),
        vx: 0,
        vy: 0,
        heading: sessionContext.Math.atan2(p.y - y, p.x - x),
      };
      s.enemies.push(e);
      return e;
    }
    function updateSpawning(dt) {
      const s = sessionContext.state,
        schedule = getWaveSchedule(s.map);
      if (schedule.active === false) return;
      updateNodes(sessionContext, dt);
      replenishPopulation(sessionContext);
      // Living enemies per unit and in total, counted once and kept current as we spawn.
      let counted = false,
        combat = 0;
      const perUnit = new Map();
      const count = () => {
        if (counted) return;
        counted = true;
        for (const e of s.enemies) {
          if (e.hp <= 0) continue;
          perUnit.set(e.unit, (perUnit.get(e.unit) || 0) + 1);
          combat++;
        }
      };
      const track = (e) => {
        if (!e || !counted) return e;
        perUnit.set(e.unit, (perUnit.get(e.unit) || 0) + 1);
        combat++;
        return e;
      };
      for (const spec of schedule.recurring) {
        const next = s.waveNext[spec.unit] ?? spec.first;
        if (s.t < next) continue;
        const stage = scheduleStage(spec.stages, s.t);
        s.waveNext[spec.unit] = next + stage.every;
        count();
        if (spec.populationCap !== null && combat >= spec.populationCap) continue;
        if ((perUnit.get(spec.unit) || 0) >= stage.cap) continue;
        if (track(spawn(spec.unit)) && spec.message) sessionContext.toast(spec.message);
      }
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const wave = normalWave(schedule, s.t);
        s.spawn = wave.interval;
        count();
        for (let i = 0; i < wave.batch && combat < wave.cap; i++)
          track(spawn(selectWaveUnit(schedule, s.t, sessionContext.Math.random())));
      }
      const boss = schedule.boss;
      if (boss && allNodesResolved(s) && !s.bossSpawned && spawn(boss.unit, true)) {
        s.bossSpawned = true;
        if (boss.message) sessionContext.toast(boss.message);
        if (boss.sound) sessionContext.soundEffect(boss.sound);
      }
      for (const spec of schedule.notifications) {
        if (s.t >= spec.time && s.t - dt < spec.time) sessionContext.toast(spec.message);
      }
    }
    return { spawn, updateSpawning };
  },
};
