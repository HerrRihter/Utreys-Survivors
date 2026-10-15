import { heroAttack } from './hero-attacks.js';
import { expansionUnits } from '../../data/enemies/units.js';
import { expansionDrop } from './expansion.js';
import { advanceAction } from '../core/action-timeline.js';
export let CombatSystem;
('use strict');
CombatSystem = {
  create(sessionContext) {
    function damage(e, n, dx = 0, dy = 0, source = sessionContext.state.p) {
      if (e.hp <= 0 || n <= 0) return;
      n *= sessionContext.Legion.mitigation(e, source);
      expansionDrop(e, n, sessionContext.state);
      e.hp -= n;
      sessionContext.soundEffect('hit');
      e.hit = 0.12;
      if (e.hp > 0 && (e.unit === 'turtle' || e.unit === 'ram' || expansionUnits[e.unit]))
        e.visualHurt = { elapsed: 0, duration: 0.34, flip: sessionContext.Math.cos(e.heading) < 0 };
      if (e.hp > 0 && e.type === 'roman') {
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
      const weight = e.nodeId ? 0 : e.r > 30 ? 0.12 : e.unit === 'veteran' ? 0.5 : 1;
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
          sessionContext.sprite,
          sessionContext.Math.hypot(dx, dy) > 0
            ? { x: dx, y: dy }
            : { x: e.x - source.x, y: e.y - source.y },
        );
        // The ambient crowd is not a source of XP, kill rewards or random loot.
        if (sessionContext.Legion.units[e.unit].civilian) return;
        sessionContext.state.kills++;
        sessionContext.abilities?.onKill();
        sessionContext.state.earned += sessionContext.Progression.kill();
        if (sessionContext.Math.random() < 0.05)
          sessionContext.state.helmets.push({ x: e.x, y: e.y, value: 3 });
        sessionContext.state.gems.push({
          x: e.x,
          y: e.y,
          v: sessionContext.Legion.units[e.unit].xp,
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
            sessionContext.Legion.units[e.unit].name + ' повержен! Заверши валидацию контура!',
          );
          sessionContext.soundEffect('boss');
          sessionContext.Progression?.recordBossKill?.();
        }
      }
    }
    function throwStones(count, baseDamage, direction = null) {
      const s = sessionContext.state,
        dir = direction || s.p.facing,
        angle = sessionContext.Math.atan2(dir.y, dir.x);
      for (let i = 0; i < count; i++) {
        const a = angle + (i - (count - 1) / 2) * 0.19;
        s.shots.push({
          x: s.p.x,
          y: s.p.y - 10,
          vx: sessionContext.Math.cos(a) * 320,
          vy: sessionContext.Math.sin(a) * 320,
          life: 2.2,
          r: 11 * s.stats.range * (1 + (s.stats.stoneSize || 0)),
          damage: baseDamage * s.stats.damage,
          hit: new Set(),
          age: 0,
          angle: a + sessionContext.Math.PI,
        });
      }
      sessionContext.soundEffect('stone');
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
    return { damage, throwStones, beginAction, advanceAction, hurtPlayer, heroImpact };
  },
};
