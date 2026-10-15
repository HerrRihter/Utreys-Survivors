export let VillageRenderer;
export function sceneryVisible(o,height,view){
 return !view||(o.x+o.width/2>=view.minX&&o.x-o.width/2<=view.maxX&&o.y+12>=view.minY&&o.y+12-height<=view.maxY);
}
VillageRenderer={create({document,VillageArt,size,objects,roads,plaza=true,roughRoads=false}){
 let groundCache=null; const depthObjects=objects.map(o=>({...o,scenery:true})).sort((a,b)=>a.y-b.y);
 const lanes=roughRoads?roads.map(([x,y,a,b,c,d,e,f,w],index)=>{
  const points=[];
  for(let i=0;i<=80;i++){
   const t=i/80,u=1-t,dx=3*u*u*(a-x)+6*u*t*(c-a)+3*t*t*(e-c),dy=3*u*u*(b-y)+6*u*t*(d-b)+3*t*t*(f-d),len=Math.hypot(dx,dy)||1;
   const nx=-dy/len,ny=dx/len,jitter=Math.sin(i*.21+index)*7+Math.sin(i*.63+index)*3;
   points.push({x:u*u*u*x+3*u*u*t*a+3*u*t*t*c+t*t*t*e+nx*jitter,y:u*u*u*y+3*u*u*t*b+3*u*t*t*d+t*t*t*f+ny*jitter,nx,ny,r:w/2+Math.sin(i*.73+index)*6+Math.sin(i*1.91)*3});
  }
  return points;
 }):[];
 function roadOutline(g,points,extra){
  for(let side=0;side<2;side++)for(let j=0;j<points.length;j++){
   const p=points[side?points.length-1-j:j],sign=side?-1:1,x=p.x+p.nx*(p.r+extra)*sign,y=p.y+p.ny*(p.r+extra)*sign;
   if(!side&&!j)g.moveTo(x,y);else g.lineTo(x,y);
  }g.closePath();
 }
 function paintGround(g){
  g.fillStyle='#89954e';g.fillRect(0,0,size,size);
  if(VillageArt&&VillageArt.status['ground-v1']==='ready'){
   g.save();g.imageSmoothingEnabled=true;
   for(let y=0;y<size;y+=550)for(let x=0;x<size;x+=550)g.drawImage(VillageArt.images['ground-v1'],x,y,550,550);g.restore();
  }
  let dirt='#c0af7d';
  if(VillageArt&&VillageArt.status['ground-v1']==='ready'){
   const tile=document.createElement('canvas');tile.width=tile.height=550;const t=tile.getContext('2d');
   t.drawImage(VillageArt.images['ground-v1'],0,0,550,550);
   t.fillStyle='#c4af83dc';t.fillRect(0,0,550,550);
   for(let i=0;i<4800;i++){t.fillStyle=i%3?'#66533b15':'#f5e1bb35';t.fillRect(i*13.71%550,i*87.23%550,1+i%3,1);}
   dirt=g.createPattern(tile,'repeat');
  }
  g.lineCap='round';g.lineJoin='round';
  for(const [extra,color] of [[18,'#8f8d55'],[8,'#b1a46e'],[0,dirt]]){
   if(roughRoads){g.fillStyle=color;g.beginPath();for(const points of lanes)roadOutline(g,points,extra/2);g.fill();continue;}
   for(const [x,y,a,b,c,d,e,f,w] of roads){
    g.strokeStyle=color;g.lineWidth=w+extra;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(a,b,c,d,e,f);g.stroke();
   }
  }
  if(roughRoads){
   g.save();g.beginPath();for(const points of lanes)roadOutline(g,points,0);g.clip();
   // Rasterize the detail layer without the complex lane clip. Clipping every
   // ellipse separately makes GPU rasterization stall despite a short JS frame.
   const detail=document?.createElement('canvas');
   if(detail){detail.width=size;detail.height=size;}
   const ink=detail?detail.getContext('2d'):g;
   ink.lineCap='round';ink.lineJoin='round';
   // Cached, deterministic dirt mottling, stones and broken wheel ruts.
   for(let i=0;i<15000;i++){
    const x=i*397.31%size,y=i*673.73%size;
    ink.fillStyle=i%3?'#6f573526':'#fff0c436';ink.beginPath();ink.ellipse(x,y,2+i%13,1+i%5,i*.7,0,Math.PI*2);ink.fill();
   }
   for(const points of lanes)for(const side of [-1,1])for(let i=1;i<points.length;i++){
    if(i%7<2)continue;const p=points[i],q=points[i-1],offset=side*25;
    ink.strokeStyle='#71593730';ink.lineWidth=2+i%3;ink.beginPath();ink.moveTo(q.x+q.nx*offset,q.y+q.ny*offset);ink.lineTo(p.x+p.nx*offset,p.y+p.ny*offset);ink.stroke();
   }
   if(detail)g.drawImage(detail,0,0);
   g.restore();
  }
  if(plaza){g.fillStyle=dirt;g.beginPath();g.ellipse(1120,1170,255,175,-.1,0,Math.PI*2);g.fill();}
  // Deterministic, quiet flecks soften the lanes without adding visual collision.
  for(let i=0;i<1800;i++){const x=(i*397.31)%size,y=(i*673.73)%size;g.fillStyle=i%2?'#78674918':'#f3dcac25';g.fillRect(x,y,2+i%5,1+i%2);}
 }
 let groundCacheReady=false;
 function ensureGroundCache(){
  if(!document)return;
  const ready=VillageArt&&VillageArt.status['ground-v1']==='ready';
  if(!groundCache||(ready&&!groundCacheReady)){
   groundCache??=document.createElement('canvas');groundCache.width=size;groundCache.height=size;
   paintGround(groundCache.getContext('2d'));
   if(ready)groundCacheReady=true;
  }
 }
 function drawGround(g){
  ensureGroundCache();
  if(groundCache)g.drawImage(groundCache,0,0);else paintGround(g);
 }
 function drawObject(g,o,player,view){
  const image=VillageArt?.images?.[o.art];
  if(image?.naturalWidth&&!sceneryVisible(o,o.width*image.naturalHeight/image.naturalWidth,view))return;
  g.save();
  // Keep the hero visible when a roof or the bard's canopy overlaps them.
  if(player&&player.y<o.y&&player.y>o.y-o.width&&Math.abs(player.x-o.x)<o.width*.48)g.globalAlpha=.48;
  if(VillageArt)VillageArt.draw(g,o.art,o.x,o.y+12,o.width);
  g.restore();
 }

function draw(g){drawGround(g);for(const o of depthObjects)drawObject(g,o);}
return {draw,drawGround,drawObject,depthObjects};
}};
