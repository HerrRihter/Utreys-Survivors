const assert=require('node:assert/strict');
const {createHarness}=require('./helpers/game-harness.cjs');
const {loadModule}=require('./helpers/load-modules.cjs');
const path=require('node:path');
async function main(){
 const h=await createHarness();h.env.Progression.earn(100);h.env.Progression.buyHero('automatix');h.session.select('automatix');h.session.start();const s=h.session.state;s.spawn=1e9;for(const id of Object.keys(s.waveNext))s.waveNext[id]=1e9;
 let copies=0;const descriptor=Object.getOwnPropertyDescriptor(h.env.Progression,'data');Object.defineProperty(h.env.Progression,'data',{get(){copies++;return descriptor.get();}});
 let writes=0;for(const id of ['ability0','ability1','levelText'])for(const property of ['textContent','title','disabled']){const node=h.nodes.get(id);let value=node[property];Object.defineProperty(node,property,{get:()=>value,set(v){writes++;value=v;}});}
 for(let i=0;i<120;i++)h.session.update(.01);
 assert.equal(writes,0,'Unchanged HUD must not recreate text/attributes each frame');assert.equal(copies,0,'Combat HUD must not serialize progression');
 h.session.activateAbility(1);writes=0;for(let i=0;i<60;i++)h.session.update(1/60);assert(writes<15,'Duration display updates at tenths, not every frame');
 h.session.pause();assert(h.nodes.get('ability0').disabled);h.session.pause();assert(!h.nodes.get('ability0').disabled,'Mode changes still update immediately');
 s.stats.regen=.15;s.p.hp=80.1;h.session.update(.01);writes=0;for(let i=0;i<60;i++)h.session.update(1/60);assert(writes<15,'Fractional regen does not rewrite unchanged HP text');
 h.session.selectMap('lutetia');h.session.start();
 let gradients=0;h.context.createRadialGradient=()=>{gradients++;return {addColorStop(){}};};
 h.session.draw();const initialGradients=gradients;h.session.draw();
 assert.equal(gradients,initialGradients,'City overlay is cached between frames');
 h.env.window.innerWidth=1234;h.env.window.innerHeight=700;h.listeners.resize();h.session.draw();
 assert(gradients>initialGradients,'City overlay is rebuilt after resize');
 const {VillageRenderer}=await loadModule(h.env,path.resolve('src/world/village/village-renderer.js'));
 const contexts=[];const doc={createElement(){const counts={ellipse:0,clip:0,drawImage:0},ctx=new Proxy(counts,{get:(o,k)=>k in o?()=>o[k]++:()=>{},set:()=>true});const canvas={getContext:()=>ctx};contexts.push(counts);return canvas;}};
 const renderer=VillageRenderer.create({document:doc,VillageArt:null,size:2200,objects:[],roads:[[0,1100,700,1100,1500,1100,2200,1100,180]],plaza:false,roughRoads:true});
 renderer.drawGround({drawImage(){}});
 assert.equal(contexts.length,2,'Ground and temporary road detail surfaces');assert.equal(contexts[0].clip,1);assert.equal(contexts[0].ellipse,0,'No per-fleck clipped drawing');assert.equal(contexts[1].ellipse,15000,'All decorative flecks retained');assert.equal(contexts[1].clip,0);assert.equal(contexts[0].drawImage,1,'One clipped composite of the detail layer');
 renderer.drawGround({drawImage(){}});assert.equal(contexts.length,2,'Cached terrain is not rebuilt in subsequent frames');
 console.log('PASS: stable HUD has no writes or progression clones, timer/regen changes bounded, pause updates immediately, terrain details composite once and remain cached.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
