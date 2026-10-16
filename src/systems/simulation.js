import { updateEnemySpeech } from './enemy-speech.js';
import { compact } from '../core/compact.js';
import { resolveEnemyStrike } from './enemy-attacks.js';
import { advanceAction } from '../core/action-timeline.js';
import { protectedMove, blocksAttack, effectiveStats, pacified } from './ability-state.js';
import { countCrowd } from './hero-passives.js';
import { defaultBindings } from '../app/run-state.js';

const isLive = (item) => item.life > 0,
  isPresent = (item) => !item.dead,
  isAlive = (actor) => actor.hp > 0;
// One fixed step of a run: movement, attacks, enemies, projectiles, pickups and effects.
// `events.finish(win)` / `events.levelUp()` hand control back to the game flow.
export const Simulation = {
  create({
    run,
    view,
    world,
    heroes,
    enemies,
    corpses,
    progression,
    audio,
    math,
    abilities,
    combat,
    spawning,
    weapons,
    settings,
    events,
  }) {
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const fragments = [];
    const strike = {
      get arena() {
        return world.arena;
      },
      effect: (name) => audio.effect(name),
      hurtPlayer: (e) => combat.hurtPlayer(e),
    };
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
      p.hp = Math.min(p.max, p.hp + st.regen * (s.healFactor ?? 1) * dt);
      const keys = settings?.bindings || defaultBindings,
        held = (action, arrow) => (run.keys.has(keys[action]) || run.keys.has(arrow) ? 1 : 0);
      let mx = held('right', 'ArrowRight') - held('left', 'ArrowLeft') + run.stick.x,
        my = held('down', 'ArrowDown') - held('up', 'ArrowUp') + run.stick.y;
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
      world.arena.move(p, mx * p.speed * st.speed * dt, my * p.speed * st.speed * dt, 14);
      p.x = math.clamp(p.x, 52, world.arena.size - 52);
      p.y = math.clamp(p.y, 100, world.arena.size - 12);
      const travel = Math.hypot(p.x - oldX, p.y - oldY);
      p.moving = travel > 0.01;
      p.walk = (p.walk || 0) + travel / 55;
      spawning.updateSpawning(dt);
      s.crowd = countCrowd(s);
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
      const heroSpec = heroes.defs[run.selected];
      s.attack -= dt;
      if (!blocksAttack(s) && s.attack <= 0 && !p.action) {
        s.attack = Math.max(0.22, heroSpec.interval / (st.haste * (1 + (st.punchTempo || 0))));
        const dir = { ...p.facing };
        s.attackCycle = s.attack;
        combat.beginAction(
          p,
          Math.max(0.18, heroSpec.wind / (st.haste * (1 + (st.punchTempo || 0)))),
          { x: p.x + dir.x, y: p.y + dir.y },
        );
        p.action.direction = dir;
        p.action.flip = Math.abs(dir.x) > 0.01 ? dir.x < 0 : p.flip;
      }
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.abilityStun > 0) continue;
        const u = enemies.units[e.unit],
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
        if (!e.action && !e.charge) {
          const target = Math.atan2(p.y - e.y, p.x - e.x),
            delta = Math.atan2(Math.sin(target - e.heading), Math.cos(target - e.heading));
          e.heading += math.clamp(delta, -dt * (e.r > 30 ? 0.8 : 6), dt * (e.r > 30 ? 0.8 : 6));
        }
        e.animationTime = s.t;
        advanceAction(e, dt, (a) => resolveEnemyStrike(strike, s, e, u, a.aim));
        if (
          !e.action &&
          !e.hurt &&
          e.cd <= 0 &&
          d < u.range &&
          !pacified(s, e) &&
          world.arena.clear(e, p, 2)
        ) {
          combat.beginAction(e, u.wind, p);
          e.cd = u.cooldown;
          e.heading = Math.atan2(p.y - e.y, p.x - e.x);
        }
        const moving =
            !e.action && !e.hurt && d > (u.attack === 'projectile' ? u.range - 20 : e.r + 10),
          speed =
            e.speed *
            (1 + s.t / 1800) *
            (1 - (e.abilitySlow || 0)) *
            (e.weaponSlowUntil > s.t ? 0.65 : 1),
          dir = moving ? world.arena.direction(e, p, e.r) : null,
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
      for (const b of s.enemyShots) {
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
      for (const b of s.shots) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.life -= dt;
        // Serialization evolution: a packet ends by splitting into three fragments.
        if (b.life <= 0 && b.split) {
          b.split = false;
          const a = Math.atan2(b.vy, b.vx),
            v = Math.hypot(b.vx, b.vy);
          for (const turn of [-0.45, 0, 0.45])
            fragments.push({
              ...b,
              vx: Math.cos(a + turn) * v,
              vy: Math.sin(a + turn) * v,
              life: 0.45,
              damage: b.damage * 0.6,
              hit: new Set(),
              split: false,
            });
        }
        b.age = (b.age || 0) + dt;
        b.angle += dt * 4.5;
        for (const e of s.enemies) {
          if (e.hp > 0 && !b.hit.has(e) && Math.hypot(e.x - b.x, e.y - 10 - b.y) < e.r + b.r) {
            b.hit.add(e);
            const impulse =
              b.push === undefined ? 0.25 : b.push / Math.max(1, Math.hypot(b.vx, b.vy));
            combat.damage(
              e,
              b.damage,
              b.vx * impulse,
              b.vy * impulse,
              { x: e.x - b.vx, y: e.y - b.vy },
              b.tag,
            );
          }
        }
      }
      compact(s.shots, isLive);
      if (fragments.length) {
        for (const f of fragments) s.shots.push(f);
        fragments.length = 0;
      }
      for (const codeToken of s.codes) {
        const d = dist(codeToken, p);
        if (d < st.magnet && world.arena.clear(codeToken, p, 2)) {
          const step = Math.min(d, 230 * dt);
          codeToken.x += ((p.x - codeToken.x) / Math.max(1, d)) * step;
          codeToken.y += ((p.y - codeToken.y) / Math.max(1, d)) * step;
        }
        if (dist(codeToken, p) < 20) {
          s.earned += progression.earn(codeToken.value);
          codeToken.dead = true;
          s.texts.push({ x: p.x, y: p.y - 30, v: '+' + codeToken.value + ' кодов', life: 1 });
        }
      }
      compact(s.codes, isPresent);
      const mag = st.magnet;
      for (const gem of s.gems) {
        if (gem.dead) continue;
        const dx = p.x - gem.x,
          dy = p.y - gem.y;
        if (Math.abs(dx) > mag || Math.abs(dy) > mag) continue;
        const d = Math.hypot(dx, dy);
        if (d < mag) {
          const speed = 270 + 200 * (1 - d / mag);
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
          const heal = Math.round(25 * (s.healFactor ?? 1));
          p.hp = Math.min(p.max, p.hp + heal);
          item.dead = true;
          s.texts.push({ x: p.x, y: p.y - 30, v: '+' + heal + ' ♥', life: 1 });
          audio.effect('heal');
        }
      compact(s.pickups, isPresent);
      compact(s.enemies, isAlive);
      updateEnemySpeech(s, view, world.arena.size);
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
      if (p.hp <= 0) {
        p.hp = 0;
        events.finish(false);
      } else if (s.bossDead) events.finish(true);
      else if (s.xp >= s.need) events.levelUp();
    }
    return { update };
  },
};
