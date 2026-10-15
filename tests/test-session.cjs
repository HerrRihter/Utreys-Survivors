const {loadModule,resourcePath}=require('./helpers/load-modules.cjs');
async function main(){
'use strict';

const assert = require('node:assert/strict');
const {createHarness} = require('./helpers/game-harness.cjs');
const idle = await createHarness({createSession: false});
assert.equal(idle.nodes.size, 0, 'Importing the session does not create a browser UI');
assert.equal(idle.scheduled.size, 0, 'Importing does not schedule a frame');
assert.equal(Object.keys(idle.listeners).length, 0, 'Importing does not bind input');

const first = await createHarness(), second = await createHarness();
for(const win of [true,false]){
 const h=await createHarness();h.session.start();h.session.state.t=300;
 h.session.finish(win);h.session.finish(win);h.session.menu();h.session.menu();
 assert.equal(h.env.Progression.stats.totalTime,300,'Finish and menu record a run exactly once');
 h.session.start();h.session.state.t=25;h.session.menu();
 assert.equal(h.env.Progression.stats.totalTime,325,'Abandoning a live run records its time');
 h.session.start();h.session.state.t=10;h.session.finish(win);h.session.start();
 assert.equal(h.env.Progression.stats.totalTime,335,'Retry does not record the finished run again');
 h.session.state.t=5;h.session.start();
 assert.equal(h.env.Progression.stats.totalTime,340,'Restart records the interrupted run');
}
const injectedHarness=await createHarness({createSession:false});
let injectedEarned=0;
const injectedProgression={...injectedHarness.env.Progression,armorRank:3,earn:n=>{injectedEarned+=n;}};
const injectedSession=injectedHarness.env.GameSession.create({...injectedHarness.env,Progression:injectedProgression});
injectedSession.start();
assert(!injectedSession.upgrades.pool('automatix',injectedSession.state).some(u=>u.ability==='forge'),'Forge availability reads injected progression');
for(const u of injectedSession.upgrades.pool('asterix',injectedSession.state)){
 injectedSession.state.upgradeRanks??={};injectedSession.state.upgradeRanks[u.id]=u.max;
}
const loot=injectedSession.upgrades.offer('asterix',injectedSession.state).find(u=>u.id==='loot');
assert(injectedSession.upgrades.apply(loot,injectedSession.state));
assert.equal(injectedEarned,3,'Loot credits the injected progression');
assert.equal(injectedHarness.env.Progression.helmets,0,'Global progression is untouched');
assert.equal(injectedSession.state.earned,3);
assert.equal(first.session.state, null);
assert.equal(first.scheduled.size, 0, 'Creating a session does not start its loop');
first.session.select('obelix');first.session.start();
second.session.start();
assert.equal(first.session.state.p.max, 160);
assert.equal(second.session.state.p.max, 110);
first.session.keys.add('KeyD');
assert.equal(second.session.keys.size, 0, 'Input is isolated between sessions');
first.session.state.stats.damage = 7;
assert.equal(second.session.state.stats.damage, 1, 'Run state is isolated');
first.session.run();first.session.run();
assert.equal(first.scheduled.size, 1, 'Repeated run() does not duplicate the loop');
first.tick(1000);
assert.equal(first.session.state.t, 0, 'First scheduled frame starts a fresh clock');
first.tick(1030);
assert(Math.abs(first.session.state.t - .03) < 1e-9);
first.session.pause();first.tick(1060);
assert(Math.abs(first.session.state.t - .03) < 1e-9, 'Paused frames do not advance simulation');
first.session.stop();
assert.equal(first.scheduled.size, 0, 'stop() cancels the scheduled frame');
assert.equal(first.session.running, false);
first.session.pause();first.session.run();first.tick(50000);
assert(Math.abs(first.session.state.t - .03) < 1e-9, 'Restarting the loop does not simulate stopped time');
first.session.stop();
const mobile=await createHarness();mobile.session.start();
mobile.session.state.spawn=1e9;
const canvas=mobile.nodes.get('game');
const startX=mobile.session.state.p.x;
canvas.events.pointerdown({pointerType:'touch',pointerId:1,clientX:100,clientY:100});
canvas.events.pointermove({pointerId:1,clientX:170,clientY:100});
mobile.session.update(.01);assert(mobile.session.state.p.x>startX,'Touch movement reaches the simulation');
canvas.events.pointercancel();const stoppedX=mobile.session.state.p.x;
mobile.session.update(.01);assert.equal(mobile.session.state.p.x,stoppedX,'Pointer cancellation clears the stick');
mobile.session.keys.add('KeyD');mobile.listeners.blur();
assert.equal(mobile.session.keys.size,0);assert.equal(mobile.session.mode,'pause','Focus loss resets input and pauses');
mobile.env.window.innerWidth=390;mobile.env.window.innerHeight=844;mobile.env.window.devicePixelRatio=3;
mobile.listeners.resize();assert.equal(canvas.width,780);assert.equal(canvas.height,1688,'Portrait canvas retains DPR cap and zoom');
mobile.env.window.innerWidth=844;mobile.env.window.innerHeight=390;mobile.listeners.resize();
assert.equal(canvas.width,1688);assert.equal(canvas.height,780,'Landscape resize retains aspect ratio');
console.log('PASS: side-effect-free session import, injected adapters, isolated state/input, one loop, pause, cancellation and restart clock.');
console.log('PASS: touch movement/cancel, focus loss and portrait/landscape canvas sizing.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
