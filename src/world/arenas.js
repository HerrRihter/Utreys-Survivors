import { mapDefinitions } from '../../data/maps/maps.js';
import { ArenaCollision } from './collision.js';
import { ArenaNavigation } from './navigation.js';

// Geometry only: size, racks, collision and navigation. rendering/arena-floor.js draws the floor.
export function createArenas() {
  const cache = {};
  return {
    get(id) {
      if (!Object.hasOwn(mapDefinitions, id)) id = 'empty';
      return cache[id] || (cache[id] = createDatacenterArena(mapDefinitions[id]));
    },
  };
}

// Both arenas share the datacenter floor; a map's `racks` become solid server racks.
function createDatacenterArena(map = mapDefinitions.empty) {
  const size = 2200,
    cell = 25,
    cols = 88,
    racks = map.racks || [],
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
    rooms: map.rooms || [],
    collision,
    ...navigation,
    blocked: collision.blocked,
    clear: collision.clear,
    racks,
  };
}
