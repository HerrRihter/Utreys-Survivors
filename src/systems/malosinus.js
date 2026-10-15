// The treasurer competes for dropped XP; already earned player XP is never touched.
export function updateMalosinus(e,c,dt){
  if(e.unit!=='malosinus')return false;
  if(e.hp<=0)return true;
  const s=c.state,p=s.p,u=c.Legion.units[e.unit];
  let target=p,nearest=320,healed=0;
  for(const gem of s.gems){
    if(gem.dead)continue;
    const d=c.dist(e,gem);
    if(d>nearest&&d>e.r+12)continue;
    if(!c.Village.clear(e,gem,2))continue;
    if(d<e.r+12){
      gem.dead=true;
      const amount=Math.min(e.max-e.hp,gem.v*u.healPerXp);
      e.hp+=amount;healed+=amount;
    }else if(e.hp<e.max&&d<nearest){nearest=d;target=gem;}
  }
  if(healed>0){
    s.texts.push({x:e.x,y:e.y-120,v:'+'+healed+' ♥',life:1});
    s.fx.push({kind:'ring',x:e.x,y:e.y,r:48,life:.4,max:.4});
    c.soundEffect('heal');
  }
  c.advanceAction(e,dt,a=>{
    const angle=Math.atan2(a.aim.y-e.y,a.aim.x-e.x);
    const delta=Math.atan2(Math.sin(Math.atan2(p.y-e.y,p.x-e.x)-angle),Math.cos(Math.atan2(p.y-e.y,p.x-e.x)-angle));
    s.fx.push({kind:'slash',x:e.x,y:e.y-8,r:u.range,angle,half:1.1,life:.3,max:.3});
    c.soundEffect('stone');
    if(c.dist(e,p)<u.range&&Math.abs(delta)<=1.1&&c.Village.clear(e,p,2))c.hurtPlayer(e);
  });
  if(!e.action&&e.cd<=0&&c.dist(e,p)<u.range&&c.Village.clear(e,p,2)){
    c.beginAction(e,u.wind,p);e.cd=u.cooldown;
    e.heading=Math.atan2(p.y-e.y,p.x-e.x);
  }
  const ox=e.x,oy=e.y;
  if(!e.action){
    const dir=c.Village.direction(e,target,e.r),speed=e.speed*(1-(e.abilitySlow||0));
    e.heading=Math.atan2(target.y-e.y,target.x-e.x);
    c.Village.move(e,dir.x*speed*dt+e.vx*dt,dir.y*speed*dt+e.vy*dt,e.r);
  }
  const travel=Math.hypot(e.x-ox,e.y-oy);
  e.moving=travel>.01;e.walk=(e.walk||0)+travel/50;
  return true;
}
