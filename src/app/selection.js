import { mapDefinitions, mapUnlocked } from '../../data/maps/maps.js';

// Rules of the run picker shared by the menus and the start of a run.

// The load level a hero may start on: 1 up to the highest level opened for that hero.
export const clampLoad = (loads, hero, level) =>
  Math.max(1, Math.min(loads.loadAvailable(hero), Math.floor(level) || 1));

// A known map whose unlock condition the save meets.
export const mapOpen = (progression, id) =>
  Object.hasOwn(mapDefinitions, id) && mapUnlocked(mapDefinitions[id], progression.data.stats);
