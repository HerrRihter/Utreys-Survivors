import { crowdRadius, farDistance, critMultiplier } from '../../data/characters/hero-passives.js';
import { weaponDefinitions } from '../../data/weapons.js';

// Enemies close to the hero, counted once per step for the crowd passive.
export function countCrowd(state) {
  if (!state.stats.crowdPer) return 0;
  const p = state.p;
  let n = 0;
  for (const e of state.enemies)
    if (e.hp > 0 && Math.abs(e.x - p.x) < crowdRadius && Math.abs(e.y - p.y) < crowdRadius)
      if (Math.hypot(e.x - p.x, e.y - p.y) < crowdRadius) n++;
  return n;
}

// Damage after the hero's passive: weapon bonus, crowd, range and critical hits.
// Returns the new amount and whether it was a critical hit.
export function passiveDamage(state, e, n, tag, random) {
  const st = state.stats;
  if (st.weaponBonus && weaponDefinitions[tag]) n *= 1 + st.weaponBonus;
  if (st.crowdPer) n *= 1 + Math.min(st.crowdCap || 0, (state.crowd || 0) * st.crowdPer);
  if (st.farBonus && Math.hypot(e.x - state.p.x, e.y - state.p.y) > farDistance)
    n *= 1 + st.farBonus;
  const chance = (st.crit || 0) + (e.scannedUntil > state.t ? st.scanCrit || 0 : 0);
  const crit = chance > 0 && random() < chance;
  return { n: crit ? n * critMultiplier : n, crit };
}
