import { mapDefinitions } from '../../../data/maps/maps.js';
import { learningRules, learningMaze } from '../../../data/learning-rules.js';
import { learningCourses } from '../../../data/learning-courses.js';
import { arenaSize } from '../../world/arenas.js';
import { mazeLayout } from '../../world/maze.js';

// The learning map's room in play: its definition and, for a maze, the layout generated from
// the run's seed (walls, entry, terminals, door). Null on other maps.
export const currentRoom = (s) =>
  mapDefinitions[s?.map]?.rooms?.[s.learning?.roomIndex ?? 0] ?? null;
// The course a learning run teaches (chosen with the map, kept in `learning.course`); null on
// other maps.
export const courseOf = (s) => learningCourses[s?.learning?.course] ?? null;
// A room's name: a maze is named by the run's course, the hall by its definition.
export const roomName = (s, index) =>
  courseOf(s)?.rooms[index] ?? mapDefinitions[s?.map]?.rooms?.[index]?.name ?? '';
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
// Seconds a failed terminal stays shut; 0 when it is open.
export const terminalLock = (s, n) => Math.max(0, (n.retryAt ?? 0) - s.t);
export const availableTerminal = (s, id) =>
  s?.learning &&
  roomNodes(s).find(
    (n) => n.id === id && n.status === 'available' && !terminalLock(s, n) && nearLearning(s, n),
  );

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
