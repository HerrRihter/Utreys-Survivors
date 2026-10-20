// Each hero's role and innate passive. `stats` add to `state.stats` at the start of a run;
// `training` is the hero's permanent shop upgrade and strengthens the same passive.
// Stat meanings (read by the upgrade and combat systems):
//   weaponSlots  extra weapon slots
//   weaponBonus  extra damage share of picked-up weapons (not the hero attack)
//   crowdPer     damage share per enemy within `crowdRadius` of the hero, capped by crowdCap
//   farBonus     damage share against enemies farther than `farDistance` from the hero
//   clientHp     HP per kill of the BA client
//   crit         critical hit chance; scanCrit is added against recently scanned targets
export const crowdRadius = 160;
export const farDistance = 150;
export const critMultiplier = 1.8;
export const scanMarkSeconds = 2;

export const heroPassives = {
  utrace: {
    role: 'Универсал',
    roleDesc: 'Ровный во всём, лучший выбор для первого забега.',
    name: 'Универсальный стек',
    desc: '+1 слот оружия.',
    details: '+1 слот оружия: до 5 видов оружия вместе с атакой героя.',
    stats: { weaponSlots: 1, weaponBonus: 0 },
    training: {
      name: 'Оптимизация Utrace',
      desc: '+6% к урону подобранного оружия',
      stat: 'weaponBonus',
      factor: 0.06,
    },
  },
  traceability: {
    role: 'Против толпы',
    roleDesc: 'Чем плотнее толпа вокруг, тем сильнее каждый удар.',
    name: 'Связанные данные',
    desc: 'Чем больше врагов рядом, тем сильнее удары.',
    details: `+3% урона за каждого врага ближе ${crowdRadius} px, максимум +30%.`,
    stats: { crowdPer: 0.03, crowdCap: 0.3 },
    training: {
      name: 'Оптимизация: Полная прослеживаемость',
      desc: '+10% к пределу бонуса за толпу',
      stat: 'crowdCap',
      factor: 0.1,
    },
  },
  serialization: {
    role: 'Дальний бой',
    roleDesc: 'Держит дистанцию и расстреливает врагов на подходе.',
    name: 'Дальняя доставка',
    desc: '+20% урона по дальним врагам.',
    details: `+20% урона по врагам дальше ${farDistance} px от героя.`,
    stats: { farBonus: 0.2 },
    training: {
      name: 'Оптимизация: Сериализация',
      desc: '+7% к урону по дальним врагам',
      stat: 'farBonus',
      factor: 0.07,
    },
  },
  ba: {
    role: 'Танк',
    roleDesc: 'Растёт в здоровье по ходу забега и гасит атаки переговорами.',
    name: 'Ключевой клиент',
    desc: '+1 HP за каждого побеждённого клиента.',
    details:
      '+1 к текущему и максимальному HP за каждое убийство выбранного клиента, до конца забега.',
    stats: { clientHp: 1 },
    training: {
      name: 'Оптимизация: БА',
      desc: '+0,5 HP за убийство клиента',
      stat: 'clientHp',
      factor: 0.5,
    },
  },
  qa: {
    role: 'Контроль',
    roleDesc: 'Останавливает врагов и добивает отмеченные цели критами.',
    name: 'Найденный дефект',
    desc: 'Критические удары, особенно по отмеченным целям.',
    details: `10% шанс крита (×${String(critMultiplier).replace('.', ',')} урона); по целям из скана ${scanMarkSeconds} с — ещё +35%.`,
    stats: { crit: 0.1, scanCrit: 0.35 },
    training: {
      name: 'Оптимизация: QA',
      desc: '+4% к шансу крита',
      stat: 'crit',
      factor: 0.04,
    },
  },
};
