import { statMetrics } from '../../../data/leaderboards.js';
import { mapDefinitions } from '../../../data/maps/maps.js';
import { heroDefinitions } from '../../../data/characters/heroes.js';
import { victoryFromScore } from '../../systems/run-records.js';
import { duration } from './format.js';

// «Моя статистика» and the leaderboards: the metrics (data/leaderboards.js), the map columns
// and how a value and the record's holder are written.
export { statMetrics };

// Ranked maps only: learning runs are not counted, so their columns would stay empty.
export const mapColumns = Object.entries(mapDefinitions)
  .filter(([, map]) => map.ranked !== false)
  .map(([id, map]) => ({ id, name: map.name }));
// The leaderboard shows records only; totals stay in «Моя статистика».
export const leaderboardMetrics = statMetrics.filter((m) => m.kind === 'record');

/**
 * A metric value as shown in tables; '—' when nothing is recorded yet.
 * @param {(typeof statMetrics)[number]} metric @param {number} value
 */
export function formatStat(metric, value) {
  if (!value) return '—';
  if (metric.format === 'time') return duration(value);
  if (metric.format === 'victory') {
    const { load, time } = victoryFromScore(value);
    return `${duration(time)} · нагр. ${load}`;
  }
  return value.toLocaleString('ru-RU');
}

/**
 * Who set a record: hero name and load.
 * @param {(typeof statMetrics)[number]} metric @param {Record<string, number | string>} scope
 */
export function recordLabel(metric, scope) {
  /** @type {{ hero?: string, load?: string }} */
  const { hero: heroField, load: loadField } = metric;
  if (!heroField || !scope[metric.field]) return '';
  const hero = heroDefinitions[scope[heroField]];
  const load = loadField ? scope[loadField] : 0;
  return [hero?.name ?? '', load ? `нагр. ${load}` : ''].filter(Boolean).join(' · ');
}
