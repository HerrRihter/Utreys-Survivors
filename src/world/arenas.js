import { mapDefinitions } from '../../data/maps/maps.js';
import { ArenaCollision } from './collision.js';
import { ArenaNavigation } from './navigation.js';

export const arenaSize = 2200;

// Geometry only: size, racks, collision and navigation. rendering/arena-floor.js draws the floor.
// `get(id)` is a map's own arena; `forRoom(id, key, racks)` an arena whose walls a run generates
// (the learning map's mazes), cached by `key` while the run plays it.
export function createArenas() {
  const cache = {},
    rooms = new Map();
  return {
    get(id) {
      if (!Object.hasOwn(mapDefinitions, id)) id = 'empty';
      return cache[id] || (cache[id] = createDatacenterArena(mapDefinitions[id].racks));
    },
    forRoom(id, key, racks) {
      if (!rooms.has(key)) {
        if (rooms.size > 3) rooms.clear();
        rooms.set(key, { ...createDatacenterArena(racks), rooms: true });
      }
      return rooms.get(key);
    },
  };
}

// Every arena shares the datacenter floor; `racks` [x, y, w, h] become solid server racks.
function createDatacenterArena(racks = []) {
  const size = arenaSize,
    cell = 25,
    cols = size / cell,
    boxes = racks.map(([x, y, w, h]) => ({ minX: x, minY: y, maxX: x + w, maxY: y + h }));
  const collision = ArenaCollision.create(boxes, size);
  const navigation = ArenaNavigation.create({
    size,
    cell,
    cols,
    ...collision,
    open: !boxes.length,
  });

  return {
    size,
    collision,
    ...navigation,
    blocked: collision.blocked,
    clear: collision.clear,
    racks,
  };
}
