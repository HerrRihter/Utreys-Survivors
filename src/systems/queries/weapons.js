import { weaponDefinitions, weaponStats } from '../../../data/weapons.js';

// Geometry of the weapons that stay around the hero, shared by the weapon system (hits) and
// rendering (what is drawn). `st` is the hero's effective stats.

// The evolution data of an evolved weapon (data/weapons.js `evolution`), else null.
export const weaponEvolution = (w) => (w.evolved ? weaponDefinitions[w.id].evolution : null);

// The orbiting drives: how many, on which radius and how big.
export function orbitShape(w, st) {
  const v = weaponStats(w.id, w.level);
  return {
    count: weaponEvolution(w)?.count ?? v.count,
    radius: v.radius * st.range,
    size: v.size * st.range,
  };
}

// The radius of a standing aura (an evolved pulse) around the hero.
export const auraRadius = (w, st) => weaponStats(w.id, w.level).radius * st.range;
