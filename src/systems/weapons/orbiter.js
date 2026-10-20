import { orbitShape } from '../queries/weapons.js';

const TAU = Math.PI * 2;

// Drives circling the hero. Each enemy is hit at most once per `rehit` seconds per weapon;
// an evolution may set `count`, `rehit` and `spinFactor`.
export const orbiter = {
  tick(c, s, w, v, st, evo) {
    const { count, radius, size } = orbitShape(w, st),
      rehit = (evo?.rehit ?? v.rehit) / st.haste;
    w.phase += v.spin * (evo?.spinFactor ?? 1) * c.dt;
    for (let k = 0; k < count; k++) {
      const a = w.phase + (k / count) * TAU,
        x = s.p.x + Math.cos(a) * radius,
        y = s.p.y - 10 + Math.sin(a) * radius;
      for (const e of s.enemies) {
        if (e.hp <= 0 || c.enemyCd(e, w.id) > s.t) continue;
        if (Math.hypot(e.x - x, e.y - 10 - y) > e.r + size) continue;
        c.setEnemyCd(e, w.id, s.t + rehit);
        c.damage(e, v.damage * st.damage, Math.cos(a) * 80, Math.sin(a) * 80, s.p, w.id);
      }
    }
  },
};
