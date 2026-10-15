import {CharacterFrameManifest} from '../../data/animations/character-frames.js';
export let SpriteRenderer;
'use strict';
SpriteRenderer={create(sessionContext){
const palette={
      '.':null,
      k:'#222a26',
      s:'#efb47c',
      S:'#cd8856',
      w:'#e5e3c8',
      b:'#6197bc',
      B:'#365974',
      r:'#c65642',
      R:'#833c35',
      y:'#ecc85d',
      g:'#86996f',
      G:'#566747',
      h:'#9aa99e',
      H:'#64796f',
      o:'#d8853f',
      p:'#a09ac2',
      P:'#635d82'
    };
const sprites={
      asterix:['....ww....ww....','.....wwhhww.....','.....hhhhhh.....','.....HHHHHH.....','......ssss......','.....ssksks.....','......syys......','.....yyyyyy.....','......kkkk......','....sskkkkss....','....sskkkkss....','......rrrr......','......rrrr......','......ss.ss.....','.....kkk.kkk....'],
      obelix:['......oooo......','.....oohhoo.....','.....hhhhh......','.....sssss......','....ssksskso....','....ossssoo.....','....ooyyoo......','...ssssssss.....','..ssssssssss....','..sswbbwbbwss...','...wwbbwwbbw....','...wwbbwwbbw....','...wwbbwwbbw....','....kk..kk......','...kkk..kkk.....'],
      roman:['.......rr.......','......rrrr......','.....hhhhhh.....','.....HHHHHH.....','......ssss......','......sksk......','......ssss......','.....RRRRRR.....','..h..RwwwwRg....','..hssRwwwwRgg...','..h..RwwwwRgg...','.....rrrrrrg....','......s..s......','......s..s......','.....kk..kk.....'],
      
      
      boss:['......rrrr......','....rrrrrrrr....','.....yyyyyy.....','....hhhhhhhh....','.....ssssss.....','.....skssks.....','.....ssssss.....','....yyyyyyyy....','...RRhyyhRRR....','..hRRhhhhRRRgg..','..hRRhhhhRRRgg..','..h..rrrrrr.gg..','.....ss..ss.....','.....ss..ss.....','....kkk..kkk....']
    };
const spriteCache={};
for(const [name,rows] of Object.entries(sprites)){
      const c=sessionContext.document.createElement('canvas');
      c.width=16;
      c.height=16;
      const g=c.getContext('2d');
      rows.forEach((row,y)=>[...row].forEach((v,x)=>{
        if(palette[v]){
          g.fillStyle=palette[v];
          g.fillRect(x,y,1,1);
        }
      }));
      spriteCache[name]=c;
    }
function sprite(g,name,x,y,size=2,flip=false,bob=0,flash=false,phase=0,actor=null){
      if(typeof sessionContext.VillagerArt!=='undefined'&&sessionContext.VillagerArt.draw(g,name,x,y,actor,flip))return;
      if(sessionContext.Villagers.draw(g,name,x,y,size,flip,actor?.walk||0))return;
      const hurt=actor&&actor.hurt,attack=actor&&actor.action,action=hurt?'hurt':attack?'attack':actor&&actor.moving?'walk':'idle';
      const progress=hurt?hurt.elapsed/hurt.duration:attack?attack.elapsed/attack.duration:actor?actor.walk||0:0;
      const animated=typeof sessionContext.AnimationArt!=='undefined'?sessionContext.AnimationArt.get(name,sessionContext.Math.floor(phase)%3,action,progress):null;
      g.save();
      g.translate(sessionContext.Math.round(x),sessionContext.Math.round(y+(animated?0:bob)));
      const roman=name==='roman'||name==='boss',facing=hurt?hurt.flip:attack?attack.flip:flip;
      if(animated?facing:roman?!facing:facing)g.scale(-1,1);
      if(flash&&!hurt)g.globalAlpha=.45;
      const hero=typeof sessionContext.HeroArt!=='undefined'?sessionContext.HeroArt.get(name):null;
      if(animated){
        const [anchorX,anchorY]=CharacterFrameManifest.anchor;
        g.drawImage(animated,-anchorX,-anchorY);
      }
  else if(hero){
        g.drawImage(hero,-48,-91,96,96);
      }
  else if(roman){
        const frame=sessionContext.Math.floor((sessionContext.state?sessionContext.state.step:sessionContext.performance.now()/1000)*7+phase)%4;
        const art=sessionContext.RomanArt.get(sessionContext.Math.floor(phase)%3,frame,name==='boss');
        const scale=name==='boss'?1.5:1.25;
        g.drawImage(art,-24*scale,-61*scale,48*scale,64*scale);
      }
  else g.drawImage(spriteCache[name],-8*size,-15*size,16*size,16*size);
      g.restore();
    }
return {sprite};
}};
