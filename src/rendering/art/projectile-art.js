import {AssetPaths} from '../asset-paths.js';
import {projectileDefinitions} from '../../../data/projectiles/projectiles.js';
export let ProjectileArt;
'use strict';
ProjectileArt=(()=>{
 const P=projectileDefinitions,art={};
 if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{art.image=image;};image.src=AssetPaths.url(P.fish.texture);}
 function bitmap(g,kind,x,y,angle,scale=1){if(!art.image)return false;const def=P[kind],b=def.box,w=def.width*scale,h=w*b[3]/b[2];g.save();g.translate(x,y);g.rotate(angle);g.drawImage(art.image,...b,-w/2,-h/2,w,h);g.restore();return true;}
 function drawFish(g,f){
  const dx=f.vx??f.dx,dy=f.vy??f.dy,angle=Math.atan2(dy,dx),yOff=P.fish.yOffset;
  if(bitmap(g,'fish',f.x,f.y-yOff,angle+Math.sin(f.age*12)*.055))return;
  g.save();g.translate(f.x,f.y-yOff);g.rotate(angle+Math.sin(f.age*12)*.055);g.scale(1.15,1.15);
  g.lineWidth=1.7;g.lineJoin='round';g.lineCap='round';
  g.fillStyle='#50634c';g.strokeStyle='#202921';
  g.beginPath();g.moveTo(-22,0);g.lineTo(-34,-10);g.quadraticCurveTo(-31,-3,-30,0);g.quadraticCurveTo(-32,4,-35,9);g.lineTo(-21,5);g.closePath();g.fill();g.stroke();
  g.fillStyle='#748568';
  g.beginPath();g.moveTo(-26,0);g.quadraticCurveTo(-13,-12,4,-10);g.quadraticCurveTo(14,-10,22,-5);g.lineTo(29,-2);g.quadraticCurveTo(32,0,29,2);g.lineTo(20,5);g.quadraticCurveTo(8,12,-5,10);g.quadraticCurveTo(-19,9,-26,0);g.closePath();g.fill();g.stroke();
  g.fillStyle='#d3c69f';g.strokeStyle='#465341';g.lineWidth=1;
  g.beginPath();g.moveTo(-19,4);g.quadraticCurveTo(-5,11,9,7);g.lineTo(21,2);g.quadraticCurveTo(11,10,-4,11);g.quadraticCurveTo(-15,10,-19,4);g.closePath();g.fill();g.stroke();
  g.fillStyle='#50634c';g.strokeStyle='#202921';g.lineWidth=1.4;
  g.beginPath();g.moveTo(-15,-8);g.lineTo(-10,-15);g.lineTo(-5,-9);g.lineTo(3,-14);g.lineTo(8,-8);g.closePath();g.fill();g.stroke();
  g.beginPath();g.moveTo(-7,8);g.lineTo(-2,15);g.lineTo(5,8);g.closePath();g.fill();g.stroke();
  g.fillStyle='#99a37c';g.beginPath();g.moveTo(1,-4);g.quadraticCurveTo(9,0,11,7);g.quadraticCurveTo(2,7,-2,0);g.closePath();g.fill();g.stroke();
  g.strokeStyle='#414e3d';g.lineWidth=1.25;g.beginPath();g.moveTo(11,-7);g.quadraticCurveTo(7,-1,11,5);g.stroke();
  g.fillStyle='#d7bc46';g.strokeStyle='#252d26';g.lineWidth=1.4;g.beginPath();g.arc(18,-3,3.5,0,Math.PI*2);g.fill();g.stroke();
  g.fillStyle='#172019';g.beginPath();g.arc(19,-3,1.45,0,Math.PI*2);g.fill();
  g.fillStyle='#313b31';for(const [x,y]of [[-16,-3],[-10,-6],[-3,-5],[4,-6],[8,3],[2,5],[-7,4]]){g.beginPath();g.ellipse(x,y,1.1,.8,-.3,0,Math.PI*2);g.fill();}
  g.restore();
 }
 function drawPilum(g,b){
  const yOff=P.pilum.yOffset;
  if(bitmap(g,'pilum',b.x,b.y-yOff,Math.atan2(b.vy,b.vx)))return;
  g.save();g.translate(b.x,b.y-yOff);g.rotate(Math.atan2(b.vy,b.vx));g.lineCap='round';g.lineJoin='round';
  g.strokeStyle='#251c16';g.lineWidth=6;g.beginPath();g.moveTo(-31,0);g.lineTo(17,0);g.stroke();
  g.strokeStyle='#80552f';g.lineWidth=3.5;g.beginPath();g.moveTo(-30,0);g.lineTo(17,0);g.stroke();
  g.strokeStyle='#c19459';g.lineWidth=1;g.beginPath();g.moveTo(-24,-.8);g.lineTo(12,-.8);g.stroke();
  g.fillStyle='#36332e';g.strokeStyle='#202421';g.lineWidth=1.5;g.beginPath();g.moveTo(39,0);g.lineTo(28,-5);g.lineTo(25,-2);g.lineTo(10,-1.8);g.lineTo(10,1.8);g.lineTo(25,2);g.lineTo(28,5);g.closePath();g.fill();g.stroke();
  g.fillStyle='#aeb9c0';g.beginPath();g.moveTo(37,0);g.lineTo(28,-3.6);g.lineTo(26,-1.15);g.lineTo(12,-1.05);g.lineTo(12,1.05);g.lineTo(26,1.15);g.lineTo(28,3.6);g.closePath();g.fill();
  g.strokeStyle='#e2e8e8';g.lineWidth=.8;g.beginPath();g.moveTo(35,0);g.lineTo(27,-2.3);g.stroke();
  g.fillStyle='#d3d7d2';g.strokeStyle='#34332e';g.lineWidth=1;
  g.beginPath();g.moveTo(8,-2.8);g.lineTo(12,-2.8);g.lineTo(12,2.8);g.lineTo(8,2.8);g.closePath();g.fill();g.stroke();
  g.restore();
 }
 function drawNet(g,b,frame=null){
  const def=P.net;
  if(frame){
   const crop=def.box;
   g.save();g.translate(b.x,b.y-def.yOffset);g.rotate(Math.atan2(b.vy,b.vx));
   g.drawImage(frame,...crop,-crop[2]/2,-crop[3]/2,crop[2],crop[3]);g.restore();return true;
  }
  g.save();g.translate(b.x,b.y-def.yOffset);g.rotate(Math.atan2(b.vy,b.vx));g.strokeStyle='#eee1a8';g.lineWidth=2;
  for(let i=-12;i<=12;i+=6){g.beginPath();g.moveTo(i,-12);g.lineTo(i,12);g.moveTo(-12,i);g.lineTo(12,i);g.stroke();}
  g.restore();return true;
 }
 function drawArrow(g,b,frame=null){
  const def=P.arrow,progress=Math.min(1,(b.age||0)/Math.max(.01,b.flightTime||2.5));
  const height=def.arcStart+(def.arcEnd-def.arcStart)*progress;
  if(frame){
   const crop=def.box;
   g.save();g.translate(b.x,b.y-height);g.rotate(Math.atan2(b.vy,b.vx));
   g.drawImage(frame,...crop,-crop[2]/2,-crop[3]/2,crop[2],crop[3]);g.restore();return true;
  }
  g.save();g.translate(b.x,b.y-height);g.rotate(Math.atan2(b.vy,b.vx));
  g.fillStyle='#d7b784';g.fillRect(-17,-1,29,2);g.fillStyle='#e9ead6';g.fillRect(9,-3,6,6);
  g.fillStyle='#b75845';g.fillRect(-18,-4,7,3);g.fillRect(-18,1,7,3);g.restore();return true;
 }
 function drawEnemyProjectile(g,b,getFrame=null){
  if(b.kind==='goods'){
   g.save();g.translate(b.x,b.y-14);g.rotate((b.age||0)*7);g.strokeStyle='#382e23';g.lineWidth=2;
   g.fillStyle=b.goods===0?'#cc503c':b.goods===1?'#ddae62':'#b97349';
   g.beginPath();g.ellipse(0,0,b.goods===1?12:8,b.goods===2?11:7,0,0,Math.PI*2);g.fill();g.stroke();
   if(b.goods===0){g.fillStyle='#648048';g.fillRect(-1,-11,4,5);}
   else if(b.goods===1){g.strokeStyle='#f8d392';g.beginPath();g.moveTo(-5,-4);g.lineTo(-2,3);g.moveTo(2,-4);g.lineTo(5,3);g.stroke();}
   else{g.fillStyle='#855132';g.fillRect(-4,-14,8,6);g.strokeRect(-4,-14,8,6);}
   g.restore();return true;
  }
  if(b.kind==='net')return drawNet(g,b,getFrame?getFrame(P.net.unit,P.net.action,P.net.progress):null);
  if(b.kind==='arrow')return drawArrow(g,b,getFrame?getFrame(P.arrow.unit,P.arrow.action,P.arrow.progress):null);
  return drawPilum(g,b);
 }
 return {drawFish,drawPilum,drawNet,drawArrow,drawEnemyProjectile,definitions:P};

})();
