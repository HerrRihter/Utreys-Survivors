import { heroAttack } from './hero-attacks.js';
import { advanceAction } from '../core/action-timeline.js';
import { baHealthPerKill } from '../../data/characters/ba-specialization.js';
import { protectedMove, effectiveStats } from './ability-state.js';
import { passiveDamage } from './hero-passives.js';
import { production } from '../../data/difficulty.js';
import { elite } from './difficulty.js';
import { auraFactor, deathBlast } from './enemy-behaviors.js';

// Damage, deaths and rewards, hero/enemy action timing and hits on the player.
export const CombatSystem = {
  create({ run, heroes, enemies, corpses, progression, world, audio, math, toast, settings = {} }) {
    // `tag` names the source (hero, an ability or a weapon id) for the result screen.
    function damage(e, n, dx = 0, dy = 0, source = run.state.p, tag = 'hero') {
      if (e.hp <= 0 || n <= 0) return;
      const st = run.state;
      n *= enemies.mitigation(e, source) * auraFactor(st, e, enemies.units);
      if (e.markedUntil > st.t) n *= 1.3;
      const passive = passiveDamage(st, e, n, tag, math.random);
      n = passive.n;
      st.damageBy ??= {};
      st.damageBy[tag] = (st.damageBy[tag] || 0) + Math.min(n, e.hp);
      e.hp -= n;
      audio.effect('hit');
      e.hit = 0.12;
      // A hit interrupts light enemies (a charger loses its lunge too); heavy units (tanks,
      // the boss) keep their attacks going, and bugs shrug off hits for `poise` seconds after
      // each interruption.
      const u = enemies.units[e.unit];
      if (e.hp > 0 && e.type === 'enemy' && !u?.heavy && !(e.poiseUntil > st.t)) {
        if (u?.poise) e.poiseUntil = st.t + u.poise;
        if (e.dash?.phase === 'wind') e.dash = null;
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
      if (run.state.texts.length < 45 && settings.damageNumbers !== false)
        run.state.texts.push({
          x: e.x,
          y: e.y - 25,
          v: passive.crit ? Math.round(n) + '!' : Math.round(n),
          life: passive.crit ? 0.8 : 0.55,
        });
      if (e.hp <= 0) {
        audio.effect('death');
        if (u?.deathBlast) deathBlast(st, e, u);
        corpses.add(
          run.state.corpses,
          e,
          Math.hypot(dx, dy) > 0 ? { x: dx, y: dy } : { x: e.x - source.x, y: e.y - source.y },
        );
        const s = run.state;
        if (s.baSpecialization?.client === e.unit && s.p.hp > 0) {
          const gain = s.stats.clientHp ?? baHealthPerKill;
          s.baSpecialization.bonus = Math.round((s.baSpecialization.bonus + gain) * 10) / 10;
          s.p.max = Math.round((s.p.max + gain) * 10) / 10;
          s.p.hp = Math.min(s.p.max, s.p.hp + gain);
          if (s.stats.heroEvo) s.stats.damage += 0.01;
          if (s.texts.length < 45)
            s.texts.push({ x: s.p.x, y: s.p.y - 40, v: `+${gain} HP`, life: 0.8 });
        }
        run.state.kills++;
        run.state.earned += progression.kill(tag);
        const luck = run.state.stats.luck || 0;
        if (math.random() < 0.05 + luck) run.state.codes.push({ x: e.x, y: e.y, value: 3 });
        run.state.gems.push({
          x: e.x,
          y: e.y,
          v: enemies.units[e.unit].xp * (e.elite ? elite.xp : 1),
        });
        // Elites leave an update bundle; ordinary kills rarely drop a map pickup.
        if (e.elite) run.state.pickups.push({ x: e.x, y: e.y, type: 'bundle' });
        else {
          const roll = math.random();
          const type =
            roll < 0.004 ? 'magnet' : roll < 0.007 ? 'bomb' : roll < 0.01 ? 'freeze' : '';
          if (type) run.state.pickups.push({ x: e.x + 12, y: e.y, type });
        }
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
        if (math.random() < 0.025 + luck / 2)
          run.state.pickups.push({ x: e.x, y: e.y, type: 'food' });
        // A node guardian leaves a bug archive: it evolves a ready weapon now or later.
        if (enemies.units[e.unit]?.miniboss) {
          run.state.evoTokens = (run.state.evoTokens || 0) + 1;
          toast(
            (enemies.units[e.unit].archiveName || 'Архив бага') +
              ' получен: эволюция готового оружия',
          );
        }
        if (e.boss && run.state.endless) {
          // Production CRPTs pay codes; the run goes on.
          run.state.earned += progression.earn(production.bossReward);
          toast(
            `${enemies.units[e.unit].name} повержен в продакшене! +${production.bossReward} кодов`,
          );
          audio.effect('boss');
          progression.recordBossKill?.();
        } else if (e.boss) {
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
      if (p.hp <= 0 || p.inv > 0 || protectedMove(run.state)) return false;
      p.hp -= Math.max(1, e.damage - run.state.stats.armor);
      const slow = !e.kind && enemies.units[e.unit]?.slow;
      if (slow) {
        p.slowUntil = run.state.t + slow.duration;
        p.slowAmount = slow.amount;
      }
      run.state.firstHurtAt ??= run.state.t;
      run.state.lastHitBy = e.unit || e.kind || 'unknown';
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
          heroId: run.selected,
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
