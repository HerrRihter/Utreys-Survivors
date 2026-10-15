import { heroAttack } from './hero-attacks.js';
import { advanceAction } from '../core/action-timeline.js';
import { baHealthPerKill } from '../../data/characters/ba-specialization.js';
export const CombatSystem = {
  create(sessionContext) {
    function damage(e, n, dx = 0, dy = 0, source = sessionContext.state.p) {
      if (e.hp <= 0 || n <= 0) return;
      n *= sessionContext.Enemies.mitigation(e, source);
      e.hp -= n;
      sessionContext.soundEffect('hit');
      e.hit = 0.12;
      if (e.hp > 0 && e.type === 'enemy') {
        e.hurt = {
          elapsed: 0,
          duration: 0.34,
          flip: e.action ? e.action.flip : e.x > sessionContext.state.p.x,
        };
        e.action = null;
        e.cd = sessionContext.Math.max(e.cd, 0.45);
        e.moving = false;
      } else if (e.hp <= 0) {
        e.hurt = null;
        e.action = null;
      }
      const weight = e.nodeId ? 0 : e.r > 30 ? 0.12 : 1;
      e.vx += dx * weight;
      e.vy += dy * weight;
      if (sessionContext.state.texts.length < 45)
        sessionContext.state.texts.push({
          x: e.x,
          y: e.y - 25,
          v: sessionContext.Math.round(n),
          life: 0.55,
        });
      if (e.hp <= 0) {
        sessionContext.soundEffect('death');
        sessionContext.Corpses.add(
          sessionContext.state.corpses,
          e,
          sessionContext.Math.hypot(dx, dy) > 0
            ? { x: dx, y: dy }
            : { x: e.x - source.x, y: e.y - source.y },
        );
        const s = sessionContext.state;
        if (s.baSpecialization?.client === e.unit && s.p.hp > 0) {
          s.baSpecialization.bonus += baHealthPerKill;
          s.p.max += baHealthPerKill;
          s.p.hp = Math.min(s.p.max, s.p.hp + baHealthPerKill);
          if (s.texts.length < 45)
            s.texts.push({ x: s.p.x, y: s.p.y - 40, v: `+${baHealthPerKill} HP`, life: 0.8 });
        }
        sessionContext.state.kills++;
        sessionContext.state.earned += sessionContext.Progression.kill();
        if (sessionContext.Math.random() < 0.05)
          sessionContext.state.codes.push({ x: e.x, y: e.y, value: 3 });
        sessionContext.state.gems.push({
          x: e.x,
          y: e.y,
          v: sessionContext.Enemies.units[e.unit].xp,
        });
        for (let i = 0; i < 4; i++)
          sessionContext.state.fx.push({
            kind: 'spark',
            x: e.x,
            y: e.y - 10,
            vx: sessionContext.rand(-65, 65),
            vy: sessionContext.rand(-70, 20),
            life: 0.3,
            max: 0.3,
            color: i % 2 === 0 ? '#00e5ff' : '#64ffda',
          });
        if (sessionContext.Math.random() < 0.025)
          sessionContext.state.pickups.push({ x: e.x, y: e.y, type: 'food' });
        if (e.boss) {
          sessionContext.state.bossDead = true;
          sessionContext.toast(
            sessionContext.Enemies.units[e.unit].name + ' повержен! Заверши валидацию контура!',
          );
          sessionContext.soundEffect('boss');
          sessionContext.Progression?.recordBossKill?.();
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
      if (actor === sessionContext.state.p && sessionContext.selected === 'utrace')
        sessionContext.soundEffect('punchSwing');
    }
    function hurtPlayer(e) {
      const p = sessionContext.state.p;
      if (p.hp <= 0 || p.inv > 0 || sessionContext.abilities?.protectedMove()) return;
      p.hp -= sessionContext.Math.max(1, e.damage - sessionContext.state.stats.armor);
      p.inv = 0.7;
      p.hurt = { elapsed: 0, duration: 0.34, flip: p.flip };
      sessionContext.state.shake = 4;
      sessionContext.soundEffect('hurt');
      sessionContext.state.fx.push({ kind: 'hurt', x: p.x, y: p.y, r: 25, life: 0.25, max: 0.25 });
    }
    function heroImpact(a) {
      heroAttack(
        sessionContext,
        a,
        sessionContext.abilities?.effectiveStats() || sessionContext.state.stats,
      );
    }
    return { damage, beginAction, advanceAction, hurtPlayer, heroImpact };
  },
};
