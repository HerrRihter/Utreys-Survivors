export const abilityDefinitions = {
 placeholder:[
  {id:'dash',name:'Рывок',cooldown:10,duration:.22,description:'Короткий рывок вперёд.'},
  {id:'potion',name:'Ускорение',cooldown:26,duration:6,description:'На 6 секунд ускоряет атаки и движение.'}
 ]
};

export const abilityUpgradeDescriptions = {
 dash:'+25% к базовому урону рывка за ранг.',
 potion:'Ускорение действует на 1 секунду дольше за ранг.'
};
export const abilityUpgradeMax=3;
export const abilityUpgradeId=id=>'ability_'+id;
export const abilityRank=(state,id)=>state.upgradeRanks?.[abilityUpgradeId(id)]||0;
