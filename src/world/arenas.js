import {mapDefinitions} from '../../data/maps/maps.js';
import {VillageCollision} from './village/collision.js';
import {VillageNavigation} from './village/navigation.js';
import {VillageRenderer,sceneryVisible} from './village/village-renderer.js';
import {VillageArt} from '../rendering/art/village-art.js';
import {SceneryArt} from '../rendering/art/scenery-art.js';
import {createLutetia} from './lutetia.js';

export const arenaDefinitions=mapDefinitions;
export const campLanes=[180,640,1100,1560,2020];
const scenery=SceneryArt;
export function createArenas(village){
 const factories={empty:createEmptyArena,village:()=>village,forest:()=>createArena('forest'),camp:()=>createArena('camp'),lutetia:createLutetia};
 const cache={};return {get(id){if(!Object.hasOwn(arenaDefinitions,id))id='empty';return cache[id]||(cache[id]=factories[id]());}};
}
function createEmptyArena(){
 const size=2200,cell=25,cols=88,objects=[],roads=[];
 const collision=VillageCollision.create(objects,size);
 const navigation=VillageNavigation.create({size,cell,cols,...collision});
 function drawGround(g){g.fillStyle='#89954e';g.fillRect(0,0,size,size);}
 function drawObject(){}
 return {size,cell,cols,objects,roads,houses:[],residents:[],depthObjects:[],collision,...navigation,blocked:collision.blocked,clear:collision.clear,drawGround,drawObject,draw(g){drawGround(g);}};
}
function createArena(id){
 const size=2200,objects=[],roads=[];let seed=id==='forest'?731:192;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const add=(x,y,art,width,footprint)=>objects.push({x,y,kind:art,art,width,...(footprint?{footprint}:{})});
 if(id==='forest'){
  // Three exits follow the supplied sketch: upper left, right, and lower right.
  roads.push([-80,110,760,-40,360,360,390,670,185],
   [390,670,340,980,610,1150,1040,1170,185],
   [1040,1170,1260,1430,1170,1560,1530,1640,190],
   [1530,1640,1870,1580,1770,2010,1800,2300,190],
   [1040,1170,1430,1170,1550,1090,2300,1160,185]);
  const samples=[];
  for(const [x,y,a,b,c,d,e,f] of roads)for(let i=0;i<=70;i++){
   const t=i/70,u=1-t;samples.push([u*u*u*x+3*u*u*t*a+3*u*t*t*c+t*t*t*e,u*u*u*y+3*u*u*t*b+3*u*t*t*d+t*t*t*f]);
  }
  // Seeded scatter is identical for previews, collision and every new run.
  for(let y=120;y<2200;y+=125)for(let x=80;x<2200;x+=125){
   const px=x+(random()-.5)*85,py=y+(random()-.5)*85;
   if(Math.hypot(px-1100,py-1100)<340||samples.some(([sx,sy])=>Math.hypot(px-sx,py-55-sy)<185))continue;
   if(random()<.18)add(px,py,'rocks',85+random()*45,[-32,-29,64,29]);
   else add(px,py,'trees',175+random()*65);
  }
 }else{
  for(const lane of campLanes){const width=lane===1100?180:128;roads.push([0,lane,700,lane,1500,lane,size,lane,width],[lane,0,lane,700,lane,1500,lane,size,width]);}
  let block=0;
  for(const y of [410,870,1330,1790])for(const x of [410,870,1330,1790]){
   const i=block++;
   if(i===2||i===13){
    add(x,y+65,'command',330,[-118,-105,236,105]);
    add(x-112,y+115,'standard',80,[-10,-12,20,12]);
    add(x+105,y+126,'supplies',100,[-35,-25,70,25]);
   }else if(i===4||i===10||i===15){
    add(x+10,y+65,'fire',170,[-48,-40,96,40]);
    add(x-100,y-40,'supplies',120,[-40,-30,80,30]);
    if(i===10)add(x+112,y+100,'standard',85,[-10,-12,20,12]);
   }else if(i===7||i===12){
    add(x-48,y+15,'supplies',175,[-60,-42,120,42]);
    add(x+70,y+100,'supplies',145,[-50,-35,100,35]);
    add(x,y-95,'fence',265);
   }else{
    add(x+(random()-.5)*55,y+35,i%2?'tent-round':'tent',230+random()*55,[-100,-85,200,85]);
    add(x+(i%2?100:-100),y+118,'supplies',90,[-30,-23,60,23]);
    if(i%3===0)add(x,y-100,'fence',280);
    if(i%3===1)add(x-105,y+115,'standard',76,[-10,-12,20,12]);
   }
   if([0,3,5,7,8,12,14].includes(i))add(x+(i%2?100:-100),y-70,'weapons',105,[-36,-20,72,20]);
  }
  // Leave every cavalry exit open; upright short sections form the side walls.
  const gaps=[0,...campLanes.flatMap(n=>[n-95,n+95]),size];
  for(let i=0;i<gaps.length;i+=2){
   const lo=gaps[i],hi=gaps[i+1],width=hi-lo;
   for(const y of [82,2190])add((lo+hi)/2,y,'fence',width);
   for(let y=lo+20;y<=hi;y+=20)for(const x of [35,2165])add(x,y,'fence',65);
  }
 }
 const collision=VillageCollision.create(objects,size);
 const navigation=VillageNavigation.create({size,cell:25,cols:88,...collision});
 const renderer=VillageRenderer.create({size,objects,roads,plaza:false,roughRoads:id==='camp',VillageArt,document:typeof document==='undefined'?null:document});
 const depthObjects=objects.map(o=>({...o,scenery:true})).sort((a,b)=>a.y-b.y);
 function drawObject(g,o,p,view){
  if(o.art==='trees'||o.art==='fence'){renderer.drawObject(g,o,p,view);return;}
  const sprite=scenery[o.art];
  const height=sprite?.ready?o.width*sprite.image.naturalHeight/sprite.image.naturalWidth:72;
  if(!sceneryVisible(o,height,view))return;
  g.save();
  if(p&&p.y<o.y&&p.y>o.y-o.width&&Math.abs(p.x-o.x)<o.width*.48)g.globalAlpha=.48;
  if(sprite?.ready){const h=o.width*sprite.image.naturalHeight/sprite.image.naturalWidth;g.imageSmoothingEnabled=true;g.drawImage(sprite.image,o.x-o.width/2,o.y+12-h,o.width,h);}
  else {g.fillStyle=o.art==='tent'?'#c9b887':'#79847a';g.fillRect(o.x-o.width/2,o.y-60,o.width,60);}
  g.restore();
 }
 return {size,objects,roads,residents:[],depthObjects,houses:[],collision,...navigation,blocked:collision.blocked,clear:collision.clear,drawGround:renderer.drawGround,drawObject,draw(g){renderer.drawGround(g);for(const o of depthObjects)drawObject(g,o);}};
}
