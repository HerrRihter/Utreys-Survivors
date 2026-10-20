import { nodeResolved } from './queries/nodes.js';
import { nodeGuardian } from './queries/nodes.js';
import {
  nodeDefinitions,
  nodeToasts,
  workaroundSeconds,
  workaroundRadius,
} from '../../data/enemies/nodes.js';

// `seconds` is the workaround time on this run's load level; `layout` gives positions and bugs.
// A node is shown by its `label`; components keep their project identifiers as labels.
export function createNodeState(seconds = workaroundSeconds, layout = nodeDefinitions) {
  return layout.map((node) => ({
    ...node,
    label: node.label ?? node.id,
    need: seconds,
    // A learning terminal is guarded in the first maze and locked in the later ones until the
    // hero gets there.
    status: node.kind === 'learning-terminal' && node.room > 0 ? 'locked' : 'guarded',
    progress: 0,
    guardianId: null,
  }));
}

export function allNodesResolved(state) {
  return (
    state.nodes?.length > 0 &&
    state.nodes.filter((node) => node.required !== false).every(nodeResolved)
  );
}

// A bug stands beside its node; a desk is the objective itself; a learning terminal's guard
// stands where its maze put it.
export function guardianPoint(node) {
  return node.guard ?? { x: node.x + (node.kind === 'desk' ? 0 : 110), y: node.y };
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

// A freed node is resolved; a learning terminal opens for its test instead.
function free(node, how, toast) {
  const terminal = node.kind === 'learning-terminal';
  node.status = terminal ? 'available' : how;
  const key = terminal ? 'opened' : node.kind === 'desk' ? 'closed' : how;
  toast(node.label + nodeToasts[key]);
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
      free(node, 'destroyed', context.toast);
      continue;
    }
    // A desk has no workaround: it must be destroyed.
    if (node.kind === 'desk') continue;
    // Standing at a component researches a workaround on both desktop and touch devices.
    const near = Math.hypot(s.p.x - node.x, s.p.y - node.y) <= workaroundRadius;
    const need = node.need ?? workaroundSeconds;
    node.progress = near && !s.p.hurt ? Math.min(need, node.progress + dt) : 0;
    if (node.progress >= need) {
      // Bypassing a bug grants no kill, XP, boss reward or corpse.
      s.enemies = s.enemies.filter((enemy) => enemy !== guardian);
      free(node, 'workaround', context.toast);
    }
  }
}
