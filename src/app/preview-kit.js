import { mapDefinitions } from '../../data/maps/maps.js';
import { unitDefinitions, enemyDamageScale, enemyHpScale } from '../../data/enemies/units.js';
import { createArenas } from '../world/arenas.js';
import { createNodeState } from '../systems/node-objectives.js';
import { getWaveSchedule } from '../systems/wave-schedule.js';
import { createArenaFloor } from '../rendering/arena-floor.js';
import { createEnemyRenderer } from '../rendering/enemies.js';
import { drawArenaPlan, drawOpponentCard, drawRadar } from '../rendering/previews.js';
import { ALL_UNIT_KEYS, OPPONENTS_META } from '../ui/opponent-details';
import { waveTiming } from '../ui/wave-preview.js';

// Every map in data/maps/maps.js, locked or not: the catalog pages show them all.
const maps = Object.entries(mapDefinitions).map(([id, map]) => ({ id, name: map.name }));

// What the catalog pages (arena plan, bestiary) draw and show, without a game session: their
// own arenas, floor, nodes and enemy renderer, whose sprite caches live as long as the kit.
export function createPreviewKit() {
  const arenas = createArenas();
  const floor = createArenaFloor();
  const nodes = createNodeState();
  let enemies = null;
  const schedules = new Map();
  const schedule = (map) => {
    if (!schedules.has(map)) schedules.set(map, getWaveSchedule(map));
    return schedules.get(map);
  };
  return {
    maps,
    /** @type {(id: string) => { name: string, description: string, notes?: string }} */
    map: (id) => mapDefinitions[id],
    units: ALL_UNIT_KEYS,
    meta: OPPONENTS_META,
    // A bestiary card: the unit's numbers as a run starts with them, its texts and when it
    // appears on `map`.
    opponent(unit, map) {
      const u = unitDefinitions[unit];
      return {
        name: u.name,
        color: u.color,
        xp: u.xp,
        hp: Math.round(u.hp * enemyHpScale),
        damage: Math.max(1, Math.round(u.damage * enemyDamageScale)),
        speed: u.speed,
        range: u.range,
        boss: !!u.boss,
        meta: OPPONENTS_META[unit],
        timing: (u.boss ? 'ГЛАВНЫЙ БОСС · ' : '') + waveTiming(schedule(map), unit),
      };
    },
    drawArenaPlan(g, map, { close, labels, bounds }) {
      drawArenaPlan(g, { floor, arena: arenas.get(map), nodes, close, labels, bounds });
    },
    drawRadar(g, map, t) {
      drawRadar(g, { floor, arena: arenas.get(map), nodes, t });
    },
    drawOpponent(g, unit, { motion, phase, reverse }) {
      enemies ??= createEnemyRenderer();
      drawOpponentCard(g, enemies, { unit, motion, phase, reverse });
    },
  };
}
