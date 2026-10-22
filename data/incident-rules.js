import { nodeDefinitions } from './enemies/nodes.js';

// The incident escalation mode (docs/INCIDENT-ESCALATION-PLAN.md): a night shift in which
// production components fail, the failure spreads along their links and the player runs the
// incident by the rules of the critical incident course (data/learning-incidents.js).
//
// Every rule names the course questions it teaches: `covers` lists question ids, and
// `{ question }` makes the console offer that question's options and check its key, so the
// course stays the single source of answers and explanations. Together they must reach every
// question of the course (validateIncidentRules, src/systems/escalation.js).
//
// Times are incident minutes unless the name says otherwise; one incident minute lasts
// `clock.minuteSeconds` seconds of play. Clients are enemy unit ids (data/enemies/units.js).

const label = (id) => nodeDefinitions.find((node) => node.id === id).label;

export const incidentRules = {
  version: 1,
  course: 'critical-incidents',

  // The shift: `start` minutes after midnight, `minutes` long, on a random day of `days`.
  // `night` is when the night triggers of clients apply. Time of day and weekday do not
  // change severity (incident-25): only clients' night triggers and who is on duty.
  clock: {
    minuteSeconds: 2,
    start: 22 * 60,
    minutes: 360,
    night: { from: 22 * 60, to: 8 * 60 },
    days: [
      { name: 'Понедельник', weekend: false },
      { name: 'Вторник', weekend: false },
      { name: 'Среда', weekend: false },
      { name: 'Четверг', weekend: false },
      { name: 'Пятница', weekend: false },
      { name: 'Суббота', weekend: true },
      { name: 'Воскресенье', weekend: true },
    ],
    covers: ['incident-25'],
  },

  // What the seed plans per shift (src/systems/production-line.js `planShift`): `faults` real
  // failures, the first after `firstAfter` minutes and `gap` minutes apart; `falseAlarms`
  // short stalls that pass by themselves; `injects` events from the list below, unseen ones
  // first. An inject bound to a failure may ask for one more.
  shift: {
    faults: [2, 3],
    falseAlarms: 1,
    firstAfter: 15,
    gap: 40,
    injects: [3, 4],
    // The shift is lost when the business impact stays at `impact` or more for `minutes`.
    collapse: { impact: 1, minutes: 20 },
    // The critical incident (the map's boss) comes when the impact reaches `impact`, or when a
    // due level 4 is left uncalled for `overdue` minutes.
    punishment: { impact: 0.67, overdue: 15 },
  },

  // A room per component: `ops` operations, each done in `cycle` minutes when healthy;
  // `clients` whose business it carries. A `queue` component holds a document queue: every
  // operation its sources finish adds `docsPerOp` documents, every one it finishes takes them.
  components: [
    {
      id: 'inport-operation-processor',
      label: label('inport-operation-processor'),
      ops: 8,
      cycle: 6,
      clients: ['procter_gamble', 'loreal', 'mondelez'],
    },
    {
      id: 'artemis',
      label: 'Artemis',
      ops: 10,
      cycle: 3,
      queue: { docsPerOp: 40 },
      clients: ['pepsi', 'inbev', 'multon'],
    },
    {
      id: 'production-aggreagtion',
      label: label('production-aggreagtion'),
      ops: 8,
      cycle: 5,
      clients: ['pepsi', 'baltika', 'inbev'],
    },
    {
      id: 'code-usage-report',
      label: label('code-usage-report'),
      ops: 8,
      cycle: 5,
      clients: ['mars', 'baltika', 'ferrero'],
    },
    {
      id: 'logistic-processor',
      label: label('logistic-processor'),
      ops: 8,
      cycle: 6,
      clients: ['progress', 'cherkizovo', 'royal_canin'],
    },
    {
      id: 'goods-reports',
      label: label('goods-reports'),
      ops: 6,
      cycle: 8,
      clients: ['mars', 'multon', 'loreal'],
    },
  ],
  // The outside receiver: its lamp in the hall goes dark while `from` fails.
  receiver: { label: 'ЦРПТ', from: 'code-usage-report' },

  // Who passes work to whom. A source whose bad share (red, or grey longer than
  // `stuckAfter`) stays at `share` or more for `after` minutes starves its receivers: after
  // `delay` more their operations stall (the `stall` fault), after `errorAfter` more they
  // fail (the `fail` fault). An edge may override `after`, `delay` and `errorAfter`.
  feeds: [
    { from: 'inport-operation-processor', to: 'artemis' },
    { from: 'artemis', to: 'production-aggreagtion' },
    { from: 'artemis', to: 'code-usage-report' },
    { from: 'production-aggreagtion', to: 'logistic-processor' },
    { from: 'logistic-processor', to: 'goods-reports' },
  ],
  cascade: {
    share: 0.4,
    stuckAfter: 3,
    after: 3,
    delay: 4,
    errorAfter: 10,
    stall: 'stall',
    fail: 'error',
  },

  // How a component fails. `kind` is the behaviour (src/systems/production-line.js):
  //   error   `share` of the operations turn red when they finish (`mildShare` for a mild
  //           failure, below the cascade and impact thresholds)
  //   stall   `share` of the operations stop finishing and stay grey
  //   reboot  the component restarts every `every` minutes and for `down` minutes finishes
  //           nothing, its operations started over
  //   flap    a stall of `share` for `minutes` that passes by itself: no incident (incident-1)
  // A real fault takes one of its kind's `causes`.
  faults: {
    error: { kind: 'error', name: 'Ошибки обработки', share: 0.7, mildShare: 0.3 },
    stall: { kind: 'stall', name: 'Зависание', share: 0.8 },
    reboot: { kind: 'reboot', name: 'Перезагрузки', every: 50, down: 4 },
    flap: {
      kind: 'flap',
      name: 'Кратковременное зависание',
      share: 0.5,
      minutes: 6,
      covers: ['incident-1'],
    },
  },
  // Causes offered in the ticket; the fault's own is the right one. `fixer` is the role that
  // repairs it in `fix` minutes; `workaround` is what lowers the impact before the repair
  // (incident-2), shown by the logs.
  causes: [
    {
      id: 'certificate',
      faults: ['error'],
      text: 'Истёк сертификат подписи',
      fixer: 'devops',
      fix: 25,
      workaround: null,
    },
    {
      id: 'release',
      faults: ['error'],
      text: 'Ошибка в последнем релизе',
      fixer: 'dev',
      fix: 40,
      workaround: 'Откат релиза',
    },
    {
      id: 'format',
      faults: ['error', 'stall'],
      text: 'Клиент прислал данные в новом формате',
      fixer: 'dev',
      fix: 45,
      workaround: 'Ручная переотправка документов',
    },
    {
      id: 'db-lock',
      faults: ['stall'],
      text: 'Блокировка в базе данных',
      fixer: 'devops',
      fix: 20,
      workaround: null,
    },
    {
      id: 'consumer',
      faults: ['stall'],
      text: 'Остановился обработчик очереди',
      fixer: 'devops',
      fix: 15,
      workaround: 'Перезапуск обработчика вручную',
    },
    {
      id: 'memory',
      faults: ['reboot'],
      text: 'Утечка памяти, сервис перезапускается',
      fixer: 'devops',
      fix: 30,
      workaround: 'Ручной перезапуск с увеличенной памятью',
    },
  ],

  // The people. `level` is the escalation level that calls them; `arrive` minutes after
  // answering they start; `miss` is the chance a call goes unanswered (rolled from the run's
  // random source); `manager` is whom to call when they do not answer.
  roles: {
    senior: { name: 'Старший смены КС', level: 1, arrive: 0, miss: 0 },
    teamlead: { name: 'Тим-лид КС (модератор)', level: 1, arrive: 5, miss: 0 },
    ba: { name: 'Бизнес-аналитик', level: 2, arrive: 8, miss: 0.2, manager: 'techlead' },
    dev: { name: 'Дежурный разработчик', level: 2, arrive: 10, miss: 0.25, manager: 'techlead' },
    devops: { name: 'Дежурный DevOps', level: 2, arrive: 10, miss: 0.3, manager: 'techlead' },
    techlead: { name: 'Тимлид QA/DevOps', level: 3, arrive: 12, miss: 0 },
    cto: { name: 'CTO', level: 3, arrive: 15, miss: 0 },
    top: { name: 'ТОП-менеджмент Utrace', level: 4, arrive: 20, miss: 0 },
  },
  // The console opens anywhere while no enemy is within `safeRadius` px of the hero; the
  // fight stops while it is open. At load `fullFeedback` and below a mistake's toast explains
  // it with the course; above, it only says that it was one.
  console: { safeRadius: 300, fullFeedback: 1 },

  // The player is the coordinator: the senior of the shift, or the team lead when the senior
  // is away (incident-6, incident-8).
  // The moderator brings more people when one coordinator is not enough (incident-7).
  coordinator: {
    role: 'senior',
    standIn: 'teamlead',
    moderator: 'teamlead',
    covers: ['incident-6', 'incident-8'],
  },
  // An unanswered call: at least `attempts` calls `interval` minutes apart, then the manager.
  calls: { attempts: 2, interval: [5, 7], covers: ['incident-19'] },
  // Everyone called beyond the roles the incident needs costs points ("two pizzas").
  warRoom: { extraPenalty: 1, covers: ['incident-9'] },

  // The escalation matrix. `within` is the deadline from detection; `stuck` the minutes
  // without progress that make the level due; `triggers` what makes it mandatory.
  matrix: [
    {
      level: 1,
      name: 'Оценка критичности и первая коммуникация',
      within: 20,
      roles: ['senior'],
      covers: ['incident-15'],
    },
    {
      level: 2,
      name: 'Решение и первая эскалация в продуктовые команды',
      roles: ['ba', 'dev', 'devops'],
      choice: { question: 'incident-16' },
    },
    {
      level: 3,
      name: 'Эскалация техническим руководителям',
      stuck: 45,
      reassess: true,
      roles: ['techlead', 'cto'],
      choice: { question: 'incident-20' },
    },
    {
      level: 4,
      name: 'ТОП-менеджмент',
      roles: ['top'],
      triggers: ['critical', 'sla-risk', 'client-top'],
      choice: { question: 'incident-17' },
    },
  ],

  // Severity. The assessment asks the course's three questions (incident-5) among wrong
  // ones; the answers come from what the player has seen. `levels` are tried in order, the
  // first whose `when` holds is right (incident-3, incident-4); `update` is how often the
  // client hears from us, `sla` the minutes to resolve.
  severity: {
    questions: [
      {
        id: 'mass',
        text: 'Затронуты ли массово бизнес-процессы клиента или клиентов?',
        right: true,
      },
      {
        id: 'impact',
        text: 'Есть ли бизнес-влияние или наступит ли оно в ближайший час?',
        right: true,
      },
      { id: 'workaround', text: 'Есть ли обходное решение (workaround)?', right: true },
      { id: 'security', text: 'Есть ли риск утечки данных или кибербезопасности?', right: true },
      {
        id: 'night',
        text: 'Ночь или выходной — можно ли подождать до утра?',
        right: false,
        covers: ['incident-25'],
      },
      {
        id: 'priority',
        text: 'Стоит ли в трекере приоритет Critical?',
        right: false,
        covers: ['incident-1'],
      },
      { id: 'teamlead', text: 'Нужно ли звать тим-лида?', right: false },
    ],
    // Mass: this many clients or components touched.
    massClients: 3,
    massComponents: 2,
    // Business impact: a component's bad share at `impactShare` or more.
    impactShare: 0.5,
    levels: [
      {
        id: 'critical',
        name: 'Critical',
        when: { impact: true, mass: true, workaround: false },
        update: 30,
        sla: 240,
        covers: ['incident-18'],
      },
      // Major and Minor cadences and SLAs are not in the course; to be confirmed by its owner.
      { id: 'major', name: 'Major', when: { impact: true }, update: 60, sla: 480 },
      { id: 'minor', name: 'Minor', when: {}, update: 120, sla: 1440 },
    ],
    covers: ['incident-3', 'incident-4', 'incident-5'],
  },
  // Clients' own Critical triggers, read from the component's history.
  clientTriggers: [
    {
      client: 'pepsi',
      component: 'artemis',
      kind: 'queue',
      min: 500,
      minutes: 30,
      severity: 'critical',
      covers: ['incident-31'],
    },
    {
      client: 'pepsi',
      component: 'artemis',
      kind: 'reboots',
      count: 2,
      minutes: 180,
      night: true,
      severity: 'critical',
      covers: ['incident-31'],
    },
  ],
  // Clients whose level 2 starts with another role, and whose updates need more parts.
  clientEscalation: [{ client: 'pepsi', first: 'ba', covers: ['incident-32'] }],
  clientUpdates: [{ client: 'pepsi', parts: { question: 'incident-33' } }],

  // The protocol. The first action must be the course's (incident-10): `first` maps its
  // options to console actions. The ticket is created the course's way (incident-11).
  protocol: {
    first: {
      question: 'incident-10',
      actions: {
        'answer-1': 'notify',
        'answer-2': 'call-teamlead',
        'answer-3': 'update',
        'answer-4': 'ticket',
      },
    },
    creation: { question: 'incident-11' },
  },
  // Moving the ticket from «Новый» to «В работе» needs the fields that the course's key
  // names (incident-12); every option is a field of the card, the wrong ones optional.
  // `kind` says what the field holds.
  ticket: {
    question: 'incident-12',
    fields: [
      { option: 'answer-1', id: 'executor', kind: 'role' },
      { option: 'answer-2', id: 'coordinator', kind: 'role' },
      { option: 'answer-3', id: 'detection', kind: 'detection' },
      { option: 'answer-4', id: 'eta', kind: 'time' },
      { option: 'answer-5', id: 'moderator', kind: 'role' },
      { option: 'answer-6', id: 'times', kind: 'times' },
    ],
    // Fields the card always has besides: the source component, the cause, the severity.
    situation: ['component', 'cause', 'severity'],
    // A start time within this many minutes of the real one is right.
    startTolerance: 5,
  },
  // How a failure got noticed: the player in the room (internal), monitoring after
  // `monitoring` minutes, the client after `client` minutes.
  detection: {
    monitoring: 6,
    client: 15,
    methods: [
      { id: 'internal', text: 'Внутреннее уведомление' },
      { id: 'monitoring', text: 'Мониторинг' },
      { id: 'client', text: 'Обращение клиента' },
    ],
  },
  // Ticket statuses in order. «Мониторинг» pauses the SLA (incident-13); «Решён» leads to the
  // mandatory postmortem (incident-14); the incident counts as solved once the impact is down,
  // a workaround included (incident-2).
  statuses: [
    { id: 'new', name: 'Новый' },
    // Entered only with the card's required fields filled (incident-12).
    { id: 'work', name: 'В работе', card: true },
    { id: 'monitoring', name: 'Мониторинг', slaPaused: true, choice: { question: 'incident-13' } },
    // Entered once the impact is down: repaired or worked around.
    { id: 'solved', name: 'Решён', solved: true, choice: { question: 'incident-2' } },
    { id: 'postmortem', name: 'Постмортем', slaStopped: true, choice: { question: 'incident-14' } },
  ],
  // A ticket moves forward through the statuses only; `optional` ones may be skipped.
  optionalStatuses: ['monitoring'],
  // Every action on the console is logged in the tracker only when the player records it
  // (a coordinator's duty, incident-7); each unrecorded one costs `missPenalty`.
  journal: { missPenalty: 1, duties: { question: 'incident-7' } },

  // Messages. The internal one in #CS_Critical (incident-21) and the client update are put
  // together from parts; `right` parts must all be there, wrong ones must not.
  internal: {
    parts: [
      { id: 'symptom', text: 'Суть (симптом) проблемы', right: true },
      { id: 'clients', text: 'Список затронутых клиентов', right: true },
      { id: 'links', text: 'Ссылка на задачу CRIT и на кризисный звонок в Teams', right: true },
      { id: 'actions', text: 'Выполненные и планируемые действия', right: true },
      { id: 'blame', text: 'Кто из сотрудников допустил ошибку', right: false },
      { id: 'stack', text: 'Полный стек-трейс ошибки', right: false },
    ],
    // The crisis call (War Room) is set up with the internal message.
    conference: true,
    covers: ['incident-21'],
  },
  update: {
    // Parts every update needs (incident-22) and the course's five principles (incident-28).
    parts: { question: 'incident-22' },
    principles: [
      { id: 'start', text: 'Время начала инцидента', right: true },
      { id: 'business', text: 'Влияние языком бизнеса, без технических терминов', right: true },
      { id: 'next', text: 'Время следующего update', right: true },
      { id: 'status-page', text: 'Ссылка на статус-страницу', right: true },
      { id: 'apology', text: 'Короткое искреннее извинение', right: true },
      {
        id: 'tech',
        text: 'Технические подробности причины',
        right: false,
        covers: ['incident-29'],
      },
    ],
    covers: ['incident-28'],
    // The wording to send (incident-26) and who sends it (incident-30).
    wording: { question: 'incident-26' },
    sender: { question: 'incident-30' },
    // When nothing changed the update still goes out on time (incident-23).
    noProgress: { question: 'incident-23' },
    // After a workaround with a risk of return the update follows its template (incident-27).
    workaround: { question: 'incident-27' },
  },

  // Metrics. Ordered on the console, opened by beating `kills` enemies of `units` within
  // `withinSeconds` of play; a `clients` metric counts the units of the incident's clients.
  // An open metric shows the history up to the moment it opened. `reveals` are the ticket
  // fields it proves. While ordered, the waves bring its units `weight` times as often.
  metrics: [
    {
      id: 'grafana',
      name: 'Графики Grafana',
      kind: 'units',
      units: ['grafana_filter'],
      kills: 10,
      withinSeconds: 45,
      weight: 4,
      series: ['throughput', 'errors', 'stalled', 'queue'],
      reveals: ['component', 'times'],
      covers: ['incident-31'],
    },
    {
      id: 'logs',
      name: 'Логи компонента',
      kind: 'units',
      units: ['log_query'],
      kills: 6,
      withinSeconds: 45,
      weight: 4,
      series: ['errors'],
      reveals: ['cause', 'workaround'],
    },
    {
      id: 'clients',
      name: 'Срез по клиенту',
      kind: 'clients',
      kills: 8,
      withinSeconds: 45,
      weight: 3,
      series: ['throughput', 'queue'],
      reveals: ['severity'],
      covers: ['incident-3'],
    },
  ],

  // Events of the shift. `kind` is the behaviour (src/systems/escalation.js); `expects` what
  // the right reaction sets. An inject with `after` is bound to a failure of the plan and comes
  // that many minutes after it starts; the failure is chosen to fit it: on `component`, of
  // `fault`, serving `client`, with a cause that has a `workaround`, `mild`. Without `after` it
  // comes at the start of the shift.
  injects: [
    {
      id: 'client-offers-workaround',
      kind: 'client-message',
      client: 'baltika',
      component: 'code-usage-report',
      fault: 'error',
      workaround: true,
      mild: true,
      after: 12,
      text: 'Менеджер «Балтики»: «Отчёты о нанесении не уходят регулятору. Можем пока переотправлять вручную — это не срочно?»',
      expects: { severity: 'minor' },
      choice: { question: 'incident-4' },
    },
    {
      id: 'senior-away',
      kind: 'role-away',
      role: 'senior',
      weekend: true,
      night: true,
      expects: { coordinator: 'teamlead' },
      choice: { question: 'incident-8' },
    },
    {
      id: 'client-top',
      kind: 'client-message',
      top: true,
      after: 30,
      text: 'ТОП-менеджмент клиента требует звонка «с вашим директором».',
      expects: { level: 4 },
      // The course's order (incident-24): the player puts the steps in sequence.
      steps: [
        'Эскалировать на уровень 4: подключить ТОП-менеджмент Utrace',
        'Оценить качество коммуникации и вовлечённость менеджмента клиента',
        'ТОП-менеджер готовит и валидирует коммуникацию',
        'Передать клиенту контакты руководителя и согласовать порядок ТОП-to-ТОП',
      ],
      covers: ['incident-24', 'incident-17'],
    },
    {
      id: 'technical-question',
      kind: 'client-message',
      client: 'mars',
      after: 20,
      text: 'Mars: «Почему наш заказ завис? Что произошло технически с Artemis?»',
      choice: { question: 'incident-29' },
    },
    {
      id: 'no-answer',
      kind: 'call-missed',
      role: 'devops',
      after: 0,
      choice: { question: 'incident-19' },
    },
    {
      id: 'workaround-found',
      kind: 'workaround',
      workaround: true,
      after: 25,
      expects: { status: 'monitoring' },
      covers: ['incident-2', 'incident-27'],
    },
    {
      id: 'parallel-incident',
      kind: 'second-fault',
      // The parallel failure starts `after` minutes into the bound one, on a component that
      // neither feeds nor is fed by it.
      after: 10,
      expects: { moderator: true },
      covers: ['incident-7'],
    },
    {
      id: 'artemis-night-reboots',
      kind: 'scenario',
      fault: 'reboot',
      component: 'artemis',
      night: true,
      after: 0,
      // The course's order (incident-34): each step done in this order scores.
      steps: [
        'Оценить критичность по критерию Pepsi: 2+ ночные перезагрузки — Critical',
        'Уведомить в #CS_Critical',
        'Завести задачу CRIT через форму',
        'Собрать конференцию в Teams',
        'Эскалировать в БА Pepsi по графику',
        'БА подтверждает критичность, тим-лид определяет состав команды',
        'Отправить первый update клиенту с данными очереди',
        'Продолжать коммуникации каждые 30 минут',
      ],
      covers: ['incident-34', 'incident-31', 'incident-32', 'incident-33'],
    },
  ],

  // The review after the shift (PIR), on this shift's incidents.
  review: [
    { question: 'incident-35' },
    { question: 'incident-36' },
    { question: 'incident-37' },
    { question: 'incident-39' },
    { question: 'incident-40' },
    {
      id: 'blameless',
      text: 'Как записать причину в постмортеме?',
      parts: [
        {
          id: 'system',
          text: 'Что в системе, процессах и инструментах позволило сбою случиться',
          right: true,
        },
        { id: 'person', text: 'Кто из сотрудников виноват в сбое', right: false },
      ],
      covers: ['incident-38'],
    },
  ],

  // The shift's grade: each step scores up to its `weight`; the share of the total gives the
  // grade, as on the learning map (data/learning-rules.js).
  // Timing and consequences of the escalation. A repair takes `fixPenalty` times longer for
  // each wrong field the specialist works from (component, cause). The SLA is at risk past
  // `slaRisk` of it. A level or an update counts as on time within `grace` minutes of its due
  // time; a start or detection time within `ticket.startTolerance`.
  escalation: { fixPenalty: 1.5, slaRisk: 0.75, grace: 5 },

  grading: {
    weights: {
      detection: 2,
      first: 2,
      creation: 1,
      card: 3,
      severity: 3,
      matrix: 3,
      calls: 2,
      updates: 3,
      statuses: 2,
      journal: 1,
      injects: 2,
      review: 2,
    },
    grades: [
      { min: 0.9, name: 'Отлично' },
      { min: 0.75, name: 'Хорошо' },
      { min: 0.6, name: 'Удовлетворительно' },
      { min: 0, name: 'Не сдано' },
    ],
  },
};
