import { weaponStats } from '../../../data/weapons.js';

// Geometry of the weapons that stay around the hero, shared by the weapon system (hits) and
// rendering (what is drawn). `st` is the hero's effective stats.

// The orbiting drives: how many, on which radius and how big.
export function orbitShape(w, st) {
  const v = weaponStats(w.id, w.level);
  return {
    count: w.evolved ? 8 : v.count,
    radius: v.radius * st.range,
    size: v.size * st.range,
  };
}

// The evolved ping's standing firewall aura.
export const auraRadius = (w, st) => weaponStats(w.id, w.level).radius * st.range;
