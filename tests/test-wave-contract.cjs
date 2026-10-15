'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {validateSchedules, checkGameContracts} = require('../tools/check-game-contracts.cjs');
const {waveSchedules} = require('../data/enemies/waves.js');
const {mapDefinitions} = require('../data/maps/maps.js');
const {unitDefinitions} = require('../data/enemies/units.js');
const {loadModule} = require('./helpers/load-modules.cjs');
const {createHarness} = require('./helpers/game-harness.cjs');

async function main() {
  assert.equal(checkGameContracts(), 4);
  for (const mutate of [
    s => {s.lutetia = [];},
    s => {delete s.camp;},
    s => {s.village.normal.stages[0].weights = [['typo', 100]];},
    s => {s.village.normal.stages[0].weights = [['roman', 0]];},
    s => {s.forest.recurring[0].stages[0].every = 0;},
    s => {s.camp.recurring.push(s.camp.recurring[0]);},
    s => {s.lutetia.normal.stages[1].time = 0;},
    s => {s.lutetia.population.maximum = 1;},
    s => {s.village.extra = true;}
  ]) {
    const schedules = structuredClone(waveSchedules);mutate(schedules);
    assert.throws(() => validateSchedules(schedules, mapDefinitions, unitDefinitions), /Game contract/);
  }
  const env = {};
  const helpers = await loadModule(env, path.resolve('src/systems/wave-schedule.js'));
  const {getWaveSchedule, normalWave, selectWaveUnit, createWaveState, waveRoster} = helpers;
  // Compare old cutoff semantics, including exact thresholds and stage transitions.
  for (const time of [0,24.999,25,49.999,50,84.999,85,110,230,300]) {
    for (const roll of [0,.12999,.13,.31999,.32,.55999,.56,.99999]) {
      const expected = time >= 85 && roll < .13 ? 'veteran' : time >= 50 && roll < .32 ? 'pilum' : time >= 25 && roll < .56 ? 'spear' : 'roman';
      for (const map of ['village','forest','camp']) assert.equal(selectWaveUnit(getWaveSchedule(map), time, roll), expected);
    }
    const normal = normalWave(getWaveSchedule('village'), time);
    assert.equal(normal.interval, Math.max(.35,.95-time*.0018));
    assert.equal(normal.batch, 1+Math.floor(time/110));
  }
  const city = getWaveSchedule('lutetia');
  assert.equal(normalWave(city,39.999).interval,1.5);
  assert.equal(normalWave(city,40).interval,1.2);
  assert.equal(normalWave(city,210).cap,90);
  assert.equal(selectWaveUnit(city,0,.75),'auxiliary');
  assert(!waveRoster(city).some(entry=>entry.unit==='ram'||entry.unit==='spear'));
  assert(waveRoster(city).some(entry=>entry.unit==='merchant'&&entry.time===0));
  const first=createWaveState(city), second=createWaveState(city);
  first.waveNext.turtle=999;assert.equal(second.waveNext.turtle,125,'Run timers are independent');
  const {waveTiming}=await loadModule(env,path.resolve('src/ui/wave-preview.js'));
  assert.match(waveTiming(city,'turtle'),/2:05.*3:25/);
  assert.match(waveTiming(getWaveSchedule('camp'),'cavalry'),/2:00.*12 с.*6/);

  // An additional map uses the same spawning, population and preview code.
  const data=await loadModule(env,path.resolve('data/enemies/waves.js'));
  const extra=structuredClone(waveSchedules.lutetia);
  extra.normal.stages=[{time:0,interval:1,minInterval:1,timeFactor:0,batch:1,batchEvery:null,cap:2,weights:[['spear',100]]}];
  extra.recurring=[{unit:'ram',first:1,populationCap:null,stages:[{time:0,every:3,cap:1},{time:5,every:2,cap:2}],message:'ram'}];
  extra.boss={unit:'veteran',time:10,message:'boss',sound:'boss'};
  extra.residents=[];extra.notifications=[];
  extra.population.initial=0;extra.population.maximum=1;extra.population.growthEvery=1;
  data.waveSchedules.contractTest=extra;
  const {EnemySpawning}=await loadModule(env,path.resolve('src/systems/enemy-spawning.js'));
  const c={state:{...createWaveState(extra),map:'contractTest',t:1,p:{x:1100,y:1100},enemies:[]},
    Legion:{units:unitDefinitions},WORLD:2200,Math,rand:(a,b)=>(a+b)/2,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    Village:{blocked:()=>false},toast(){},soundEffect(){}};
  const spawning=EnemySpawning.create(c);c.spawn=spawning.spawn;
  spawning.updateSpawning(.5);
  assert.deepEqual(c.state.enemies.map(e=>e.unit),['ram','spear']);
  c.state.spawn=0;spawning.updateSpawning(.5);assert.equal(c.state.enemies.length,2,'Combat cap includes scheduled units');
  c.state.t=4;spawning.updateSpawning(.1);assert.equal(c.state.enemies.filter(e=>e.unit==='ram').length,1);
  assert.equal(c.state.enemies.filter(e=>e.unit==='citizen').length,1,'Population is not tied to a map name');
  c.state.t=7;spawning.updateSpawning(.1);assert.equal(c.state.enemies.filter(e=>e.unit==='ram').length,2);
  assert.equal(c.state.waveNext.ram,9,'Late cadence comes from data');
  c.state.t=10;c.Village.blocked=()=>true;spawning.updateSpawning(.1);assert.equal(c.state.bossSpawned,false,'Failed boss placement retries');
  c.Village.blocked=()=>false;spawning.updateSpawning(.1);spawning.updateSpawning(.1);
  assert.equal(c.state.enemies.filter(e=>e.boss).length,1);assert.equal(c.state.enemies.find(e=>e.boss).unit,'veteran');
  assert.throws(()=>spawning.spawn('typo'),/Unknown unit/);
  delete data.waveSchedules.contractTest;

  const h=await createHarness();
  const {createArenas}=await loadModule(h.env,path.resolve('src/world/arenas.js'));
  const arenas=createArenas(h.env.Village);
  for(const id of Object.keys(mapDefinitions)) {
    const arena=arenas.get(id);assert.equal(arenas.get(id),arena,'Arena cache');
    for(const method of ['prepare','blocked','clear','move','direction','draw','drawGround','drawObject']) assert.equal(typeof arena[method],'function',id+'.'+method);
    assert(Array.isArray(arena.residents));
    assert.deepEqual([...new Set(arena.residents.map(r=>r.unit))].sort(),[...waveSchedules[id].residents].sort());
    h.session.selectMap(id);h.session.start();
    const saved=h.session.state.waveNext; saved[Object.keys(saved)[0]]=999;
    h.session.start();assert.notEqual(h.session.state.waveNext,saved);
  }
  for(const file of ['src/systems/enemy-spawning.js','src/systems/population.js','src/app/game-flow.js','src/pages/legion-preview.js']) {
    const source=fs.readFileSync(file,'utf8');
    assert(!/===\s*['"](?:lutetia|camp|forest|village)['"]/.test(source),'Map dispatch outside factory: '+file);
  }
  console.log('PASS: identical map schemas, invalid-data rejection, original probabilities, generic new-map spawning, caps, restart, boss retry and shared preview timings.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
