const assert=require('node:assert/strict');
const {createHarness}=require('./helpers/game-harness.cjs');
const {loadModule}=require('./helpers/load-modules.cjs');
const path=require('node:path');

async function main(){
 const {session:t,env,nodes}=await createHarness();
 const {createArenas,campLanes}=await loadModule(env,path.resolve(__dirname,'../src/world/arenas.js'));
 const arenas=createArenas(env.Village);
 for(const lane of campLanes)for(const offset of [-30,0,30]){
  const n=lane+offset,camp=arenas.get('camp');
  assert(camp.clear({x:40,y:n},{x:2160,y:n},30),'Horizontal cavalry route must stay open');
  assert(camp.clear({x:n,y:40},{x:n,y:2160},30),'Vertical cavalry route must stay open');
 }
 assert(arenas.get('forest').objects.length>150,'Forest is densely populated');
 for(const map of ['village','forest','camp']){
  t.selectMap(map);t.start();assert.equal(t.state.map,map);
  assert(!arenas.get(map).blocked(1100,1100,44),'Central spawn fits all units');
  t.draw();
 }
 for(const map of ['forest','camp']){
  const arena=arenas.get(map),o=arena.objects[0];
  assert(arena.blocked(o.x,o.y-10,14),'Scenery blocks movement');
  const p={x:o.x-200,y:o.y-10};arena.move(p,400,0,14);assert(p.x<o.x,'Swept collision stops crossing scenery');
 }
 nodes.get('runMap').value='forest';nodes.get('runMap').onchange();t.start();assert.equal(t.state.map,'forest');
 function reset(map='forest'){
  t.selectMap(map);t.select('asterix');t.start();t.state.spawn=999;t.state.attack=999;
  for(const id of ['boar','netter','stoneSquad','tower','cavalry','caius','wine'])t.state.waveNext[id]=999;
 }
 function enemy(unit,x=1250,y=1100){const e=t.spawn(unit);assert(e);e.x=x;e.y=y;e.cd=0;return e;}
 function ticks(n){for(let i=0;i<n;i++)t.update(.02);}
 reset();let e=enemy('boar',1300);ticks(1);assert(e.action,'Boar warns before charging');ticks(30);assert(e.charge);ticks(25);assert(t.state.p.hp<t.state.p.max,'Boar charge damages hero');
 reset();e=enemy('stoneSquad',1320);ticks(100);assert(e.crush||e.hp<=0,'Stone falls after the charge');ticks(45);assert.equal(e.hp,0);assert.equal(t.state.kills,0,'Self destruction grants no kill or loot');
 reset();e=enemy('netter',1280);ticks(50);assert(t.state.enemyShots.some(b=>b.kind==='net'));
 ticks(25);assert(t.state.p.stun>0,'Net stuns on hit');const x=t.state.p.x;t.keys.add('KeyD');ticks(10);assert.equal(t.state.p.x,x,'Stun blocks movement');assert(!t.state.p.action,'Stun blocks active attack');t.keys.clear();ticks(75);assert.equal(t.state.p.stun,0);
 reset();e=enemy('netter',1280);ticks(1);t.state.p.y+=150;ticks(100);assert(!t.state.p.stun,'Net aims at locked position and can be dodged');
 reset('camp');e=enemy('tower',1460,1100);ticks(45);assert.equal(t.state.enemyShots.filter(b=>b.kind==='arrow').length,3,'Tower fires three arrows');
 reset('camp');e=t.spawn('cavalry');const entry={x:e.x,y:e.y};ticks(1);assert(e.action&&!e.charge);ticks(90);assert(e.charge,'Cavalry starts after warning');const walkStart=e.walk;const walkFrames=new Set();for(let i=0;i<50;i++){ticks(1);const phase=((e.walk%1)+1)%1;walkFrames.add(Math.floor(phase*4));}assert.equal(Math.round((e.walk-walkStart)*100)/100,2,'Cavalry gait advances at two cycles per second');assert.deepEqual([...walkFrames].sort(),[0,1,2,3],'Cavalry runs through every walk frame');ticks(350);assert.equal(e.hp,0,'Cavalry exits without chasing');assert(Math.hypot(e.x-entry.x,e.y-entry.y)>2000,'Crosses the whole map');assert.equal(t.state.kills,0);
 reset('camp');e=t.spawn('cavalry');t.state.p.x=e.x+e.lane.x*300;t.state.p.y=e.y+e.lane.y*300;ticks(90);assert(e.charge);assert(!e.strike);ticks(30);assert(e.strike,'Cavalry triggers strike when encountering hero on path');ticks(30);assert(!e.strike&&e.struck,'Cavalry finishes strike and resumes galloping');
 reset('camp');t.state.t=150;
 const lanes=new Set();
 for(let i=0;i<30;i++){
  const horse=t.spawn('cavalry'),horizontal=horse.lane.x!==0;
  const coordinate=horizontal?horse.y:horse.x;
  const lane=campLanes.find(n=>Math.abs(n-coordinate)<=30);assert(lane!==undefined);
  lanes.add(lane);t.state.enemies=[];
 }
 assert(lanes.size>3,'Late cavalry uses routes throughout the map');
 reset('camp');e=enemy('caius',1120);ticks(100);assert.equal(t.state.p.hp,t.state.p.max,'Caius never attacks');
 t.damage(e,99);assert.equal(t.state.helmets.length,0);t.damage(e,1);assert.equal(t.state.helmets.length,1);assert.equal(t.state.gems.length,1);
 t.damage(e,1e6);assert(t.state.helmets.length<=27,'Payout capped by actual remaining HP');const count=t.state.gems.length;t.damage(e,1e6);assert.equal(t.state.gems.length,count,'Dead Caius cannot be farmed');
 reset('camp');e=enemy('wine',1300);ticks(30);assert(t.state.winePools.length>0);const pool=t.state.winePools[0];t.state.enemies=[];t.state.p.x=pool.x;t.state.p.y=pool.y;ticks(1);assert(t.state.p.poisoned>0);assert(t.state.p.hp<t.state.p.max);t.state.p.y+=200;ticks(320);assert.equal(t.state.winePools.length,0);assert.equal(t.state.p.poisoned,0);
 for(const map of ['forest','camp','village']){
  reset(map);t.state.waveNext={};t.state.t=46;t.state.p.inv=999;t.update(.02);
  const types=t.state.enemies.map(e=>e.unit);
  const expected=map==='forest'?['boar','netter','stoneSquad']:map==='camp'?['wine','cavalry','tower','caius']:[];
  for(const unit of expected)assert(types.includes(unit),map+' spawns '+unit);
  if(map==='village')assert.equal(types.length,0,'Village retains its original roster');
  t.draw();
 }
 for(const map of ['forest','camp']){
  t.selectMap(map);t.start();t.state.p.inv=999;t.state.stats.damage=0;
  for(let i=0;i<6001;i++){t.update(.05);if(i%500===0)t.draw();}
  assert(t.state.bossSpawned);assert.equal(t.mode,'play');
  const boss=t.state.enemies.find(e=>e.boss);assert(boss);t.damage(boss,1e6);t.update(.02);assert.equal(t.mode,'end');
  t.start();assert.equal(t.state.winePools.length,0);assert(!t.state.p.stun);assert.equal(t.state.map,map);
 }
 console.log('PASS: three maps, obstacles, seven enemy mechanics, warnings, dodge, stun, poison expiry, bounded loot, full runs and restart.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
