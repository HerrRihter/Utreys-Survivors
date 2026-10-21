// One schedule per map. Besides waves: `elites` brings a stronger copy of a unit from the
// current stage on a timer; `events` lists the times of mid-run events, their types (the seed
// picks the order) and each type's numbers. `boss.hpScale` changes the CRPT on this map.
const datacenter = {
  normal: {
    firstDelay: 2,
    // At most this share of the wave limit may be shooters (projectile and mortar units)
    // or tanks (armoured or hard to interrupt); see unitRole in src/systems/wave-schedule.js.
    shares: { shooter: 0.25, tank: 0.2 },
    // Every stage fields the whole roster; the weights shift from light units early to
    // tanks and specialists late. Intervals shrink smoothly inside a stage.
    stages: [
      {
        time: 0,
        interval: 3.2,
        minInterval: 2.8,
        timeFactor: 0.0067,
        batch: 2,
        batchEvery: null,
        cap: 18,
        strength: 0.7,
        weights: [
          ['l3', 8],
          ['multon', 3],
          ['pepsi', 1.5],
          ['mondelez', 1.5],
          ['mars', 1],
          ['mars_petfood', 0.5],
          ['royal_canin', 0.5],
          ['loreal', 0.5],
          ['ferrero', 0.5],
          ['progress', 1],
          ['cherkizovo', 0.5],
          ['baltika', 0.5],
          ['procter_gamble', 0.5],
          ['inbev', 0.3],
          ['vetis', 0.3],
        ],
      },
      {
        time: 60,
        interval: 2.733,
        minInterval: 2.4,
        timeFactor: 0.00222,
        batch: 4,
        batchEvery: null,
        cap: 36,
        strength: 0.8,
        weights: [
          ['l3', 5],
          ['multon', 3],
          ['pepsi', 3],
          ['mondelez', 3],
          ['mars', 2],
          ['mars_petfood', 1.5],
          ['royal_canin', 1.5],
          ['loreal', 1],
          ['ferrero', 1.5],
          ['progress', 1.5],
          ['cherkizovo', 1],
          ['baltika', 0.6],
          ['procter_gamble', 0.6],
          ['inbev', 0.6],
          ['vetis', 0.6],
        ],
      },
      {
        time: 150,
        interval: 2.533,
        minInterval: 2.0,
        timeFactor: 0.00222,
        batch: 6,
        batchEvery: null,
        cap: 65,
        strength: 0.9,
        weights: [
          ['l3', 3],
          ['multon', 3],
          ['pepsi', 3],
          ['mondelez', 3],
          ['mars', 2],
          ['mars_petfood', 2],
          ['royal_canin', 2],
          ['loreal', 2],
          ['ferrero', 2],
          ['progress', 2],
          ['cherkizovo', 2],
          ['baltika', 1.5],
          ['procter_gamble', 1.5],
          ['inbev', 1.5],
          ['vetis', 1.5],
        ],
      },
      {
        time: 240,
        interval: 1.9,
        minInterval: 1.8,
        timeFactor: 0,
        batch: 8,
        batchEvery: null,
        cap: 110,
        strength: 1,
        weights: [
          ['l3', 2],
          ['multon', 3],
          ['pepsi', 3],
          ['mondelez', 2],
          ['mars', 2],
          ['mars_petfood', 2],
          ['royal_canin', 2],
          ['loreal', 2],
          ['ferrero', 2],
          ['progress', 2],
          ['cherkizovo', 3],
          ['baltika', 2.5],
          ['procter_gamble', 2.5],
          ['inbev', 2.5],
          ['vetis', 2.5],
        ],
      },
    ],
  },
  recurring: [
    {
      unit: 'inbev',
      first: 150,
      populationCap: null,
      stages: [{ time: 0, every: 30, cap: 2 }],
      message: 'Клиент Инбев запрашивает агрегацию паллет!',
    },
    {
      unit: 'mars',
      first: 75,
      populationCap: null,
      stages: [{ time: 0, every: 20, cap: 3 }],
      message: 'Клиент Марс направляет тираж кодов!',
    },
  ],
  boss: {
    unit: 'crpt',
    condition: 'all-nodes-resolved',
    // Share of max health restored when the CRPT arrives: the node hunt wears the hero down.
    heal: 0.25,
    message: 'ВНИМАНИЕ: Подключение шлюза ЦРПТ! Валидация криптохвостов!',
    sound: 'boss',
  },
  notifications: [
    { time: 5, message: 'Сеть L3 активирована. Обработка потока кодов маркировки.' },
    { time: 30, message: 'Линии Пепси подключены: входящий поток запросов розлива!' },
    { time: 90, message: 'Высокая нагрузка: клиенты требуют мгновенного отчёта о нанесении!' },
  ],
  elites: { first: 100, every: 80 },
  events: {
    times: [80, 170, 260],
    types: ['friday', 'incident', 'rush'],
    // Each type: its `kind` (src/systems/run-events.js), numbers, the HUD `label` shown while it
    // runs ({left} seconds, {progress}/{need}), the edge `marker` of a point to hold,
    // the `success` / `failed` toasts and the `reward`: `codes` or a `pickup` type.
    friday: {
      kind: 'siege',
      duration: 25,
      count: 14,
      distance: 430,
      label: 'Релиз в пятницу: продержись {left}',
      success: 'Релиз пережит!',
      failed: 'Событие провалено',
      reward: { pickup: 'bundle' },
    },
    incident: {
      kind: 'hold',
      duration: 60,
      hold: 15,
      radius: 90,
      distance: 380,
      label: 'Инцидент: удержи точку {progress}/{need} с · {left}',
      marker: 'ИНЦИДЕНТ',
      success: 'Инцидент закрыт!',
      failed: 'Событие провалено',
      reward: { pickup: 'bundle' },
    },
    rush: {
      kind: 'collect',
      duration: 40,
      tokens: 16,
      need: 12,
      near: 150,
      far: 520,
      label: 'Срочный тираж: {progress}/{need} кодов · {left}',
      success: 'Тираж сдан',
      failed: 'Событие провалено',
      reward: { codes: 25 },
    },
  },
};

