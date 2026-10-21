import { bossUnits, waveRoster } from '../systems/wave-schedule.js';
import { nodeDefinitions } from '../../data/enemies/nodes.js';

const nodeBugs = new Set(nodeDefinitions.map((node) => node.bug));
// When the main boss comes, by what the map asks to clear first (`objective.type`).
const bossArrival = {
  desks: 'После закрытия всех сервисдесков',
  learning: 'В центральном зале, если это босс выбранного курса',
};

const clock = (seconds) => Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');

// When `unit` appears on a map with this schedule and `objective` (data/maps/maps.js).
export function waveTiming(schedule, unit, objective = {}) {
  if (bossUnits(schedule).includes(unit))
    return bossArrival[objective.type] ?? 'После устранения всех багов узлов';
  // The map's own objective: service desks stand from the start; node bugs guard nodes or
  // learning terminals and are not on a desk map at all.
  if (objective.type === 'desks' && unit === objective.unit) return 'С начала боя · цель карты';
  if (nodeBugs.has(unit))
    return objective.type === 'desks'
      ? 'На этой карте не встречается'
      : objective.type === 'learning'
        ? 'Охраняет терминал в лабиринте'
        : 'С начала боя · охраняет узел';
  const entry = waveRoster(schedule).find((entry) => entry.unit === unit);
  if (!entry) return 'На этой карте не встречается';
  const parts = [entry.time === 0 ? 'С начала боя' : 'С ' + clock(entry.time)];
  const recurring = schedule.recurring.find((spec) => spec.unit === unit);
  if (recurring)
    for (const stage of recurring.stages) {
      parts.push(
        (stage.time ? 'с ' + clock(stage.time) + ' — ' : '') +
          'каждые ' +
          stage.every +
          ' с, максимум ' +
          stage.cap,
      );
    }
  return parts.join(' · ');
}
