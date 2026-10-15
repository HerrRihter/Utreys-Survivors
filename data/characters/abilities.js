export const abilityDefinitions = {
  utrace: [
    { id: 'dash', name: 'Пакетный сброс', cooldown: 8, duration: 0.22, description: 'Мгновенная выгрузка буфера и резкое перемещение с уроном по цепи валидации.' },
    { id: 'potion', name: 'Оверклокинг', cooldown: 22, duration: 6, description: 'Разгон ядра Utrace: на 6 секунд ускоряет темп атак и скорость обработки запросов.' }
  ]
};

export const abilityUpgradeDescriptions = {
  dash: '+25% к базовому урону пакетного сброса за ранг.',
  potion: 'Оверклокинг действует на 1 секунду дольше за ранг.'
};
export const abilityUpgradeMax = 3;
export const abilityUpgradeId = id => 'ability_' + id;
export const abilityRank = (state, id) => state.upgradeRanks?.[abilityUpgradeId(id)] || 0;
