import { mapDefinitions } from '../../../data/maps/maps.js';
import { learningRules } from '../../../data/learning-rules.js';

export const currentRoom = (s) =>
  mapDefinitions[s?.map]?.rooms?.[s.learning?.roomIndex ?? 0] ?? null;
export function inRoom(room, x, y, radius = 0) {
  if (!room) return true;
  const [left, top, right, bottom] = room.bounds;
  return x - radius >= left && x + radius <= right && y - radius >= top && y + radius <= bottom;
}
export const nearLearning = (s, point) =>
  !!point && Math.hypot(s.p.x - point.x, s.p.y - point.y) <= learningRules.interactionRadius;
export const availableTerminal = (s, id) =>
  s?.learning &&
  s.nodes.find(
    (n) =>
      n.id === id &&
      n.room === s.learning.roomIndex &&
      n.status === 'available' &&
      nearLearning(s, n),
  );
export function availableExit(s) {
  const room = currentRoom(s);
  return (
    !!room?.exit &&
    nearLearning(s, room.exit) &&
    s.nodes.some((n) => n.room === s.learning.roomIndex && n.required && n.status === 'completed')
  );
}
