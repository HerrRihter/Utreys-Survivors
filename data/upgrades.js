import { heroPassives } from './characters/hero-passives.js';

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
  greed: {
    name: 'Монетизация',
    desc: '+5% кодов в конце забега',
    max: 5,
    stat: 'greed',
    factor: 0.05,
  },
  luck: {
    name: 'Удачный парсинг',
    desc: '+1% шанс кода и +0,5% шанс еды с врага',
    max: 5,
    stat: 'luck',
    factor: 0.01,
  },
  headStart: {
    name: 'Предзагрузка',
    desc: 'Забег начинается с левелапа',
    max: 2,
    stat: 'headStart',
    factor: 1,
  },
  // Level-up controls: every run starts with one of each, ranks add more. They are sold only
  // after the first win (`requires: 'win'`).
  rerolls: {
    name: 'Перегенерация',
    desc: '+1 реролл карточек за забег',
    max: 3,
    stat: 'rerolls',
    factor: 1,
    requires: 'win',
  },
  skips: {
    name: 'Отложенный релиз',
    desc: '+1 пропуск левелапа за забег',
    max: 3,
    stat: 'skips',
    factor: 1,
    requires: 'win',
  },
  banishes: {
    name: 'Чёрный список',
    desc: '+1 бан карточки за забег',
    max: 3,
    stat: 'banishes',
    factor: 1,
    requires: 'win',
  },
};
export const levelUpControls = ['rerolls', 'skips', 'banishes'];

// Hero trainings strengthen the hero's own passive (see data/characters/hero-passives.js).
export const heroTrainingDefinitions = Object.fromEntries(
  ['traceability', 'serialization', 'ba', 'qa', 'utrace'].map((hero) => [
    hero,
    { ...heroPassives[hero].training, max: 3 },
  ]),
);

export const permanentUpgrades = {
  ...permanentUpgradeDefinitions,
  ...Object.fromEntries(
    Object.entries(heroTrainingDefinitions).map(([hero, def]) => [
      'training_' + hero,
      { name: def.name, desc: def.desc, max: def.max, hero, stat: def.stat, factor: def.factor },
    ]),
  ),
};
