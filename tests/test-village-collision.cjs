const {loadModule,resourcePath}=require('./helpers/load-modules.cjs');
async function main(){
const projectRoot = require('node:path').resolve(__dirname, '..');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const env={};env.AssetPaths={url:relative=>'assets/runtime/'+relative};vm.createContext(env);
for(const file of ['src/world/village/collision.js','src/world/village/village-data.js','src/world/village/navigation.js','src/world/village/village-renderer.js','src/world/village/village.js'])await loadModule(env,projectRoot+'/'+file,{fresh:false});
const V=env.Village;
const view={minX:100,maxX:300,minY:100,maxY:300};
assert(env.sceneryVisible({x:200,y:450,width:100},200,view),'Tall roof remains visible when its feet are offscreen');
assert(!env.sceneryVisible({x:400,y:200,width:100},200,view),'Offscreen scenery is culled horizontally');
assert(!env.sceneryVisible({x:200,y:450,width:100},100,view),'Scenery entirely below the viewport is culled');
assert(env.sceneryVisible({x:200,y:450,width:100},100),'Previews without a viewport keep drawing everything');
// Preparing static grids is idempotent and routing does not rebuild geometry.
let blockedChecks=0;
const nav=env.VillageNavigation.create({size:100,cell:25,cols:4,
 blocked:()=>{blockedChecks++;return false;},clear:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<40});
nav.prepare([12,16,12]);assert.equal(blockedChecks,32);
nav.prepare([12,16]);assert.equal(blockedChecks,32);
nav.direction({x:12,y:12},{x:87,y:87},12);assert.equal(blockedChecks,32,'Combat uses the prepared grid');
// A hero in an inaccessible pocket used to trigger a seed scan per enemy.
const pocket={x:87,y:87};let targetChecks=0;
const unreachable=env.VillageNavigation.create({size:100,cell:25,cols:4,blocked:()=>false,
 clear:(a,b)=>{if(b===pocket){targetChecks++;return false;}return true;}});
unreachable.prepare([12]);
unreachable.direction({x:12,y:12},pocket,12);const initialChecks=targetChecks;
assert(initialChecks>1,'First query searches for a reachable approach');
for(let i=0;i<120;i++)unreachable.direction({x:12,y:12},pocket,12);
assert.equal(targetChecks,initialChecks+120,'Unreachable target search is shared across the horde');
pocket.x++;unreachable.direction({x:12,y:12},pocket,12);
assert(targetChecks>initialChecks+121,'Moving the target invalidates the cached result');
for(const o of V.objects){
 const polys=V.collision.polygons.filter(p=>p.object===o);assert(polys.length,'Every scenery object has physical geometry');
 for(const p of polys){
  const c={x:p.points.reduce((s,p)=>s+p.x,0)/p.points.length,y:p.points.reduce((s,p)=>s+p.y,0)/p.points.length};
  assert(V.blocked(c.x,c.y,0),o.art+' solid interior');
  assert(!V.clear({x:p.minX-60,y:c.y},{x:p.maxX+60,y:c.y},2),o.art+' blocks fast projectiles');
 }
}
assert(V.clear({x:1100,y:1760},{x:1100,y:1910},14),'Hero fits through open gate');
assert(!V.clear({x:1100,y:1760},{x:1100,y:1910},46),'Siege cannot squeeze between gate leaves');
const fence=V.objects.find(o=>o.art==='fence');
let body={x:fence.x,y:fence.y-70};V.move(body,0,200,14);
assert(body.y<fence.y&& !V.blocked(body.x,body.y,14),'Swept motion stops before thin fence');
// Routes use actual actor radii and checked edges, including approaches outside the palisade.
let routes=0;
for(const r of [12,14,16,29,46])for(const start of [[1100,2020],[180,1100],[2020,1100],[1100,180],[600,650],[1740,1650],[650,1850],[1780,700]]){
 const a={x:start[0],y:start[1]},target={x:1100,y:1100};if(V.blocked(a.x,a.y,r))continue;
 for(let i=0;i<2200&&Math.hypot(a.x-target.x,a.y-target.y)>12;i++){
  const d=V.direction(a,target,r);V.move(a,d.x*4,d.y*4,r);
  assert(!V.blocked(a.x,a.y,r),'Navigation never enters geometry');
 }
 assert(Math.hypot(a.x-target.x,a.y-target.y)<=12,'Route to plaza: radius '+r+' from '+start);routes++;
}
// A target next to a wall must not poison the flow field for larger units.
const wall=V.collision.polygons.find(p=>p.object.art==='fence');
const target={x:(wall.minX+wall.maxX)/2,y:wall.maxY+15},a={x:target.x,y:target.y+200};
for(let i=0;i<150;i++){const d=V.direction(a,target,46);V.move(a,d.x*3,d.y*3,46);assert(!V.blocked(a.x,a.y,46));}
assert(a.y<target.y+90,'Siege approaches hero near wall without entering it');
console.log('PASS: '+V.collision.polygons.length+' ground polygons; every object solid, swept collisions, gate clearance, '+routes+' navigation routes for five radii, wall-adjacent target.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
