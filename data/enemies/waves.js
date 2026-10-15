export const waveSchedules = {
  empty: {
    active: true,
    normal: {
      firstDelay: 2,
      stages: [
        { until: 60, interval: 3.2, batch: 2, cap: 14, roster: [{ unit: 'l3', weight: 4 }, { unit: 'pepsi', weight: 2 }] },
        { until: 150, interval: 2.6, batch: 3, cap: 24, roster: [{ unit: 'l3', weight: 3 }, { unit: 'pepsi', weight: 3 }, { unit: 'mars', weight: 2 }] },
        { until: 240, interval: 2.2, batch: 4, cap: 35, roster: [{ unit: 'pepsi', weight: 3 }, { unit: 'mars', weight: 3 }, { unit: 'inbev', weight: 2 }] },
        { until: 300, interval: 1.8, batch: 5, cap: 50, roster: [{ unit: 'l3', weight: 2 }, { unit: 'pepsi', weight: 3 }, { unit: 'inbev', weight: 3 }, { unit: 'mars', weight: 2 }] }
      ]
    },
    recurring: [
      { unit: 'inbev', first: 45, populationCap: 6, stages: [{ until: 300, every: 20, cap: 3 }], message: 'Клиент Инбев запрашивает агрегацию паллет!' },
      { unit: 'mars', first: 60, populationCap: 8, stages: [{ until: 300, every: 18, cap: 4 }], message: 'Клиент Марс направляет тираж кодов!' }
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
