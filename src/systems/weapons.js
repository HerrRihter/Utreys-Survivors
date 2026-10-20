import { weaponDefinitions, weaponStats, weaponMaxLevel } from '../../data/weapons.js';
import { compact } from '../core/compact.js';
import { effectiveStats } from './queries/abilities.js';
import { orbitShape, auraRadius } from './queries/weapons.js';

const isLive = (item) => item.life > 0;
const TAU = Math.PI * 2;

// Extra weapons picked up during a run. State lives in `run.state`:
//   weapons: [{ id, level, cd, evolved, phase }] — owned weapons in pickup order (the upgrade
//            system adds and levels them; this system fires and evolves them,
//            rendering/weapons.js draws them)
//   wfx:     live projectiles, mines and zones these weapons spawned
//   evoTokens: bug archives waiting for an eligible weapon
// `damage(e, n, dx, dy, source, tag)` is the combat entry point; `tag` attributes the damage.
export const WeaponSystem = {
  create({ run, world, damage, audio, math }) {
    const passiveRank = (s, id) => s.upgradeRanks?.[id] || 0;

    // Weapons at max level whose passive is owned; the first one waiting is evolved.
    function eligible(s) {
      return s.weapons.filter(
        (w) =>
          !w.evolved &&
          w.level >= weaponMaxLevel &&
          passiveRank(s, weaponDefinitions[w.id].evolution.passive) > 0,
      );
    }
    function tryEvolve() {
      const s = run.state;
      while (s.evoTokens > 0) {
        const w = eligible(s)[0];
        if (!w) return;
        s.evoTokens--;
        w.evolved = true;
        s.evolutions++;
        const evo = weaponDefinitions[w.id].evolution;
        s.texts.push({ x: s.p.x, y: s.p.y - 50, v: 'ЭВОЛЮЦИЯ: ' + evo.name, life: 2 });
        audio.effect('level');
      }
    }
    // A bug archive from a node guardian. It waits until some weapon can use it.
    function grantArchive() {
      run.state.evoTokens++;
      tryEvolve();
    }

    function nearest(s, x, y, maxDistance = Infinity) {
      let best = null,
        bestD = maxDistance;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < bestD) {
          best = e;
          bestD = d;
        }
      }
      return best;
    }
    function hitArea(s, x, y, radius, n, push, tag, filter) {
      let hits = 0;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - x,
          dy = e.y - y,
          d = Math.hypot(dx, dy);
        if (d > radius + e.r) continue;
        if (filter && !filter(e)) continue;
        damage(e, n, (dx / Math.max(1, d)) * push, (dy / Math.max(1, d)) * push, { x, y }, tag);
        hits++;
      }
      return hits;
    }
    const enemyCd = (e, key) => e.wcd?.[key] || 0;
    function setEnemyCd(e, key, until) {
      (e.wcd ||= {})[key] = until;
    }

    const fire = {
      orbit() {},
      homing(s, w, v, st) {
        const count = v.count;
        for (let i = 0; i < count; i++) {
          const target = nearest(s, s.p.x, s.p.y, 520);
          const a = target
            ? Math.atan2(target.y - s.p.y, target.x - s.p.x) + (i - (count - 1) / 2) * 0.35
            : math.rand(0, TAU);
          s.wfx.push({
            kind: 'homing',
            tag: w.id,
            x: s.p.x,
            y: s.p.y - 10,
            vx: Math.cos(a) * v.speed,
            vy: Math.sin(a) * v.speed,
            speed: v.speed,
            life: v.life,
            r: v.size * st.range,
            damage: v.damage * st.damage,
            target,
            split: w.evolved,
            color: weaponDefinitions[w.id].color,
          });
        }
        audio.effect('throw');
      },
      mine(s, w, v, st) {
        const limit = v.limit * (w.evolved ? 2 : 1);
        const drops = v.count * (w.evolved ? 2 : 1);
        let live = 0;
        for (const f of s.wfx) if (f.kind === 'mine' && f.tag === w.id) live++;
        for (let i = 0; i < drops && live < limit; i++, live++)
          s.wfx.push({
            kind: 'mine',
            tag: w.id,
            x: s.p.x + (drops > 1 ? math.rand(-22, 22) : 0),
            y: s.p.y + (drops > 1 ? math.rand(-14, 14) : 0),
            arm: 0.4,
            life: v.life,
            radius: v.radius * st.range,
            damage: v.damage * st.damage,
            chain: w.evolved,
            color: weaponDefinitions[w.id].color,
          });
      },
      ping(s, w, v, st) {
        if (w.evolved) return;
        const r = v.radius * st.range;
        hitArea(s, s.p.x, s.p.y, r, v.damage * st.damage, v.push, w.id);
        s.fx.push({
          kind: 'ring',
          x: s.p.x,
          y: s.p.y - 8,
          r,
          life: 0.35,
          max: 0.35,
          color: '#80deea',
        });
      },
      printer(s, w, v, st) {
        const color = weaponDefinitions[w.id].color;
        if (w.evolved) {
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * TAU;
            s.wfx.push({
              kind: 'label',
              tag: w.id,
              x: s.p.x,
              y: s.p.y - 12,
              vx: Math.cos(a) * 380,
              vy: Math.sin(a) * 380,
              gravity: 0,
              life: 0.9,
              r: v.size * st.range,
              damage: v.damage * st.damage,
              hit: new Set(),
              color,
            });
          }
        } else
          for (let i = 0; i < v.count; i++)
            s.wfx.push({
              kind: 'label',
              tag: w.id,
              x: s.p.x,
              y: s.p.y - 12,
              vx: (i - (v.count - 1) / 2) * 90 + (s.p.flip ? -60 : 60),
              vy: -460,
              gravity: 900,
              life: 1.4,
              r: v.size * st.range,
              damage: v.damage * st.damage,
              hit: new Set(),
              color,
            });
        audio.effect('throw');
      },
      retry(s, w, v, st) {
        if (w.evolved) {
          // Evolved boomerangs persist: keep exactly `count` of them alive.
          let live = 0;
          for (const f of s.wfx) if (f.kind === 'boomerang' && f.tag === w.id) live++;
          if (live >= v.count) return;
        }
        for (let i = 0; i < v.count; i++) {
          const target = nearest(s, s.p.x, s.p.y, 480);
          const a = target
            ? Math.atan2(target.y - s.p.y, target.x - s.p.x) + i * 0.6
            : Math.atan2(s.p.facing.y, s.p.facing.x) + i * 0.6;
          s.wfx.push({
            kind: 'boomerang',
            tag: w.id,
            x: s.p.x,
            y: s.p.y - 10,
            vx: Math.cos(a) * v.speed,
            vy: Math.sin(a) * v.speed,
            out: 0.55,
            back: false,
            life: w.evolved ? Infinity : 3,
            r: v.size * st.range,
            damage: v.damage * st.damage,
            hit: new Set(),
            collect: w.evolved,
            speed: v.speed,
            spin: 0,
            color: weaponDefinitions[w.id].color,
          });
        }
      },
      cache(s, w, v, st) {
        for (let i = 0; i < v.count; i++) {
          const target = nearest(s, s.p.x + math.rand(-60, 60), s.p.y + math.rand(-60, 60), 260);
          const a = math.rand(0, TAU),
            d = math.rand(40, 150);
          s.wfx.push({
            kind: 'zone',
            tag: w.id,
            x: target ? target.x : s.p.x + Math.cos(a) * d,
            y: target ? target.y : s.p.y + Math.sin(a) * d,
            radius: v.radius * st.range * (w.evolved ? 1.35 : 1),
            life: v.life,
            max: v.life,
            tick: 0,
            every: v.tick,
            damage: v.damage * st.damage,
            heal: w.evolved ? 3 : 0,
            color: weaponDefinitions[w.id].color,
          });
        }
      },
      log(s, w, v, st) {
        const length = v.length * st.range,
          width = v.width * st.range;
        const dirs = w.evolved
          ? [
              [1, 0],
              [-1, 0],
              [0, 1],
              [0, -1],
            ]
          : [
              [1, 0],
              [-1, 0],
            ];
        for (const [dx, dy] of dirs) {
          for (const e of s.enemies) {
            if (e.hp <= 0) continue;
            const along = (e.x - s.p.x) * dx + (e.y - s.p.y) * dy,
              side = Math.abs((e.x - s.p.x) * dy - (e.y - s.p.y) * dx);
            if (along < -e.r || along > length + e.r || side > width / 2 + e.r) continue;
            damage(e, v.damage * st.damage, dx * 90, dy * 90, s.p, w.id);
          }
          s.fx.push({
            kind: 'line',
            x: s.p.x,
            y: s.p.y - 8,
            toX: s.p.x + dx * length,
            toY: s.p.y - 8 + dy * length,
            width,
            life: 0.18,
            max: 0.18,
            color: weaponDefinitions[w.id].color,
          });
        }
      },
    };

    function updateOrbit(s, w, v, st) {
      const { count, radius, size } = orbitShape(w, st),
        rehit = (w.evolved ? 0.3 : v.rehit) / st.haste;
      w.phase += v.spin * (w.evolved ? 1.3 : 1) * dtNow;
      for (let k = 0; k < count; k++) {
        const a = w.phase + (k / count) * TAU,
          x = s.p.x + Math.cos(a) * radius,
          y = s.p.y - 10 + Math.sin(a) * radius;
        for (const e of s.enemies) {
          if (e.hp <= 0 || enemyCd(e, w.id) > s.t) continue;
          if (Math.hypot(e.x - x, e.y - 10 - y) > e.r + size) continue;
          setEnemyCd(e, w.id, s.t + rehit);
          damage(e, v.damage * st.damage, Math.cos(a) * 80, Math.sin(a) * 80, s.p, w.id);
        }
      }
    }
    function updateAura(s, w, v, st) {
      // Firewall: a standing aura that slows and ticks.
      const r = auraRadius(w, st);
      w.tick = (w.tick || 0) - dtNow;
      const pulse = w.tick <= 0;
      if (pulse) w.tick = 0.35 / st.haste;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        if (Math.hypot(e.x - s.p.x, e.y - s.p.y) > r + e.r) continue;
        e.weaponSlowUntil = s.t + 0.2;
        if (pulse) damage(e, v.damage * 0.4 * st.damage, 0, 0, s.p, w.id);
      }
    }

    let dtNow = 0;
    function update(dt) {
      const s = run.state;
      if (!s.weapons) return;
      dtNow = dt;
      if (s.evoTokens > 0) tryEvolve();
      const st = effectiveStats(s);
      for (const w of s.weapons) {
        const v = weaponStats(w.id, w.level);
        if (w.id === 'orbit') updateOrbit(s, w, v, st);
        if (w.id === 'ping' && w.evolved) updateAura(s, w, v, st);
        if (!v.cooldown) continue;
        w.cd -= dt;
        if (w.cd > 0) continue;
        w.cd = Math.max(0.25, v.cooldown / st.haste);
        fire[w.id](s, w, v, st);
      }
      updateEffects(s, dt, st);
    }

    function updateEffects(s, dt) {
      const spawned = [];
      for (const f of s.wfx) {
        if (f.kind === 'homing') {
          if (!f.target || f.target.hp <= 0) f.target = nearest(s, f.x, f.y, 420);
          if (f.target) {
            const want = Math.atan2(f.target.y - 10 - f.y, f.target.x - f.x),
              have = Math.atan2(f.vy, f.vx);
            const turn = Math.atan2(Math.sin(want - have), Math.cos(want - have));
            const a = have + math.clamp(turn, -7 * dt, 7 * dt);
            f.vx = Math.cos(a) * f.speed;
            f.vy = Math.sin(a) * f.speed;
          }
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.life -= dt;
          for (const e of s.enemies) {
            if (e.hp <= 0 || e === f.ignore) continue;
            if (Math.hypot(e.x - f.x, e.y - 10 - f.y) > e.r + f.r) continue;
            damage(e, f.damage, f.vx * 0.15, f.vy * 0.15, { x: f.x, y: f.y }, f.tag);
            f.life = 0;
            if (f.split && !f.child)
              for (const turn of [-0.9, 0, 0.9]) {
                const a = Math.atan2(f.vy, f.vx) + turn;
                spawned.push({
                  ...f,
                  vx: Math.cos(a) * f.speed,
                  vy: Math.sin(a) * f.speed,
                  life: 0.8,
                  damage: f.damage * 0.5,
                  target: null,
                  child: true,
                  ignore: e,
                });
              }
            break;
          }
        } else if (f.kind === 'mine') {
          f.life -= dt;
          f.arm -= dt;
          if (f.arm > 0) continue;
          if (f.trigger === undefined) {
            for (const e of s.enemies)
              if (e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) < e.r + 22) {
                f.trigger = 0;
                break;
              }
          }
          if (f.trigger !== undefined) {
            f.trigger -= dt;
            if (f.trigger <= 0) explode(s, f);
          }
        } else if (f.kind === 'label') {
          f.vy += f.gravity * dt;
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.life -= dt;
          for (const e of s.enemies) {
            if (e.hp <= 0 || f.hit.has(e)) continue;
            if (Math.hypot(e.x - f.x, e.y - 10 - f.y) > e.r + f.r) continue;
            f.hit.add(e);
            damage(e, f.damage, f.vx * 0.1, 40, { x: f.x, y: f.y }, f.tag);
          }
        } else if (f.kind === 'boomerang') {
          f.spin += dt * 14;
          if (!f.back) {
            f.out -= dt;
            if (f.out <= 0) {
              f.back = true;
              f.hit.clear();
            }
          } else {
            const dx = s.p.x - f.x,
              dy = s.p.y - 10 - f.y,
              d = Math.hypot(dx, dy);
            if (d < 24) {
              if (f.collect) {
                // Relaunch toward the nearest enemy instead of despawning.
                const target = nearest(s, s.p.x, s.p.y, 480);
                const a = target
                  ? Math.atan2(target.y - s.p.y, target.x - s.p.x)
                  : math.rand(0, TAU);
                f.vx = Math.cos(a) * f.speed;
                f.vy = Math.sin(a) * f.speed;
                f.back = false;
                f.out = 0.55;
                f.hit.clear();
              } else f.life = 0;
            } else {
              f.vx = (dx / d) * f.speed;
              f.vy = (dy / d) * f.speed;
            }
          }
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          f.life -= dt;
          for (const e of s.enemies) {
            if (e.hp <= 0 || f.hit.has(e)) continue;
            if (Math.hypot(e.x - f.x, e.y - 10 - f.y) > e.r + f.r) continue;
            f.hit.add(e);
            damage(e, f.damage, f.vx * 0.15, f.vy * 0.15, { x: f.x, y: f.y }, f.tag);
          }
          if (f.collect)
            for (const g of s.gems)
              if (Math.abs(g.x - f.x) < 50 && Math.abs(g.y - f.y) < 50) {
                g.x = s.p.x;
                g.y = s.p.y;
              }
        } else if (f.kind === 'zone') {
          f.life -= dt;
          f.tick -= dt;
          if (f.tick <= 0) {
            f.tick = f.every;
            hitArea(s, f.x, f.y, f.radius, f.damage, 0, f.tag);
          }
          if (f.heal && Math.hypot(s.p.x - f.x, s.p.y - f.y) < f.radius)
            s.p.hp = Math.min(s.p.max, s.p.hp + f.heal * s.healFactor * dt);
        }
      }
      for (const f of spawned) s.wfx.push(f);
      compact(s.wfx, isLive);
    }

    function explode(s, f) {
      if (f.life <= 0) return;
      f.life = 0;
      hitArea(s, f.x, f.y, f.radius, f.damage, 160, f.tag);
      s.fx.push({
        kind: 'ring',
        x: f.x,
        y: f.y - 4,
        r: f.radius,
        life: 0.3,
        max: 0.3,
        color: f.color,
      });
      audio.effect('hit');
      if (!f.chain) return;
      for (const other of s.wfx)
        if (
          other.kind === 'mine' &&
          other.life > 0 &&
          other.trigger === undefined &&
          Math.hypot(other.x - f.x, other.y - f.y) < f.radius * 2
        )
          other.trigger = 0.12;
    }

    return { update, grantArchive, eligible: () => eligible(run.state) };
  },
};