// The learning maps: steady waves in the mazes (the rooms scale them, data/learning-rules.js),
// no events, and the course's boss in the central hall.
function learningSchedule(unit, message) {
  return {
    ...datacenter,
    normal: {
      ...datacenter.normal,
      firstDelay: 2,
      stages: datacenter.normal.stages.map((stage) => ({
        ...stage,
        batch: 2,
        cap: 14,
        interval: 4,
        minInterval: 3,
        timeFactor: 0,
        batchEvery: null,
        weights: stage.weights,
      })),
    },
    recurring: [],
    elites: datacenter.elites,
    events: { times: [], types: [] },
    notifications: [],
    boss: { unit, condition: 'learning-rooms-complete', message, sound: 'boss' },
  };
}

export const waveSchedules = {
  empty: datacenter,
  // Narrow corridors: fewer enemies at once, larger batches, a tougher CRPT.
  serverRoom: {
    ...datacenter,
    normal: {
      ...datacenter.normal,
      firstDelay: 1.5,
      stages: datacenter.normal.stages.map((stage) => ({
        ...stage,
        batch: stage.batch + 1,
        cap: Math.round(stage.cap * 0.85),
      })),
    },
    boss: {
      ...datacenter.boss,
      hpScale: 1.4,
      message: 'ВНИМАНИЕ: ЦРПТ развёрнут в серверном зале! Усиленная проверка!',
    },
    notifications: [
      { time: 5, message: 'Серверный зал: стойки перекрывают проходы, используй коридоры.' },
      { time: 60, message: 'Охлаждение на пределе: клиенты идут плотными пачками!' },
    ],
    elites: { first: 80, every: 70 },
    events: { ...datacenter.events, times: [70, 150, 230, 310] },
  },
  // The desks add their own Pepsi: the regular waves are a little thinner.
  pepsiDesk: {
    ...datacenter,
    normal: {
      ...datacenter.normal,
      stages: datacenter.normal.stages.map((stage) => ({
        ...stage,
        cap: Math.round(stage.cap * 0.85),
      })),
    },
    boss: {
      ...datacenter.boss,
      message: 'ВНИМАНИЕ: Бэклог закрыт, ЦРПТ пришёл с проверкой SLA!',
    },
    notifications: [
      { time: 5, message: 'Сервисдески Пепси открыты: тикеты пошли. Снеси все три!' },
      { time: 90, message: 'Бэклог растёт: сервисдески выпускают всё больше тикетов!' },
    ],
  },
  learningLab: learningSchedule(
    'batch_accounting',
    'ПАРТИОННЫЙ УЧЁТ: склеенные партии Пепси наступают!',
  ),
  incidentLab: learningSchedule(
    'critical_incident',
    'КРИТИЧЕСКИЙ ИНЦИДЕНТ: сбой задел всех клиентов разом!',
  ),
};
