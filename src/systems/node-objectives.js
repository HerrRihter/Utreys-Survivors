import { nodeGuardian } from './queries/nodes.js';
import { nodeDefinitions, workaroundSeconds, workaroundRadius } from '../../data/enemies/nodes.js';

// `seconds` is the workaround time on this run's load level; `layout` gives positions and bugs.
export function createNodeState(seconds = workaroundSeconds, layout = nodeDefinitions) {
  return layout.map((node) => ({
    ...node,
    need: seconds,
    status: 'guarded',
    progress: 0,
    guardianId: null,
  }));
}

export function allNodesResolved(state) {
  return (
    state.nodes?.length > 0 &&
    state.nodes.every((node) => node.status === 'destroyed' || node.status === 'workaround')
  );
}

// A bug stands beside its node; a desk is the objective itself.
export function guardianPoint(node) {
  return { x: node.x + (node.kind === 'desk' ? 0 : 110), y: node.y };
}

// Re-exported for the node logic's callers; rendering imports it from queries directly.
export { nodeGuardian };

// Open tickets: living enemies released by the run's service desks.
export function openTickets(state) {
  const guardians = new Set();
  for (const node of state.nodes) if (node.guardianId !== null) guardians.add(node.guardianId);
  let n = 0;
  for (const e of state.enemies) if (e.hp > 0 && guardians.has(e.summonerId)) n++;
  return n;
}

export function updateNodes(context, dt) {
  const s = context.state;
  for (const node of s.nodes) {
    if (node.status !== 'guarded') continue;
    if (node.guardianId === null) {
      const guardian = context.spawn(node.bug, false, guardianPoint(node));
      if (!guardian) continue;
      guardian.nodeId = node.id;
      node.guardianId = guardian.id;
    }
    // A killed guardian leaves the enemy list at the end of its step.
    const guardian = nodeGuardian(s, node);
    if (!guardian || guardian.hp <= 0) {
      node.status = 'destroyed';
      context.toast(node.id + (node.kind === 'desk' ? ': закрыт' : ': баг уничтожен'));
      continue;
    }
    // A desk has no workaround: it must be destroyed.
    if (node.kind === 'desk') continue;
    // Standing at a component researches a workaround on both desktop and touch devices.
    const near = Math.hypot(s.p.x - node.x, s.p.y - node.y) <= workaroundRadius;
    const need = node.need ?? workaroundSeconds;
    node.progress = near && !s.p.hurt ? Math.min(need, node.progress + dt) : 0;
    if (node.progress >= need) {
      node.status = 'workaround';
      // Bypassing a bug grants no kill, XP, boss reward or corpse.
      s.enemies = s.enemies.filter((enemy) => enemy !== guardian);
      context.toast(node.id + ': воркэраунд найден');
    }
  }
}
