import { useEffect, useState } from 'react';
import { AuthDialog } from './Account';
import { Dialog } from './Dialog';
import {
  statMetrics,
  leaderboardMetrics,
  formatStat,
  mapColumns,
  recordLabel,
} from '../app/views/stats.js';
import { statPath, leaderboardSize } from '../app/cloud.js';
import type { Metric } from '../app/types';
import { useCloud, useStore } from './cloud-context';

type Row = { place: number; uid: string; login: string; scope: Record<string, number | string> };

const placeText = (place: number | null) =>
  place === null ? '' : Number.isFinite(place) ? `${place}-е место` : 'дальше 1000-го места';

const scopes = [{ id: 'all', name: 'Все карты' }, ...mapColumns];

// Reads one table; `rows` is null while loading, `error` when the server is unreachable.
function useTable(field: string, scope: string) {
  const { leaderboard } = useCloud();
  const [table, setTable] = useState<{ key: string; rows: Row[] | null; error: boolean }>({
    key: '',
    rows: null,
    error: false,
  });
  const key = `${scope}|${field}`;
  useEffect(() => {
    let live = true;
    leaderboard.top(field, scope).then(
      (rows) => live && setTable({ key, rows, error: false }),
      () => live && setTable({ key, rows: null, error: true }),
    );
    return () => {
      live = false;
    };
  }, [leaderboard, field, scope, key]);
  return table.key === key ? table : { key, rows: null, error: false };
}

