import {VillageCollision} from './village/collision.js';
import {VillageNavigation} from './village/navigation.js';
import {sceneryVisible} from './village/village-renderer.js';
import {LutetiaArt,LutetiaShapes} from '../rendering/art/lutetia-art.js';
import {UnitArt} from '../rendering/art/unit-art.js';

export function createLutetia(){
 const size=2200,objects=[];
 // Compact residential rows frame the central garden and market square.
 const houseArts=Object.keys(LutetiaShapes).filter(name=>name.startsWith('house-'));
 function place(art,x,y,width,flip=false){
  const footprintPolygons=[LutetiaShapes[art].map(([u,v])=>[(u-.5)*width,(v-1)*width])];
  objects.push({x,y,width,art,flip,footprintPolygons,island:!art.startsWith('tree-')});
 }
 const columns=[180,455,740,1460,1745,2020];
 const rows=[370,675,980,1450,1770,2090];
 rows.forEach((y,row)=>columns.forEach((x,col)=>{
  const variant=(row*2+col)%houseArts.length;
  place(houseArts[variant],x+(row%2?12:-8),y+(col%2?14:0),280+(variant===5?15:0),col>=3);
 }));
 place('guardpost-v3',1100,340,210);
 // The round terrace projects to an ellipse in this 768 x 622 sprite.
 // Follow its stone rim, including the rear arc, instead of a bounding box.
 const gardenWidth=380,gardenHeight=gardenWidth*622/768;
 const gardenRim=Array.from({length:48},(_,i)=>{
  const angle=i*Math.PI*2/48;
  return [Math.cos(angle)*gardenWidth*.497,(.64+Math.sin(angle)*.352-1)*gardenHeight];
 });
 objects.push({x:1100,y:710,width:gardenWidth,art:'garden-v2',footprintPolygons:[gardenRim]});
 place('fountain-v3',1100,1460,190);
 for(const [i,x,y] of [[0,80,600],[1,910,830],[0,1300,850],[1,2120,640],[0,120,1670],[1,900,1690],[0,1300,1750],[1,2140,1710],[1,900,2060],[0,1300,2100]])place(i?'tree-cypress-v3':'tree-broadleaf-v3',x,y,i?170:210);
 const residents=[{unit:'merchant',x:790,y:1040},{unit:'merchant',x:1530,y:1050},{unit:'merchant',x:1750,y:730},{unit:'merchant',x:300,y:1510},{unit:'merchant',x:850,y:1920},{unit:'merchant',x:1880,y:1500}];
 const lamps=[];
 for(const [x,y] of [[405,420],[830,420],[1370,420],[1900,440],[400,740],[825,1030],[1320,1040],[1890,1040],[535,1510],[1650,1510],[610,1840],[1320,1850],[1810,1840],[430,2160],[1020,2160],[1710,2160]])lamps.push({x,y,width:56,art:'lamp'});
 objects.push(...lamps);
 const collision=VillageCollision.create(objects.filter(o=>o.footprint||o.footprintPolygons),size);
 const navigation=VillageNavigation.create({size,cell:25,cols:88,...collision});
 const depthObjects=objects.map(o=>({...o,scenery:true})).sort((a,b)=>a.y-b.y);
 let ground=null;
 function paint(g){
  let paving='#a5aaa0';
  if(typeof document!=='undefined'){
   const tile=document.createElement('canvas');tile.width=120;tile.height=64;const t=tile.getContext('2d');
   t.fillStyle='#7e877c';t.fillRect(0,0,120,64);
   for(let y=0;y<4;y++)for(let x=-1;x<7;x++){
    const px=x*20+(y%2)*10,py=y*16,v=(x*3+y+20)%5;
    t.fillStyle=['#a9afa1','#b7baaa','#a0a99e','#b2b6a8','#a8b0a6'][v];
    t.beginPath();t.roundRect(px+1,py+1,18,14,[4,5,4,3]);t.fill();
    t.strokeStyle='#e2e0c660';t.lineWidth=1;t.beginPath();t.moveTo(px+4,py+3);t.lineTo(px+14,py+3);t.stroke();
   }
   paving=g.createPattern(tile,'repeat');
  }
  g.fillStyle=paving;g.fillRect(0,0,size,size);
  // Narrow stone edging follows the same ground polygons as collision.
  for(const polygon of collision.polygons){
   if(!polygon.object.island)continue;
   g.beginPath();polygon.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();
   g.fillStyle='#c9bd9d';g.fill();g.lineJoin='round';
   g.lineWidth=12;g.strokeStyle='#878b78';g.stroke();
   g.lineWidth=8;g.strokeStyle='#dfd3b1';g.stroke();
  }
 }
 function drawGround(g){
  if(!ground&&typeof document!=='undefined'){ground=document.createElement('canvas');ground.width=ground.height=size;paint(ground.getContext('2d'));}
  if(ground)g.drawImage(ground,0,0);else paint(g);
 }
 function drawLamp(g,o){
  const {x,y}=o;g.strokeStyle='#313d35';g.lineWidth=5;g.beginPath();g.moveTo(x,y-5);g.lineTo(x,y-88);g.stroke();
  g.fillStyle='#313d35';g.beginPath();g.ellipse(x,y-3,10,4,0,0,Math.PI*2);g.fill();
  g.fillStyle='#ffde7d';g.fillRect(x-7,y-102,14,20);g.strokeRect(x-7,y-102,14,20);
  g.beginPath();g.moveTo(x-12,y-103);g.lineTo(x,y-116);g.lineTo(x+12,y-103);g.closePath();g.fillStyle='#364438';g.fill();
 }
 function drawObject(g,o,p,view){
  if(!sceneryVisible(o,Math.max(o.width,120),view))return;
  g.save();if(p&&p.y<o.y&&p.y>o.y-o.width&&Math.abs(p.x-o.x)<o.width*.45)g.globalAlpha=.45;
  if(o.art==='lamp')drawLamp(g,o);
  else if(!LutetiaArt.draw(g,o.art,o.x,o.y,o.width,o.flip)){g.fillStyle='#bcad88';g.fillRect(o.x-o.width*.3,o.y-o.width*.3,o.width*.6,o.width*.3);}
  g.restore();
 }
 return {size,objects,roads:[],residents,depthObjects,houses:[],collision,...navigation,blocked:collision.blocked,clear:collision.clear,drawGround,drawObject,draw(g){drawGround(g);const sorted=[...depthObjects,...residents].sort((a,b)=>a.y-b.y);for(const o of sorted)if(o.unit)UnitArt.draw(g,{...o,heading:0});else drawObject(g,o);}};
}
