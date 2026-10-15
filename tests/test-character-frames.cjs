'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const manifest=require('../data/animations/character-frames.json');
const {frameHarness}=require('./helpers/frame-harness.cjs');
(async()=>{
 assert.deepEqual([manifest.width,manifest.height,manifest.anchor],[256,256,[128,236]]);
 const files=new Set();
 for(const [id,spec]of Object.entries(manifest.characters)){
  assert(['animation','villager','unit'].includes(spec.renderer),id+': supported rendering adapter');
  assert(spec.actions.walk?.length&&spec.actions.attack?.length,id+': required actions');
  assert(spec.actions[spec.idle.action]?.[spec.idle.index],id+': idle refers to a real pose');
  for(const [action,sequence]of Object.entries(spec.actions)){
   assert(sequence.length>0,id+'/'+action);
   for(const file of sequence){
    assert(/^characters\/(heroes|enemies|civilians)\/[a-z0-9-]+\/animations\/[a-z]+\/\d+\.png$/.test(file),'Safe independent frame path: '+file);
    const bytes=fs.readFileSync(path.resolve(__dirname,'../assets/runtime',file));
    assert.equal(bytes.subarray(1,4).toString(),'PNG');
    assert.equal(bytes.readUInt32BE(16),256,file);assert.equal(bytes.readUInt32BE(20),256,file);
    files.add(file);
   }
  }
 }
 const h=await frameHarness('src/rendering/character-frames.js'),F=h.env.CharacterFrames;
 // Additional animation frames need no change to the playback logic or hit timing.
 F.manifest.characters.fixture={idle:{action:'walk',index:2},actions:{walk:Array.from({length:6},(_,i)=>'fixture/'+i+'.png'),attack:['fixture/0.png','fixture/1.png','fixture/2.png']}};
 const status=F.register(['fixture'],'fixture-ready');h.images.forEach(i=>i.onload());
 assert.equal(status.fixture,'ready');assert.equal(F.get('fixture','walk',.5).url.split('/').at(-1),'3.png');
 assert.equal(F.get('fixture','attack',1).url.split('/').at(-1),'2.png');
 assert.equal(F.get('fixture','idle').url.split('/').at(-1),'2.png');
 assert.equal(F.get('fixture','walk',-1/6).url.split('/').at(-1),'5.png');
 assert(F.get('fixture','walk',NaN));
 const bad=F.register(['asterix'],'fixture-ready');const image=h.images.find(i=>i.url.includes('/asterix/'));image.naturalWidth=128;image.onload();
 assert.equal(bad.asterix,'fallback');assert.equal(F.get('asterix'),null,'Wrong frame dimensions are rejected');
 console.log(`PASS: ${files.size} independent PNG poses, universal dimensions, manifest references, variable sequence lengths and invalid-size fallback.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
