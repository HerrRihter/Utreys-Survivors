import { mapDefinitions } from '../../data/maps/maps.js';
import { neonStroke, neon } from '../rendering/neon.js';
import { VillageCollision } from './village/collision.js';
import { VillageNavigation } from './village/navigation.js';

export const arenaDefinitions = mapDefinitions;
export const campLanes = [180, 640, 1100, 1560, 2020];

export function createArenas() {
  const cache = {};
  return {
    get(id) {
      if (!Object.hasOwn(arenaDefinitions, id)) id = 'empty';
      return cache[id] || (cache[id] = createDatacenterArena());
    },
  };
}

function createDatacenterArena() {
  const size = 2200,
    cell = 25,
    cols = 88,
    objects = [],
    roads = [];
  const collision = VillageCollision.create(objects, size);
  const navigation = VillageNavigation.create({ size, cell, cols, ...collision });

  function drawGround(g) {
    // Dark cyber datacenter floor
    g.fillStyle = '#0a1619';
    g.fillRect(0, 0, size, size);

    // Grid lines
    g.strokeStyle = '#122e35';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= size; x += 100) {
      g.moveTo(x, 0);
      g.lineTo(x, size);
    }
    for (let y = 0; y <= size; y += 100) {
      g.moveTo(0, y);
      g.lineTo(size, y);
    }
    g.stroke();

    // Data buses / optical traces
    g.strokeStyle = '#00e5ff33';
    g.lineWidth = 2;
    g.beginPath();
    for (let pos = 200; pos < size; pos += 400) {
      g.moveTo(pos, 0);
      g.lineTo(pos, size);
      g.moveTo(0, pos);
      g.lineTo(size, pos);
    }
    g.stroke();

    // Central Data Processing Core Ring
    g.strokeStyle = '#00e5ff88';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(size / 2, size / 2, 140, 0, Math.PI * 2);
    neonStroke(g, neon.cyan, 2, 8);
    g.strokeStyle = '#ffd60044';
    g.lineWidth = 1.5;
    g.beginPath();
    g.arc(size / 2, size / 2, 220, 0, Math.PI * 2);
    neonStroke(g, '#64ffda66', 1, 5);
  }

  function drawObject() {}

  return {
    size,
    cell,
    cols,
    objects,
    roads,
    houses: [],
    residents: [],
    depthObjects: [],
    collision,
    ...navigation,
    blocked: collision.blocked,
    clear: collision.clear,
    drawGround,
    drawObject,
    draw(g) {
      drawGround(g);
    },
  };
}
