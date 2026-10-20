import { mapDefinitions, nodeSpacing } from '../../data/maps/maps.js';
import { nodeDefinitions } from '../../data/enemies/nodes.js';
import { createRng, shuffle } from '../core/rng.js';

// Node positions and bug placement for one seed: each node takes its own zone, nodes keep
// `nodeSpacing` apart, and the five bugs are dealt to the nodes in random order. A map with a
// `desks` objective places its structures the same way instead of the nodes.
export function layoutNodes(mapId, seed) {
  const map = mapDefinitions[mapId] || mapDefinitions.empty;
  if (map.objective?.type === 'learning') return layoutTerminals(map.rooms);
  const rng = createRng(seed).random;
  const zones = shuffle(map.nodeZones, rng);
  if (map.objective?.type === 'desks') return layoutDesks(map.objective, zones, rng);
  const bugs = shuffle(
    nodeDefinitions.map((n) => n.bug),
    rng,
  );
  const placed = [];
  for (const [x, y, w, h] of zones) {
    if (placed.length === nodeDefinitions.length) break;
    for (let attempt = 0; attempt < 12; attempt++) {
      const point = { x: Math.round(x + rng() * w), y: Math.round(y + rng() * h) };
      if (placed.every((p) => Math.hypot(p.x - point.x, p.y - point.y) >= nodeSpacing)) {
        placed.push(point);
        break;
      }
    }
  }
  // Too few zones fit (a hand-edited map): fall back to the fixed coordinates.
  if (placed.length < nodeDefinitions.length) return nodeDefinitions.map((n) => ({ ...n }));
  return nodeDefinitions.map((n, i) => ({ ...n, ...placed[i], bug: bugs[i] }));
}

// Desks are `desk-1`, `desk-2`... and shown as the objective's label with their number.
// Learning terminals stand where their rooms put them: the required ones in room order, then
// the optional bonus terminals.
function layoutTerminals(rooms) {
  const terminal = (room, i, spec, required) => ({
    label: room.name,
    ...spec,
    kind: 'learning-terminal',
    required,
    room: i,
    topic: room.topic,
  });
  return [
    ...rooms.flatMap((room, i) => (room.terminal ? [terminal(room, i, room.terminal, true)] : [])),
    ...rooms.flatMap((room, i) => (room.bonus ? [terminal(room, i, room.bonus, false)] : [])),
  ];
}

function layoutDesks({ unit, count, label }, zones, rng) {
  const placed = [];
  for (const [x, y, w, h] of zones) {
    if (placed.length === count) break;
    for (let attempt = 0; attempt < 12; attempt++) {
      const point = { x: Math.round(x + rng() * w), y: Math.round(y + rng() * h) };
      if (placed.every((p) => Math.hypot(p.x - point.x, p.y - point.y) >= nodeSpacing)) {
        placed.push(point);
        break;
      }
    }
  }
  return placed.map((p, i) => ({
    id: 'desk-' + (i + 1),
    label: label + ' ' + (i + 1),
    kind: 'desk',
    bug: unit,
    ...p,
  }));
}

// Event order for one seed: every type once, then repeats, at the schedule's times.
export function planEvents(schedule, seed) {
  const spec = schedule.events;
  if (!spec?.times?.length) return [];
  const rng = createRng(seed ^ 0x9e3779b9).random;
  let order = [];
  while (order.length < spec.times.length) order = order.concat(shuffle(spec.types, rng));
  return spec.times.map((time, i) => ({ time, type: order[i] }));
}
