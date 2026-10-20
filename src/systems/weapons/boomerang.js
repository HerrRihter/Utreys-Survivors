import { weaponDefinitions } from '../../../data/weapons.js';

// Boomerangs that hit on the way out and back. An evolution with `persist` keeps exactly
// `count` of them alive for good; `collect` makes them relaunch at the hero and carry the
// experience within `reach` to the hero (see the boomerang projectile).
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
};
