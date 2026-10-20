import { heroPassives } from './characters/hero-passives.js';

import { heroDefinitions } from './characters/heroes.js';

export const heroUnlockPrices = { traceability: 80, serialization: 100, ba: 120, qa: 140 };
// Heroes without a price are open from the start.
export const starterHeroes = Object.keys(heroDefinitions).filter(
  (id) => !Object.hasOwn(heroUnlockPrices, id),
);

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

// Price of the next rank of a permanent upgrade at `level` ranks: the base grows by itself each
// rank (base, 2·base, 3·base, ...). Personal (hero) training costs more than general upgrades.
export const upgradePriceBase = { general: 30, hero: 50 };
export const priceOf = (id, level) =>
  (permanentUpgrades[id].hero ? upgradePriceBase.hero : upgradePriceBase.general) * (level + 1);

// Level-up cards (src/systems/upgrades.js). An `effect` says what one rank does:
//   stat, value  adds `value` to the run stat `stat`
//   maxHp        raises the hero's maximum health
//   hp           adds health (may exceed the maximum: the maximum rises with it)
//   heal         restores health up to the maximum
//   fullHeal     restores all health
//   codes        pays codes at once
// Passives take the passive slots (`passiveSlots` in data/weapons.js) and evolve weapons.
export const levelUpPassives = [
  {
    id: 'might',
    name: 'Сила атаки',
    desc: '+15% к базовому урону всех атак.',
    effect: { stat: 'damage', value: 0.15 },
  },
  {
    id: 'tempo',
    name: 'Второе дыхание',
    desc: '+12% к темпу атак и перезарядке оружия.',
    effect: { stat: 'haste', value: 0.12 },
  },
  {
    id: 'area',
    name: 'Широкий размах',
    desc: '+12% к размеру оружия и областей урона.',
    effect: { stat: 'range', value: 0.12 },
  },
  {
    id: 'boots',
    name: 'Лёгкий шаг',
    desc: '+8% к скорости передвижения.',
    effect: { stat: 'speed', value: 0.08 },
  },
  {
    id: 'vitality',
    name: 'Запас здоровья',
    desc: '+20 к максимуму здоровья и восстановление 30 HP.',
    icon: '♥',
    effect: { maxHp: 20, heal: 30 },
  },
  {
    id: 'recovery',
    name: 'Восстановление',
    desc: 'Ещё 0,5 HP в секунду.',
    effect: { stat: 'regen', value: 0.5 },
  },
  {
    id: 'armor',
    name: 'Защита',
    desc: 'На 1 меньше урона от каждого попадания; минимум 1.',
    effect: { stat: 'armor', value: 1 },
  },
  {
    id: 'magnet',
    name: 'Притяжение предметов',
    desc: '+30 к радиусу притяжения кодов и опыта.',
    effect: { stat: 'magnet', value: 30 },
  },
];
export const passiveIcon = '✦';
export const passiveMaxRank = 5;

// Supplies fill a level-up when fewer than four cards remain.
export const supplyCards = [
  {
    id: 'herbs',
    name: 'Восстановление',
    desc: '+0,1 HP регенерации в секунду.',
    icon: '♥',
    effect: { stat: 'regen', value: 0.1 },
  },
  {
    id: 'food',
    name: 'Передышка',
    desc: 'Восстановить всё здоровье.',
    icon: '♥',
    effect: { fullHeal: true },
  },
  {
    id: 'loot',
    name: 'Бонусные коды',
    desc: 'Получить 3 кода маркировки.',
    icon: '◈',
    effect: { codes: 3 },
  },
  {
    id: 'reserve',
    name: 'Запас сил',
    desc: '+5 к максимуму и текущему здоровью.',
    icon: '♥',
    effect: { maxHp: 5, hp: 5 },
  },
];

// Texts of the level-up cards and the build. `{from}`, `{to}`, `{max}`, `{name}`, `{desc}`
// and `{passive}` are filled in by the upgrade system.
export const cardTexts = {
  heroWeapon: { name: 'Атака героя', icon: '⚔' },
  abilityIcon: '◆',
  groups: {
    hero: 'Оружие героя',
    weapon: 'Оружие',
    newWeapon: 'Новое оружие',
    passive: 'Пассивка',
    newPassive: 'Новая пассивка',
    ability: 'Активное умение',
    supply: 'Припасы',
  },
  isNew: 'Новое',
  level: 'Ур. {from} → {to}',
  rank: 'Ранг {from} → {to} из {max}',
  heroEvolution: 'Эволюция: {name}. {desc}',
  weaponEvolution: 'Эволюция: {name} (+ {passive})',
};
