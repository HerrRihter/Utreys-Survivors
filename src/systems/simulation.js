import { currentRoom } from './queries/learning.js';
import { compact } from '../core/compact.js';
import { clamp, near } from '../core/math.js';
import { unitDefinitions } from '../../data/enemies/units.js';
import { heroDefinitions } from '../../data/characters/heroes.js';
import { pickupDefinitions } from '../../data/pickups.js';
import { resolveEnemyStrike } from './enemy-attacks.js';
import {
  moveGoal,
  goalDirection,
  updateDash,
  updateTraits,
  updateHazards,
  speedFactor,
  cooldownFactor,
} from './enemy-behaviors.js';
import { advanceAction } from '../core/action-timeline.js';
import { protectedMove, blocksAttack, effectiveStats, pacified } from './queries/abilities.js';
import { countCrowd } from './hero-passives.js';
import { updateProjectiles } from './projectiles.js';

const isLive = (item) => item.life > 0,
  isPresent = (item) => !item.dead,
  isAlive = (actor) => actor.hp > 0;
// One fixed step of a run: movement, attacks, enemies, projectiles, pickups and effects.
// `events.finish(win)` / `events.levelUp()` hand control back to the game flow.
export const Simulation = {
  create({
    run,
    world,
    corpses,
    wallet,
    audio,
    abilities,
    combat,
    spawning,
    weapons,
    runEvents,
    events,
  }) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    // The hero's packets (`s.shots`) move and split through the shared projectile kinds.
    const shotContext = { damage: combat.damage };
    const strike = {
      get arena() {
        return world.arena;
      },
      effect: (name) => audio.effect(name),
      hurtPlayer: (e) => combat.hurtPlayer(e),
      spawn: (...args) => spawning.spawn(...args),
      toast: (message) => events.toast?.(message),
      units: unitDefinitions,
    };
    // Enemy speed grows with time, up to this multiplier.
    const timeSpeedCap = 1.2;
    // Map pickups by kind (data/pickups.js): `spec` is the pickup type's data.
    const pickupKinds = {
      upgrade() {
        events.openBundle?.();
      },
      pull(s, spec) {
        const p = s.p;
        for (const gem of s.gems) gem.pull = true;
        s.texts.push({ x: p.x, y: p.y - 30, v: spec.text, life: 1 });
        audio.effect(spec.sound);
      },
      blast(s, spec, st, type) {
        const p = s.p;
        for (const e of s.enemies)
          if (e.hp > 0 && near(p, e, spec.halfWidth, spec.halfHeight))
            combat.damage(e, spec.damage * st.damage, 0, 0, p, type);
        ring(s, spec.ring);
        s.shake = spec.shake;
        audio.effect(spec.sound);
      },
      stun(s, spec) {
        const p = s.p;
        for (const e of s.enemies)
          if (e.hp > 0 && !e.boss && !unitDefinitions[e.unit]?.miniboss) {
            e.abilityStun = Math.max(e.abilityStun || 0, spec.seconds);
            e.action = null;
          }
        ring(s, spec.ring);
        s.texts.push({ x: p.x, y: p.y - 30, v: spec.text, life: 1 });
        audio.effect(spec.sound);
      },
      heal(s, spec) {
        const p = s.p;
        const heal = Math.round(spec.amount * s.healFactor);
        s.foodTaken++;
        p.hp = Math.min(p.max, p.hp + heal);
        s.texts.push({ x: p.x, y: p.y - 30, v: '+' + heal + ' ♥', life: 1 });
        audio.effect(spec.sound);
      },
    };
    function ring(s, { r, life, color }) {
      s.fx.push({ kind: 'ring', x: s.p.x, y: s.p.y, r, life, max: life, color });
    }
    function pickUp(s, item, st) {
      const spec = pickupDefinitions[item.type];
      pickupKinds[spec.kind](s, spec, st, item.type);
    }
    function update(dt) {
      const s = run.state,
        p = s.p;
      const abilityMoving = protectedMove(s);
      s.t += dt;
      abilities.update(dt);
      const st = effectiveStats(s);
      s.step += dt;
      s.corpses = corpses.update(s.corpses, dt);
      s.shake = Math.max(0, s.shake - dt * 20);
      p.inv = Math.max(0, p.inv - dt);
      p.hp = Math.min(p.max, p.hp + st.regen * s.healFactor * dt);
      // Movement intent from the input layer: keys, arrows and the touch stick combined.
      let mx = run.move.x,
        my = run.move.y;
      if (abilityMoving) {
        mx = 0;
        my = 0;
      }
      const ml = Math.hypot(mx, my);
      if (ml > 1) {
        mx /= ml;
        my /= ml;
      }
      if (ml > 0.05) {
        p.facing = {
          x: mx / Math.hypot(mx, my),
          y: my / Math.hypot(mx, my),
        };
        if (Math.abs(mx) > 0.01) p.flip = mx < 0;
      }
      const oldX = p.x,
        oldY = p.y;
      // Inspectors' waves slow the player for a moment.
      const slowed = p.slowUntil > s.t ? 1 - p.slowAmount : 1;
      world.arena.move(
        p,
        mx * p.speed * st.speed * slowed * dt,
        my * p.speed * st.speed * slowed * dt,
        14,
      );
      p.x = clamp(p.x, 52, world.arena.size - 52);
      p.y = clamp(p.y, 100, world.arena.size - 12);
      const travel = Math.hypot(p.x - oldX, p.y - oldY);
      p.moving = travel > 0.01;
      p.walk += travel / 55;
      spawning.updateSpawning(dt);
      runEvents?.update(dt);
      s.runtime.crowd = countCrowd(s);
      if (p.hurt) {
        p.hurt.elapsed += dt;
        if (p.hurt.elapsed >= p.hurt.duration) p.hurt = null;
      }
      if (p.action) {
        p.action.direction = { ...p.facing };
        p.action.flip = Math.abs(p.facing.x) > 0.01 ? p.facing.x < 0 : p.flip;
      }
      advanceAction(p, dt, combat.heroImpact);
      weapons?.update(dt);
      const heroSpec = heroDefinitions[run.selected];
      s.attack -= dt;
      if (!blocksAttack(s) && s.attack <= 0 && !p.action) {
        s.attack = Math.max(0.22, heroSpec.interval / (st.haste * (1 + (st.punchTempo || 0))));
        const dir = { ...p.facing };
        s.runtime.attackCycle = s.attack;
        combat.beginAction(
          p,
          Math.max(0.18, heroSpec.wind / (st.haste * (1 + (st.punchTempo || 0)))),
          { x: p.x + dir.x, y: p.y + dir.y },
        );
        p.action.direction = dir;
        p.action.flip = Math.abs(dir.x) > 0.01 ? dir.x < 0 : p.flip;
      }
      // Guards whose aura covers their neighbours, found once per step for combat.
      s.runtime.guards = s.enemies.filter((e) => e.hp > 0 && unitDefinitions[e.unit]?.aura);
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.abilityStun > 0) continue;
        const u = unitDefinitions[e.unit],
          d = dist(e, p);
        e.hit = Math.max(0, e.hit - dt);
        if (e.visualHurt) {
          e.visualHurt.elapsed += dt;
          if (e.visualHurt.elapsed >= e.visualHurt.duration) e.visualHurt = null;
        }
        e.cd -= dt;
        if (e.hurt) {
          e.hurt.elapsed += dt;
          if (e.hurt.elapsed >= e.hurt.duration) e.hurt = null;
        }
        e.vx *= Math.exp(-9 * dt);
        e.vy *= Math.exp(-9 * dt);
        updateTraits(strike, s, e, u, dt);
        const canAct = !e.hurt && !pacified(s, e);
        if (updateDash(strike, s, e, u, dt, d, canAct)) {
          e.animationTime = s.t;
          const travel = e.dash?.phase === 'go' ? 1 : 0;
          e.moving = travel > 0;
          e.walk = (e.walk || e.phase / 6) + travel / 10;
          continue;
        }
        if (!e.action) {
          const target = Math.atan2(p.y - e.y, p.x - e.x),
            delta = Math.atan2(Math.sin(target - e.heading), Math.cos(target - e.heading));
          e.heading += clamp(delta, -dt * (e.r > 30 ? 0.8 : 6), dt * (e.r > 30 ? 0.8 : 6));
        }
        e.animationTime = s.t;
        advanceAction(e, dt, (a) => resolveEnemyStrike(strike, s, e, u, a.aim));
        if (
          !e.action &&
          !e.hurt &&
          !u.passive &&
          e.cd <= 0 &&
          d < u.range &&
          !pacified(s, e) &&
          world.arena.clear(e, p, 2)
        ) {
          combat.beginAction(e, u.wind, p);
          e.cd = u.cooldown * cooldownFactor(e, u);
          e.heading = Math.atan2(p.y - e.y, p.x - e.x);
        }
        const goal = !e.action && !e.hurt ? moveGoal(strike, s, e, u, d) : null,
          moving = !!goal,
          speed =
            e.speed *
            speedFactor(e, u) *
            Math.min(timeSpeedCap, 1 + s.t / 1800) *
            (1 - (e.abilitySlow || 0)) *
            (e.weaponSlowUntil > s.t ? 1 - e.weaponSlow : 1),
          dir = moving ? goalDirection(world.arena, e, goal, p) : null,
          ox = e.x,
          oy = e.y;
        world.arena.move(
          e,
          (moving ? dir.x * speed * dt : 0) + e.vx * dt,
          (moving ? dir.y * speed * dt : 0) + e.vy * dt,
          e.r,
        );
        const travel = Math.hypot(e.x - ox, e.y - oy);
        e.moving = travel > 0.01;
        e.walk = (e.walk || e.phase / 6) + travel / 50;
      }
      updateHazards(strike, s, dt);
      for (const b of s.enemyShots) {
        // Later shots of a burst wait at the muzzle.
        if (b.wait > 0) {
          b.wait -= dt;
          continue;
        }
        b.age = (b.age || 0) + dt;
        const n = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 8));
        for (let i = 0; i < n && b.life > 0; i++) {
          b.x += (b.vx * dt) / n;
          b.y += (b.vy * dt) / n;
          if (world.arena.blocked(b.x, b.y, 2)) b.life = 0;
          else if (dist(b, p) < 17) {
            combat.hurtPlayer(b);
            b.life = 0;
          }
        }
        b.life -= dt;
      }
      compact(s.enemyShots, isLive);
      updateProjectiles(shotContext, s, s.shots, dt);
      for (const codeToken of s.codes) {
        const d = dist(codeToken, p);
        if (d < st.magnet && world.arena.clear(codeToken, p, 2)) {
          const step = Math.min(d, 230 * dt);
          codeToken.x += ((p.x - codeToken.x) / Math.max(1, d)) * step;
          codeToken.y += ((p.y - codeToken.y) / Math.max(1, d)) * step;
        }
        if (dist(codeToken, p) < 20) {
          s.earned += wallet.earn(codeToken.value);
          codeToken.dead = true;
          if (codeToken.event) runEvents?.collectCode(s);
          s.texts.push({ x: p.x, y: p.y - 30, v: '+' + codeToken.value + ' кодов', life: 1 });
        }
      }
      compact(s.codes, isPresent);
      const mag = st.magnet;
      for (const gem of s.gems) {
        if (gem.dead) continue;
        const dx = p.x - gem.x,
          dy = p.y - gem.y;
        // A magnet pickup pulls every gem on the map (`pull`).
        if (!gem.pull && (Math.abs(dx) > mag || Math.abs(dy) > mag)) continue;
        const d = Math.hypot(dx, dy);
        if (gem.pull || d < mag) {
          const speed = gem.pull ? 900 : 270 + 200 * (1 - d / mag);
          const step = Math.min(d, speed * dt);
          const invD = 1 / Math.max(1, d);
          gem.x += dx * invD * step;
          gem.y += dy * invD * step;
        }
        if (d < 19) {
          s.xp += gem.v;
          gem.dead = true;
          audio.effect('pickup');
        }
      }
      compact(s.gems, isPresent);
      // Merge nearby old drops when needed, retaining all earned experience.
      if (s.gems.length > 500) {
        const grid = new Map();
        for (const g of s.gems) {
          const key = (Math.floor(g.x / 50) & 0xffff) | ((Math.floor(g.y / 50) & 0xffff) << 16);
          const existing = grid.get(key);
          if (existing) existing.v += g.v;
          else grid.set(key, g);
        }
        s.gems = [...grid.values()];
      }
      for (const item of s.pickups)
        if (!item.dead && dist(item, p) < 25) {
          item.dead = true;
          pickUp(s, item, st);
        }
      compact(s.pickups, isPresent);
      compact(s.enemies, isAlive);
      for (const f of s.fx) {
        f.life -= dt;
        if (f.kind === 'spark') {
          f.x += f.vx * dt;
          f.y += f.vy * dt;
        }
      }
      compact(s.fx, isLive);
      for (const t of s.texts) {
        t.life -= dt;
        t.y -= dt * 35;
      }
      compact(s.texts, isLive);
      const room = currentRoom(s);
      if (room) {
        const [left, top, right, bottom] = room.bounds;
        p.x = clamp(p.x, left + 14, right - 14);
        p.y = clamp(p.y, top + 14, bottom - 14);
      }
      if (p.hp <= 0) {
        p.hp = 0;
        events.finish(false);
      } else if (s.bossDead) events.finish(true);
      else if (s.xp >= s.need) events.levelUp();
    }
    return { update };
  },
};
