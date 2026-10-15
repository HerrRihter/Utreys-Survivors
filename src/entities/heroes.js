import {heroDefinitions} from '../../data/characters/heroes.js';
import {Village} from '../world/village/village.js';
import {ProjectileArt} from '../rendering/art/projectile-art.js';
import {HelmetArt} from '../rendering/art/villager-art.js';
export let Villagers;
'use strict';
Villagers=(()=>{
 const defs=heroDefinitions;
 // Deliberately simple code-drawn prototype portraits, distinct from finished hero atlases.
 const colors={placeholder:['#647d8e','#d4d1c8']};
 function draw(g,id,x,y,size=3,flip=false,phase=0){
  if(!colors[id])return false;g.save();g.translate(x,y);g.scale((flip?-1:1)*size,size);const [shirt,hair]=colors[id],step=Math.sin(phase*6.28)*1.3;
  g.fillStyle='#242c29';g.fillRect(-6,-3+step,5,3);g.fillRect(2,-3-step,5,3);
  g.fillStyle=shirt;g.fillRect(-6,-17,12,14);g.fillStyle='#efba85';g.fillRect(-5,-25,10,9);g.fillRect(4,-21,4,3);g.fillRect(-9,-15,3,7);g.fillRect(6,-15,3,7);g.fillStyle=hair;g.fillRect(-6,-28,12,5);g.fillStyle='#222b28';g.fillRect(3,-23,1,2);
  if(id==='panoramix'){g.fillStyle=hair;g.fillRect(-4,-18,10,8);g.fillRect(-1,-10,5,5);g.fillStyle='#91643b';g.fillRect(10,-26,2,26);g.fillStyle='#84ac47';g.fillRect(-12,-11,5,7);}
  if(id==='cacofonix'){g.fillStyle='#83532e';g.fillRect(7,-17,7,11);g.fillStyle='#f4da85';g.fillRect(9,-15,3,7);g.fillStyle='#ddbf48';g.fillRect(-6,-21,2,7);}
  if(id==='antisanitarix'){g.fillStyle='#ece0c1';g.fillRect(-6,-16,10,11);g.fillStyle='#78976a';g.fillRect(7,-11,10,4);g.fillRect(14,-14,3,10);}
  if(id==='automatix'){g.fillStyle='#422f28';g.fillRect(-5,-18,11,4);g.fillStyle='#967045';g.fillRect(9,-19,3,15);g.fillStyle='#9daaa5';g.fillRect(6,-23,10,7);}
  g.restore();return true;
 }
 function fish(s,dir,options={}){const count=options.count??1+(s.stats.fishCount||0),angle=Math.atan2(dir.y,dir.x);for(let i=0;i<count;i++){const a=angle+(i-(count-1)/2)*(options.spread?options.spread/Math.max(1,count-1):.22);s.fish.push({x:s.p.x,y:s.p.y,dx:Math.cos(a),dy:Math.sin(a),age:0,damage:options.damage??24,back:false,hit:new Set(),r:12*s.stats.range});}}
 function update(s,id,dt,hit,world=Village,effective=s.stats){
  const p=s.p,st=effective;if(p.visualAction){p.visualAction.elapsed+=dt;if(p.visualAction.elapsed>=p.visualAction.duration)p.visualAction=null;}
  if(id==='cacofonix'&&!(p.stun>0)){
   s.music-=dt;if(s.music<=0){s.music=.6/st.haste;p.visualAction={elapsed:0,duration:.5/st.haste,flip:p.flip};s.fx.push({kind:'ring',x:p.x,y:p.y,r:95*st.range*(1+(st.musicRange||0)),life:.45,max:.45});
    for(const e of s.enemies)if(e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<95*st.range*(1+(st.musicRange||0))+e.r&&world.clear(p,e,2)){const d=Math.max(1,Math.hypot(e.x-p.x,e.y-p.y)),push=st.musicPush||0;hit(e,12*st.damage*(1+(st.musicDamage||0)),(e.x-p.x)/d*push,(e.y-p.y)/d*push,p);}
   }
  }
  if(id==='panoramix'){s.trail-=dt;p.pourCooldown=Math.max(0,(p.pourCooldown||0)-dt);if(p.moving&&s.trail<=0){s.trail=.22/st.haste;if(!p.visualAction&&!p.pourCooldown){p.visualAction={elapsed:0,duration:.4/st.haste,flip:p.flip};p.pourCooldown=1.6;}s.poison.push({x:p.x,y:p.y,r:30*st.range*(1+(st.poisonRange||0)),life:3.5+(st.poisonDuration||0)});}}
  for(const puddle of s.poison)puddle.life-=dt;s.poison=s.poison.filter(q=>q.life>0);
  s.poisonTick-=dt;if(s.poisonTick<=0){s.poisonTick=.5/st.haste;for(const e of s.enemies)if(e.hp>0&&s.poison.some(q=>Math.hypot(e.x-q.x,e.y-q.y)<q.r+e.r&&world.clear(q,e,2)))hit(e,8*st.damage*(1+(st.poisonDamage||0)));}
  for(const f of s.fish){
   f.age+=dt;if(!f.back&&f.age>=.65){f.back=true;f.hit.clear();}
   const d=Math.hypot(p.x-f.x,p.y-f.y);if(f.back&&d<20){f.dead=true;continue;}
   const vx=(f.back?(p.x-f.x)/Math.max(1,d):f.dx)*(310*(1+(st.fishSpeed||0))),vy=(f.back?(p.y-f.y)/Math.max(1,d):f.dy)*(310*(1+(st.fishSpeed||0)));f.vx=vx;f.vy=vy;
   const n=Math.max(1,Math.ceil(Math.hypot(vx,vy)*dt/6));
   for(let i=0;i<n&&!f.dead;i++){const next={x:f.x+vx*dt/n,y:f.y+vy*dt/n};
    if(!world.clear(f,next,3)){if(f.back)f.dead=true;else{f.back=true;f.hit.clear();}break;}
    f.x=next.x;f.y=next.y;
    for(const e of s.enemies)if(e.hp>0&&!f.hit.has(e)&&Math.hypot(e.x-f.x,e.y-f.y)<e.r+f.r){f.hit.add(e);hit(e,(f.damage??24)*st.damage*(f.back?1+(st.fishReturn||0):1),vx*.12,vy*.12,f);}
   }if(f.age>3)f.dead=true;
  }s.fish=s.fish.filter(f=>!f.dead);
 }
 function ground(g,s,id,effective=s.stats){
  const st=effective;
  for(const q of s.poison){g.fillStyle='#79a74455';g.beginPath();g.ellipse(q.x,q.y,q.r,q.r*.6,0,0,Math.PI*2);g.fill();g.fillStyle='#bfdc7755';g.fillRect(q.x-5,q.y-3,4,3);}
  if(id==='cacofonix'){const radius=95*st.range*(1+(st.musicRange||0));g.strokeStyle='#e8c67255';g.lineWidth=2;g.beginPath();g.arc(s.p.x,s.p.y,radius,0,Math.PI*2);g.stroke();g.font='18px serif';g.fillStyle='#f4d778';for(let i=0;i<5;i++){const a=s.step*1.3+i*Math.PI*2/5;g.fillText('♫',s.p.x+Math.cos(a)*radius*.79,s.p.y+Math.sin(a)*radius*.58-15);}}
 }
 function projectiles(g,s){for(const f of s.fish)ProjectileArt.drawFish(g,f);}
 function helmet(g,x,y,scale=1){if(typeof HelmetArt!=='undefined'&&HelmetArt.draw(g,x,y,scale))return;g.save();g.translate(x,y);g.scale(scale,scale);g.fillStyle='#273b32';g.fillRect(-9,4,19,4);g.fillStyle='#b8c5c7';g.beginPath();g.arc(0,0,8,Math.PI,0);g.lineTo(8,3);g.lineTo(-8,3);g.fill();g.fillStyle='#e1e7de';g.fillRect(-5,-5,3,5);g.fillStyle='#718d95';g.fillRect(-10,2,20,3);g.fillRect(4,4,4,5);g.restore();}
 return {defs,draw,fish,update,ground,projectiles,helmet};
})();
