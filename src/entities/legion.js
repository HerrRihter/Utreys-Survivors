import {drawExpansion,expansionTelegraph} from '../rendering/art/expansion-art.js';
import {unitDefinitions} from '../../data/enemies/units.js';
import {ProjectileArt} from '../rendering/art/projectile-art.js';
import {UnitArt} from '../rendering/art/unit-art.js';
export let Legion;
'use strict';
Legion=(()=>{
 const units=unitDefinitions;
 const labels=new Map();
 function drawLabel(g,u,x,y){
  let label=labels.get(u);
  if(!label&&typeof document!=='undefined'){
   const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
   ctx.font='bold 10px monospace';
   const width=Math.ceil(ctx.measureText(u.name).width)+4,height=18;
   // Render once at 2x for both standard and high-DPI game canvases.
   canvas.width=width*2;canvas.height=height*2;
   ctx.scale(2,2);ctx.font='bold 10px monospace';ctx.textAlign='center';ctx.fillStyle=u.color;
   ctx.fillText(u.name,width/2,13);
   label={canvas,width,height};labels.set(u,label);
  }
  if(label)g.drawImage(label.canvas,x-label.width/2,y-13,label.width,label.height);
  else {g.fillStyle=u.color;g.font='bold 10px monospace';g.textAlign='center';g.fillText(u.name,x,y);}
 }

 function mitigation(e,p){if(e.unit!=='turtle')return 1;const a=Math.atan2(p.y-e.y,p.x-e.x);return Math.cos(a-(e.heading||0))>.15?.35:1;}
 function telegraph(g,e){if(expansionTelegraph(g,e))return;if(!e.action||e.action.hit)return;const u=units[e.unit],a=e.action,angle=Math.atan2(a.aim.y-e.y,a.aim.x-e.x);g.save();g.translate(e.x,e.y);g.rotate(angle);g.fillStyle='#e8774245';g.strokeStyle='#ffca80';g.lineWidth=2;
  if(e.unit==='ram'||e.unit==='spear'||e.unit==='pilum'){const reach=e.unit==='ram'?420:u.range;g.fillRect(0,-(e.unit==='ram'?43:10),reach,e.unit==='ram'?86:20);g.strokeRect(0,-(e.unit==='ram'?43:10),reach,e.unit==='ram'?86:20);}else{g.beginPath();g.arc(0,0,u.range,-1.1,1.1);g.lineTo(0,0);g.closePath();g.fill();g.stroke();}g.restore();
 }
 function projectile(g,b){
  ProjectileArt.drawEnemyProjectile(g,b,(unit,action,progress)=>typeof UnitArt!=='undefined'?UnitArt.get(unit,action,progress):null);
 }
 function draw(g,e,sprite){
  const u=units[e.unit];
  if(typeof UnitArt!=='undefined'&&UnitArt.draw(g,e)){
  }else if(drawExpansion(g,e)){
   // Illustrated specialist atlas; old drawings below remain load-failure fallbacks.
  }else if(e.unit==='turtle'){
   for(let row=0;row<2;row++)for(let col=0;col<3;col++)sprite(g,'roman',e.x+(col-1)*25,e.y+row*23-15,2,Math.cos(e.heading)<0,0,e.hit>0,col+row,{...e,action:null});
   g.save();g.translate(e.x,e.y-32);g.rotate(e.heading+Math.PI/2);
   for(let row=0;row<2;row++)for(let col=0;col<3;col++){g.fillStyle=e.hit>0?'#c9e0e4':'#6891ad';g.fillRect(-43+col*29,-36+row*35,27,33);g.strokeStyle='#e4dec0';g.lineWidth=3;g.strokeRect(-43+col*29,-36+row*35,27,33);g.fillStyle='#edc975';g.beginPath();g.arc(-30+col*29,-20+row*35,5,0,Math.PI*2);g.fill();}g.restore();
  }else if(e.unit==='ram'){
   for(const side of [-1,1])sprite(g,'roman',e.x-34,e.y+side*32,2,Math.cos(e.heading)<0,0,e.hit>0,side+1,{...e,action:null});
   g.save();g.translate(e.x,e.y-22);g.rotate(e.heading);g.fillStyle='#282b22';for(const x of [-30,27])for(const y of [-30,22]){g.fillRect(x,y,14,14);g.fillStyle='#70543b';g.fillRect(x+4,y+3,6,8);g.fillStyle='#282b22';}
   g.fillStyle='#64452f';g.fillRect(-49,-22,93,44);g.strokeStyle='#bb925d';g.lineWidth=6;g.strokeRect(-39,-20,68,40);g.fillStyle=e.hit>0?'#f0d8a4':'#a47b4e';g.fillRect(-62,-10,127,20);g.fillStyle='#aab7b6';g.fillRect(51,-14,23,28);g.fillStyle='#e0dfc8';g.fillRect(70,-9,5,18);g.restore();
  }else{
   sprite(g,e.type,e.x,e.y,2.5,Math.cos(e.heading)<0,0,e.hit>0,e.phase,e);
   if(e.unit==='spear'||e.unit==='pilum'){g.strokeStyle='#ccbd86';g.lineWidth=3;g.beginPath();g.moveTo(e.x-10,e.y-14);g.lineTo(e.x+Math.cos(e.heading)*55,e.y-72);g.stroke();}
  }
  if(e.unit!=='roman'&&!e.boss&&!u.civilian)drawLabel(g,u,e.x,e.y-(u.labelHeight||(e.unit==='ram'?142:e.unit==='turtle'?124:96)));
 }
 return {units,mitigation,telegraph,draw,projectile};
})();
