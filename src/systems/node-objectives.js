import { nodeDefinitions, workaroundSeconds, workaroundRadius } from '../../data/enemies/nodes.js';

export function createNodeState() {
  return nodeDefinitions.map((node) => ({
    ...node,
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
    node.progress = near && !s.p.hurt ? Math.min(workaroundSeconds, node.progress + dt) : 0;
    if (node.progress >= workaroundSeconds) {
      node.status = 'workaround';
      // Bypassing a bug grants no kill, XP, boss reward or corpse.
      s.enemies = s.enemies.filter((enemy) => enemy !== node.guardian);
      context.toast(node.id + ': воркэраунд найден');
    }
  }
}
