import { currentRoom, currentLayout, courseOf } from './queries/learning.js';
import { learningRules } from '../../data/learning-rules.js';
import { clamp } from '../core/math.js';
import { updateNodes, allNodesResolved } from './node-objectives.js';
import {
  getWaveSchedule,
  normalWave,
  selectWaveUnit,
  scheduleStage,
  unitRole,
} from './wave-schedule.js';
import { runModifiers, scaleEnemy, scaleWave, makeElite } from './difficulty.js';
import { metricBoost, shiftEscalated, shiftMinute } from './queries/incident.js';
import { production } from '../../data/difficulty.js';
import { enemyDamageScale, enemyHpScale, unitDefinitions } from '../../data/enemies/units.js';
// A learning room's wave size and limit, scaled by the room (later mazes bring more) and
// swollen for a while after a failed test.
function roomWave(wave, room, s) {
  if (!room?.waves) return wave;
  const surge = s.t < s.learning.surgeUntil ? learningRules.surge : { batch: 1, cap: 1 };
  return {
    ...wave,
    batch: Math.ceil(wave.batch * room.waves.batch * surge.batch),
    cap: Math.round(wave.cap * room.waves.cap * surge.cap),
  };
}

// Placing enemies: waves, recurring units, node guardians and the boss.
export const EnemySpawning = {
  create({ run, world, toast, audio }) {
    // A free spot `near`..`far` px from the hero; null when none was found.
    function pointAround(s, u, [near, far]) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const a = s.rng.rand(0, Math.PI * 2),
          r = s.rng.rand(near, far),
          x = clamp(s.p.x + Math.cos(a) * r, u.r + 10, world.arena.size - u.r - 10),
          y = clamp(s.p.y + Math.sin(a) * r, u.r + 10, world.arena.size - u.r - 10);
        if (!world.arena.blocked(x, y, u.r)) return { x, y };
      }
      return null;
    }
    function spawn(unit, boss = false, position = null) {
      const s = run.state,
        p = s.p,
        u = unitDefinitions[unit];
      if (!u) throw new Error('Unknown unit: ' + unit);
      const room = currentRoom(s);
      // In a learning room waves come from around the corridors' bends, the boss to its spot.
      if (room && !position) {
        position = boss ? currentLayout(s).boss : pointAround(s, u, learningRules.waveDistance);
        if (!position) return;
      }
      let x, y;
      if (position) {
        x = position.x;
        y = position.y;
      }
      for (let i = 0; !position && i < 100; i++) {
        const a = s.rng.rand(0, Math.PI * 2),
          r = s.rng.rand(520, 640);
        x = clamp(p.x + Math.cos(a) * r, u.r + 10, world.arena.size - u.r - 10);
        y = clamp(p.y + Math.sin(a) * r, u.r + 10, world.arena.size - u.r - 10);
        if (!world.arena.blocked(x, y, u.r) && Math.hypot(x - p.x, y - p.y) > 260) break;
      }
      if (world.arena.blocked(x, y, u.r)) return;
      const e = {
        id: s.nextEnemyId++,
        summonerId: null,
        nodeId: null,
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
        // Animation offset, spread by id so neighbours do not walk in step.
        phase: (((s.nextEnemyId - 1) * 0.6180339887) % 1) * 3,
        vx: 0,
        vy: 0,
        heading: Math.atan2(p.y - y, p.x - x),
      };
      const schedule = getWaveSchedule(s.map);
      if (boss) e.hp = e.max = Math.round(u.hp * (schedule.boss?.hpScale || 1));
      else if (!u.miniboss) {
        // The whole roster is there from the start; the stage's strength ramps it up, and a
        // learning room's strength on top.
        const k =
          (scheduleStage(schedule.normal.stages, s.t)?.strength ?? 1) * (room?.strength ?? 1);
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
      const room = currentRoom(s);
      // An audit for a wrong answer: a pack of the current waves, close by. One pack per step.
      if (s.learning?.audits > 0) {
        s.learning.audits--;
        for (let i = 0; i < learningRules.auditPack; i++) {
          const unit = selectWaveUnit(schedule, s.t, s.rng.random());
          const point = pointAround(s, unitDefinitions[unit], learningRules.auditDistance);
          if (point) spawn(unit, false, point);
        }
        toast('Проверка: ошибка в ответе привела инспекторов');
      }
      if (room?.boss) {
        // The hall's boss is the course's.
        const boss = courseOf(s).boss;
        if (allNodesResolved(s) && !s.bossSpawned && spawn(boss.unit, true, room.boss)) {
          s.bossSpawned = true;
          toast(boss.message);
          audio.effect(schedule.boss.sound);
        }
        return;
      }
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
        const wave = scaleWave(roomWave(normalWave(schedule, s.t), room, s), runModifiers(s));
        s.spawn = wave.interval;
        count();
        // Shooters and tanks outlive the light crowd: their share of the wave limit is capped
        // so they do not pile up into an unescapable wall.
        const shares = schedule.normal.shares || {},
          roles = { shooter: 0, tank: 0, light: 0 },
          full = new Set();
        for (const e of s.enemies) if (e.hp > 0) roles[unitRole(unitDefinitions[e.unit])]++;
        const check = () => {
          for (const [role, share] of Object.entries(shares))
            if (roles[role] >= Math.ceil(wave.cap * share)) full.add(role);
        };
        check();
        for (let i = 0; i < wave.batch && combat < wave.cap; i++) {
          const unit = selectWaveUnit(
              schedule,
              s.t,
              s.rng.random(),
              unitDefinitions,
              full,
              metricBoost(s.incident),
            ),
            leader = track(spawn(unit)),
            pack = unitDefinitions[unit].pack || 1;
          if (leader) {
            roles[unitRole(unitDefinitions[unit])]++;
            check();
          }
          // Swarm units arrive as a pack around the first one.
          for (let k = 1; leader && k < pack; k++)
            track(
              spawn(unit, false, {
                x: leader.x + s.rng.rand(-45, 45),
                y: leader.y + s.rng.rand(-45, 45),
              }),
            );
        }
      }
      // Elites: a stronger copy of a unit from the current stage, on the schedule's timer.
      if (schedule.elites && s.t >= s.eliteNext) {
        s.eliteNext += schedule.elites.every;
        const e = spawn(selectWaveUnit(schedule, s.t, s.rng.random()));
        if (e) {
          makeElite(e);
          toast(
            'Элитный клиент: ' + unitDefinitions[e.unit].name + '. С него падает пакет обновлений',
          );
        }
      }
      const boss = schedule.boss;
      // The incident shift's boss punishes an incident left to grow; elsewhere it comes once
      // the objectives are done.
      const bossDue =
        boss?.condition === 'incident-escalated'
          ? !!s.incident && shiftEscalated(s.incident, shiftMinute(s))
          : allNodesResolved(s);
      if (boss && !room && bossDue && !s.bossSpawned && spawn(boss.unit, true)) {
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
