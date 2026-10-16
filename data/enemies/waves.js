// One schedule per map. Besides waves: `elites` brings a stronger copy of a unit from the
// current stage on a timer; `events` lists the times of mid-run events, their types (the seed
// picks the order) and each type's numbers. `boss.hpScale` changes the CRPT on this map.
const datacenter = {
  normal: {
    firstDelay: 2,
    stages: [
      {
        time: 0,
        interval: 3.2,
        minInterval: 3.2,
        timeFactor: 0,
        batch: 2,
        batchEvery: null,
        cap: 18,
        weights: [
          ['multon', 1],
          ['progress', 1],
          ['l3', 4],
          ['pepsi', 2],
        ],
      },
      {
        time: 60,
        interval: 2.6,
        minInterval: 2.6,
        timeFactor: 0,
        batch: 4,
        batchEvery: null,
        cap: 36,
        weights: [
          ['mars_petfood', 1],
          ['loreal', 1],
          ['mondelez', 1],
          ['l3', 3],
          ['pepsi', 3],
          ['mars', 2],
        ],
      },
      {
        time: 150,
        interval: 2.2,
        minInterval: 2.2,
        timeFactor: 0,
        batch: 6,
        batchEvery: null,
        cap: 65,
        weights: [
          ['baltika', 1],
          ['royal_canin', 1],
          ['cherkizovo', 1],
          ['ferrero', 1],
          ['pepsi', 3],
          ['mars', 3],
          ['inbev', 2],
        ],
      },
      {
        time: 240,
        interval: 1.8,
        minInterval: 1.8,
        timeFactor: 0,
        batch: 8,
        batchEvery: null,
        cap: 110,
        weights: [
          ['procter_gamble', 1],
          ['vetis', 1],
          ['l3', 2],
          ['pepsi', 3],
          ['inbev', 3],
          ['mars', 2],
        ],
      },
    ],
  },
  recurring: [
    {
      unit: 'inbev',
      first: 45,
      populationCap: 6,
      stages: [{ time: 0, every: 20, cap: 3 }],
      message: 'Клиент Инбев запрашивает агрегацию паллет!',
    },
    {
      unit: 'mars',
      first: 60,
      populationCap: 8,
      stages: [{ time: 0, every: 18, cap: 4 }],
      message: 'Клиент Марс направляет тираж кодов!',
    },
  ],
  boss: {
    unit: 'crpt',
    condition: 'all-nodes-resolved',
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
    friday: { duration: 25, count: 14, message: 'Релиз в пятницу! Нагрузка со всех сторон' },
    incident: {
      duration: 60,
      hold: 15,
      radius: 90,
      distance: 380,
      message: 'Инцидент! Удержите точку 15 секунд',
    },
    rush: { duration: 40, tokens: 16, need: 12, message: 'Срочный тираж! Соберите 12 кодов' },
  },
};

export const waveSchedules = {
  empty: datacenter,
  // Narrow corridors: fewer enemies at once, larger batches, a tougher CRPT.
  serverRoom: {
    ...datacenter,
    normal: {
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
      { time: 5, message: 'Серверный зал: стойки перекрывают проходы, используйте коридоры.' },
      { time: 60, message: 'Охлаждение на пределе: клиенты идут плотными пачками!' },
    ],
    elites: { first: 80, every: 70 },
    events: { ...datacenter.events, times: [70, 150, 230, 310] },
  },
};
