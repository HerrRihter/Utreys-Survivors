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
};
