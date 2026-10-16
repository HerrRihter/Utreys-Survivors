// Q is the shared dash; E is each hero's own ability. `rankDuration` adds seconds per rank,
// `upgrade` describes one rank on the level-up card and in the HUD tooltip.
const dash = {
  id: 'dash',
  name: 'Пакетный сброс',
  cooldown: 8,
  duration: 0.22,
  description: 'Мгновенная выгрузка буфера и резкое перемещение с уроном по цепи валидации.',
  upgrade: '+25% к базовому урону пакетного сброса за ранг.',
};

const heroAbilities = {
  utrace: {
    id: 'potion',
    name: 'Оверклокинг',
    cooldown: 22,
    duration: 6,
    rankDuration: 1,
    description:
      'Разгон ядра Utrace: на 6 секунд ускоряет темп атак и скорость обработки запросов.',
    upgrade: 'Оверклокинг действует на 1 секунду дольше за ранг.',
  },
  traceability: {
    id: 'registry',
    name: 'Реестр',
    cooldown: 20,
    duration: 5,
    rankDuration: 1,
    description: 'На 5 секунд цепь прослеживаемости бьёт всю связанную группу без лимита целей.',
    upgrade: 'Реестр действует на 1 секунду дольше за ранг.',
  },
  serialization: {
    id: 'volley',
    name: 'Залп',
    cooldown: 14,
    duration: 0.3,
    // Packets in the fan and their share of the hero's packet damage.
    count: 12,
    power: 0.8,
    description: 'Выпускает 12 пробивающих пакетов веером во все стороны.',
    upgrade: '+25% к урону пакетов залпа за ранг.',
  },
  ba: {
    id: 'negotiate',
    name: 'Переговоры',
    cooldown: 24,
    duration: 4,
    rankDuration: 1,
    radius: 240,
    description:
      'На 4 секунды обычные враги рядом перестают атаковать, а выбранный клиент — по всей карте.',
    upgrade: 'Переговоры действуют на 1 секунду дольше за ранг.',
  },
  qa: {
    id: 'regress',
    name: 'Регресс',
    cooldown: 18,
    duration: 3,
    radius: 140,
    stun: 2,
    description:
      'Ставит зону регресса на 3 секунды: обычные враги, вошедшие в неё, замирают на 2 секунды.',
    upgrade: 'Враги в зоне регресса замирают на 0,5 секунды дольше за ранг.',
  },
};

export const abilityDefinitions = Object.fromEntries(
  Object.entries(heroAbilities).map(([hero, ability]) => [hero, [{ ...dash }, { ...ability }]]),
);

export const abilityUpgradeDescriptions = Object.fromEntries(
  [dash, ...Object.values(heroAbilities)].map((a) => [a.id, a.upgrade]),
);
export const abilityUpgradeMax = 3;
export const abilityUpgradeId = (id) => 'ability_' + id;
export const abilityRank = (state, id) => state.upgradeRanks?.[abilityUpgradeId(id)] || 0;
