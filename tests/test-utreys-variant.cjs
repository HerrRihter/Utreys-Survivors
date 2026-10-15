'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

async function main(){
  const {heroDefinitions}=await import('../data/characters/heroes.js');
  const {abilityDefinitions}=await import('../data/characters/abilities.js');
  const {mapDefinitions}=await import('../data/maps/maps.js');
  const {waveSchedules}=await import('../data/enemies/waves.js');
  const {achievementDefinitions}=await import('../data/achievements.js');
  const {Village}=await import('../src/world/village/village.js');
  const {createArenas}=await import('../src/world/arenas.js');

  assert.deepEqual(Object.keys(heroDefinitions),['placeholder']);
  assert.equal(heroDefinitions.placeholder.name,'Персонаж-заглушка');
  assert.equal(abilityDefinitions.placeholder.length,2);
  assert.deepEqual(Object.keys(mapDefinitions),['empty']);
  assert.equal(waveSchedules.empty.active,false);
  assert.equal(waveSchedules.empty.boss,null);
  assert.equal(waveSchedules.empty.recurring.length,0);
  assert.equal(achievementDefinitions.some(({category})=>category==='combat'),false);
  for(const achievement of achievementDefinitions.filter(({category})=>category==='mastery')){
    assert.equal(achievement.getProgress({stats:{abilitiesUsed:achievement.target}}),achievement.target);
  }

  const arena=createArenas(Village).get('empty');
  assert.equal(arena.objects.length,0);
  assert.equal(arena.roads.length,0);
  assert.equal(arena.houses.length,0);
  assert.equal(arena.clear({x:500,y:500},{x:510,y:510},14),true);
  assert.equal(arena.blocked(5,5,14),true);

  const publicFiles=['index.html','opponents-preview.html','village-preview.html','README.md','documentation.md','metadata.json','data/achievements.js'];
  const factionNames=/gaul|roman|legion|галл|римлян|римск|легион/i;
  for(const file of publicFiles){
    assert.equal(factionNames.test(fs.readFileSync(path.join(root,file),'utf8')),false,`${file} contains removed faction references`);
  }

  console.log('PASS: one placeholder character, one empty arena, working generic systems and neutral public copy.');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
