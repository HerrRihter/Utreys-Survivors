import { statMetrics, formatStat, recordLabel, mapColumns } from '../app/views/stats.js';
import { Dialog } from './Dialog';
import { useSession } from './session';

type Scope = Record<string, number | string>;

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
