// Read-only questions about running abilities, shared by combat, rendering and the simulation.
export const abilityActive = (state, id) =>
  !!state?.abilities?.some((a) => a.id === id && a.left > 0 && state.t < a.endsAt);

export const protectedMove = (state) => abilityActive(state, 'dash');
export const blocksAttack = protectedMove;

export function effectiveStats(state) {
  const stats = state.stats;
  if (!abilityActive(state, 'potion')) return stats;
  return {
    ...stats,
    haste: stats.haste * 1.6,
    speed: stats.speed * 1.15,
    punchForce: ((stats.punchForce || 0) + 145) * 1.5 - 145,
  };
}
