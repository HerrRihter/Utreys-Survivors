'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {loadModule}=require('./helpers/load-modules.cjs');
(async()=>{
 const env={};
 await loadModule(env,path.resolve(__dirname,'../data/animations/character-bounds.js'));
 await loadModule(env,path.resolve(__dirname,'../src/ui/character-preview.js'));
 const anchor=[128,236];
 for(const id of ['roman-0','boss','spear','pilum','veteran','turtle','ram']){
  const b=env.CharacterBounds[id],p=env.fitCharacterPreview(b,anchor,280,210);
  for(const flip of [false,true]){
   const xs=[b.left,b.right].map(x=>p.x+(x-anchor[0])*p.scale*(flip?-1:1));
   assert(Math.min(...xs)>=18-1e-9&&Math.max(...xs)<=262+1e-9,id+': arms and siege equipment fit in both directions');
   assert(p.y+(b.top-anchor[1])*p.scale>=18-1e-9,id+': head and raised equipment fit');
   assert(p.y+(b.bottom-anchor[1])*p.scale<=184+1e-9,id+': feet retain bottom padding');
  }
  if(id==='roman-0'||id==='boss')assert.equal(p.scale,1.6,'Primary units use the same frame coordinates as specialists');
 }
 const p=env.fitCharacterPreview(env.CharacterBounds.ram,anchor,280,210),calls=[];
 const g={save(){},restore(){},translate(...args){calls.push(['translate',...args]);},scale(...args){calls.push(['scale',...args]);},drawImage(...args){calls.push(['drawImage',...args]);}};
 const image={width:256,height:256};env.drawCharacterPreview(g,image,anchor,p,true);
 assert.deepEqual(calls,[['translate',p.x,p.y],['scale',-p.scale,p.scale],['drawImage',image,-128,-236]]);
 console.log('PASS: consistent primary-unit scale, complete siege envelopes, both directions and anchored drawing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
