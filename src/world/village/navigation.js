export let VillageNavigation;
VillageNavigation={create({size,cell,cols,blocked,clear}){
 const moveNext={x:0,y:0},moveNextX={x:0,y:0},moveNextY={x:0,y:0};
 function move(a,dx,dy,r=14){
  if(dx===0&&dy===0)return;
  const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/5));
  const sx=dx/n,sy=dy/n;
  for(let i=0;i<n;i++){
   moveNext.x=a.x+sx;moveNext.y=a.y+sy;
   if(clear(a,moveNext,r)){a.x=moveNext.x;a.y=moveNext.y;continue;}
   moveNextX.x=moveNext.x;moveNextX.y=a.y;
   if(clear(a,moveNextX,r))a.x=moveNext.x;
   moveNextY.x=a.x;moveNextY.y=moveNext.y;
   if(clear(a,moveNextY,r))a.y=moveNext.y;
  }
 }
 const grids=new Map(),maps=new Map(),queries=new Map();
 const centers=Array.from({length:cols*cols},(_,k)=>({x:(k%cols+.5)*cell,y:(Math.floor(k/cols)+.5)*cell}));
 const center=k=>centers[k];
 const sharedQueue=new Int32Array(cols*cols);
 function grid(r){
  if(grids.has(r))return grids.get(r);
  const free=new Uint8Array(cols*cols),edges=new Uint8Array(cols*cols);
  for(let k=0;k<free.length;k++){const p=center(k);free[k]=!blocked(p.x,p.y,r);}
  for(let k=0;k<free.length;k++)if(free[k]){
   const x=k%cols,y=Math.floor(k/cols);
   if(x+1<cols&&free[k+1]&&clear(center(k),center(k+1),r)){edges[k]|=1;edges[k+1]|=2;}
   if(y+1<cols&&free[k+cols]&&clear(center(k),center(k+cols),r)){edges[k]|=4;edges[k+cols]|=8;}
  }
  const out={free,edges};grids.set(r,out);return out;
 }
 function field(p,r){
  // Every enemy of this radius shares the same target. Cache even an
  // unreachable target: otherwise each enemy repeats the full seed search.
  const query=queries.get(r);
  if(query&&query.x===p.x&&query.y===p.y)return query.flow;
  const flow=computeField(p,r);
  queries.set(r,{x:p.x,y:p.y,flow});
  return flow;
 }
 function computeField(p,r){
  const {free,edges}=grid(r),tx=Math.floor(p.x/cell),ty=Math.floor(p.y/cell),target=tx+ty*cols;
  const cached=maps.get(r);if(cached&&cached.target===target&&clear(center(cached.seed),p,2))return cached;
  // A hero can stand in a gap that siege units cannot enter: route to the nearest reachable approach.
  let seed=-1,best=Infinity;
  for(let y=Math.max(0,ty-7);y<=Math.min(cols-1,ty+7);y++)for(let x=Math.max(0,tx-7);x<=Math.min(cols-1,tx+7);x++){
   const k=x+y*cols;if(!free[k])continue;const c=center(k),d=Math.hypot(c.x-p.x,c.y-p.y);
   if(d<best&&clear(c,p,2)){best=d;seed=k;}
  }
  if(seed<0)return null;
  const old=maps.get(r);if(old&&old.seed===seed){old.target=target;return old;}
  const costs=new Int16Array(cols*cols).fill(-1);let n=1;sharedQueue[0]=seed;costs[seed]=0;
  for(let q=0;q<n;q++){
   const k=sharedQueue[q],edge=edges[k],c=costs[k]+1;
   if(edge&1){const nk=k+1;if(costs[nk]<0){costs[nk]=c;sharedQueue[n++]=nk;}}
   if(edge&2){const nk=k-1;if(costs[nk]<0){costs[nk]=c;sharedQueue[n++]=nk;}}
   if(edge&4){const nk=k+cols;if(costs[nk]<0){costs[nk]=c;sharedQueue[n++]=nk;}}
   if(edge&8){const nk=k-cols;if(costs[nk]<0){costs[nk]=c;sharedQueue[n++]=nk;}}
  }
  const out={seed,costs,target};maps.set(r,out);return out;
 }
 function direction(a,p,r=14){
  const d=Math.hypot(p.x-a.x,p.y-a.y);
  if(clear(a,p,r))return {x:(p.x-a.x)/Math.max(1,d),y:(p.y-a.y)/Math.max(1,d)};
  const flow=field(p,r);if(!flow)return {x:0,y:0};
  const ax=Math.floor(a.x/cell),ay=Math.floor(a.y/cell);let best=null,score=Infinity;
  for(let y=ay-2;y<=ay+2;y++)for(let x=ax-2;x<=ax+2;x++){
   if(x<0||y<0||x>=cols||y>=cols)continue;const k=x+y*cols;const cost=flow.costs[k];if(cost<0)continue;
   const b=center(k);const s=cost*cell*1.05+Math.hypot(a.x-b.x,a.y-b.y);if(s>=score)continue;
   if(!clear(a,b,r))continue;
   score=s;best=b;
  }
  if(!best)return {x:0,y:0};const n=Math.hypot(best.x-a.x,best.y-a.y);return {x:(best.x-a.x)/Math.max(1,n),y:(best.y-a.y)/Math.max(1,n)};
 }

// Geometry stays fixed for this arena; build each body-size grid before combat.
function prepare(radii,target){for(const r of new Set(radii)){grid(r);if(target)field(target,r);}}
return {move,direction,prepare};
}};
