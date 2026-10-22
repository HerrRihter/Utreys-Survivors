import { useState } from 'react';
import type { EscalationConsoleView } from '../app/types';
import { Overlay } from './Overlay';
import { useSession } from './session';

type View = EscalationConsoleView;
type Ticket = View['tickets'][number];
type Asked = {
  id: string;
  text: string;
  multiple: boolean;
  options: { id: string; text: string }[];
};
type Commands = ReturnType<typeof useSession>['commands'];

const tabs = [
  ['tickets', 'Инциденты'],
  ['team', 'Команда'],
  ['messages', 'Коммуникации'],
  ['metrics', 'Метрики'],
  ['inbox', 'Входящие'],
  ['journal', 'Журнал'],
  ['memo', 'Памятка'],
] as const;
type Tab = (typeof tabs)[number][0];

// «HH:MM» of the shift's clock <-> minutes from the shift's start.
const toMinute = (text: string, start: number) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  return (((+m[1] * 60 + +m[2] - start) % 1440) + 1440) % 1440;
};
const toClock = (minute: number | undefined, start: number) => {
  if (minute == null) return '';
  const t = (start + Math.round(minute)) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const toggle = (list: string[], id: string, multiple = true) =>
  multiple ? (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]) : [id];

// The escalation console of the incident shift: the fight waits while it is open.
export function EscalationConsole() {
  const { views, commands } = useSession();
  const view = views.escalation() as View | null;
  const [tab, setTab] = useState<Tab>('tickets');
  const [selected, setSelected] = useState<number | null>(null);
  if (!view) return null;
  const ticket = view.tickets.find((t) => t.id === selected) ?? view.tickets.at(-1) ?? null;
  const unread = view.inbox.filter((m) => !m.answered).length;
  return (
    <Overlay id="escalation">
      <div
        className="modal escalation-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="escalation-title"
      >
        <div className="eyebrow">ПУЛЬТ ЭСКАЛАЦИИ · БОЙ ПРИОСТАНОВЛЕН · {view.clock}</div>
        <h2 id="escalation-title">Ситуационный центр</h2>
        <div className="esc-tabs" role="tablist">
          {tabs.map(([id, name]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={'esc-tab' + (tab === id ? ' active' : '')}
              onClick={() => setTab(id)}
            >
              {name}
              {id === 'inbox' && unread > 0 ? ` (${unread})` : ''}
            </button>
          ))}
        </div>
        {view.tickets.length > 1 && tab !== 'metrics' && tab !== 'inbox' && tab !== 'memo' && (
          <label className="esc-row">
            Тикет:{' '}
            <select value={ticket?.id ?? ''} onChange={(e) => setSelected(Number(e.target.value))}>
              {view.tickets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} · {t.component} · {t.statusName}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="esc-body" role="tabpanel">
          {tab === 'tickets' && (
            <TicketsTab view={view} ticket={ticket} commands={commands} onOpen={setSelected} />
          )}
          {tab === 'team' && <TeamTab view={view} ticket={ticket} commands={commands} />}
          {tab === 'messages' && (
            <MessagesTab key={ticket?.id} view={view} ticket={ticket} commands={commands} />
          )}
          {tab === 'metrics' && <MetricsTab view={view} ticket={ticket} commands={commands} />}
          {tab === 'inbox' && <InboxTab view={view} commands={commands} />}
          {tab === 'journal' && <JournalTab view={view} commands={commands} />}
          {tab === 'memo' && (
            <div className="esc-section">
              {view.notes.map((n) => (
                <section key={n.name}>
                  <h3>{n.name}</h3>
                  <p>{n.note}</p>
                </section>
              ))}
            </div>
          )}
        </div>
        <button className="primary" onClick={() => commands.closeConsole()}>
          Вернуться в бой
        </button>
      </div>
    </Overlay>
  );
}

// A course question answered once: its options, then a button.
function Question({
  q,
  onAnswer,
  label = 'Ответить',
}: {
  q: Asked;
  onAnswer: (options: string[]) => void;
  label?: string;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  return (
    <fieldset className="esc-question">
      <legend>{q.text}</legend>
      {q.options.map((o) => (
        <label key={o.id} className="esc-option">
          <input
            type={q.multiple ? 'checkbox' : 'radio'}
            name={'q-' + q.id}
            checked={chosen.includes(o.id)}
            onChange={() => setChosen(toggle(chosen, o.id, q.multiple))}
          />
          <span>{o.text}</span>
        </label>
      ))}
      <button className="small" disabled={!chosen.length} onClick={() => onAnswer(chosen)}>
        {label}
      </button>
    </fieldset>
  );
}

function TicketsTab({
  view,
  ticket,
  commands,
  onOpen,
}: {
  view: View;
  ticket: Ticket | null;
  commands: Commands;
  onOpen: (id: number) => void;
}) {
  const [component, setComponent] = useState(view.components[0].id);
  return (
    <div className="esc-section">
      <div className="esc-row">
        <label>
          Где сбой:{' '}
          <select value={component} onChange={(e) => setComponent(e.target.value)}>
            {view.components.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>{' '}
        <button
          className="small"
          onClick={() => {
            const id = commands.escalationOpen(component);
            if (typeof id === 'number') onOpen(id);
          }}
        >
          Начать эскалацию
        </button>
      </div>
      {!ticket && <p>Инцидентов нет. Заметил сбой в комнате — начни эскалацию.</p>}
      {ticket && <TicketCard key={ticket.id} view={view} ticket={ticket} commands={commands} />}
    </div>
  );
}

function TicketCard({
  view,
  ticket,
  commands,
}: {
  view: View;
  ticket: Ticket;
  commands: Commands;
}) {
  const [times, setTimes] = useState({
    start: toClock(ticket.card.times?.start, view.clockStart),
    detected: toClock(ticket.card.times?.detected, view.clockStart),
  });
  const [eta, setEta] = useState(toClock(ticket.card.eta, view.clockStart));
  const [asked, setAsked] = useState<string[]>(ticket.asked);
  const field = (id: string, value: unknown) => commands.escalationField(ticket.id, id, value);
  const options = (kind: string) =>
    kind === 'role'
      ? view.roles.map((r) => ({ id: r.id, text: r.name }))
      : kind === 'detection'
        ? view.detection
        : kind === 'component'
          ? view.components.map((c) => ({ id: c.id, text: c.label }))
          : kind === 'cause'
            ? view.causes
            : view.severities.map((l) => ({ id: l.id, text: l.name }));
  return (
    <div className="esc-ticket">
      <h3>
        {ticket.title} · {ticket.component} · открыт в {ticket.opened} · {ticket.statusName}
      </h3>
      {!ticket.status && (
        <Question
          q={view.creation}
          label="Завести тикет"
          onAnswer={([option]) => commands.escalationCreate(ticket.id, option)}
        />
      )}
      <div className="esc-grid">
        {view.fields.map((f) =>
          f.kind === 'times' ? (
            <label key={f.id} className="esc-field">
              {f.label}
              {f.required ? ' *' : ''}
              <span className="esc-times">
                <input
                  aria-label="Время начала"
                  placeholder="начало ЧЧ:ММ"
                  value={times.start}
                  onChange={(e) => setTimes({ ...times, start: e.target.value })}
                />
                <input
                  aria-label="Время обнаружения"
                  placeholder="обнаружение ЧЧ:ММ"
                  value={times.detected}
                  onChange={(e) => setTimes({ ...times, detected: e.target.value })}
                />
                <button
                  className="small"
                  onClick={() => {
                    const start = toMinute(times.start, view.clockStart),
                      detected = toMinute(times.detected, view.clockStart);
                    if (start != null && detected != null) field('times', { start, detected });
                  }}
                  aria-label={'Записать: ' + f.label}
                >
                  Записать
                </button>
              </span>
            </label>
          ) : f.kind === 'time' ? (
            <label key={f.id} className="esc-field">
              {f.label}
              <span className="esc-times">
                <input
                  aria-label={f.label}
                  placeholder="ЧЧ:ММ"
                  value={eta}
                  onChange={(e) => setEta(e.target.value)}
                />
                <button
                  className="small"
                  onClick={() => {
                    const m = toMinute(eta, view.clockStart);
                    if (m != null) field(f.id, m);
                  }}
                  aria-label={'Записать: ' + f.label}
                >
                  Записать
                </button>
              </span>
            </label>
          ) : (
            <label key={f.id} className="esc-field">
              {f.label}
              {f.required ? ' *' : ''}
              <select
                aria-label={f.label}
                value={ticket.card[f.id] ?? ''}
                onChange={(e) => e.target.value && field(f.id, e.target.value)}
              >
                <option value="">—</option>
                {options(f.kind).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.text}
                  </option>
                ))}
              </select>
            </label>
          ),
        )}
      </div>
      <fieldset className="esc-question">
        <legend>Какие вопросы задать для оценки критичности?</legend>
        {view.severityQuestions.map((q) => (
          <label key={q.id} className="esc-option">
            <input
              type="checkbox"
              checked={asked.includes(q.id)}
              onChange={() => setAsked(toggle(asked, q.id))}
            />
            <span>{q.text}</span>
          </label>
        ))}
        <button
          className="small"
          disabled={!asked.length}
          onClick={() => commands.escalationSeverityQuestions(ticket.id, asked)}
        >
          Задать вопросы
        </button>
      </fieldset>
      <div className="esc-row">
        Статус:{' '}
        {ticket.next.map((st) => (
          <button
            key={st.id}
            className="small"
            onClick={() => commands.escalationStatus(ticket.id, st.id)}
          >
            → {st.name}
          </button>
        ))}
        {ticket.workaroundKnown && !ticket.workaroundApplied && (
          <button className="small" onClick={() => commands.escalationWorkaround(ticket.id)}>
            Применить обходное решение
          </button>
        )}
      </div>
      <p className="esc-status">
        {ticket.fixed
          ? 'Починено.'
          : ticket.workaroundApplied
            ? 'Обходное решение применено: влияние снято, починка ещё нужна.'
            : ticket.impactDown
              ? 'Влияние снято.'
              : 'Влияние продолжается.'}
      </p>
      {ticket.questions
        .filter((q) => q.key.startsWith('status.'))
        .map((q) => (
          <Question
            key={q.key}
            q={q}
            onAnswer={(o) => commands.escalationAnswer(ticket.id, q.key, o)}
          />
        ))}
    </div>
  );
}

function TeamTab({
  view,
  ticket,
  commands,
}: {
  view: View;
  ticket: Ticket | null;
  commands: Commands;
}) {
  if (!ticket) return <p>Сначала начни эскалацию.</p>;
  return (
    <div className="esc-section">
      <h3>Матрица эскалации</h3>
      <ul className="esc-list">
        {ticket.levels.map((l) => (
          <li key={l.level}>
            Уровень {l.level} · {l.name}
            {l.reached ? ` · достигнут в ${l.reached}` : l.due ? ` · пора с ${l.due}` : ''}
          </li>
        ))}
      </ul>
      {ticket.questions
        .filter((q) => q.key.startsWith('matrix.'))
        .map((q) => (
          <Question
            key={q.key}
            q={q}
            onAnswer={(o) => commands.escalationAnswer(ticket.id, q.key, o)}
          />
        ))}
      <h3>Позвать</h3>
      <div className="esc-grid">
        {view.roles.map((r) => (
          <button
            key={r.id}
            className="small"
            onClick={() => commands.escalationCall(ticket.id, r.id)}
          >
            {r.name} · ур. {r.level}
          </button>
        ))}
      </div>
      <h3>Звонки</h3>
      <ul className="esc-list">
        {ticket.calls.map((c, i) => (
          <li key={i}>
            {c.at} · {c.role} · {c.answered ? `ответил, будет в ${c.arrive}` : 'не ответил'}
            {c.working ? ' · работает' : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Parts({
  title,
  items,
  chosen,
  onChange,
}: {
  title: string;
  items: { id: string; text: string }[];
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset className="esc-question">
      <legend>{title}</legend>
      {items.map((p) => (
        <label key={p.id} className="esc-option">
          <input
            type="checkbox"
            checked={chosen.includes(p.id)}
            onChange={() => onChange(toggle(chosen, p.id))}
          />
          <span>{p.text}</span>
        </label>
      ))}
    </fieldset>
  );
}

function OneOf({
  q,
  value,
  onChange,
}: {
  q: Asked;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  return (
    <label className="esc-field">
      {q.text}
      <select
        aria-label={q.text}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">—</option>
        {q.options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.text}
          </option>
        ))}
      </select>
    </label>
  );
}

function MessagesTab({
  view,
  ticket,
  commands,
}: {
  view: View;
  ticket: Ticket | null;
  commands: Commands;
}) {
  const [internal, setInternal] = useState<string[]>([]);
  const [conference, setConference] = useState(false);
  const [required, setRequired] = useState<string[]>([]);
  const [principles, setPrinciples] = useState<string[]>([]);
  const [wording, setWording] = useState<string | null>(null);
  const [sender, setSender] = useState<string | null>(null);
  const [noProgress, setNoProgress] = useState<string | null>(null);
  const [workaround, setWorkaround] = useState<string[]>([]);
  const [client, setClient] = useState<string | null>(null);
  if (!ticket) return <p>Сначала начни эскалацию.</p>;
  const u = view.update;
  return (
    <div className="esc-section">
      <h3>#CS_Critical {ticket.internal ? '· отправлено' : ''}</h3>
      {!ticket.internal && (
        <>
          <Parts
            title="Что в сообщении"
            items={view.internalParts}
            chosen={internal}
            onChange={setInternal}
          />
          <label className="esc-option">
            <input
              type="checkbox"
              checked={conference}
              onChange={() => setConference(!conference)}
            />
            <span>Собрать конференцию (War Room)</span>
          </label>
          <button
            className="small"
            disabled={!internal.length}
            onClick={() => commands.escalationInternal(ticket.id, internal, conference)}
          >
            Отправить в #CS_Critical
          </button>
        </>
      )}
      <h3>
        Update клиенту · отправлено {ticket.updates}
        {ticket.lastUpdate ? `, последний в ${ticket.lastUpdate}` : ''}
        {ticket.nextUpdateIn != null
          ? ticket.nextUpdateIn >= 0
            ? ` · следующий через ${ticket.nextUpdateIn} мин`
            : ` · опоздание ${-ticket.nextUpdateIn} мин`
          : ''}
      </h3>
      <Parts
        title={u.required.text}
        items={u.required.options}
        chosen={required}
        onChange={setRequired}
      />
      <Parts
        title="Принципы внешних коммуникаций"
        items={u.principles}
        chosen={principles}
        onChange={setPrinciples}
      />
      <OneOf q={u.wording} value={wording} onChange={setWording} />
      <OneOf q={u.sender} value={sender} onChange={setSender} />
      <OneOf q={u.noProgress} value={noProgress} onChange={setNoProgress} />
      {ticket.workaroundApplied && (
        <Parts
          title={u.workaround.text}
          items={u.workaround.options}
          chosen={workaround}
          onChange={setWorkaround}
        />
      )}
      {u.client && (
        <OneOf
          q={{ ...u.client, text: `Для клиента ${u.client.clients.join(', ')}: ${u.client.text}` }}
          value={client}
          onChange={setClient}
        />
      )}
      <button
        className="primary"
        onClick={() =>
          commands.escalationUpdate(ticket.id, {
            required,
            principles,
            wording,
            sender,
            noProgress,
            workaround: ticket.workaroundApplied ? workaround : null,
            client,
          })
        }
      >
        Отправить update
      </button>
    </div>
  );
}

function Chart({
  name,
  lines,
}: {
  name: string;
  lines: { component: string; points: number[] }[];
}) {
  const max = Math.max(1, ...lines.flatMap((l) => l.points));
  const length = Math.max(2, ...lines.map((l) => l.points.length));
  const w = 300,
    h = 90;
  return (
    <figure className="esc-chart">
      <figcaption>{name}</figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={name}>
        {lines.map((l, i) => (
          <polyline
            key={l.component}
            className={'esc-line esc-line-' + i}
            fill="none"
            points={l.points
              .map((v, x) => `${(x / (length - 1)) * w},${h - (v / max) * (h - 6) - 3}`)
              .join(' ')}
          />
        ))}
      </svg>
      <div className="esc-legend">
        {lines.map((l, i) => (
          <span key={l.component} className={'esc-key esc-line-' + i}>
            {l.component}: {l.points.at(-1) ?? 0}
          </span>
        ))}
      </div>
    </figure>
  );
}

function MetricsTab({
  view,
  ticket,
  commands,
}: {
  view: View;
  ticket: Ticket | null;
  commands: Commands;
}) {
  return (
    <div className="esc-section">
      {view.metrics.map((m) => (
        <section key={m.id} className="esc-metric">
          <h3>{m.name}</h3>
          <p>
            Открывается победой над {m.need}: {m.units}.{' '}
            {m.pending
              ? `Заказано: ${m.kills}/${m.need}, осталось ${m.secondsLeft} с.`
              : m.openedAt
                ? `Снимок на ${m.openedAt}.`
                : ''}
          </p>
          {!m.pending && (
            <button
              className="small"
              disabled={m.needsTicket && !ticket}
              onClick={() => commands.escalationOrderMetric(m.id, ticket?.id ?? null)}
            >
              {m.openedAt ? 'Заказать свежий снимок' : 'Заказать'}
            </button>
          )}
          {m.charts.map((c) => (
            <Chart key={c.name} name={c.name} lines={c.lines} />
          ))}
        </section>
      ))}
    </div>
  );
}

function InboxTab({ view, commands }: { view: View; commands: Commands }) {
  if (!view.inbox.length) return <p>Входящих нет.</p>;
  return (
    <div className="esc-section">
      {view.inbox.map((m) => (
        <InboxItem key={m.inject} item={m} commands={commands} />
      ))}
    </div>
  );
}

function InboxItem({ item, commands }: { item: View['inbox'][number]; commands: Commands }) {
  const [order, setOrder] = useState<number[]>([]);
  return (
    <section className="esc-inbox">
      <h3>
        {item.at} · {item.text}
      </h3>
      {item.answered && <p>Ответ дан.</p>}
      {!item.answered && item.question && (
        <Question q={item.question} onAnswer={(o) => commands.escalationInject(item.inject, o)} />
      )}
      {!item.answered && item.steps.length > 0 && (
        <fieldset className="esc-question">
          <legend>Расставь шаги по порядку: нажимай в нужной последовательности</legend>
          {item.steps.map((st) => (
            <button
              key={st.index}
              className={'small esc-step' + (order.includes(st.index) ? ' chosen' : '')}
              disabled={order.includes(st.index)}
              onClick={() => setOrder([...order, st.index])}
            >
              {order.includes(st.index) ? order.indexOf(st.index) + 1 + '. ' : ''}
              {st.text}
            </button>
          ))}
          <div className="esc-row">
            <button className="small" onClick={() => setOrder([])}>
              Сначала
            </button>
            <button
              className="small"
              disabled={order.length !== item.steps.length}
              onClick={() => commands.escalationInject(item.inject, order)}
            >
              Готово
            </button>
          </div>
        </fieldset>
      )}
      {!item.answered && !item.question && !item.steps.length && (
        <button className="small" onClick={() => commands.escalationInject(item.inject, true)}>
          Принято
        </button>
      )}
    </section>
  );
}

function JournalTab({ view, commands }: { view: View; commands: Commands }) {
  return (
    <div className="esc-section">
      <p>Фиксируй действия в трекере: это обязанность координатора.</p>
      <ul className="esc-list">
        {view.journal.map((e) => (
          <li key={e.index}>
            {e.at} {e.ticket} · {e.text}{' '}
            {e.recorded ? (
              '· в трекере'
            ) : (
              <button className="small" onClick={() => commands.escalationRecord(e.index)}>
                В трекер
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
