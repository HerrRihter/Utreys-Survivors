export let VillageCollision;
'use strict';
// Ground-contact shapes in normalized sprite coordinates, not roof/canopy silhouettes.
VillageCollision=(()=>{
 const shapes={
  chief:[[[.14,.69],[.68,.64],[.89,.85],[.82,.96],[.17,.96]]],
  asterix:[[[.17,.72],[.65,.66],[.88,.87],[.81,.98],[.14,.96]]],
  obelix:[[[.15,.70],[.68,.64],[.9,.88],[.84,.97],[.15,.96]]],
  forge:[[[.28,.72],[.70,.66],[.88,.90],[.83,.96],[.28,.97]],[[.04,.88],[.27,.86],[.31,.98],[.04,.98]]],
  fish:[[[.17,.70],[.69,.64],[.89,.87],[.83,.96],[.15,.98]],[[.06,.86],[.26,.84],[.29,.98],[.05,.98]]],
  bard:[[[.33,.76],[.57,.74],[.69,.95],[.25,.97]],[[.66,.79],[.76,.80],[.83,.96],[.73,.98]]],
  trees:[[[.22,.80],[.35,.79],[.50,.96],[.21,.98]],[[.52,.76],[.65,.76],[.72,.90],[.48,.92]],[[.76,.82],[.86,.82],[.94,.96],[.72,.94]]],
  fence:[[[.015,.91],[.985,.91],[.985,.995],[.015,.995]]],
  gate:[[[.06,.86],[.25,.84],[.39,.94],[.39,.98],[.08,.98]],[[.60,.94],[.78,.84],[.93,.86],[.94,.98],[.60,.98]]]
 };
 const dimensions={chief:[617,496],asterix:[411,378],obelix:[515,436],forge:[550,447],fish:[511,448],bard:[504,539],trees:[666,637],fence:[773,353],gate:[708,682]};
 function create(objects,size){
  const polygons=[],bucketSize=100,bucketCols=Math.ceil(size/bucketSize)+2,buckets=[];
  let queryStamp=1;
  const candidateList=[];
  for(const o of objects){
   const [w,h]=dimensions[o.art]||[1,1],height=o.width*h/w;
   const [fx,fy,fw,fh]=o.footprint||[0,0,0,0];
   const outlines=o.footprintPolygons||(o.footprint?[[[fx,fy],[fx+fw,fy],[fx+fw,fy+fh],[fx,fy+fh]]]:shapes[o.art]);
   for(const shape of outlines){
    const points=shape.map(([x,y])=>o.footprintPolygons?({x:o.x+(o.flip?-x:x),y:o.y+y}):o.footprint?({x:o.x+x,y:o.y+y}):({x:o.x+(x-.5)*o.width,y:o.y+12+(y-1)*height}));
    const p={points,object:o,minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y)),stamp:0};polygons.push(p);
    const minBy=Math.max(0,Math.floor(p.minY/bucketSize)),maxBy=Math.min(bucketCols-1,Math.floor(p.maxY/bucketSize));
    const minBx=Math.max(0,Math.floor(p.minX/bucketSize)),maxBx=Math.min(bucketCols-1,Math.floor(p.maxX/bucketSize));
    for(let y=minBy;y<=maxBy;y++)for(let x=minBx;x<=maxBx;x++){
     const idx=x+y*bucketCols;
     if(!buckets[idx])buckets[idx]=[];
     buckets[idx].push(p);
    }
   }
  }
  function candidates(x0,y0,x1,y1){
   const minBx=Math.max(0,Math.floor(x0/bucketSize)),maxBx=Math.min(bucketCols-1,Math.floor(x1/bucketSize));
   const minBy=Math.max(0,Math.floor(y0/bucketSize)),maxBy=Math.min(bucketCols-1,Math.floor(y1/bucketSize));
   queryStamp++;
   if(queryStamp>2000000000){for(let i=0;i<polygons.length;i++)polygons[i].stamp=0;queryStamp=1;}
   candidateList.length=0;
   for(let y=minBy;y<=maxBy;y++){
    const row=y*bucketCols;
    for(let x=minBx;x<=maxBx;x++){
     const b=buckets[row+x];
     if(b)for(let i=0;i<b.length;i++){const p=b[i];if(p.stamp!==queryStamp){p.stamp=queryStamp;candidateList.push(p);}}
    }
   }
   return candidateList;
  }
  function distance2(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return (p.x-a.x-t*dx)**2+(p.y-a.y-t*dy)**2;}
  function inside(p,points){let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;}
  const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  function intersects(a,b,c,d){return Math.max(a.x,b.x)>=Math.min(c.x,d.x)&&Math.max(c.x,d.x)>=Math.min(a.x,b.x)&&Math.max(a.y,b.y)>=Math.min(c.y,d.y)&&Math.max(c.y,d.y)>=Math.min(a.y,b.y)&&cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0;}
  function clear(a,b,r=14){
   if(Math.min(a.x,b.x)<r||Math.min(a.y,b.y)<r||Math.max(a.x,b.x)>size-r||Math.max(a.y,b.y)>size-r)return false;
   const minX=Math.min(a.x,b.x)-r,minY=Math.min(a.y,b.y)-r,maxX=Math.max(a.x,b.x)+r,maxY=Math.max(a.y,b.y)+r;
   const cand=candidates(minX,minY,maxX,maxY);
   for(let k=0;k<cand.length;k++){
    const p=cand[k];
    // Buckets deliberately over-select; reject non-overlapping bounds before
    // the expensive polygon/segment distance tests.
    if(p.maxX<minX||p.minX>maxX||p.maxY<minY||p.minY>maxY)continue;
    // Reject polygons outside the swept segment's expanded box. The bucket
    // rectangle alone over-selects many buildings on long diagonal paths.
    let enter=0,leave=1;
    const dx=b.x-a.x,dy=b.y-a.y;
    if(dx!==0){const t0=(p.minX-r-a.x)/dx,t1=(p.maxX+r-a.x)/dx;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));}
    if(dy!==0){const t0=(p.minY-r-a.y)/dy,t1=(p.maxY+r-a.y)/dy;enter=Math.max(enter,Math.min(t0,t1));leave=Math.min(leave,Math.max(t0,t1));}
    if(enter>leave)continue;
    if(inside(a,p.points)||inside(b,p.points))return false;
    for(let i=0;i<p.points.length;i++){const c=p.points[i],d=p.points[(i+1)%p.points.length];
     if(intersects(a,b,c,d)||Math.min(distance2(a,c,d),distance2(b,c,d),distance2(c,a,b),distance2(d,a,b))<r*r)return false;
    }
   }return true;
  }
  const reusablePoint={x:0,y:0};
  const blocked=(x,y,r=14)=>{reusablePoint.x=x;reusablePoint.y=y;return !clear(reusablePoint,reusablePoint,r);};
  function draw(g){g.save();g.lineWidth=2;for(const p of polygons){g.beginPath();p.points.forEach((v,i)=>i?g.lineTo(v.x,v.y):g.moveTo(v.x,v.y));g.closePath();g.fillStyle='#f25d4540';g.strokeStyle='#ffcf85';g.fill();g.stroke();}g.restore();}
  return {polygons,blocked,clear,draw};
 }
 return {create};
})();
