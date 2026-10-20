import { mapDefinitions } from '../../data/maps/maps.js';
import { ArenaCollision } from './collision.js';
import { ArenaNavigation } from './navigation.js';

export const arenaDefinitions = mapDefinitions;

// Geometry only: size, racks, collision and navigation. rendering/arena-floor.js draws the floor.
export function createArenas() {
  const cache = {};
  return {
    get(id) {
      if (!Object.hasOwn(arenaDefinitions, id)) id = 'empty';
      return cache[id] || (cache[id] = createDatacenterArena(arenaDefinitions[id]));
    },
  };
}

// Both arenas share the datacenter floor; a map's `racks` become solid server racks.
function createDatacenterArena(map = arenaDefinitions.empty) {
  const size = 2200,
    cell = 25,
    cols = 88,
    racks = map.racks || [],
    objects = racks.map(([x, y, w, h]) => ({ x, y, footprint: [0, 0, w, h] }));
  const collision = ArenaCollision.create(objects, size);
  const navigation = ArenaNavigation.create({
    size,
    cell,
    cols,
    ...collision,
    open: !objects.length,
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
