import { weaponDefinitions } from '../../../data/weapons.js';

// Straight lines of damage from the hero, left and right; an evolution's `directions`
// replaces the pair of directions.
const sides = [
  [1, 0],
  [-1, 0],
];

export const beam = {
  fire(c, s, w, v, st, evo) {
    const length = v.length * st.range,
      width = v.width * st.range;
    for (const [dx, dy] of evo?.directions ?? sides) {
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const along = (e.x - s.p.x) * dx + (e.y - s.p.y) * dy,
          side = Math.abs((e.x - s.p.x) * dy - (e.y - s.p.y) * dx);
        if (along < -e.r || along > length + e.r || side > width / 2 + e.r) continue;
        c.damage(e, v.damage * st.damage, dx * 90, dy * 90, s.p, w.id);
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
