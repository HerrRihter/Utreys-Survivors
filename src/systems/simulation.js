import {updateExpansion,updateHazards} from './expansion.js';
import {updateMalosinus} from './malosinus.js';
export let Simulation;
'use strict';
Simulation={create(sessionContext){
function update(dt){
      const s=sessionContext.state,p=s.p;
      const abilityMoving=sessionContext.abilities.protectedMove();
      s.t+=dt;
      sessionContext.abilities.update(dt);
      const st=sessionContext.abilities.effectiveStats();
      s.step+=dt;
      s.corpses=sessionContext.Corpses.update(s.corpses,dt);
      s.shake=sessionContext.Math.max(0,s.shake-dt*20);
      p.inv=sessionContext.Math.max(0,p.inv-dt);
      p.hp=sessionContext.Math.min(p.max,p.hp+st.regen*dt);
      let mx=(sessionContext.keys.has('KeyD')||sessionContext.keys.has('ArrowRight')?1:0)-(sessionContext.keys.has('KeyA')||sessionContext.keys.has('ArrowLeft')?1:0)+sessionContext.stick.x,my=(sessionContext.keys.has('KeyS')||sessionContext.keys.has('ArrowDown')?1:0)-(sessionContext.keys.has('KeyW')||sessionContext.keys.has('ArrowUp')?1:0)+sessionContext.stick.y;
      updateHazards(sessionContext,dt);
      if(p.stun>0||abilityMoving){mx=0;my=0;}
      const ml=sessionContext.Math.hypot(mx,my);
      if(ml>1){
        mx/=ml;
        my/=ml;
      }
      if(ml>.05){
        p.facing={x:mx/sessionContext.Math.hypot(mx,my),y:my/sessionContext.Math.hypot(mx,my)};
        if(sessionContext.Math.abs(mx)>.01)p.flip=mx<0;
      }
      const oldX=p.x,oldY=p.y;
      sessionContext.Village.move(p,mx*p.speed*st.speed*dt,my*p.speed*st.speed*dt,14);
      p.x=sessionContext.clamp(p.x,52,sessionContext.WORLD-52);
      p.y=sessionContext.clamp(p.y,100,sessionContext.WORLD-12);
      const travel=sessionContext.Math.hypot(p.x-oldX,p.y-oldY);
      p.moving=travel>.01;
      p.walk=(p.walk||0)+travel/(['antisanitarix','automatix','panoramix'].includes(sessionContext.selected)?90:55);
      sessionContext.updateSpawning(dt);
      if(p.hurt){
        p.hurt.elapsed+=dt;
        if(p.hurt.elapsed>=p.hurt.duration)p.hurt=null;
      }
      if(p.action){
        p.action.direction={...p.facing};
        p.action.flip=sessionContext.Math.abs(p.facing.x)>.01?p.facing.x<0:p.flip;
      }
      sessionContext.advanceAction(p,dt,sessionContext.heroImpact);
      const heroSpec=sessionContext.Villagers.defs[sessionContext.selected];
      s.attack-=dt;
      if(!sessionContext.abilities.blocksAttack()&&!heroSpec.passive&&s.attack<=0&&!p.action&&!(p.stun>0)){
        s.attack=sessionContext.Math.max(.22,heroSpec.interval/(st.haste*(1+(st.punchTempo||0))));
        const dir={...p.facing};
        sessionContext.beginAction(p,sessionContext.Math.max(.18,heroSpec.wind/(st.haste*(1+(st.punchTempo||0)))),{x:p.x+dir.x,y:p.y+dir.y});
        p.action.direction=dir;
        p.action.flip=sessionContext.Math.abs(dir.x)>.01?dir.x<0:p.flip;
      }
      s.menhir-=dt;
      if(s.menhir<=0&&!(p.stun>0)){
        s.menhir=2/st.haste;
        if(st.stones)sessionContext.throwStones(st.stones,32);
      }
      s.ring-=dt;
      if(s.ring<=0&&!(p.stun>0)){
        s.ring=1.25/st.haste;
        if(st.orbit){
          const r=100+st.orbit*10;
          s.fx.push({kind:'ring',x:p.x,y:p.y-8,r,life:.45,max:.45});
          for(const e of s.enemies)if(sessionContext.dist(e,p)<r+e.r)sessionContext.damage(e,12*st.orbit*st.damage);
          sessionContext.soundEffect('magic');
        }
      }
      sessionContext.Villagers.update(s,sessionContext.selected,dt,sessionContext.damage,sessionContext.Village,st);
      for(const e of s.enemies){
        if(e.hp<=0||e.abilityStun>0)continue;
        const u=sessionContext.Legion.units[e.unit],d=sessionContext.dist(e,p);
        e.hit=sessionContext.Math.max(0,e.hit-dt);
        if(e.visualHurt){
          e.visualHurt.elapsed+=dt;
          if(e.visualHurt.elapsed>=e.visualHurt.duration)e.visualHurt=null;
        }
        e.cd-=dt;
        if(e.hurt){
          e.hurt.elapsed+=dt;
          if(e.hurt.elapsed>=e.hurt.duration)e.hurt=null;
        }
        e.vx*=sessionContext.Math.exp(-9*dt);
        e.vy*=sessionContext.Math.exp(-9*dt);
        if(updateMalosinus(e,sessionContext,dt)||updateExpansion(e,sessionContext,dt))continue;
        if(!e.action&&!e.charge){
          const target=sessionContext.Math.atan2(p.y-e.y,p.x-e.x),delta=sessionContext.Math.atan2(sessionContext.Math.sin(target-e.heading),sessionContext.Math.cos(target-e.heading));
          e.heading+=sessionContext.clamp(delta,-dt*(e.r>30?.8:6),dt*(e.r>30?.8:6));
        }
        sessionContext.advanceAction(e,dt,a=>{
          const angle=sessionContext.Math.atan2(a.aim.y-e.y,a.aim.x-e.x),ax=sessionContext.Math.cos(angle),ay=sessionContext.Math.sin(angle),px=p.x-e.x,py=p.y-e.y,along=px*ax+py*ay,across=sessionContext.Math.abs(px*ay-py*ax);
          if(e.unit==='pilum'){
            s.enemyShots.push({x:e.x,y:e.y,vx:ax*235,vy:ay*235,life:2,damage:e.damage});
            sessionContext.soundEffect('throw');
          }
  else if(e.unit==='ram'){
            e.charge={x:ax,y:ay,left:1.3};
            e.heading=angle;
          }
  else if(e.unit==='spear'){
            if(along>=-8&&along<u.range+14&&across<24&&sessionContext.Village.clear(e,p,2))sessionContext.hurtPlayer(e);
          }
  else if(sessionContext.dist(e,p)<u.range+8&&along>=-8&&sessionContext.Village.clear(e,p,2))sessionContext.hurtPlayer(e);
        });
        if(e.charge){
          const q=e.charge,ox=e.x,oy=e.y,chargeSpeed=320*(1-(e.abilitySlow||0));
          sessionContext.Village.move(e,q.x*chargeSpeed*dt,q.y*chargeSpeed*dt,e.r);
          q.left-=dt;
          if(sessionContext.dist(e,p)<e.r+14)sessionContext.hurtPlayer(e);
          if(sessionContext.Math.hypot(e.x-ox,e.y-oy)<chargeSpeed*dt*.8||q.left<=0){
            e.charge=null;
            e.action=null;
            e.cd=2;
            s.fx.push({kind:'ring',x:e.x,y:e.y,r:65,life:.3,max:.3});
          }
          e.moving=true;
          e.walk=(e.walk||0)+dt*5;
          continue;
        }
        if(!e.action&&!e.hurt&&e.cd<=0&&d<u.range&&sessionContext.Village.clear(e,p,2)){
          sessionContext.beginAction(e,u.wind,p);
          e.cd=u.cooldown;
          e.heading=sessionContext.Math.atan2(p.y-e.y,p.x-e.x);
        }
        const moving=!e.action&&!e.hurt&&d>(e.unit==='pilum'?220:e.r+10),speed=e.speed*(1+s.t/1800)*(1-(e.abilitySlow||0)),dir=moving?sessionContext.Village.direction(e,p,e.r):null,ox=e.x,oy=e.y;
        sessionContext.Village.move(e,(moving?dir.x*speed*dt:0)+e.vx*dt,(moving?dir.y*speed*dt:0)+e.vy*dt,e.r);
        const travel=sessionContext.Math.hypot(e.x-ox,e.y-oy);
        e.moving=travel>.01;
        e.walk=(e.walk||e.phase/6)+travel/50;
      }
      for(const b of s.enemyShots){
        b.age=(b.age||0)+dt;
        const n=sessionContext.Math.max(1,sessionContext.Math.ceil(sessionContext.Math.hypot(b.vx,b.vy)*dt/8));
        for(let i=0;i<n&&b.life>0;i++){
          b.x+=b.vx*dt/n;
          b.y+=b.vy*dt/n;
          if(sessionContext.Village.blocked(b.x,b.y,2))b.life=0;else if(sessionContext.dist(b,p)<17){
            if(b.kind==='net'&&!sessionContext.abilities.protectedMove()&&!(p.netGrace>0)&&p.inv<=0){p.stun=1.25;p.netGrace=4;p.action=null;}
            sessionContext.hurtPlayer(b);
            b.life=0;
          }
        }
        b.life-=dt;
      }
      s.enemyShots=s.enemyShots.filter(b=>b.life>0);
      for(const b of s.shots){
        b.x+=b.vx*dt;
        b.y+=b.vy*dt;
        b.life-=dt;
        b.age=(b.age||0)+dt;
        b.angle+=dt*4.5;
        for(const e of s.enemies){
          if(e.hp>0&&!b.hit.has(e)&&sessionContext.Math.hypot(e.x-b.x,e.y-10-b.y)<e.r+b.r){
            b.hit.add(e);
            sessionContext.damage(e,b.damage,b.vx*.25,b.vy*.25,{x:e.x-b.vx,y:e.y-b.vy});
          }
        }
      }
      s.shots=s.shots.filter(b=>b.life>0);
      for(const helmet of s.helmets){
        const d=sessionContext.dist(helmet,p);
        if(d<st.magnet&&sessionContext.Village.clear(helmet,p,2)){
          const step=sessionContext.Math.min(d,230*dt);
          helmet.x+=(p.x-helmet.x)/sessionContext.Math.max(1,d)*step;
          helmet.y+=(p.y-helmet.y)/sessionContext.Math.max(1,d)*step;
        }
        if(sessionContext.dist(helmet,p)<20){
          s.earned+=sessionContext.Progression.earn(helmet.value);
          helmet.dead=true;
          s.texts.push({x:p.x,y:p.y-30,v:'+'+helmet.value+' шлема',life:1});
        }
      }
      s.helmets=s.helmets.filter(h=>!h.dead);
      const mag=st.magnet;
      for(const gem of s.gems){
        if(gem.dead)continue;
        const dx=p.x-gem.x,dy=p.y-gem.y;
        if(sessionContext.Math.abs(dx)>mag||sessionContext.Math.abs(dy)>mag)continue;
        const d=sessionContext.Math.hypot(dx,dy);
        if(d<mag){
          const speed=270+200*(1-d/mag);
          const step=sessionContext.Math.min(d,speed*dt);
          const invD=1/sessionContext.Math.max(1,d);
          gem.x+=dx*invD*step;
          gem.y+=dy*invD*step;
        }
        if(d<19){
          s.xp+=gem.v;
          gem.dead=true;
          sessionContext.soundEffect('pickup');
        }
      }
      s.gems=s.gems.filter(g=>!g.dead);
// Merge nearby old drops when needed, retaining all earned experience.
      if(s.gems.length>500){
        const grid=new Map();
        for(const g of s.gems){
          const key=(sessionContext.Math.floor(g.x/50)&0xffff)|((sessionContext.Math.floor(g.y/50)&0xffff)<<16);
          const existing=grid.get(key);
          if(existing)existing.v+=g.v;else grid.set(key,g);
        }
        s.gems=[...grid.values()];
      }
      for(const item of s.pickups)if(!item.dead&&sessionContext.dist(item,p)<25){
        p.hp=sessionContext.Math.min(p.max,p.hp+25);
        item.dead=true;
        s.texts.push({x:p.x,y:p.y-30,v:'+25 ♥',life:1});
        sessionContext.soundEffect('heal');
      }
      s.pickups=s.pickups.filter(i=>!i.dead);
      s.enemies=s.enemies.filter(e=>e.hp>0);
      for(const f of s.fx){
        f.life-=dt;
        if(f.kind==='spark'){
          f.x+=f.vx*dt;
          f.y+=f.vy*dt;
        }
      }
      s.fx=s.fx.filter(f=>f.life>0);
      for(const t of s.texts){
        t.life-=dt;
        t.y-=dt*35;
      }
      s.texts=s.texts.filter(t=>t.life>0);
      if(p.hp<=0){
        p.hp=0;
        sessionContext.finish(false);
      }else if(s.t>=sessionContext.DURATION&&s.bossDead)sessionContext.finish(true);else if(s.xp>=s.need)sessionContext.levelUp();
      sessionContext.hud();
    }
return {update};
}};
