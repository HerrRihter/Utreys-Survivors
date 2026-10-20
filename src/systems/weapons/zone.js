import { weaponDefinitions } from '../../../data/weapons.js';

const TAU = Math.PI * 2;

// Damage zones on the ground near enemies, ticking every `tick` seconds. An evolution may
// widen them (`radiusFactor`) and heal the hero inside by `heal` HP per second.
export const zone = {
  fire(c, s, w, v, st, evo) {
    for (let i = 0; i < v.count; i++) {
      const target = c.nearest(s, s.p.x + s.rng.rand(-60, 60), s.p.y + s.rng.rand(-60, 60), 260);
      const a = s.rng.rand(0, TAU),
        d = s.rng.rand(40, 150);
      s.wfx.push({
        kind: 'zone',
        tag: w.id,
        x: target ? target.x : s.p.x + Math.cos(a) * d,
        y: target ? target.y : s.p.y + Math.sin(a) * d,
        radius: v.radius * st.range * (evo?.radiusFactor ?? 1),
        life: v.life,
        max: v.life,
        tick: 0,
        every: v.tick,
        damage: v.damage * st.damage,
        heal: evo?.heal ?? 0,
        color: weaponDefinitions[w.id].color,
      });
    }
  },
  effects: {
    zone(c, s, f, dt) {
      f.life -= dt;
      f.tick -= dt;
      if (f.tick <= 0) {
        f.tick = f.every;
        c.hitArea(s, f.x, f.y, f.radius, f.damage, 0, f.tag);
      }
      if (f.heal && Math.hypot(s.p.x - f.x, s.p.y - f.y) < f.radius)
        s.p.hp = Math.min(s.p.max, s.p.hp + f.heal * s.healFactor * dt);
    },
  },
};
