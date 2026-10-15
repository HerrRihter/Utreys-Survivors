import {expansionUnits} from '../../data/enemies/units.js';
export function updateCityPedestrian(e,c,dt){
 const civilian=expansionUnits[e.unit]?.civilian;
 if(!civilian&&e.unit!=='courtesan')return false;
 const s=c.state,p=s.p;
 e.action=null;e.moving=false;
 const move=(angle,speed)=>{
  // Choose a clear local step instead of constructing a flow field for every pedestrian.
  let chosen=null;
  for(const offset of [0,.6,-.6,1.2,-1.2,Math.PI]){
   const a=angle+offset,q={x:e.x+Math.cos(a)*28,y:e.y+Math.sin(a)*28};
   if(c.Village.clear(e,q,e.r)){chosen=a;break;}
  }
  if(chosen===null){e.roamUntil=0;return;}
  e.heading=chosen;const ox=e.x,oy=e.y;
  const step=speed*(1-(e.abilitySlow||0))*dt;
  c.Village.move(e,Math.cos(chosen)*step+e.vx*dt,Math.sin(chosen)*step+e.vy*dt,e.r);
  const travel=Math.hypot(e.x-ox,e.y-oy);e.moving=travel>.01;e.walk=(e.walk||0)+travel/50;
 };
 const wander=()=>{
  if(!e.roamUntil||s.t>=e.roamUntil){e.roamAngle=c.rand(-Math.PI,Math.PI);e.roamUntil=s.t+c.rand(.6,2.1);}
  move(e.roamAngle,e.speed);
 };
 if(civilian){
  if(c.dist(e,p)<e.r+14&&c.Village.clear(e,p,2))c.hurtPlayer(e);
  wander();return true;
 }
 // Thieves never pursue or attack the hero. Grab nearby loot, then retreat.
 let target=null,best=340;
 if(!(e.fleeUntil>s.t))for(const list of [s.gems,s.pickups])for(const item of list){
  if(item.dead)continue;const distance=c.dist(e,item);
  if(distance<best&&c.Village.clear(e,item,e.r)){target=item;best=distance;}
 }
 if(target&&best<22){
  target.dead=true;if(target.type==='food')e.hp=Math.min(e.max,e.hp+25);
  e.fleeUntil=s.t+2.2;e.roamUntil=0;
  if(s.texts.length<45)s.texts.push({x:e.x,y:e.y-50,v:target.type==='food'?'Перекус!':'Моё!',life:.8});
 }
 const distance=c.dist(e,p);
 if(e.fleeUntil>s.t||distance<145){
  const angle=distance<1?(e.roamAngle??c.rand(-Math.PI,Math.PI)):Math.atan2(e.y-p.y,e.x-p.x);
  move(angle,e.speed*1.25);
 }else if(target){move(Math.atan2(target.y-e.y,target.x-e.x),e.speed);}
 else wander();
 return true;
}
