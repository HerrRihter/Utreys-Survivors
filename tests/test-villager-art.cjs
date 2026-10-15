'use strict';
const assert=require('node:assert/strict');
const {frameHarness}=require('./helpers/frame-harness.cjs');
(async()=>{
 const h=await frameHarness('src/rendering/art/villager-art.js'),V=h.env.VillagerArt;
 assert.equal(V.get('cacofonix'),null);h.images.forEach(i=>i.onload());
 assert.equal(h.images.length,49);assert.equal(h.draws.length,1,'Only the static currency icon uses a crop');
 for(const name of ['cacofonix','antisanitarix','automatix','panoramix']){
  assert.equal(V.status[name],'ready');
  for(const action of ['walk','attack','hurt'])assert.equal(new Set([0,.25,.5,.75].map(p=>V.get(name,action,p))).size,4);
  let flipped,frame;const g={save(){},restore(){},translate(){},scale(x){flipped=x===-1;},drawImage(f){frame=f;}};
  V.draw(g,name,0,0,{visualAction:{elapsed:.25,duration:.5,flip:true}},false);
  assert(flipped);assert.equal(frame,V.get(name,'attack',.5));
  V.draw(g,name,0,0,{hurt:{elapsed:.1,duration:.4,flip:false},action:{elapsed:0,duration:1}},false);
  assert.equal(frame,V.get(name,'hurt',.25));
 }
 assert.equal(h.env.HelmetArt.status,'ready');
 const broken=await frameHarness('src/rendering/art/villager-art.js');
 broken.images.find(i=>i.url.includes('/cacofonix/')).onerror();broken.load('automatix');
 assert.equal(broken.env.VillagerArt.status.cacofonix,'fallback');assert.equal(broken.env.VillagerArt.status.automatix,'ready');
 assert.equal(broken.env.VillagerArt.get('cacofonix'),null);
 console.log('PASS: separate hero poses, anchors, reaction priority and isolated load failure.');
})().catch(e=>{console.error(e);process.exitCode=1;});
