const assert=require('node:assert/strict');
const {createHarness}=require('./helpers/game-harness.cjs');
async function setup(hero){const h=await createHarness();h.env.Progression.earn(1000);if(!h.env.Progression.owned(hero))h.env.Progression.buyHero(hero);h.session.select(hero);h.session.selectMap('camp');h.session.start();const s=h.session.state;s.p.x=1100;s.p.y=1100;s.spawn=1e9;for(const id of Object.keys(s.waveNext))s.waveNext[id]=1e9;s.waveNext={turtle:1e9,ram:1e9,cavalry:1e9,netter:1e9,tower:1e9,caius:1e9,wine:1e9};s.attack=1e9;s.music=1e9;return h;}
function enemy(h,hp=10000,dx=30,unit='roman'){h.session.spawn(unit);const e=h.session.state.enemies.at(-1);Object.assign(e,{x:h.session.state.p.x+dx,y:h.session.state.p.y,hp,max:hp,cd:1e9,speed:0,vx:0,vy:0});return e;}
function advance(h,time,dt=.05){for(let t=0;t<time-1e-9;t+=dt)h.session.update(Math.min(dt,time-t));}
async function main(){
 for(const [hero,slot,id] of [['panoramix',0,'brew'],['antisanitarix',1,'cloud']]){
  const h=await setup(hero);
  const {abilityDefinitions}=await require('./helpers/load-modules.cjs').loadModule(h.env,require('node:path').resolve('data/characters/abilities.js'));
  abilityDefinitions[hero][slot].duration=9;h.session.start();
  h.session.state.stats.poisonDuration=2;
  assert(h.session.activateAbility(slot));
  const expected=id==='brew'?11:9;
  assert.equal(h.session.state.abilities[slot].left,expected,'Activation respects configured duration');
  assert.equal(h.session.state.abilityZones[0].left,expected,'Zone and ability share a lifetime');
 }
 const configuredForge=await setup('automatix');
 const {abilityDefinitions}=await require('./helpers/load-modules.cjs').loadModule(configuredForge.env,require('node:path').resolve('data/characters/abilities.js'));
 abilityDefinitions.automatix[0].cooldownPerRank=4;configuredForge.session.start();
 configuredForge.session.activateAbility(0);
 const forgeUpgrade=configuredForge.session.upgrades.abilities.automatix.find(u=>u.ability==='forge');
 configuredForge.session.upgrades.apply(forgeUpgrade,configuredForge.session.state);
 assert.equal(configuredForge.session.state.abilities[0].cd,20,'Upgrade uses configured cooldown reduction');
 configuredForge.session.state.abilities[0].cd=0;configuredForge.session.activateAbility(0);
 assert.equal(configuredForge.session.state.abilities[0].cd,20,'Next activation uses the same cooldown reduction');
 for(const hero of ['asterix','obelix','automatix','cacofonix','antisanitarix','panoramix']){const h=await setup(hero);assert.equal(h.session.state.abilities.length,2);assert(h.session.activateAbility(0));assert(!h.session.activateAbility(0));assert(h.session.activateAbility(1));h.session.draw();const before=h.session.state.abilities[1].cd;h.session.pause();assert(!h.session.activateAbility(1));h.session.run();h.tick(0);h.tick(50);assert.equal(h.session.state.abilities[1].cd,before);h.session.stop();h.session.start();assert(h.session.state.abilities.every(a=>!a.cd&&!a.left));}

 function rank(h,id,n=3){const u=Object.values(h.session.upgrades.abilities).flat().find(u=>u.ability===id);for(let i=0;i<n;i++)assert(h.session.upgrades.apply(u,h.session.state));return u;}
 const upgradedDash=await setup('asterix');rank(upgradedDash,'dash');let victim=enemy(upgradedDash,1000,70);upgradedDash.session.activateAbility(0);advance(upgradedDash,.25);assert.equal(victim.hp,1000-35*1.75);
 rank(upgradedDash,'potion');upgradedDash.session.activateAbility(1);assert.equal(upgradedDash.session.state.abilities[1].left,9);
 const upgradedJump=await setup('obelix');rank(upgradedJump,'jump');victim=enemy(upgradedJump,1000,160);upgradedJump.session.activateAbility(0);advance(upgradedJump,.55);assert.equal(victim.hp,1000-65*1.75);
 rank(upgradedJump,'appetite');upgradedJump.session.state.p.hp=50;upgradedJump.session.activateAbility(1);upgradedJump.session.damage(enemy(upgradedJump,1),2);assert.equal(upgradedJump.session.state.p.hp,55);
 const upgradedSpin=await setup('automatix');rank(upgradedSpin,'spin');victim=enemy(upgradedSpin,1000,0);victim.r=100;upgradedSpin.session.activateAbility(1);advance(upgradedSpin,3);assert(Math.abs(victim.hp-(1000-180*1.75))<1e-6);
 upgradedSpin.session.activateAbility(0);rank(upgradedSpin,'forge');assert.equal(upgradedSpin.session.state.abilities[0].cd,6,'Rank shortens running forge cooldown');advance(upgradedSpin,6.1);assert(upgradedSpin.session.activateAbility(0));assert.equal(upgradedSpin.session.state.abilities[0].cd,6);assert.equal(upgradedSpin.env.Progression.armorRank,2,'One armor rank per activation');upgradedSpin.env.Progression.grantArmorRank();assert(!upgradedSpin.session.upgrades.pool('automatix',upgradedSpin.session.state).some(u=>u.ability==='forge'));
 const upgradedBard=await setup('cacofonix');rank(upgradedBard,'note');victim=enemy(upgradedBard,1000);upgradedBard.session.activateAbility(0);assert.equal(victim.hp,965);assert(Math.abs(victim.abilityStun-2.1)<1e-6);rank(upgradedBard,'concert');upgradedBard.session.activateAbility(1);assert.equal(upgradedBard.session.state.abilities[1].left,3);

 const concert=await setup('cacofonix');const near=enemy(concert,1000,250),far=enemy(concert,1000,330);concert.session.activateAbility(1);concert.session.state.music=0;advance(concert,.01);assert.equal(near.hp,988,'Concert reaches three times base radius with ordinary damage');assert.equal(far.hp,1000,'Concert has a bounded radius');assert(!near.abilitySlow,'Concert no longer slows');
 const arcs=[];concert.context.arc=(x,y,r)=>arcs.push(r);concert.session.draw();assert(arcs.includes(285),'Visible aura matches damage radius');
 advance(concert,3);const remainingHp=near.hp;concert.session.state.music=0;advance(concert,.01);assert.equal(near.hp,remainingHp,'Radius returns to normal after three seconds');arcs.length=0;concert.session.draw();assert(arcs.includes(95)&&!arcs.includes(285));
 const bigConcert=await setup('cacofonix');rank(bigConcert,'concert');bigConcert.session.state.stats.range=1.12;bigConcert.session.state.stats.musicRange=.15;bigConcert.session.state.stats.musicDamage=.5;const distant=enemy(bigConcert,1000,400);bigConcert.session.activateAbility(1);bigConcert.session.state.music=0;advance(bigConcert,.01);assert.equal(distant.hp,982,'Rank and passive radius stack without an extra damage bonus');assert.equal(bigConcert.session.state.stats.musicRange,.15,'Base stats stay unchanged');
 const bigArcs=[];bigConcert.context.arc=(x,y,r)=>bigArcs.push(r);bigConcert.session.draw();assert(bigArcs.some(r=>Math.abs(r-95*1.12*1.15*4.5)<1e-6));assert.equal(bigConcert.session.state.abilities[1].duration,3);
 const upgradedFish=await setup('antisanitarix');rank(upgradedFish,'volley');upgradedFish.session.activateAbility(0);assert.equal(upgradedFish.session.state.fish.length,8);rank(upgradedFish,'cloud');upgradedFish.session.activateAbility(1);assert.equal(upgradedFish.session.state.abilityZones[0].damage,10.5);assert.equal(upgradedFish.session.state.abilityZones[0].r,130);
 const upgradedDruid=await setup('panoramix');rank(upgradedDruid,'brew');upgradedDruid.session.activateAbility(0);assert.equal(upgradedDruid.session.state.abilityZones[0].damage,21);assert.equal(upgradedDruid.session.state.abilityZones[0].r,117);rank(upgradedDruid,'elixir');upgradedDruid.session.state.p.hp=20;upgradedDruid.session.activateAbility(1);advance(upgradedDruid,5);assert(Math.abs(upgradedDruid.session.state.p.hp-55)<1e-6);
 const snapshot=await setup('obelix');snapshot.session.activateAbility(1);rank(snapshot,'appetite');snapshot.session.state.p.hp=50;snapshot.session.damage(enemy(snapshot,1),2);assert.equal(snapshot.session.state.p.hp,52,'Running effect retains activation rank');snapshot.session.start();assert(!snapshot.session.state.upgradeRanks,'Ability ranks reset with the run');
 const fourth=await setup('asterix');fourth.session.state.xp=fourth.session.state.need;fourth.session.update(.01);assert.equal(fourth.nodes.get('cards').children.length,4);fourth.listeners.keydown({code:'Digit4',repeat:false});assert.equal(fourth.session.mode,'play','Fourth keyboard choice works');
 console.log('PASS: all twelve upgraded effects, cast snapshots, run reset, forge cooldown and cap, four cards and Digit4.');
 // Persistence is checked through a fresh module, not only a restarted session.
 const vm=require('node:vm'),{loadModule}=require('./helpers/load-modules.cjs'),path=require('node:path'),saved=new Map();
 const env={localStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)}};vm.createContext(env);
 await loadModule(env,path.resolve('src/systems/persistence.js'));assert(env.Progression.grantArmorRank());env.Progression.flush();
 const reload={localStorage:env.localStorage};vm.createContext(reload);await loadModule(reload,path.resolve('src/systems/persistence.js'),{fresh:true});assert.equal(reload.Progression.data.levels.armor,1);
 const potion=await setup('asterix');potion.session.activateAbility(1);potion.session.state.stats.haste+=.12;potion.session.state.stats.speed+=.08;advance(potion,6);assert.equal(potion.session.state.stats.haste,1.12);assert.equal(potion.session.state.stats.speed,1.08,'Expired buff preserves upgrades');
 for(const dt of [.02,.05]){const timed=await setup('panoramix');timed.session.state.p.hp=20;timed.session.activateAbility(1);advance(timed,5,dt);assert(Math.abs(timed.session.state.p.hp-40)<1e-6,'Healing independent of frame partition');}
 const forge=await setup('automatix'),p=forge.env.Progression,s=forge.session.state,wallet=p.data.helmets;
 for(let i=1;i<=3;i++){s.abilities[0].cd=0;assert(forge.session.activateAbility(0));assert.equal(p.data.levels.armor,i);assert.equal(s.stats.armor,i);assert.equal(p.data.helmets,wallet);}
 s.abilities[0].cd=0;assert(!forge.session.activateAbility(0));forge.session.start();assert.equal(forge.session.state.stats.armor,3,'Granted ranks survive restarting');
 const ob=await setup('obelix');ob.session.state.p.hp=80;ob.session.activateAbility(1);let e=enemy(ob,1);ob.session.damage(e,2);assert.equal(ob.session.state.p.hp,82);ob.session.damage(e,2);assert.equal(ob.session.state.p.hp,82);e=enemy(ob,1);e.hp=0;advance(ob,.1);assert.equal(ob.session.state.p.hp,82,'Despawn does not heal');advance(ob,7);ob.session.damage(enemy(ob,1),2);assert.equal(ob.session.state.p.hp,82,'Expired appetite does not heal');
 const jump=await setup('obelix');e=enemy(jump,1000,160);jump.session.activateAbility(0);advance(jump,.55);assert.equal(e.hp,935,'Landing hits once');advance(jump,.1);assert.equal(e.hp,935);assert.equal(jump.session.state.p.jumpHeight,0);
 const dash=await setup('asterix');e=enemy(dash,1000,70);dash.session.activateAbility(0);advance(dash,.25);assert.equal(e.hp,965,'Dash hits once');
 const spin=await setup('automatix');e=enemy(spin,1000,0);e.r=100;spin.session.activateAbility(1);advance(spin,3);assert(Math.abs(e.hp-820)<1e-6,'Exactly ten spin ticks');assert(!spin.session.state.p.action);
 const bard=await setup('cacofonix');e=enemy(bard,1000);bard.session.activateAbility(0);assert.equal(e.hp,980);assert.equal(e.abilityStun,1.2);const heavy=enemy(bard,1000,40,'tower');bard.session.state.abilities[0].cd=0;bard.session.activateAbility(0);assert(!heavy.abilityStun);
 const fish=await setup('antisanitarix');fish.session.activateAbility(0);assert.equal(fish.session.state.fish.length,5);assert(fish.session.state.fish.every(f=>f.damage===16));fish.session.activateAbility(1);e=enemy(fish,1000,0);advance(fish,5);assert(e.hp<=940,'Cloud damages throughout lifetime');assert.equal(fish.session.state.abilityZones.length,0);
 const druid=await setup('panoramix');druid.session.state.p.hp=20;druid.session.state.p.poisoned=2;druid.session.activateAbility(1);advance(druid,5);assert(Math.abs(druid.session.state.p.hp-40)<1e-6);assert.equal(druid.session.state.p.poisoned,0);druid.session.activateAbility(0);assert.equal(druid.session.state.abilityZones.length,1);
 const mobile=await setup('asterix'),canvas=mobile.nodes.get('game');canvas.events.pointerdown({pointerType:'touch',pointerId:1,clientX:100,clientY:100});canvas.events.pointermove({pointerId:1,clientX:150,clientY:100});canvas.events.pointerup({pointerId:2});const x=mobile.session.state.p.x;advance(mobile,.1);assert(mobile.session.state.p.x>x,'Second finger does not release movement');mobile.nodes.get('ability1').onclick();assert(mobile.session.state.abilities[1].left>0);
 console.log('PASS: all twelve abilities, persistent free armor ranks/cap, cooldowns/pause/reset, kill healing, jump/dash single hits, spin ticks, control resistance, fish/cloud/elixir and multitouch.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

