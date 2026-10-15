'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const manifest=require('../data/animations/character-frames.json');
const {frameHarness}=require('./helpers/frame-harness.cjs');
const {loadModule}=require('./helpers/load-modules.cjs');
const ids=['boar','stoneSquad','netter','tower','cavalry','caius','wine','auxiliary','merchant','courtesan'];
(async()=>{
 const h=await frameHarness('src/rendering/art/unit-art.js');h.images.forEach(i=>i.onload());
 const U=h.env.UnitArt;
 for(const id of ids){
  const spec=manifest.characters[id];assert(spec,id+' registered');assert.equal(U.status[id],'ready');
  const hashes=new Set();
  for(const action of ['walk','attack','hurt']){
   assert.equal(spec.actions[action].length,4);
   for(const file of spec.actions[action]){
    const png=fs.readFileSync(path.resolve(__dirname,'../assets/runtime',file));
    assert.equal(png.readUInt32BE(16),256);assert.equal(png.readUInt32BE(20),256);assert.equal(png[25],6,'RGBA transparency');
    hashes.add(crypto.createHash('sha256').update(png).digest('hex'));
   }
  }
  assert.equal(hashes.size,12,id+' has twelve real poses');
  let drawn,flip;const g={save(){},restore(){},translate(){},scale(x){flip=x;},drawImage(frame){drawn=frame;}};
  const e={unit:id,x:0,y:0,heading:Math.PI,walk:.55,moving:true};
  assert(U.draw(g,e));assert.equal(drawn,U.get(id,'walk',.55));assert.equal(flip,-1);
  e.visualHurt={elapsed:.18,duration:.34,flip:false};U.draw(g,e);assert.equal(drawn,U.get(id,'hurt',.18/.34));
  delete e.visualHurt;e.action={elapsed:.5,duration:1,flip:false};U.draw(g,e);assert.equal(drawn,U.get(id,'attack',.5));
  e.charge={left:1};U.draw(g,e);assert.equal(drawn,U.get(id,'walk',.55));
 }
 await loadModule(h.env,path.resolve(__dirname,'../src/entities/legion.js'));
 let raster=0,pixels=0;const labels=new Set();
 const g=new Proxy({save(){},restore(){},translate(){},scale(){},drawImage(image){if(image instanceof h.env.Image)raster++;else labels.add(image);},fillRect(){pixels++;},fillText(){}},{get:(o,k)=>o[k]||(()=>{})});
 for(const id of ids)h.env.Legion.draw(g,{unit:id,x:0,y:0,heading:0,moving:false},()=>{throw Error('Unexpected legacy sprite')});
 assert.equal(raster,ids.length,'Game uses raster frames before pixel fallback');assert.equal(pixels,0);
 const labelCount=labels.size;assert(labelCount>0,'Unit labels use raster canvases');
 for(const id of ids)h.env.Legion.draw(g,{unit:id,x:0,y:0,heading:0,moving:false},()=>{throw Error('Unexpected legacy sprite')});
 assert.equal(labels.size,labelCount,'Repeated draws reuse label canvases');
 // Flying weapons are literal crops of their release frames, at the same scale.
 for(const [kind,id,crop,height]of [['net','netter',[183,172,64,44],44],['arrow','tower',[185,109,33,10],122]]){
  for(const [vx,vy]of [[250,0],[-250,0],[0,250]]){
   const calls=[],g={save(){calls.push('save');},restore(){calls.push('restore');},translate(...a){calls.push(['translate',...a]);},rotate(a){calls.push(['rotate',a]);},drawImage(...a){calls.push(['image',...a]);}};
   h.env.Legion.projectile(g,{kind,x:100,y:200,vx,vy,age:0,flightTime:1});
   const image=calls.find(c=>c[0]==='image');assert.equal(image[1],U.get(id,'attack',.5),'Exact release pose image');
   assert.deepEqual(image.slice(2,6),crop);assert.deepEqual(image.slice(6),[-crop[2]/2,-crop[3]/2,crop[2],crop[3]],'Preserves release-frame scale');
   assert.deepEqual(calls.find(c=>c[0]==='translate'),['translate',100,200-height]);
   assert.equal(calls.find(c=>c[0]==='rotate')[1],Math.atan2(vy,vx));assert.equal(calls[0],'save');assert.equal(calls.at(-1),'restore');
  }
 }
 let arrivalY;h.env.Legion.projectile({save(){},restore(){},rotate(){},drawImage(){},translate(x,y){arrivalY=y;}},{kind:'arrow',x:100,y:200,vx:250,vy:0,age:1,flightTime:1});assert.equal(arrivalY,160,'Tower arrows descend from archer platform to hero height');
 const broken=await frameHarness('src/rendering/art/unit-art.js');broken.images.find(i=>i.url.includes('/boar/')).onerror();assert.equal(broken.env.UnitArt.get('boar'),null,'Load errors retain pixel fallback');
 console.log('PASS: 120 distinct transparent frames, ten raster-first units, animation/reaction/charge selection, facing and load fallback.');
})().catch(e=>{console.error(e);process.exitCode=1;});
