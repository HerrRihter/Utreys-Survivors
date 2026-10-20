import { weaponDefinitions } from '../../../data/weapons.js';

const TAU = Math.PI * 2;

// Homing shots toward the nearest enemy; an evolution's `split` breaks each shot on its hit.
export const seeker = {
  fire(c, s, w, v, st, evo) {
    const count = v.count;
    for (let i = 0; i < count; i++) {
      const target = c.nearest(s, s.p.x, s.p.y, 520);
      const a = target
        ? Math.atan2(target.y - s.p.y, target.x - s.p.x) + (i - (count - 1) / 2) * 0.35
        : c.math.rand(0, TAU);
      s.wfx.push({
        kind: 'seeker',
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
        split: evo?.split ?? null,
        color: weaponDefinitions[w.id].color,
      });
    }
    c.audio.effect('throw');
  },
  effects: {
    seeker(c, s, f, dt, spawned) {
      if (!f.target || f.target.hp <= 0) f.target = c.nearest(s, f.x, f.y, 420);
      if (f.target) {
        const want = Math.atan2(f.target.y - 10 - f.y, f.target.x - f.x),
          have = Math.atan2(f.vy, f.vx);
        const turn = Math.atan2(Math.sin(want - have), Math.cos(want - have));
        const a = have + c.math.clamp(turn, -7 * dt, 7 * dt);
        f.vx = Math.cos(a) * f.speed;
        f.vy = Math.sin(a) * f.speed;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.life -= dt;
      for (const e of s.enemies) {
        if (e.hp <= 0 || e === f.ignore) continue;
        if (Math.hypot(e.x - f.x, e.y - 10 - f.y) > e.r + f.r) continue;
        c.damage(e, f.damage, f.vx * 0.15, f.vy * 0.15, { x: f.x, y: f.y }, f.tag);
        f.life = 0;
        if (f.split && !f.child)
          for (const turn of f.split.turns) {
            const a = Math.atan2(f.vy, f.vx) + turn;
            spawned.push({
              ...f,
              vx: Math.cos(a) * f.speed,
              vy: Math.sin(a) * f.speed,
              life: f.split.life,
              damage: f.damage * f.split.damage,
              target: null,
              child: true,
              ignore: e,
            });
          }
        break;
      }
    },
  },
};
