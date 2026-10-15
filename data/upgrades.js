export const heroUnlockPrices = { traceability: 80, serialization: 100, ba: 120, qa: 140 };

export const permanentUpgradeDefinitions = {
  health: {
    name: 'Буфер памяти',
    desc: '+10 HP к стабильности ядра',
    max: 5,
    stat: 'hp',
    factor: 10,
  },
  power: {
    name: 'Пропускная способность',
    desc: '+5% к урону трассировки',
    max: 5,
    stat: 'damage',
    factor: 0.05,
  },
  speed: {
    name: 'Тактовая частота',
    desc: '+3% к скорости перемещения',
    max: 5,
    stat: 'speed',
    factor: 0.03,
  },
  haste: {
    name: 'Многопоточность',
    desc: '+4% к темпу обработки',
    max: 5,
    stat: 'haste',
    factor: 0.04,
  },
  range: {
    name: 'Радиус сканирования',
    desc: '+4% к области охвата',
    max: 5,
    stat: 'range',
    factor: 0.04,
  },
  magnet: {
    name: 'Сбор пакетов',
    desc: '+10 к радиусу притяжения кодов',
    max: 5,
    stat: 'magnet',
    factor: 10,
  },
  armor: {
    name: 'Криптозащита',
    desc: '−1 входящего урона; минимум 1',
    max: 3,
    stat: 'armor',
    factor: 1,
  },
  regen: {
    name: 'Автовосстановление',
    desc: '+0,15 HP в секунду',
    max: 5,
    stat: 'regen',
    factor: 0.15,
  },
};

export const heroTrainingDefinitions = {
  traceability: {
    name: 'Оптимизация: Полная прослеживаемость',
    desc: '+6% к темпу основной атаки',
    max: 3,
    stat: 'punchTempo',
    factor: 0.06,
  },
  serialization: {
    name: 'Оптимизация: Сериализация',
    desc: '+6% к темпу основной атаки',
    max: 3,
    stat: 'punchTempo',
    factor: 0.06,
  },
  ba: {
    name: 'Оптимизация: БА',
    desc: '+6% к темпу основной атаки',
    max: 3,
    stat: 'punchTempo',
    factor: 0.06,
  },
  qa: {
    name: 'Оптимизация: QA',
    desc: '+6% к темпу основной атаки',
    max: 3,
    stat: 'punchTempo',
    factor: 0.06,
  },
  utrace: {
    name: 'Оптимизация Utrace',
    desc: '+6% к темпу обработки запросов',
    max: 3,
    stat: 'punchTempo',
    factor: 0.06,
  },
};

export const permanentUpgrades = {
  ...permanentUpgradeDefinitions,
  ...Object.fromEntries(
    Object.entries(heroTrainingDefinitions).map(([hero, def]) => [
      'training_' + hero,
      { name: def.name, desc: def.desc, max: def.max, hero, stat: def.stat, factor: def.factor },
    ]),
  ),
};
