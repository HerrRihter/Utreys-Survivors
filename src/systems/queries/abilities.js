// Read-only questions about running abilities, shared by combat, rendering and the simulation.
// Pure queries over run state: rendering may import this folder (see STRUCTURE-CONTRACT).

// An ability is running from its cast until `endsAt`.
export const abilityRunning = (state, a) => a.left > 0 && state.t < a.endsAt;
export const abilityActive = (state, id) =>
  !!state?.abilities?.some((a) => a.id === id && abilityRunning(state, a));

// While an ability with `protects` runs (the dash) the hero takes no hits, does not strike
// and ignores movement input.
export const protectedMove = (state) =>
  !!state?.abilities?.some((a) => a.protects && abilityRunning(state, a));
export const blocksAttack = protectedMove;

// The run's stats with the `statMods` of every running ability (data/characters/abilities.js):
// `set` replaces a stat; otherwise `mul` scales the stat plus `base` (the stat alone when
// there is no `base`): value = (stat + base) × mul − base.
export function effectiveStats(state) {
  const stats = state.stats;
  let out = stats;
  for (const a of state.abilities || []) {
    if (!a.statMods || !abilityRunning(state, a)) continue;
    if (out === stats) out = { ...stats };
    for (const [key, mod] of Object.entries(a.statMods)) {
      if ('set' in mod) out[key] = mod.set;
      else {
        const base = mod.base ?? 0;
        out[key] = ((out[key] || 0) + base) * (mod.mul ?? 1) - base;
      }
    }
  }
  return out;
}

// Enemies under BA's negotiations walk but do not start attacks.
export const pacified = (state, e) => e.pacifiedUntil > state.t;
