import { updateNodes, allNodesResolved } from './node-objectives.js';
import { getWaveSchedule, normalWave, selectWaveUnit, scheduleStage } from './wave-schedule.js';
import { runModifiers, scaleEnemy, scaleWave } from './difficulty.js';
import { production } from '../../data/difficulty.js';
// Placing enemies: waves, recurring units, node guardians and the boss.
export const EnemySpawning = {
  create({ run, enemies, world, math, toast, audio }) {
    function spawn(unit, boss = false, position = null) {
      const s = run.state,
        p = s.p,
        u = enemies.units[unit];
      if (!u) throw new Error('Unknown unit: ' + unit);
      let x, y;
      if (position) {
        x = position.x;
        y = position.y;
      }
      for (let i = 0; !position && i < 100; i++) {
        const a = math.rand(0, Math.PI * 2),
          r = math.rand(520, 640);
        x = math.clamp(p.x + Math.cos(a) * r, u.r + 10, world.arena.size - u.r - 10);
        y = math.clamp(p.y + Math.sin(a) * r, u.r + 10, world.arena.size - u.r - 10);
        if (!world.arena.blocked(x, y, u.r) && Math.hypot(x - p.x, y - p.y) > 260) break;
      }
      if (world.arena.blocked(x, y, u.r)) return;
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
        phase: math.rand(0, 3),
        vx: 0,
        vy: 0,
        heading: Math.atan2(p.y - y, p.x - x),
      };
      scaleEnemy(e, runModifiers(s), boss ? s.productionBosses || 0 : 0);
      s.enemies.push(e);
      return e;
    }
    function updateSpawning(dt) {
      const s = run.state,
        schedule = getWaveSchedule(s.map);
      if (schedule.active === false) return;
      updateNodes({ state: s, spawn, toast }, dt);
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
        if (track(spawn(spec.unit)) && spec.message) toast(spec.message);
      }
      s.spawn -= dt;
      if (s.spawn <= 0) {
        const wave = scaleWave(normalWave(schedule, s.t), runModifiers(s));
        s.spawn = wave.interval;
        count();
        for (let i = 0; i < wave.batch && combat < wave.cap; i++)
          track(spawn(selectWaveUnit(schedule, s.t, math.random())));
      }
      const boss = schedule.boss;
      if (boss && allNodesResolved(s) && !s.bossSpawned && spawn(boss.unit, true)) {
        s.bossSpawned = true;
        if (boss.message) toast(boss.message);
        if (boss.sound) audio.effect(boss.sound);
      }
      // Production: a stronger CRPT every few minutes; its kill pays codes instead of ending.
      if (boss && s.endless && s.t >= s.productionBossNext) {
        s.productionBossNext += production.bossEvery;
        if (spawn(boss.unit, true)) {
          s.productionBosses = (s.productionBosses || 0) + 1;
          toast('ПРОДАКШЕН: усиленный ЦРПТ №' + s.productionBosses);
          if (boss.sound) audio.effect(boss.sound);
        }
      }
      for (const spec of schedule.notifications) {
        if (s.t >= spec.time && s.t - dt < spec.time) toast(spec.message);
      }
    }
    return { spawn, updateSpawning };
  },
};
