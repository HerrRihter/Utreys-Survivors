// Q is the shared dash; E is each hero's own ability. `rankDuration` adds seconds per rank,
// `upgrade` describes one rank on the level-up card and in the HUD tooltip.
// `kind` names what the ability does (src/systems/abilities/index.js): lunge (dash with hits),
// boost (only `statMods`), fan (packets in every direction: `count`, `power`), truce
// (`radius`), field (a zone at the cast point: `radius`, `stun`).
// While an ability runs:
//   statMods  changes the run's stats: { stat: { set } } or { stat: { mul, base } }, value =
//             (stat + base) × mul − base (see effectiveStats in src/systems/queries/abilities.js)
//   protects  the hero takes no hits, does not strike and ignores movement input
//   ring      colour of the ring drawn around the hero
const dash = {
  id: 'dash',
  kind: 'lunge',
  protects: true,
  name: 'Пакетный сброс',
  cooldown: 8,
  duration: 0.22,
  description: 'Мгновенная выгрузка буфера и резкое перемещение с уроном по цепи валидации.',
  upgrade: '+25% к базовому урону пакетного сброса за ранг.',
};

const heroAbilities = {
  utrace: {
    id: 'overclock',
    kind: 'boost',
    // Faster strikes and steps; the strike's push (the hero's 145 plus upgrades) grows by half.
    statMods: { haste: { mul: 1.6 }, speed: { mul: 1.15 }, punchForce: { base: 145, mul: 1.5 } },
    ring: '#6ca99a',
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
    kind: 'boost',
    statMods: { chainUnlimited: { set: true } },
    ring: '#6de2cd',
    name: 'Реестр',
    cooldown: 20,
    duration: 5,
    rankDuration: 1,
    description: 'На 5 секунд цепь прослеживаемости бьёт всю связанную группу без лимита целей.',
    upgrade: 'Реестр действует на 1 секунду дольше за ранг.',
  },
  serialization: {
    id: 'volley',
    kind: 'fan',
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
    kind: 'truce',
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
    kind: 'field',
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
// Ability ids renamed since older saves and run journals: old id → current id.
const renamedAbilityIds = { potion: 'overclock' };
export const currentAbilityId = (id) => renamedAbilityIds[id] ?? id;
// A level-up card id (`ability_<id>` for abilities) from an older save under its current name.
export const currentCardId = (id) =>
  typeof id === 'string' && id.startsWith('ability_')
    ? abilityUpgradeId(currentAbilityId(id.slice('ability_'.length)))
    : id;
export const abilityUpgradeId = (id) => 'ability_' + id;
export const abilityRank = (state, id) => state.upgradeRanks?.[abilityUpgradeId(id)] || 0;
