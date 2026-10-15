'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {frameHarness}=require('./helpers/frame-harness.cjs');
const {loadModule}=require('./helpers/load-modules.cjs');
(async()=>{
 const h=await frameHarness('src/rendering/art/animation-art.js'),A=h.env.AnimationArt;
 assert.equal(A.get('asterix'),null);
 const asterix=h.images.filter(i=>i.url.includes('/asterix/'));
 asterix.slice(0,-1).forEach(i=>i.onload());assert.equal(A.get('asterix'),null,'Partial sets stay unavailable');
 asterix.at(-1).onload();assert(A.get('asterix'));assert.equal(A.get('obelix'),null);
 for(const id of ['obelix','roman-0','roman-1','roman-2','boss'])h.load(id);
 for(const [name,v]of [['asterix',0],['obelix',0],['roman',0],['roman',1],['roman',2],['boss',0]]){
  for(const action of ['walk','attack',...(name==='roman'?['hurt']:[])]){
   const frames=[0,.25,.5,.75].map(p=>A.get(name,v,action,p));assert.equal(new Set(frames).size,4);
   assert.equal(A.get(name,v,action,1),frames[action==='walk'?0:3]);
  }
  assert.equal(A.get(name,v,'idle'),A.get(name,v,'attack',name==='obelix'?.75:0));
 }
 assert.equal(h.draws.length,4,'Only four Obelix attack poses are normalized at load time');
 for(const [image,x,y,w,height]of h.draws){
  assert(image.url.includes('/obelix/animations/attack/'));
  assert(Math.abs(x+w/2-128)<1e-9,'Scaling preserves horizontal anchor');
  assert(Math.abs(y+height*236/256-236)<1e-9,'Scaling preserves the foot anchor');
 }
 const normalizations=h.draws.length;
 for(let n=0;n<10000;n++)A.get('obelix',0,'attack',n/4);
 assert.equal(h.draws.length,normalizations,'Resizing never runs during playback');
 const requests=h.images.length;
 await loadModule(h.env,path.resolve(__dirname,'../src/rendering/art/roman-art.js'));
 assert.equal(h.images.length,requests,'Portrait adapter shares decoded frames');
 for(let n=0;n<10000;n++)A.get('roman',n%3,'walk',n/4);
 assert.equal(h.images.length,requests,'No allocations during playback');
 assert(h.images.every(i=>/\/characters\/(heroes|enemies|civilians)\/[^/]+\/animations\//.test(i.url)));
 console.log('PASS: atomic frame loading, variants, idle, loops and shared image cache.');
})().catch(e=>{console.error(e);process.exitCode=1;});
