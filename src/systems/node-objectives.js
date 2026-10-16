import { nodeDefinitions, workaroundSeconds, workaroundRadius } from '../../data/enemies/nodes.js';

// `seconds` is the workaround time on this run's load level.
export function createNodeState(seconds = workaroundSeconds) {
  return nodeDefinitions.map((node) => ({
    ...node,
    need: seconds,
    status: 'guarded',
    progress: 0,
    guardian: null,
  }));
}

export function allNodesResolved(state) {
  return (
    state.nodes?.length === nodeDefinitions.length &&
    state.nodes.every((node) => node.status === 'destroyed' || node.status === 'workaround')
  );
}

export function updateNodes(context, dt) {
  const s = context.state;
  for (const node of s.nodes) {
    if (node.status !== 'guarded') continue;
    if (!node.guardian) {
      const guardian = context.spawn(node.bug, false, { x: node.x + 110, y: node.y });
      if (!guardian) continue;
      guardian.nodeId = node.id;
      node.guardian = guardian;
    }
    if (node.guardian.hp <= 0) {
      node.status = 'destroyed';
      context.toast(node.id + ': баг уничтожен');
      continue;
    }
    // Standing at a component researches a workaround on both desktop and touch devices.
    const near = Math.hypot(s.p.x - node.x, s.p.y - node.y) <= workaroundRadius;
    const need = node.need ?? workaroundSeconds;
    node.progress = near && !s.p.hurt ? Math.min(need, node.progress + dt) : 0;
    if (node.progress >= need) {
      node.status = 'workaround';
      // Bypassing a bug grants no kill, XP, boss reward or corpse.
      s.enemies = s.enemies.filter((enemy) => enemy !== node.guardian);
      context.toast(node.id + ': воркэраунд найден');
    }
  }
}
