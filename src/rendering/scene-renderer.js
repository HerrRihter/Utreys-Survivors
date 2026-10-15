import {drawHazards} from './art/expansion-art.js';
import {orderActors} from './depth-order.js';
export let SceneRenderer;
'use strict';
SceneRenderer={create(sessionContext){
let cachedVignette=null,cachedVignetteW=0,cachedVignetteH=0;
let cityVignette=null;
function getVignette(w,h){
  if(cachedVignette&&cachedVignetteW===w&&cachedVignetteH===h)return cachedVignette;
  cachedVignetteW=w;cachedVignetteH=h;
  cityVignette=null;
  cachedVignette=sessionContext.ctx.createRadialGradient(w/2,h/2,150,w/2,h/2,600);
  cachedVignette.addColorStop(0,'transparent');
  cachedVignette.addColorStop(1,'#08171188');
  return cachedVignette;
}
function background(cx,cy){
      sessionContext.ctx.fillStyle='#89954e';
      sessionContext.ctx.fillRect(0,0,sessionContext.W,sessionContext.H);
      sessionContext.ctx.save();
      sessionContext.ctx.translate(-cx,-cy);
      sessionContext.Village.drawGround(sessionContext.ctx);
      sessionContext.ctx.restore();
    }
function draw(){
      const s=sessionContext.state,p=s?s.p:{x:1100,y:1010},cx=sessionContext.clamp(p.x-sessionContext.W/2,0,sessionContext.WORLD-sessionContext.W),cy=sessionContext.clamp(p.y-sessionContext.H/2,0,sessionContext.WORLD-sessionContext.H);
      sessionContext.ctx.save();
      if(s&&s.shake&&sessionContext.mode==='play'&&sessionContext.gameSettings?.shake!==false)sessionContext.ctx.translate(sessionContext.rand(-s.shake,s.shake),sessionContext.rand(-s.shake,s.shake));
      background(cx,cy);
      sessionContext.ctx.save();
      sessionContext.ctx.translate(-cx,-cy);
      if(s){
        const minX=cx-50,maxX=cx+sessionContext.W+50,minY=cy-50,maxY=cy+sessionContext.H+50;
        const sceneryView={minX,maxX,minY,maxY};
        drawHazards(sessionContext.ctx,s);
        sessionContext.Villagers.ground(sessionContext.ctx,s,sessionContext.selected,sessionContext.abilities.effectiveStats());
        sessionContext.Corpses.draw(sessionContext.ctx,s.corpses,cx,cy,sessionContext.W,sessionContext.H);
        for(const h of s.helmets){
          if(h.x<minX||h.x>maxX||h.y<minY||h.y>maxY)continue;
          sessionContext.Villagers.helmet(sessionContext.ctx,h.x,h.y);
        }
        for(const g of s.gems){
          if(g.x<minX||g.x>maxX||g.y<minY||g.y>maxY)continue;
          sessionContext.ctx.fillStyle='#142d25';
          sessionContext.ctx.fillRect(g.x-4,g.y,9,5);
          sessionContext.ctx.fillStyle=g.v>3?'#d4e890':'#8bd3ac';
          sessionContext.ctx.beginPath();
          sessionContext.ctx.moveTo(g.x,g.y-6);
          sessionContext.ctx.lineTo(g.x+4,g.y-1);
          sessionContext.ctx.lineTo(g.x,g.y+4);
          sessionContext.ctx.lineTo(g.x-4,g.y-1);
          sessionContext.ctx.fill();
          sessionContext.ctx.fillStyle='#d2f6c5';
          sessionContext.ctx.fillRect(g.x-1,g.y-4,2,3);
        }
        for(const a of s.pickups){
          if(a.x<minX||a.x>maxX||a.y<minY||a.y>maxY)continue;
          sessionContext.ctx.fillStyle='#603b26';
          sessionContext.ctx.fillRect(a.x-7,a.y-5,14,10);
          sessionContext.ctx.fillStyle='#dc9c5e';
          sessionContext.ctx.fillRect(a.x-5,a.y-7,10,9);
          sessionContext.ctx.fillStyle='#efdcab';
          sessionContext.ctx.fillRect(a.x+5,a.y-2,5,3);
        }
        for(const e of s.enemies){
          if(e.x<minX-70||e.x>maxX+70||e.y<minY-70||e.y>maxY+70)continue;
          sessionContext.Legion.telegraph(sessionContext.ctx,e);
        }
        sessionContext.abilities.draw(sessionContext.ctx);
        const actors=orderActors(sessionContext.Village.depthObjects,s.enemies,p,sessionContext.selected);
        for(const e of actors){
          if(e.scenery){
            sessionContext.Village.drawObject(sessionContext.ctx,e,p,sceneryView);
            continue;
          }
          if(!e.player&&(e.x<minX-100||e.x>maxX+100||e.y<minY-100||e.y>maxY+100))continue;
          const size=e.boss?3.5:e.type==='obelix'?3.5:e.player?3:e.type==='monster'?3:2.5;
          sessionContext.ctx.fillStyle='#14291e66';
          sessionContext.ctx.beginPath();
          sessionContext.ctx.ellipse(e.x,e.y,12*size/2,4*size/2,0,0,sessionContext.Math.PI*2);
          sessionContext.ctx.fill();
          const bob=e.player?(p.moving?sessionContext.Math.sin(s.step*15)*1.7:0):sessionContext.Math.sin(s.step*9+e.phase)*1.4;
          if(e.player)sessionContext.sprite(sessionContext.ctx,e.type,e.x,e.y-(p.jumpHeight||0),size,e.flip,bob,p.inv>0&&sessionContext.Math.floor(p.inv*15)%2===0,e.phase||0,e);else sessionContext.Legion.draw(sessionContext.ctx,e,sessionContext.sprite);
          if(e.player){
            const aim=p.action?.direction||p.facing;
            sessionContext.ctx.save();
            sessionContext.ctx.translate(e.x,e.y);
            sessionContext.ctx.rotate(sessionContext.Math.atan2(aim.y,aim.x));
            sessionContext.ctx.fillStyle='#f6cb72bb';
            sessionContext.ctx.beginPath();
            sessionContext.ctx.moveTo(35,0);
            sessionContext.ctx.lineTo(26,-5);
            sessionContext.ctx.lineTo(26,5);
            sessionContext.ctx.closePath();
            sessionContext.ctx.fill();
            sessionContext.ctx.restore();
            sessionContext.ctx.fillStyle='#f6cb72';
            sessionContext.ctx.fillRect(e.x-3,e.y-(typeof sessionContext.HeroArt!=='undefined'&&sessionContext.HeroArt.get(e.type)?(e.type==='obelix'?94:67):15*size+6),6,2);
          }else if(e.hp<e.max&&!e.boss){
            sessionContext.ctx.fillStyle='#233429';
            sessionContext.ctx.fillRect(e.x-12,e.y-(sessionContext.Legion.units[e.unit].labelHeight?sessionContext.Legion.units[e.unit].labelHeight-12:e.unit==='ram'?132:e.unit==='turtle'?116:84),24,3);
            sessionContext.ctx.fillStyle='#c4956d';
            sessionContext.ctx.fillRect(e.x-12,e.y-(sessionContext.Legion.units[e.unit].labelHeight?sessionContext.Legion.units[e.unit].labelHeight-12:e.unit==='ram'?132:e.unit==='turtle'?116:84),24*e.hp/e.max,3);
          }
        }
        for(const b of s.enemyShots)sessionContext.Legion.projectile(sessionContext.ctx,b);
        sessionContext.Villagers.projectiles(sessionContext.ctx,s);
        for(const b of s.shots){
          if(typeof sessionContext.MenhirArt!=='undefined')sessionContext.MenhirArt.draw(sessionContext.ctx,b);
        }
        for(const f of s.fx){
          sessionContext.ctx.save();
          sessionContext.ctx.globalAlpha=f.life/f.max;
          if(f.kind==='spark'){
            sessionContext.ctx.fillStyle=f.color;
            sessionContext.ctx.fillRect(f.x,f.y,3,3);
          }else{
            sessionContext.ctx.strokeStyle=f.kind==='slash'?'#f8dfa0':f.kind==='ring'?'#a9c7e0':'#e97451';
            sessionContext.ctx.lineWidth=f.kind==='slash'?7:3;
            sessionContext.ctx.beginPath();
            const r=f.r*(1-(f.life/f.max)*.3);
            sessionContext.ctx.arc(f.x,f.y,r,f.kind==='slash'?f.angle-(f.half||sessionContext.Math.PI/4):0,f.kind==='slash'?f.angle+(f.half||sessionContext.Math.PI/4):sessionContext.Math.PI*2);
            sessionContext.ctx.stroke();
            if(f.kind==='slash'){
              sessionContext.ctx.lineWidth=2;
              sessionContext.ctx.beginPath();
              sessionContext.ctx.arc(f.x,f.y,r-12,f.angle-(f.half||sessionContext.Math.PI/4),f.angle+(f.half||sessionContext.Math.PI/4));
              sessionContext.ctx.stroke();
            }
          }
          sessionContext.ctx.restore();
        }
        sessionContext.ctx.font='bold 12px monospace';
        sessionContext.ctx.textAlign='center';
        for(const t of s.texts){
          if(t.x<minX||t.x>maxX||t.y<minY||t.y>maxY)continue;
          sessionContext.ctx.globalAlpha=sessionContext.Math.min(1,t.life*3);
          sessionContext.ctx.fillStyle='#111f18';
          sessionContext.ctx.fillText(t.v,t.x+1,t.y+1);
          sessionContext.ctx.fillStyle=typeof t.v==='string'?'#bfe7a3':'#fff1c6';
          sessionContext.ctx.fillText(t.v,t.x,t.y);
        }
        sessionContext.ctx.globalAlpha=1;
      }else{
        for(const o of sessionContext.Village.depthObjects)sessionContext.Village.drawObject(sessionContext.ctx,o);
        for(let i=0;i<14;i++)sessionContext.sprite(sessionContext.ctx,'roman',1300+(i%5)*47,890+sessionContext.Math.floor(i/5)*60,2,i%2===0,sessionContext.Math.sin(sessionContext.performance.now()/300+i));
      }
      sessionContext.ctx.restore();
      const vignette=getVignette(sessionContext.W,sessionContext.H);
      // On the dense city scene, reuse the rasterized overlay as well as the
      // scaled buildings. Other maps retain their cheaper direct gradient.
      if(s?.map==='lutetia'){
        if(!cityVignette){
          cityVignette=sessionContext.document.createElement('canvas');
          cityVignette.width=Math.ceil(sessionContext.W);cityVignette.height=Math.ceil(sessionContext.H);
          const ink=cityVignette.getContext('2d');
          const shade=ink.createRadialGradient(sessionContext.W/2,sessionContext.H/2,150,sessionContext.W/2,sessionContext.H/2,600);
          shade.addColorStop(0,'transparent');shade.addColorStop(1,'#08171188');ink.fillStyle=shade;
          ink.fillRect(0,0,sessionContext.W,sessionContext.H);
        }
        sessionContext.ctx.drawImage(cityVignette,0,0);
      }else{
        sessionContext.ctx.fillStyle=vignette;
        sessionContext.ctx.fillRect(0,0,sessionContext.W,sessionContext.H);
      }
      sessionContext.ctx.restore();
    }
return {background,draw};
}};
