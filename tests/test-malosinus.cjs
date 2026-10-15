const assert=require('node:assert/strict');
const {loadModule}=require('./helpers/load-modules.cjs');
const {createHarness}=require('./helpers/game-harness.cjs');
async function main(){
 const env={};
 const {updateMalosinus}=await loadModule(env,'src/systems/malosinus.js');
 const {advanceAction}=await loadModule(env,'src/core/action-timeline.js');
 const {unitDefinitions}=await loadModule(env,'data/enemies/units.js');
 const {waveSchedules}=await loadModule(env,'data/enemies/waves.js');
 assert.equal(waveSchedules.lutetia.boss.unit,'malosinus');
 for(const map of ['village','forest','camp'])assert.equal(waveSchedules[map].boss.unit,'boss');
 const e={...unitDefinitions.malosinus,unit:'malosinus',x:0,y:0,max:2200,hp:1000,vx:0,vy:0,cd:99};
 let damage=0,clear=true;
 const c={state:{p:{x:200,y:0},gems:[{x:2,y:0,v:4}],texts:[],fx:[],xp:50},Legion:{units:unitDefinitions},
 dist:(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),Village:{clear:()=>clear,direction:()=>({x:1,y:0}),move:(a,x,y)=>{a.x+=x;a.y+=y;}},
 soundEffect(){},advanceAction,beginAction:(a,d,p)=>{a.action={elapsed:0,duration:d,aim:{...p},hit:false};},hurtPlayer:a=>damage+=a.damage};
 updateMalosinus(e,c,0);assert.equal(e.hp,1048);assert(c.state.gems[0].dead);assert.equal(c.state.xp,50);
 updateMalosinus(e,c,0);assert.equal(e.hp,1048,'Consumed XP cannot heal twice');
 e.hp=2199;c.state.gems=[{x:0,y:0,v:100}];updateMalosinus(e,c,0);assert.equal(e.hp,2200);
 e.hp=1000;clear=false;c.state.gems=[{x:0,y:0,v:5}];updateMalosinus(e,c,0);assert.equal(e.hp,1000);assert(!c.state.gems[0].dead);
 clear=true;c.state.gems=[];c.state.p={x:60,y:0};e.cd=0;
 updateMalosinus(e,c,0);assert(e.action);updateMalosinus(e,c,.79);assert.equal(damage,0);
 updateMalosinus(e,c,.01);assert.equal(damage,65);updateMalosinus(e,c,.1);assert.equal(damage,65);
 for(const [p,wall] of [[{x:0,y:80},false],[{x:101,y:0},false],[{x:60,y:0},true]]){
  e.action={elapsed:0,duration:1.6,aim:{x:60,y:0},hit:false};c.state.p=p;clear=!wall;
  updateMalosinus(e,c,.8);assert.equal(damage,65,'Dodge, range and walls prevent impact');
 }
 e.hp=0;c.state.gems=[{x:0,y:0,v:100}];updateMalosinus(e,c,0);assert.equal(e.hp,0);assert(!c.state.gems[0].dead);
 const h=await createHarness();h.session.selectMap('lutetia');h.session.start();
 const s=h.session.state;s.t=230;h.session.update(0);
 const boss=s.enemies.find(e=>e.boss);assert.equal(boss.unit,'malosinus');assert.equal(boss.type,'malosinus');
 h.session.update(0);assert.equal(h.nodes.get('bossname').textContent,'КАЗНАЧЕЙ МАЛОСИНУС');
 h.session.damage(boss,99999);assert(s.bossDead);assert(s.gems.some(g=>g.v===100));
 console.log('PASS: city-only boss, XP consumption, capped healing, no resurrection, windup, single impact, dodge, cover, HUD and death.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
