import { useState, useSyncExternalStore, type FormEvent } from 'react';
import type { CloudProgress } from '../app/useGameSession';
import type { Account } from '../app/types';
import { LOGIN_MAX, PASSWORD_MIN } from '../services/login.js';
import { Dialog } from './Dialog';

function useAccountState(account: Account) {
  useSyncExternalStore(account.subscribe, account.getVersion);
  return account.state;
}

const syncLabels: Record<string, string> = {
  syncing: 'СОХРАНЕНИЕ В ОБЛАКО…',
  synced: 'ПРОГРЕСС В ОБЛАКЕ',
  offline: 'ОБЛАКО НЕДОСТУПНО',
  conflict: 'НУЖНО ВЫБРАТЬ ПРОГРЕСС',
};

function useCloudState(cloud: CloudProgress) {
  useSyncExternalStore(cloud.subscribe, cloud.getVersion);
  return cloud.state;
}

function SyncStatus({ cloud }: { cloud: CloudProgress }) {
  const { status } = useCloudState(cloud);
  if (!syncLabels[status]) return null;
  return (
    <span className="account-sync" id="cloudStatus" data-status={status}>
      {syncLabels[status]}
    </span>
  );
}

// The account row of the main menu. Hidden when the build has no Firebase config.
export function AccountPanel({
  account,
  cloud = null,
}: {
  account: Account;
  cloud?: CloudProgress | null;
}) {
  const state = useAccountState(account);
  const [dialog, setDialog] = useState<'auth' | 'password' | null>(null);
  if (state.status === 'disabled') return null;
  return (
    <div className="account-panel" id="accountPanel">
      {state.status === 'loading' && <span className="account-status">ПОДКЛЮЧЕНИЕ…</span>}
      {state.status === 'error' && (
        <>
          <span className="account-status">СЕРВЕР НЕДОСТУПЕН</span>
          <button className="small" onClick={() => account.start()}>
            ПОВТОРИТЬ
          </button>
        </>
      )}
      {state.status === 'guest' && (
        <>
          <span className="account-status">ГОСТЬ</span>
          <button id="accountSignIn" className="small" onClick={() => setDialog('auth')}>
            ВОЙТИ
          </button>
        </>
      )}
      {state.status === 'signedIn' && (
        <>
          <span className="account-status">
            ИГРОК: <strong id="accountLogin">{state.login}</strong>
          </span>
          {cloud && <SyncStatus cloud={cloud} />}
          <button className="small" onClick={() => setDialog('password')}>
            СМЕНИТЬ ПАРОЛЬ
          </button>
          <button id="accountSignOut" className="small" onClick={() => account.signOut()}>
            ВЫЙТИ
          </button>
        </>
      )}
      {dialog === 'auth' && <AuthDialog account={account} onClose={() => setDialog(null)} />}
      {dialog === 'password' && (
        <PasswordDialog account={account} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function useSubmit(onClose: () => void) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (action: () => Promise<unknown>) => async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

export function AuthDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [tab, setTab] = useState<'signIn' | 'register'>('signIn');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const { error, busy, submit } = useSubmit(onClose);
  const registering = tab === 'register';
  return (
    <Dialog titleId="auth-title" onClose={onClose}>
      <form
        className="account-form"
        onSubmit={submit(() =>
          registering ? account.register(login, password, repeat) : account.signIn(login, password),
        )}
      >
        <h2 id="auth-title">{registering ? 'Регистрация' : 'Вход'}</h2>
        <div className="account-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!registering}
            className="small"
            onClick={() => setTab('signIn')}
          >
            ВХОД
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={registering}
            className="small"
            id="authRegisterTab"
            onClick={() => setTab('register')}
          >
            РЕГИСТРАЦИЯ
          </button>
        </div>
        <label>
          Логин
          <input
            id="authLogin"
            name="username"
            autoComplete="username"
            autoFocus
            maxLength={LOGIN_MAX + 8}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </label>
        {registering && (
          <small className="account-hint">
            3–{LOGIN_MAX} символов: кириллица или латиница, цифры, «_», «-». Логин виден в таблице
            лидеров.
          </small>
        )}
        <label>
          Пароль
          <input
            id="authPassword"
            type="password"
            name="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {registering && (
          <label>
            Повторите пароль
            <input
              id="authRepeat"
              type="password"
              autoComplete="new-password"
              value={repeat}
              onChange={(e) => setRepeat(e.target.value)}
            />
          </label>
        )}
        {registering && (
          <small className="account-hint">
            Не короче {PASSWORD_MIN} символов. Почты нет, поэтому забытый пароль сбрасывает только
            администратор.
          </small>
        )}
        <p className="account-error" role="alert" id="authError">
          {error}
        </p>
        <div className="account-actions">
          <button type="button" className="small" onClick={onClose}>
            ОТМЕНА
          </button>
          <button type="submit" id="authSubmit" className="primary" disabled={busy}>
            {busy ? '…' : registering ? 'СОЗДАТЬ АККАУНТ' : 'ВОЙТИ'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function PasswordDialog({ account, onClose }: { account: Account; onClose: () => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const { error, busy, submit } = useSubmit(onClose);
  return (
    <Dialog titleId="password-title" onClose={onClose}>
      <form
        className="account-form"
        onSubmit={submit(() => account.changePassword(current, next, repeat))}
      >
        <h2 id="password-title">Смена пароля</h2>
        <label>
          Текущий пароль
          <input
            type="password"
            autoComplete="current-password"
            autoFocus
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          Новый пароль
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </label>
        <label>
          Повторите новый пароль
          <input
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        <p className="account-error" role="alert">
          {error}
        </p>
        <div className="account-actions">
          <button type="button" className="small" onClick={onClose}>
            ОТМЕНА
          </button>
          <button type="submit" className="primary" disabled={busy}>
            {busy ? '…' : 'СОХРАНИТЬ'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

const hours = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} мин` : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`;
};

// Shown when this device and the cloud both changed: the player keeps one of the saves.
export function ConflictDialog({ cloud }: { cloud: CloudProgress }) {
  const { conflict } = useCloudState(cloud);
  if (!conflict) return null;
  type Summary = NonNullable<CloudProgress['state']['conflict']>['local'];
  const rows: [string, (s: Summary) => string | number][] = [
    ['Коды', (s) => s.codes],
    ['Победы', (s) => s.wins],
    ['Герои', (s) => s.heroes],
    ['Убийства', (s) => s.kills],
    ['Время в игре', (s) => hours(s.time)],
  ];
  return (
    // Escape does not close it: syncing waits for the answer.
    <Dialog titleId="conflict-title" onClose={() => {}}>
      <div className="account-form conflict-form" id="cloudConflict">
        <h2 id="conflict-title">Какой прогресс оставить?</h2>
        <p className="account-hint">
          На этом устройстве и в облаке разный прогресс. Выбранный заменит другой, второй пропадёт.
        </p>
        <table className="conflict-table">
          <thead>
            <tr>
              <th />
              <th>Это устройство</th>
              <th>Облако</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th>{label}</th>
                <td>{value(conflict.local)}</td>
                <td>{value(conflict.cloud)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="account-actions">
          <button id="conflictKeepLocal" className="small" onClick={() => cloud.resolve('local')}>
            ОСТАВИТЬ С УСТРОЙСТВА
          </button>
          <button id="conflictTakeCloud" className="primary" onClick={() => cloud.resolve('cloud')}>
            ВЗЯТЬ ИЗ ОБЛАКА
          </button>
        </div>
      </div>
    </Dialog>
  );
}
