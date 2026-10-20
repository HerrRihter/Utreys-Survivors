import { weaponDefinitions } from '../../../data/weapons.js';

const TAU = Math.PI * 2;

// Boomerangs that hit on the way out and back. An evolution with `persist` keeps exactly
// `count` of them alive for good; with `collect` they relaunch at the hero and carry the
// experience within `reach` to the hero.
export const boomerang = {
  fire(c, s, w, v, st, evo) {
    if (evo?.persist) {
      let live = 0;
      for (const f of s.wfx) if (f.kind === 'boomerang' && f.tag === w.id) live++;
      if (live >= v.count) return;
    }
    for (let i = 0; i < v.count; i++) {
      const target = c.nearest(s, s.p.x, s.p.y, 480);
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
        life: evo?.persist ? Infinity : 3,
        r: v.size * st.range,
        damage: v.damage * st.damage,
        hit: new Set(),
        collect: evo?.collect ?? null,
        speed: v.speed,
        spin: 0,
        color: weaponDefinitions[w.id].color,
      });
    }
  },
  effects: {
    boomerang(c, s, f, dt) {
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
            const target = c.nearest(s, s.p.x, s.p.y, 480);
            const a = target ? Math.atan2(target.y - s.p.y, target.x - s.p.x) : c.math.rand(0, TAU);
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
        c.damage(e, f.damage, f.vx * 0.15, f.vy * 0.15, { x: f.x, y: f.y }, f.tag);
      }
      if (f.collect) {
        const reach = f.collect.reach;
        for (const g of s.gems)
          if (Math.abs(g.x - f.x) < reach && Math.abs(g.y - f.y) < reach) {
            g.x = s.p.x;
            g.y = s.p.y;
          }
      }
    },
  },
};
