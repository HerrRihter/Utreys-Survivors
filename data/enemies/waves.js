export const waveSchedules = {
  empty: {
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
          cap: 14,
          weights: [
            ['l3', 4],
            ['pepsi', 2]
          ]
        },
        {
          time: 60,
          interval: 2.6,
          minInterval: 2.6,
          timeFactor: 0,
          batch: 3,
          batchEvery: null,
          cap: 24,
          weights: [
            ['l3', 3],
            ['pepsi', 3],
            ['mars', 2]
          ]
        },
        {
          time: 150,
          interval: 2.2,
          minInterval: 2.2,
          timeFactor: 0,
          batch: 4,
          batchEvery: null,
          cap: 35,
          weights: [
            ['pepsi', 3],
            ['mars', 3],
            ['inbev', 2]
          ]
        },
        {
          time: 240,
          interval: 1.8,
          minInterval: 1.8,
          timeFactor: 0,
          batch: 5,
          batchEvery: null,
          cap: 50,
          weights: [
            ['l3', 2],
            ['pepsi', 3],
            ['inbev', 3],
            ['mars', 2]
          ]
        }
      ]
    },
    recurring: [
      {
        unit: 'inbev',
        first: 45,
        populationCap: 6,
        stages: [{ time: 0, every: 20, cap: 3 }],
        message: 'Клиент Инбев запрашивает агрегацию паллет!'
      },
      {
        unit: 'mars',
        first: 60,
        populationCap: 8,
        stages: [{ time: 0, every: 18, cap: 4 }],
        message: 'Клиент Марс направляет тираж кодов!'
      }
    ],
    boss: {
      unit: 'crpt',
      time: 120,
      message: 'ВНИМАНИЕ: Подключение шлюза ЦРПТ! Валидация криптохвостов!',
      sound: 'boss'
    },
    population: null,
    residents: [],
    notifications: [
      { time: 5, message: 'Сеть L3 активирована. Обработка потока кодов маркировки.' },
      { time: 30, message: 'Линии Пепси подключены: входящий поток запросов розлива!' },
      { time: 90, message: 'Высокая нагрузка: клиенты требуют мгновенного отчёта о нанесении!' }
    ]
  }
};
