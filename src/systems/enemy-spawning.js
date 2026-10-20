import { updateNodes, allNodesResolved } from './node-objectives.js';
import {
  getWaveSchedule,
  normalWave,
  selectWaveUnit,
  scheduleStage,
  unitRole,
} from './wave-schedule.js';
import { runModifiers, scaleEnemy, scaleWave, makeElite } from './difficulty.js';
import { production } from '../../data/difficulty.js';
import { enemyDamageScale, enemyHpScale } from '../../data/enemies/units.js';
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
      const schedule = getWaveSchedule(s.map);
      if (boss) e.hp = e.max = Math.round(u.hp * (schedule.boss?.hpScale || 1));
      else if (!u.miniboss) {
        // The whole roster is there from the start; the stage's strength ramps it up.
        const k = scheduleStage(schedule.normal.stages, s.t)?.strength ?? 1;
        e.hp = e.max = Math.max(1, Math.round(e.hp * k));
        e.damage *= k;
      }
      e.hp = e.max = Math.max(1, Math.round(e.hp * enemyHpScale));
      e.damage = Math.max(1, Math.round(e.damage * enemyDamageScale));
      scaleEnemy(e, runModifiers(s), boss ? s.productionBosses : 0);
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
        const next = s.waveNext[spec.unit];
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
        // Shooters and tanks outlive the light crowd: their share of the wave limit is capped
        // so they do not pile up into an unescapable wall.
        const shares = schedule.normal.shares || {},
          roles = { shooter: 0, tank: 0, light: 0 },
          full = new Set();
        for (const e of s.enemies) if (e.hp > 0) roles[unitRole(enemies.units[e.unit])]++;
        const check = () => {
          for (const [role, share] of Object.entries(shares))
            if (roles[role] >= Math.ceil(wave.cap * share)) full.add(role);
        };
        check();
        for (let i = 0; i < wave.batch && combat < wave.cap; i++) {
          const unit = selectWaveUnit(schedule, s.t, math.random(), enemies.units, full),
            leader = track(spawn(unit)),
            pack = enemies.units[unit].pack || 1;
          if (leader) {
            roles[unitRole(enemies.units[unit])]++;
            check();
          }
          // Swarm units arrive as a pack around the first one.
          for (let k = 1; leader && k < pack; k++)
            track(
              spawn(unit, false, {
                x: leader.x + math.rand(-45, 45),
                y: leader.y + math.rand(-45, 45),
              }),
            );
        }
      }
      // Elites: a stronger copy of a unit from the current stage, on the schedule's timer.
      if (schedule.elites && s.t >= s.eliteNext) {
        s.eliteNext += schedule.elites.every;
        const e = spawn(selectWaveUnit(schedule, s.t, math.random()));
        if (e) {
          makeElite(e);
          toast(
            'Элитный клиент: ' + enemies.units[e.unit].name + '. С него падает пакет обновлений',
          );
        }
      }
      const boss = schedule.boss;
      if (boss && allNodesResolved(s) && !s.bossSpawned && spawn(boss.unit, true)) {
        s.bossSpawned = true;
        if (boss.heal) {
          const gain = Math.round(s.p.max * boss.heal * s.healFactor);
          s.p.hp = Math.min(s.p.max, s.p.hp + gain);
          s.texts.push({
            x: s.p.x,
            y: s.p.y - 40,
            v: '+' + gain + ' ♥ резервная копия',
            life: 1.6,
          });
        }
        if (boss.message) toast(boss.message);
        if (boss.sound) audio.effect(boss.sound);
      }
      // Production: a stronger CRPT every few minutes; its kill pays codes instead of ending.
      if (boss && s.endless && s.t >= s.productionBossNext) {
        s.productionBossNext += production.bossEvery;
        if (spawn(boss.unit, true)) {
          s.productionBosses++;
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
