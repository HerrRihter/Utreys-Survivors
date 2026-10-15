import { updateEnemySpeech } from './enemy-speech.js';
import { compact } from '../core/compact.js';
import { resolveEnemyStrike } from './enemy-attacks.js';

const isLive = (item) => item.life > 0,
  isPresent = (item) => !item.dead,
  isAlive = (actor) => actor.hp > 0;
export const Simulation = {
  create(sessionContext) {
    function update(dt) {
      const s = sessionContext.state,
        p = s.p;
      const abilityMoving = sessionContext.abilities.protectedMove();
      s.t += dt;
      sessionContext.abilities.update(dt);
      const st = sessionContext.abilities.effectiveStats();
      s.step += dt;
      s.corpses = sessionContext.Corpses.update(s.corpses, dt);
      s.shake = sessionContext.Math.max(0, s.shake - dt * 20);
      p.inv = sessionContext.Math.max(0, p.inv - dt);
      p.hp = sessionContext.Math.min(p.max, p.hp + st.regen * dt);
      let mx =
          (sessionContext.keys.has('KeyD') || sessionContext.keys.has('ArrowRight') ? 1 : 0) -
          (sessionContext.keys.has('KeyA') || sessionContext.keys.has('ArrowLeft') ? 1 : 0) +
          sessionContext.stick.x,
        my =
          (sessionContext.keys.has('KeyS') || sessionContext.keys.has('ArrowDown') ? 1 : 0) -
          (sessionContext.keys.has('KeyW') || sessionContext.keys.has('ArrowUp') ? 1 : 0) +
          sessionContext.stick.y;
      if (p.stun > 0 || abilityMoving) {
        mx = 0;
        my = 0;
      }
      const ml = sessionContext.Math.hypot(mx, my);
      if (ml > 1) {
        mx /= ml;
        my /= ml;
      }
      if (ml > 0.05) {
        p.facing = {
          x: mx / sessionContext.Math.hypot(mx, my),
          y: my / sessionContext.Math.hypot(mx, my),
        };
        if (sessionContext.Math.abs(mx) > 0.01) p.flip = mx < 0;
      }
      const oldX = p.x,
        oldY = p.y;
      sessionContext.Arena.move(p, mx * p.speed * st.speed * dt, my * p.speed * st.speed * dt, 14);
      p.x = sessionContext.clamp(p.x, 52, sessionContext.WORLD - 52);
      p.y = sessionContext.clamp(p.y, 100, sessionContext.WORLD - 12);
      const travel = sessionContext.Math.hypot(p.x - oldX, p.y - oldY);
      p.moving = travel > 0.01;
      p.walk = (p.walk || 0) + travel / 55;
      sessionContext.updateSpawning(dt);
      if (p.hurt) {
        p.hurt.elapsed += dt;
        if (p.hurt.elapsed >= p.hurt.duration) p.hurt = null;
      }
      if (p.action) {
        p.action.direction = { ...p.facing };
        p.action.flip = sessionContext.Math.abs(p.facing.x) > 0.01 ? p.facing.x < 0 : p.flip;
      }
      sessionContext.advanceAction(p, dt, sessionContext.heroImpact);
      const heroSpec = sessionContext.Heroes.defs[sessionContext.selected];
      s.attack -= dt;
      if (
        !sessionContext.abilities.blocksAttack() &&
        !heroSpec.passive &&
        s.attack <= 0 &&
        !p.action &&
        !(p.stun > 0)
      ) {
        s.attack = sessionContext.Math.max(
          0.22,
          heroSpec.interval / (st.haste * (1 + (st.punchTempo || 0))),
        );
        const dir = { ...p.facing };
        s.attackCycle = s.attack;
        sessionContext.beginAction(
          p,
          sessionContext.Math.max(0.18, heroSpec.wind / (st.haste * (1 + (st.punchTempo || 0)))),
          { x: p.x + dir.x, y: p.y + dir.y },
        );
        p.action.direction = dir;
        p.action.flip = sessionContext.Math.abs(dir.x) > 0.01 ? dir.x < 0 : p.flip;
      }
      s.ring -= dt;
      if (s.ring <= 0 && !(p.stun > 0)) {
        s.ring = 1.25 / st.haste;
        if (st.orbit) {
          const r = 100 + st.orbit * 10;
          s.fx.push({ kind: 'ring', x: p.x, y: p.y - 8, r, life: 0.45, max: 0.45 });
          for (const e of s.enemies)
            if (sessionContext.dist(e, p) < r + e.r)
              sessionContext.damage(e, 12 * st.orbit * st.damage);
          sessionContext.soundEffect('magic');
        }
      }
      for (const e of s.enemies) {
        if (e.hp <= 0 || e.abilityStun > 0) continue;
        const u = sessionContext.Enemies.units[e.unit],
          d = sessionContext.dist(e, p);
        e.hit = sessionContext.Math.max(0, e.hit - dt);
        if (e.visualHurt) {
          e.visualHurt.elapsed += dt;
          if (e.visualHurt.elapsed >= e.visualHurt.duration) e.visualHurt = null;
        }
        e.cd -= dt;
        if (e.hurt) {
          e.hurt.elapsed += dt;
          if (e.hurt.elapsed >= e.hurt.duration) e.hurt = null;
        }
        e.vx *= sessionContext.Math.exp(-9 * dt);
        e.vy *= sessionContext.Math.exp(-9 * dt);
        if (!e.action && !e.charge) {
          const target = sessionContext.Math.atan2(p.y - e.y, p.x - e.x),
            delta = sessionContext.Math.atan2(
              sessionContext.Math.sin(target - e.heading),
              sessionContext.Math.cos(target - e.heading),
            );
          e.heading += sessionContext.clamp(
            delta,
            -dt * (e.r > 30 ? 0.8 : 6),
            dt * (e.r > 30 ? 0.8 : 6),
          );
        }
        e.animationTime = s.t;
        sessionContext.advanceAction(e, dt, (a) => resolveEnemyStrike(sessionContext, e, u, a.aim));
        if (
          !e.action &&
          !e.hurt &&
          e.cd <= 0 &&
          d < u.range &&
          sessionContext.Arena.clear(e, p, 2)
        ) {
          sessionContext.beginAction(e, u.wind, p);
          e.cd = u.cooldown;
          e.heading = sessionContext.Math.atan2(p.y - e.y, p.x - e.x);
        }
        const moving =
            !e.action && !e.hurt && d > (u.attack === 'projectile' ? u.range - 20 : e.r + 10),
          speed = e.speed * (1 + s.t / 1800) * (1 - (e.abilitySlow || 0)),
          dir = moving ? sessionContext.Arena.direction(e, p, e.r) : null,
          ox = e.x,
          oy = e.y;
        sessionContext.Arena.move(
          e,
          (moving ? dir.x * speed * dt : 0) + e.vx * dt,
          (moving ? dir.y * speed * dt : 0) + e.vy * dt,
          e.r,
        );
        const travel = sessionContext.Math.hypot(e.x - ox, e.y - oy);
        e.moving = travel > 0.01;
        e.walk = (e.walk || e.phase / 6) + travel / 50;
      }
      for (const b of s.enemyShots) {
        b.age = (b.age || 0) + dt;
        const n = sessionContext.Math.max(
          1,
          sessionContext.Math.ceil((sessionContext.Math.hypot(b.vx, b.vy) * dt) / 8),
        );
        for (let i = 0; i < n && b.life > 0; i++) {
          b.x += (b.vx * dt) / n;
          b.y += (b.vy * dt) / n;
          if (sessionContext.Arena.blocked(b.x, b.y, 2)) b.life = 0;
          else if (sessionContext.dist(b, p) < 17) {
            sessionContext.hurtPlayer(b);
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
        b.age = (b.age || 0) + dt;
        b.angle += dt * 4.5;
        for (const e of s.enemies) {
          if (
            e.hp > 0 &&
            !b.hit.has(e) &&
            sessionContext.Math.hypot(e.x - b.x, e.y - 10 - b.y) < e.r + b.r
          ) {
            b.hit.add(e);
            const impulse =
              b.push === undefined ? 0.25 : b.push / Math.max(1, Math.hypot(b.vx, b.vy));
            sessionContext.damage(e, b.damage, b.vx * impulse, b.vy * impulse, {
              x: e.x - b.vx,
              y: e.y - b.vy,
            });
          }
        }
      }
      compact(s.shots, isLive);
      for (const codeToken of s.codes) {
        const d = sessionContext.dist(codeToken, p);
        if (d < st.magnet && sessionContext.Arena.clear(codeToken, p, 2)) {
          const step = sessionContext.Math.min(d, 230 * dt);
          codeToken.x += ((p.x - codeToken.x) / sessionContext.Math.max(1, d)) * step;
          codeToken.y += ((p.y - codeToken.y) / sessionContext.Math.max(1, d)) * step;
        }
        if (sessionContext.dist(codeToken, p) < 20) {
          s.earned += sessionContext.Progression.earn(codeToken.value);
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
        if (sessionContext.Math.abs(dx) > mag || sessionContext.Math.abs(dy) > mag) continue;
        const d = sessionContext.Math.hypot(dx, dy);
        if (d < mag) {
          const speed = 270 + 200 * (1 - d / mag);
          const step = sessionContext.Math.min(d, speed * dt);
          const invD = 1 / sessionContext.Math.max(1, d);
          gem.x += dx * invD * step;
          gem.y += dy * invD * step;
        }
        if (d < 19) {
          s.xp += gem.v;
          gem.dead = true;
          sessionContext.soundEffect('pickup');
        }
      }
      compact(s.gems, isPresent);
      // Merge nearby old drops when needed, retaining all earned experience.
      if (s.gems.length > 500) {
        const grid = new Map();
        for (const g of s.gems) {
          const key =
            (sessionContext.Math.floor(g.x / 50) & 0xffff) |
            ((sessionContext.Math.floor(g.y / 50) & 0xffff) << 16);
          const existing = grid.get(key);
          if (existing) existing.v += g.v;
          else grid.set(key, g);
        }
        s.gems = [...grid.values()];
      }
      for (const item of s.pickups)
        if (!item.dead && sessionContext.dist(item, p) < 25) {
          p.hp = sessionContext.Math.min(p.max, p.hp + 25);
          item.dead = true;
          s.texts.push({ x: p.x, y: p.y - 30, v: '+25 ♥', life: 1 });
          sessionContext.soundEffect('heal');
        }
      compact(s.pickups, isPresent);
      compact(s.enemies, isAlive);
      updateEnemySpeech(sessionContext);
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
        sessionContext.finish(false);
      } else if (s.bossDead) sessionContext.finish(true);
      else if (s.xp >= s.need) sessionContext.levelUp();
      sessionContext.hud();
    }
    return { update };
  },
};
