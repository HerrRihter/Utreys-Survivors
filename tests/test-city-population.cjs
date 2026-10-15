const assert=require('node:assert/strict');
const path=require('node:path');
const {createHarness}=require('./helpers/game-harness.cjs');
const {loadModule}=require('./helpers/load-modules.cjs');
(async()=>{
 const {session:t,env}=await createHarness();
 const {getWaveSchedule,selectWaveUnit,normalWave}=await loadModule(env,path.resolve('src/systems/wave-schedule.js'));
 const schedule=getWaveSchedule('lutetia');
 for(const [time,allowed]of [[0,['roman','auxiliary']],[39.99,['roman','auxiliary']],[40,['roman','auxiliary','pilum']],[84.99,['roman','auxiliary','pilum']],[85,['roman','auxiliary','pilum','veteran']]]){
  const seen=new Set(Array.from({length:100},(_,i)=>selectWaveUnit(schedule,time,(i+.5)/100)));
  assert.deepEqual([...seen].sort(),allowed.sort(),'Roster at '+time);
 }
 assert(normalWave(schedule,210).cap>normalWave(schedule,85).cap);assert(normalWave(schedule,0).interval>normalWave(schedule,140).interval);
 function reset(){t.selectMap('lutetia');t.start();t.state.enemies=[];t.state.attack=9999;t.state.spawn=9999;t.state.populationNext=9999;t.state.waveNext={courtesan:9999,wine:9999};}
 reset();t.state.t=124;t.update(.01);assert(!t.state.enemies.some(e=>e.unit==='turtle'));
 t.state.t=125;t.update(.01);assert.equal(t.state.enemies.filter(e=>e.unit==='turtle').length,1);
 t.state.t=195;t.update(.01);assert.equal(t.state.enemies.filter(e=>e.unit==='turtle').length,1);
 t.state.t=265;t.update(.01);assert.equal(t.state.enemies.filter(e=>e.unit==='turtle').length,2);
 reset();t.state.waveNext.wine=70;t.state.t=69;t.update(.01);assert(!t.state.enemies.some(e=>e.unit==='wine'));t.state.t=70;t.update(.01);assert(t.state.enemies.some(e=>e.unit==='wine'));
 reset();let thief=t.spawn('courtesan',false,{x:1180,y:1100});const before=thief.x;
 for(let i=0;i<25;i++)t.update(.02);
 assert(thief.x>before,'Thief flees rather than pursues nearby hero');assert(!thief.action);assert.equal(t.state.p.hp,t.state.p.max);
 reset();thief=t.spawn('courtesan',false,{x:1100,y:1100});t.state.p.x=1500;t.state.gems=[{x:1110,y:1100,v:3}];
 t.update(.02);assert.equal(t.state.gems.length,0);const after=thief.x;t.update(.02);assert(thief.x<after,'After stealing, thief runs away from hero');
 const types=['citizen'];
 for(let variant=0;variant<3;variant++){
  const unit='citizen';
  reset();const citizen=t.spawn(unit,false,{x:1100,y:1100,variant});
  assert.equal(citizen.variant,variant,'Skin is selected independently of unit type');
  t.update(.02);assert.equal(t.state.p.hp,t.state.p.max-1,'Contact deals exactly 1');assert(!citizen.action);
  t.state.p.inv=999;for(let i=0;i<100;i++)t.update(.02);assert(citizen.walk>.2,'Civilian runs');assert(!citizen.action);
  const kills=t.state.kills,earned=t.state.earned;t.damage(citizen,9999);
  assert.equal(t.state.gems.length,0);assert.equal(t.state.pickups.length,0);assert.equal(t.state.helmets.length,0);assert.equal(t.state.kills,kills);assert.equal(t.state.earned,earned);
 }
 reset();for(let i=0;i<40;i++)t.spawn('citizen',false,{x:1100,y:1200});t.state.spawn=0;t.update(.02);assert(t.state.enemies.some(e=>e.unit==='roman'||e.unit==='auxiliary'),'Crowd does not consume combat budget');
 reset();t.state.populationNext=0;t.state.t=240;for(let i=0;i<150;i++){t.state.t+=3;t.update(.01);}assert(t.state.enemies.filter(e=>types.includes(e.unit)).length<=40,'Crowd remains bounded');
 const frames=await require('./helpers/frame-harness.cjs').frameHarness('src/rendering/art/unit-art.js');frames.images.forEach(i=>i.onload());
 const art=frames.env.UnitArt,images=new Set();
 for(let variant=0;variant<3;variant++){
  let drawn;const g={save(){},restore(){},translate(){},scale(){},drawImage(image){drawn=image;}};
  art.draw(g,{unit:'citizen',variant,x:0,y:0,heading:0,moving:true,walk:.4});
  assert.equal(drawn,art.get('citizen','walk',.4,variant));assert(drawn.url.includes('/citizen-'+variant+'/'));images.add(drawn);
 }
 assert.equal(images.size,3,'Three distinct skins share one gameplay unit');
 console.log('PASS: wave gates, siege caps, independent crowd budget, fleeing thieves, three civilian skins, contact-only damage and no rewards.');
})().catch(e=>{console.error(e);process.exitCode=1;});
