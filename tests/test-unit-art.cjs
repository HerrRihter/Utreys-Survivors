'use strict';
const assert=require('node:assert/strict');
const {frameHarness}=require('./helpers/frame-harness.cjs');
(async()=>{
 const h=await frameHarness('src/rendering/art/unit-art.js'),U=h.env.UnitArt;
 assert.equal(U.get('spear'),null);h.images.forEach(i=>i.onload());
 assert.equal(h.images.length,Object.values(require('../data/animations/character-frames.json').characters).filter(c=>c.renderer==='unit').reduce((n,c)=>n+new Set(Object.values(c.actions).flat()).size,0));assert.equal(h.draws.length,0,'No runtime atlas splitting');
 for(const name of ['spear','pilum','veteran','turtle','ram']){
  assert.equal(U.status[name],'ready');
  for(const action of ['walk','attack','hurt']){
   const frames=[0,.25,.5,.75].map(p=>U.get(name,action,p));assert.equal(new Set(frames).size,4);
   assert.equal(U.get(name,action,1),frames[action==='walk'?0:3]);
  }
  assert.equal(U.get(name,'idle'),U.get(name,'walk',.25));
  const e={unit:name,x:10,y:20,heading:Math.PI,walk:.3,moving:true};let flipped,rendered;
  const g={save(){},restore(){},translate(){},scale(x){flipped=x===-1;},drawImage(...args){rendered=args;}};
  assert(U.draw(g,e));assert(flipped);assert.equal(rendered[0],U.get(name,'walk',.3));assert.deepEqual(rendered.slice(1),[-128,-236]);
  e.hurt={elapsed:.2,duration:.4,flip:false};U.draw(g,e);assert.equal(rendered[0],U.get(name,'hurt',.5));
 }
 assert.equal(U.get('roman'),null);
 console.log('PASS: 60 separate specialist poses, anchors, looping, priorities and facing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
