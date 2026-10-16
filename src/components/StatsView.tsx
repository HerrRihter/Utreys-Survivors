import { statMetrics } from '../../data/leaderboards.js';
import { mapDefinitions } from '../../data/maps/maps.js';
import { heroDefinitions } from '../../data/characters/heroes.js';
import { victoryFromScore } from '../systems/run-records.js';
import { Dialog } from './Dialog';
import { useSession } from './session';

type Scope = Record<string, number | string>;
type Metric = (typeof statMetrics)[number];

const clock = (seconds: number) => {
  const total = Math.floor(seconds),
    h = Math.floor(total / 3600),
    m = Math.floor((total % 3600) / 60),
    s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
};

// A metric value as shown in tables; '—' when nothing is recorded yet.
export function formatStat(metric: Metric, value: number) {
  if (!value) return '—';
  if (metric.format === 'time') return clock(value);
  if (metric.format === 'victory') {
    const { load, time } = victoryFromScore(value);
    return `${clock(time)} · нагр. ${load}`;
  }
  return value.toLocaleString('ru-RU');
}

// Who set a record: hero name and load.
export function recordLabel(metric: Metric, scope: Scope) {
  const { hero: heroField, load: loadField } = metric as { hero?: string; load?: string };
  if (!heroField || !scope[metric.field]) return '';
  const hero = heroDefinitions[scope[heroField] as keyof typeof heroDefinitions];
  const load = loadField ? scope[loadField] : 0;
  return [hero?.name ?? '', load ? `нагр. ${load}` : ''].filter(Boolean).join(' · ');
}

export const mapColumns = Object.entries(mapDefinitions).map(([id, map]) => ({
  id,
  name: map.name,
}));

// «Моя статистика»: every metric overall and per map, from the save on this device.
export function StatsDialog({ onClose }: { onClose: () => void }) {
  const session = useSession();
  const stats = session.views.runStats() as { all: Scope; maps: Record<string, Scope> };
  const scopes = [
    { id: 'all', name: 'Все карты', scope: stats.all },
    ...mapColumns.map((map) => ({ ...map, scope: stats.maps[map.id] ?? {} })),
  ];
  return (
    <Dialog titleId="stats-title" onClose={onClose}>
      <div className="account-form stats-form" id="statsDialog">
        <h2 id="stats-title">Моя статистика</h2>
        <p className="account-hint">
          Забеги этого сохранения. Забеги короче 10 секунд не считаются.
        </p>
        <div className="stats-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th />
                {scopes.map((s) => (
                  <th key={s.id}>{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {statMetrics.map((metric) => (
                <tr key={metric.field} data-metric={metric.field}>
                  <th>{metric.title}</th>
                  {scopes.map((s) => (
                    <td key={s.id}>
                      {formatStat(metric, Number(s.scope[metric.field]) || 0)}
                      {recordLabel(metric, s.scope) && (
                        <small>{recordLabel(metric, s.scope)}</small>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="account-actions">
          <button className="primary" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </Dialog>
  );
}