// The signed-in player's value and place, for the row under the table.
function useOwnPlace(field: string, scope: string) {
  const { account, runStats, leaderboard } = useCloud();
  useStore(account);
  const uid = account.state.status === 'signedIn' ? account.state.uid : '';
  const [own, setOwn] = useState<{ key: string; value: number; place: number | null }>({
    key: '',
    value: 0,
    place: null,
  });
  const key = `${uid}|${scope}|${field}`;
  useEffect(() => {
    if (!uid || !runStats) return;
    let live = true;
    runStats
      .remote()
      .then(async (doc) => {
        const scoped = scope === 'all' ? doc?.all : doc?.maps?.[scope];
        const value = Number(scoped?.[field]) || 0;
        const place = await leaderboard.place(field, scope, value);
        if (live) setOwn({ key, value, place });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [uid, runStats, leaderboard, field, scope, key]);
  return { uid, own: own.key === key ? own : null };
}

export function LeaderboardDialog({ onClose }: { onClose: () => void }) {
  const [field, setField] = useState('bestTime');
  const [scope, setScope] = useState('all');
  const metric = leaderboardMetrics.find((m) => m.field === field) as Metric;
  const table = useTable(field, scope);
  const { uid, own } = useOwnPlace(field, scope);
  const inTop = table.rows?.some((row) => row.uid === uid);
  const scopeName = scopes.find((s) => s.id === scope)?.name ?? '';
  return (
    <Dialog titleId="leaders-title" onClose={onClose}>
      <div
        className="account-form stats-form"
        id="leadersDialog"
        data-path={statPath(scope, field)}
      >
        <h2 id="leaders-title">Лидеры</h2>
        {/* What is compared: one row of records; where: a list of maps. */}
        <div className="leaders-choices" role="group" aria-label="Рекорд">
          {leaderboardMetrics.map((m) => (
            <button
              key={m.field}
              aria-pressed={field === m.field}
              className="small"
              data-field={m.field}
              onClick={() => setField(m.field)}
            >
              {'short' in m ? m.short : m.title}
            </button>
          ))}
        </div>
        <label className="leaders-scope">
          <span>Карта</span>
          <select id="leadersScope" value={scope} onChange={(e) => setScope(e.target.value)}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="leaders-caption" id="leadersCaption">
          <strong>
            {metric.title} · {scopeName}
          </strong>
          <span>топ-{leaderboardSize}</span>
          {'hint' in metric && metric.hint && <small>{metric.hint}</small>}
        </div>
        <ol className="leaders-list" id="leadersList" aria-busy={!table.rows && !table.error}>
          {table.error && <li className="leaders-note">Нет связи с сервером</li>}
          {!table.error && !table.rows && <li className="leaders-note">Загрузка…</li>}
          {table.rows?.length === 0 && <li className="leaders-note">Пока никого — будь первым</li>}
          {table.rows?.map((row) => (
            <li key={row.uid} className={row.uid === uid ? 'mine' : undefined}>
              <span className="leaders-place">{row.place}</span>
              <span className="leaders-login">{row.login}</span>
              <span className="leaders-value">
                {formatStat(metric, Number(row.scope[field]) || 0)}
                {recordLabel(metric, row.scope) && <small>{recordLabel(metric, row.scope)}</small>}
              </span>
            </li>
          ))}
        </ol>
        {!uid && <p className="account-hint">Войди, чтобы попасть в таблицу.</p>}
        {uid && own && !inTop && (
          <p className="leaders-own" id="leadersOwn">
            {own.value
              ? `Ты: ${placeText(own.place)} · ${formatStat(metric, own.value)}`
              : 'Тебя пока нет в этой таблице'}
          </p>
        )}
        <div className="account-actions">
          <button className="primary" onClick={onClose}>
            ЗАКРЫТЬ
          </button>
        </div>
      </div>
    </Dialog>
  );
}

// Results screen: places in the tables for the records this run improved, or a way to sign
// in and send it.
export function RunRecords({ runId }: { runId: string }) {
  const { account, runStats, leaderboard } = useCloud();
  useStore(account);
  useStore(runStats);
  const [signIn, setSignIn] = useState(false);
  const [places, setPlaces] = useState<Record<string, number | null>>({});
  const last = runStats?.state.last;
  const written = last?.runId === runId ? last : null;
  const rows = written
    ? [
        ...written.improved.all.map((field) => ({
          field,
          scope: 'all',
          value: written.all[field],
        })),
        ...written.improved.map
          .filter((field) => !written.improved.all.includes(field))
          .map((field) => ({ field, scope: written.map, value: written.mapScope[field] })),
      ]
    : [];
  const rowsKey = rows.map((r) => `${r.scope}.${r.field}=${r.value}`).join(',');
  useEffect(() => {
    if (!rowsKey) return;
    let live = true;
    for (const row of rowsKey.split(',')) {
      const [path, value] = row.split('=');
      const [scope, field] = path.split('.');
      leaderboard
        .place(field, scope, Number(value))
        .then((place) => live && setPlaces((p) => ({ ...p, [path]: place })))
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [leaderboard, rowsKey]);
  if (account.state.status === 'disabled' || !runStats) return null;
  if (account.state.status !== 'signedIn') {
    if (runStats.state.guestRun !== runId) return null;
    return (
      <div className="run-records" id="runRecords">
        <button id="recordsSignIn" className="small" onClick={() => setSignIn(true)}>
          ВОЙТИ, ЧТОБЫ ПОПАСТЬ В ТАБЛИЦУ
        </button>
        {signIn && <AuthDialog account={account} onClose={() => setSignIn(false)} />}
      </div>
    );
  }
  if (!written) {
    return runStats.state.status === 'sending' ? (
      <p className="run-records account-hint">Отправка результата…</p>
    ) : null;
  }
  if (!rows.length) return null;
  const scopeName = (id: string) => scopes.find((s) => s.id === id)?.name ?? id;
  return (
    <div className="run-records goal-list" id="runRecords">
      <h3>Рекорды в таблицах</h3>
      {rows.map((row) => {
        const metric = statMetrics.find((m) => m.field === row.field) as Metric;
        const path = `${row.scope}.${row.field}`;
        return (
          <div key={path} className="goal done">
            <strong>
              {metric.title}
              {row.scope !== 'all' ? ` · ${scopeName(row.scope)}` : ''}:{' '}
              {formatStat(metric, Number(row.value) || 0)}
            </strong>
            <small>{places[path] === undefined ? '…' : placeText(places[path])}</small>
          </div>
        );
      })}
    </div>
  );
}
