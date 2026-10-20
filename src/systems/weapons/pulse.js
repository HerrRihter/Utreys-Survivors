import { weaponDefinitions } from '../../../data/weapons.js';
import { auraRadius } from '../queries/weapons.js';

// A periodic ring around the hero that knocks enemies back. An evolution's `aura` replaces
// the pulses with a standing aura: damage share `damage` every `every` seconds, enemies
// inside slowed for `slowFor` seconds.
export const pulse = {
  fire(c, s, w, v, st, evo) {
    if (evo?.aura) return;
    const r = v.radius * st.range;
    c.hitArea(s, s.p.x, s.p.y, r, v.damage * st.damage, v.push, w.id);
    s.fx.push({
      kind: 'ring',
      x: s.p.x,
      y: s.p.y - 8,
      r,
      life: 0.35,
      max: 0.35,
      color: weaponDefinitions[w.id].color,
    });
  },
  tick(c, s, w, v, st, evo) {
    const aura = evo?.aura;
    if (!aura) return;
    const r = auraRadius(w, st);
    w.tick = (w.tick || 0) - c.dt;
    const beat = w.tick <= 0;
    if (beat) w.tick = aura.every / st.haste;
    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - s.p.x, e.y - s.p.y) > r + e.r) continue;
      e.weaponSlowUntil = s.t + aura.slowFor;
      if (beat) c.damage(e, v.damage * aura.damage * st.damage, 0, 0, s.p, w.id);
    }
  },
};
