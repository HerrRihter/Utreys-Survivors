'use strict';
const {performance}=require('node:perf_hooks');
async function main(){
 const {orderActors}=await import('../src/rendering/depth-order.js');
 const {VillageData}=await import('../src/world/village/village-data.js');
 const {objects}=VillageData.create();
 const staticObjects=objects.map(o=>({...o,scenery:true})).sort((a,b)=>a.y-b.y);
 const player={x:1100,y:1100};
 const enemies=Array.from({length:120},(_,i)=>({x:i*13%2200,y:i*137%2200,unit:'roman'}));
 const old=()=>[...objects.map(o=>({...o,scenery:true})),...enemies,{...player,type:'asterix',player:true}].sort((a,b)=>a.y-b.y);
 const next=()=>orderActors(staticObjects,enemies,player,'asterix');
 const assert=require('node:assert/strict');assert.deepEqual(next(),old());
 function sample(fn){for(let i=0;i<300;i++)fn();const batches=[];for(let b=0;b<50;b++){const start=performance.now();for(let i=0;i<100;i++)fn();batches.push((performance.now()-start)/100);}batches.sort((a,b)=>a-b);return {p50Ms:batches[25],p95Ms:batches[47]};}
 const before=sample(old),after=sample(next);
 const report={date:'2026-10-10',node:process.version,staticObjects:objects.length,enemies:enemies.length,
  method:'50 batches of 100 orders after 300 warmup iterations; same deterministic scene',
  before,after,p50ReductionPercent:(1-after.p50Ms/before.p50Ms)*100,
  limits:'CPU ordering microbenchmark only; not total browser frame time or mobile performance'};
 require('node:fs').writeFileSync(require('node:path').join(__dirname,'../docs/DEPTH-PROFILE.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
