import { heroAttack } from './hero-attacks.js';
import { advanceAction } from '../core/action-timeline.js';
import { baHealthPerKill } from '../../data/characters/ba-specialization.js';
import { protectedMove, effectiveStats } from './ability-state.js';

// Damage, deaths and rewards, hero/enemy action timing and hits on the player.
export const CombatSystem = {
  create({ run, heroes, enemies, corpses, progression, world, audio, math, toast }) {
    function damage(e, n, dx = 0, dy = 0, source = run.state.p) {
      if (e.hp <= 0 || n <= 0) return;
      n *= enemies.mitigation(e, source);
      e.hp -= n;
      audio.effect('hit');
      e.hit = 0.12;
      if (e.hp > 0 && e.type === 'enemy') {
        e.hurt = {
          elapsed: 0,
          duration: 0.34,
          flip: e.action ? e.action.flip : e.x > run.state.p.x,
        };
        e.action = null;
        e.cd = Math.max(e.cd, 0.45);
        e.moving = false;
      } else if (e.hp <= 0) {
        e.hurt = null;
        e.action = null;
      }
      const weight = e.nodeId ? 0 : e.r > 30 ? 0.12 : 1;
      e.vx += dx * weight;
      e.vy += dy * weight;
      if (run.state.texts.length < 45)
        run.state.texts.push({
          x: e.x,
          y: e.y - 25,
          v: Math.round(n),
          life: 0.55,
        });
      if (e.hp <= 0) {
        audio.effect('death');
        corpses.add(
          run.state.corpses,
          e,
          Math.hypot(dx, dy) > 0 ? { x: dx, y: dy } : { x: e.x - source.x, y: e.y - source.y },
        );
        const s = run.state;
        if (s.baSpecialization?.client === e.unit && s.p.hp > 0) {
          s.baSpecialization.bonus += baHealthPerKill;
          s.p.max += baHealthPerKill;
          s.p.hp = Math.min(s.p.max, s.p.hp + baHealthPerKill);
          if (s.texts.length < 45)
            s.texts.push({ x: s.p.x, y: s.p.y - 40, v: `+${baHealthPerKill} HP`, life: 0.8 });
        }
        run.state.kills++;
        run.state.earned += progression.kill();
        if (math.random() < 0.05) run.state.codes.push({ x: e.x, y: e.y, value: 3 });
        run.state.gems.push({
          x: e.x,
          y: e.y,
          v: enemies.units[e.unit].xp,
        });
        for (let i = 0; i < 4; i++)
          run.state.fx.push({
            kind: 'spark',
            x: e.x,
            y: e.y - 10,
            vx: math.rand(-65, 65),
            vy: math.rand(-70, 20),
            life: 0.3,
            max: 0.3,
            color: i % 2 === 0 ? '#00e5ff' : '#64ffda',
          });
        if (math.random() < 0.025) run.state.pickups.push({ x: e.x, y: e.y, type: 'food' });
        if (e.boss) {
          run.state.bossDead = true;
          toast(enemies.units[e.unit].name + ' повержен! Заверши валидацию контура!');
          audio.effect('boss');
          progression.recordBossKill?.();
        }
      }
    }
    function beginAction(actor, duration, target) {
      actor.action = {
        elapsed: 0,
        duration,
        hit: false,
        flip: target.x < actor.x,
        aim: { x: target.x, y: target.y },
      };
      if (actor === run.state.p && run.selected === 'utrace') audio.effect('punchSwing');
    }
    function hurtPlayer(e) {
      const p = run.state.p;
      if (p.hp <= 0 || p.inv > 0 || protectedMove(run.state)) return;
      p.hp -= Math.max(1, e.damage - run.state.stats.armor);
      p.inv = 0.7;
      p.hurt = { elapsed: 0, duration: 0.34, flip: p.flip };
      run.state.shake = 4;
      audio.effect('hurt');
      run.state.fx.push({ kind: 'hurt', x: p.x, y: p.y, r: 25, life: 0.25, max: 0.25 });
    }
    function heroImpact(a) {
      heroAttack(
        {
          state: run.state,
          hero: heroes.defs[run.selected],
          arena: world.arena,
          units: enemies.units,
          effect: audio.effect,
          damage,
        },
        a,
        effectiveStats(run.state),
      );
    }
    return { damage, beginAction, advanceAction, hurtPlayer, heroImpact };
  },
};
