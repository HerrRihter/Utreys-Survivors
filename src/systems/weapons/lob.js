import { weaponDefinitions } from '../../../data/weapons.js';

const TAU = Math.PI * 2;

// Piercing labels thrown up in an arc ahead of the hero; an evolution's `fan` throws `count`
// of them straight out in every direction instead.
export const lob = {
  fire(c, s, w, v, st, evo) {
    const color = weaponDefinitions[w.id].color;
    const fan = evo?.fan;
    if (fan) {
      for (let i = 0; i < fan.count; i++) {
        const a = (i / fan.count) * TAU;
        s.wfx.push({
          kind: 'label',
          tag: w.id,
          x: s.p.x,
          y: s.p.y - 12,
          vx: Math.cos(a) * fan.speed,
          vy: Math.sin(a) * fan.speed,
          gravity: 0,
          life: fan.life,
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
    c.audio.effect('throw');
  },
};
