import {getWaveSchedule,createWaveState} from '../systems/wave-schedule.js';
import {seedPopulation} from '../systems/population.js';
import {permanentUpgradeDefinitions} from '../../data/upgrades.js';
export let GameFlow;
'use strict';
GameFlow={create(sessionContext){
function recordRun(){
      const s=sessionContext.state;
      if(!s||s.resultRecorded)return;
      sessionContext.Progression.recordTime(s.t);
      sessionContext.Progression.recordLevel(s.level);
      s.resultRecorded=true;
    }
function start(){
      recordRun();
      if(!sessionContext.Progression.owned(sessionContext.selected))sessionContext.selected='placeholder';
      const hero=sessionContext.Villagers.defs[sessionContext.selected],levels=sessionContext.Progression.data.levels;
      sessionContext.resetInput();
      sessionContext.state={
        t:0,
        map:sessionContext.selectedMap,
        winePools:[],
        ...createWaveState(getWaveSchedule(sessionContext.selectedMap)),
        kills:0,
        level:1,
        xp:0,
        need:8,
        attack:.2,
        menhir:2,
        ring:1,
        enemies:[],
        corpses:[],
        enemyShots:[],
        shots:[],
        fish:[],
        poison:[],
        helmets:[],
        earned:0,
        music:0,
        trail:0,
        poisonTick:0,
        gems:[],
        fx:[],
        texts:[],
        pickups:[],
        bossDead:false,
        shake:0,
        step:0,
        stats:{
          damage:1+levels.power*permanentUpgradeDefinitions.power.factor,
          haste:1,
          range:1,
          speed:1+levels.speed*permanentUpgradeDefinitions.speed.factor,
          magnet:75,
          armor:0,
          regen:0,
          stones:0,
          orbit:0
        },
        p:{
          x:sessionContext.WORLD/2,
          y:sessionContext.WORLD/2,
          hp:hero.hp+levels.health*permanentUpgradeDefinitions.health.factor,
          max:hero.hp+levels.health*permanentUpgradeDefinitions.health.factor,
          speed:hero.speed,
          inv:0,
          flip:false,
          facing:{x:1,y:0}
        }
      };
      sessionContext.abilities.init();
      sessionContext.UpgradeSystem.permanent(sessionContext.state,sessionContext.selected,levels);
      sessionContext.Village.prepare(Object.values(sessionContext.Legion.units).map(unit=>unit.r),sessionContext.state.p);
      for(const resident of sessionContext.Village.residents||[])sessionContext.spawn(resident.unit,false,resident);
      seedPopulation(sessionContext);
      sessionContext.mode='play';
      ['menu','runHeroSelect','end','paused','levelup','bossbar','achievements','settings'].forEach(id=>sessionContext.show(id,false));
      ['hud','pause','stick'].forEach(id=>sessionContext.show(id,true));
      sessionContext.show('hint',sessionContext.gameSettings?.hints!==false);
      sessionContext.$('heroLabel').textContent=hero.name.toUpperCase();
      sessionContext.toast(sessionContext.arenaDefinitions[sessionContext.selectedMap].name.toUpperCase()+' · '+sessionContext.arenaDefinitions[sessionContext.selectedMap].description);
      sessionContext.soundEffect('ui');
      sessionContext.hud();
    }
function menu(){
      recordRun();
      sessionContext.Progression.flush();
      sessionContext.mode='menu';
      sessionContext.$('abilities').classList.toggle('hidden',true);
      sessionContext.state=null;
      sessionContext.resetInput();
      ['end','paused','levelup','hud','hint','pause','stick','bossbar','runHeroSelect','shop','achievements','settings'].forEach(id=>sessionContext.show(id,false));
      sessionContext.show('menu',true);
      sessionContext.renderShop();
      sessionContext.$('toast').style.opacity=0;
      sessionContext.updateRecord();
    }
function pause(){
      if(sessionContext.mode==='play'){
        sessionContext.Progression.flush();
        sessionContext.mode='pause';
        sessionContext.resetInput();
        sessionContext.show('settings',false);
        sessionContext.show('paused',true);
        sessionContext.abilities.hud();
      }else if(sessionContext.mode==='pause'){
        sessionContext.mode='play';
        sessionContext.show('settings',false);
        sessionContext.show('paused',false);
        sessionContext.show('hint',sessionContext.gameSettings?.hints!==false);
        sessionContext.abilities.hud();
      }
    }
function levelUp(){
      sessionContext.state.xp-=sessionContext.state.need;
      sessionContext.state.level++;
      sessionContext.state.need=sessionContext.Math.floor(sessionContext.state.need*1.23+3);
      sessionContext.mode='level';
      sessionContext.resetInput();
      sessionContext.choice=sessionContext.UpgradeSystem.offer(sessionContext.selected,sessionContext.state);
      sessionContext.$('cards').replaceChildren();
      sessionContext.choice.forEach((u,i)=>{
        const b=sessionContext.document.createElement('button');
        b.className='upgrade';
        b.innerHTML=`<em>${u.icon}</em><strong>${u.name}</strong><span>${u.group}${u.max?` · Ранг ${(sessionContext.state.upgradeRanks?.[u.id]||0)+1}/${u.max}`:``}</span><span>${u.desc}</span><span style="margin-top:16px;color:#788e77">[ ${i+1} ]</span>`;
        b.onclick=()=>pickUpgrade(i);
        sessionContext.$('cards').append(b);
      });
      sessionContext.show('levelup',true);
      sessionContext.soundEffect('level');
      sessionContext.hud();
    }
function pickUpgrade(i){
      if(sessionContext.mode!=='level'||!sessionContext.choice[i])return;
      sessionContext.UpgradeSystem.apply(sessionContext.choice[i],sessionContext.state);
      sessionContext.show('levelup',false);
      sessionContext.mode='play';
      sessionContext.soundEffect('ui');
      if(sessionContext.state.xp>=sessionContext.state.need)levelUp();
    }
function finish(win){
      if(!sessionContext.state||sessionContext.state.resultRecorded)return;
      recordRun();
      sessionContext.Progression.flush();
      sessionContext.finishAudio(win);
      sessionContext.mode='end';
      sessionContext.abilities.hud();
      sessionContext.resetInput();
      sessionContext.show('end',true);
      sessionContext.show('pause',false);
      sessionContext.show('stick',false);
      sessionContext.$('endTag').textContent=win?sessionContext.arenaDefinitions[sessionContext.selectedMap].victoryTag:'ЗАБЕГ ОКОНЧЕН';
      sessionContext.$('endTitle').textContent=win?'Забег завершён':'Попробовать ещё раз?';
      sessionContext.$('endText').textContent=win?'Отличный результат. Можно начать новый забег или проверить улучшения.':'Даже героям нужен привал. Попробуй другую сборку и вернись в игру.';
      sessionContext.$('endStats').innerHTML=`<div><strong>${sessionContext.clock(sessionContext.state.t)}</strong><span>ВРЕМЯ</span></div><div><strong>${sessionContext.state.kills}</strong><span>ПРОТИВНИКОВ ПОБЕЖДЕНО</span></div><div><strong>${sessionContext.state.level}</strong><span>УРОВЕНЬ</span></div><div><strong>+${sessionContext.state.earned}</strong><span>ЖЕТОНОВ</span></div>`;
      sessionContext.best={kills:sessionContext.Math.max(sessionContext.best.kills||0,sessionContext.state.kills),time:sessionContext.Math.max(sessionContext.best.time||0,sessionContext.state.t)};
      try{
        sessionContext.localStorage.setItem('utreys-best',JSON.stringify(sessionContext.best));
      }catch{
      }
    }
return {start,menu,pause,levelUp,pickUpgrade,finish};
}};
