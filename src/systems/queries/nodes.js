// The enemy standing at a node; null before it is spawned and once it is gone.
export function nodeGuardian(state, node) {
  if (node.guardianId === null) return null;
  for (const e of state.enemies) if (e.id === node.guardianId) return e;
  return null;
}
