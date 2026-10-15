export const heroUnlockPrices = {
};

export const permanentUpgradeDefinitions = {
  health: {name: 'Запас здоровья', desc: '+10 HP персонажу', max: 5, stat: 'hp', factor: 10},
  power: {name: 'Сила атаки', desc: '+5% урона персонажу', max: 5, stat: 'damage', factor: 0.05},
  speed: {name: 'Скорость движения', desc: '+3% скорости персонажа', max: 5, stat: 'speed', factor: 0.03},
  haste: {name: 'Выносливость', desc: '+4% к темпу атак', max: 5, stat: 'haste', factor: 0.04},
  range: {name: 'Размах', desc: '+4% к размеру атак', max: 5, stat: 'range', factor: 0.04},
  magnet: {name: 'Сумка трофеев', desc: '+10 к радиусу сбора', max: 5, stat: 'magnet', factor: 10},
  armor: {name: 'Крепкая кожа', desc: '−1 входящего урона; минимум 1', max: 3, stat: 'armor', factor: 1},
  regen: {name: 'Травяной чай', desc: '+0,15 HP в секунду', max: 5, stat: 'regen', factor: 0.15}
};

export const heroTrainingDefinitions = {
  placeholder: {name: 'Тренировка атаки', desc: '+6% к темпу атак', max: 3, stat: 'punchTempo', factor: 0.06}
};

export const permanentUpgrades = {
  ...permanentUpgradeDefinitions,
  ...Object.fromEntries(
    Object.entries(heroTrainingDefinitions).map(([hero, def]) => [
      'training_' + hero,
      {name: def.name, desc: def.desc, max: def.max, hero, stat: def.stat, factor: def.factor}
    ])
  )
};
