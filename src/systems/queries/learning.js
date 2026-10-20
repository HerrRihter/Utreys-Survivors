import { mapDefinitions } from '../../../data/maps/maps.js';
import { learningRules, learningMaze } from '../../../data/learning-rules.js';
import { arenaSize } from '../../world/arenas.js';
import { mazeLayout } from '../../world/maze.js';

// The learning map's room in play: its definition and, for a maze, the layout generated from
// the run's seed (walls, entry, terminals, door). Null on other maps.
export const currentRoom = (s) =>
  mapDefinitions[s?.map]?.rooms?.[s.learning?.roomIndex ?? 0] ?? null;
export const mazeRooms = (map) => (mapDefinitions[map]?.rooms || []).filter((room) => room.maze);
export function roomLayout(map, seed, roomIndex) {
  const room = mapDefinitions[map]?.rooms?.[roomIndex];
  if (!room) return null;
  if (!room.maze) return { walls: room.racks || [], entry: room.entry, boss: room.boss };
  return mazeLayout({ ...learningMaze, size: arenaSize }, seed, roomIndex);
}
export const currentLayout = (s) =>
  s?.learning ? roomLayout(s.map, s.seed, s.learning.roomIndex) : null;

// Terminals of the room in play; the other rooms' terminals share the arena's coordinates.
export const roomNodes = (s) =>
  s?.learning ? s.nodes.filter((n) => n.room === s.learning.roomIndex) : s?.nodes || [];

export const nearLearning = (s, point) =>
  !!point && Math.hypot(s.p.x - point.x, s.p.y - point.y) <= learningRules.interactionRadius;
export const availableTerminal = (s, id) =>
  s?.learning &&
  roomNodes(s).find((n) => n.id === id && n.status === 'available' && nearLearning(s, n));

// A maze's door opens once every terminal in it is passed.
export function doorOpen(s) {
  if (!currentRoom(s)?.maze) return false;
  const terminals = roomNodes(s);
  return terminals.length > 0 && terminals.every((n) => n.status === 'completed');
}
export const availableExit = (s) => doorOpen(s) && nearLearning(s, currentLayout(s).exit);

// Whether the HUD offers a test or the door right now.
export const learningActionNear = (s) =>
  !!s?.learning && (roomNodes(s).some((n) => availableTerminal(s, n.id)) || availableExit(s));
