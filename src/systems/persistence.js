import {heroUnlockPrices,permanentUpgrades} from '../../data/upgrades.js';
import {achievementDefinitions} from '../../data/achievements.js';
export let Progression;
'use strict';
Progression=(()=>{
 const key='utreys-progression-v1',prices=heroUnlockPrices,upgrades=permanentUpgrades;
 let data={helmets:0,kills:0,unlocked:['placeholder'],levels:{health:0,power:0,speed:0},stats:{totalTime:0,maxTime:0,bossKills:0,abilitiesUsed:0,maxLevel:0},claimedAchievements:[]},persistent=true;
 for(const id of Object.keys(upgrades))data.levels[id]=0;
 const integer=(v,max=1e9)=>Number.isSafeInteger(v)&&v>=0?Math.min(max,v):0;
 try{
  const saved=JSON.parse(localStorage.getItem(key));
  if(saved&&typeof saved==='object'){
   data.helmets=integer(saved.helmets);
   data.kills=integer(saved.kills);
   if(Array.isArray(saved.unlocked))data.unlocked=[...new Set(['placeholder',...saved.unlocked.filter(id=>Object.hasOwn(prices,id))])];
   for(const id of Object.keys(upgrades))data.levels[id]=integer(saved.levels?.[id],upgrades[id].max);
   if(saved.stats&&typeof saved.stats==='object'){
    data.stats.totalTime=typeof saved.stats.totalTime==='number'&&saved.stats.totalTime>=0?saved.stats.totalTime:0;
    data.stats.maxTime=typeof saved.stats.maxTime==='number'&&saved.stats.maxTime>=0?saved.stats.maxTime:0;
    data.stats.bossKills=integer(saved.stats.bossKills);
    data.stats.abilitiesUsed=integer(saved.stats.abilitiesUsed);
    data.stats.maxLevel=integer(saved.stats.maxLevel);
   }
   if(Array.isArray(saved.claimedAchievements))data.claimedAchievements=[...new Set(saved.claimedAchievements.filter(id=>achievementDefinitions.some(a=>a.id===id)))];
  }
 }catch{}
 let dirty=false,pending=null,idle=null;
 function flush(){
  if(pending!==null){clearTimeout(pending);pending=null;}
  if(idle!==null){globalThis.cancelIdleCallback?.(idle);idle=null;}
  if(!dirty)return;
  try{localStorage.setItem(key,JSON.stringify(data));persistent=true;dirty=false;}catch{persistent=false;}
 }
 function save(){dirty=true;flush();}
 // Combat only updates memory. Coalesce rewards into one write outside the
 // simulation, preferably when the browser has idle time between frames.
 function deferSave(){
  dirty=true;
  if(pending!==null||idle!==null)return;
  if(typeof setTimeout!=='function'){flush();return;}
  pending=setTimeout(()=>{
   pending=null;
   if(globalThis.requestIdleCallback)idle=globalThis.requestIdleCallback(()=>{idle=null;flush();},{timeout:2000});
   else flush();
  },1000);
 }
 globalThis.addEventListener?.('pagehide',flush);
 globalThis.document?.addEventListener?.('visibilitychange',()=>{if(document.hidden)flush();});
 function earn(amount){if(!Number.isSafeInteger(amount)||amount<=0)return 0;data.helmets+=amount;deferSave();return amount;}
 function kill(){data.kills++;const reward=data.kills%10===0?1:0;data.helmets+=reward;deferSave();return reward;}
 const owned=id=>data.unlocked.includes(id);
 const cost=id=>Object.hasOwn(upgrades,id)?(upgrades[id].hero?50:30)*(data.levels[id]+1):prices[id];
 function buyHero(id){if(!Object.hasOwn(prices,id)||owned(id)||data.helmets<prices[id])return false;data.helmets-=prices[id];data.unlocked.push(id);save();return true;}
 function buyUpgrade(id){if(!Object.hasOwn(upgrades,id)||(upgrades[id].hero&&!owned(upgrades[id].hero))||data.levels[id]>=upgrades[id].max||data.helmets<cost(id))return false;data.helmets-=cost(id);data.levels[id]++;save();return true;}
 function grantArmorRank(){if(data.levels.armor>=upgrades.armor.max)return false;data.levels.armor++;deferSave();return true;}
 function recordTime(t){if(typeof t==='number'&&t>0){data.stats.totalTime+=t;data.stats.maxTime=Math.max(data.stats.maxTime,t);deferSave();}}
 function recordBossKill(){data.stats.bossKills++;deferSave();}
 function recordAbility(){data.stats.abilitiesUsed++;deferSave();}
 function recordLevel(lvl){if(typeof lvl==='number'&&lvl>0){data.stats.maxLevel=Math.max(data.stats.maxLevel,lvl);deferSave();}}
 function claimAchievement(id,best){
  const a=achievementDefinitions.find(x=>x.id===id);
  if(!a||data.claimedAchievements.includes(id))return false;
  const progress=a.getProgress(data,best);
  if(progress<a.target)return false;
  data.claimedAchievements.push(id);
  if(a.reward)data.helmets+=a.reward;
  save();
  return true;
 }
 const isClaimed=id=>data.claimedAchievements.includes(id);
 return {grantArmorRank,prices,upgrades,owned,cost,buyHero,buyUpgrade,earn,kill,flush,recordTime,recordBossKill,recordAbility,recordLevel,claimAchievement,isClaimed,get achievements(){return achievementDefinitions;},get stats(){return {...data.stats};},get claimedAchievements(){return [...data.claimedAchievements];},get helmets(){return data.helmets;},get armorRank(){return data.levels.armor;},get data(){return JSON.parse(JSON.stringify(data));},get persistent(){return persistent;}};
})();
