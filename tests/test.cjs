const {loadModule,resourcePath}=require('./helpers/load-modules.cjs');
async function main(){
const projectRoot = require('node:path').resolve(__dirname, '..');
const fs = require('node:fs'), assert = require('node:assert/strict');
const {createHarness} = require('./helpers/game-harness.cjs');
const {env, nodes, listeners, noop, context, session: t} = await createHarness();
const page=fs.readFileSync(projectRoot+'/index.html','utf8');assert(!page.includes('id="portraitA"')&&!page.includes('id="portraitO"')&&!page.includes('id="chosen"'),'Main menu has no hero portraits or selection label');
nodes.get('start').onclick();assert.equal(nodes.get('runHeroes').children.length,2,'Only the two initially owned heroes are offered');assert.deepEqual(nodes.get('runHeroes').children.map(card=>card.dataset.hero),['asterix','obelix']);assert.equal(nodes.get('runHeroSelect').classList.contains('hidden'),false);nodes.get('runHeroBack').onclick();assert.equal(nodes.get('runHeroSelect').classList.contains('hidden'),true);nodes.get('start').onclick();listeners.keydown({code:'Escape',repeat:false,preventDefault:noop});assert.equal(nodes.get('runHeroSelect').classList.contains('hidden'),true,'Escape closes the hero selector');assert.equal(t.mode,'menu');
t.start();assert.equal(t.mode,'play');const x=t.state.p.x;t.keys.add('KeyD');t.update(.1);assert(t.state.p.x>x);t.keys.clear();
t.state.p.x=2190;t.keys.add('ArrowRight');for(let i=0;i<10;i++)t.update(.1);t.keys.clear();assert.equal(t.state.p.x,2148,'Hero stays inside the map at the right edge');t.state.p.x=10;t.keys.add('ArrowLeft');for(let i=0;i<10;i++)t.update(.1);t.keys.clear();assert.equal(t.state.p.x,52,'Hero stays inside the map at the left edge');t.state.p.y=10;t.keys.add('ArrowUp');for(let i=0;i<10;i++)t.update(.1);t.keys.clear();assert.equal(t.state.p.y,100,'Hero stays inside the map at the top edge');t.start();
t.pause();assert.equal(t.mode,'pause');t.pause();assert.equal(t.mode,'play');
t.spawn('roman');let e=t.state.enemies[0];e.x=t.state.p.x+30;e.y=t.state.p.y;t.state.attack=0;t.update(.02);assert.equal(t.state.kills,0,'Punch has windup');assert(t.state.p.action);for(let i=0;i<12;i++)t.update(.02);assert.equal(t.state.kills,0,'Legionary survives first punch');assert(e.hp>30&&e.hp<40);assert(e.hurt,'Nonlethal hit starts reaction');assert.equal(e.action,null,'Hit interrupts attack');t.damage(e,25);assert(e.hp>0);t.damage(e,25);assert(e.hp<=0);assert.equal(e.hurt,null,'Lethal blow clears hurt animation');assert.equal(t.state.kills,1);
t.state.gems.push({x:t.state.p.x,y:t.state.p.y,v:20});t.update(.02);assert.equal(t.mode,'level');assert.equal(nodes.get('cards').children.length,4);while(t.mode==='level')t.pickUpgrade(0);assert.equal(t.mode,'play');
t.start();t.select('obelix');t.start();assert.equal(t.state.p.max,160);t.spawn('roman');t.state.attack=0;t.update(.02);assert.equal(t.state.shots.length,0,'No stone before release');for(let i=0;i<19;i++)t.update(.02);assert(t.state.shots.length>0,'Obelix releases menhir on impact frame');
t.state.p.hp=50;t.state.pickups.push({x:t.state.p.x,y:t.state.p.y});t.update(.02);assert.equal(t.state.p.hp,75);
t.state.enemies=[];t.spawn('roman');e=t.state.enemies[0];e.x=t.state.p.x;e.y=t.state.p.y;t.state.p.inv=0;t.state.attack=99;t.state.shots=[];t.state.p.action=null;t.update(.02);assert.equal(t.state.p.hp,75,'Legionary telegraphs attack');assert(e.action);for(let i=0;i<17;i++)t.update(.02);assert(t.state.p.hp<75,'Spear impact damage');const hp=t.state.p.hp;t.update(.02);assert.equal(t.state.p.hp,hp,'Invulnerability window');
// Surviving hit reactions recover, can retrigger, and do not grant invulnerability.
t.start();t.state.attack=99;t.spawn('roman');e=t.state.enemies[0];e.x=t.state.p.x+150;e.y=t.state.p.y;assert.equal(e.max,60);t.damage(e,52);assert.equal(e.hp,8,'Early legionary survives one base menhir');assert(e.hurt);const hurtX=e.x;t.update(.1);assert.equal(e.x,hurtX,'No walking during reaction');t.damage(e,1);assert.equal(e.hurt.elapsed,0,'Another hit restarts reaction');assert.equal(e.hp,7);for(let i=0;i<18;i++)t.update(.02);assert.equal(e.hurt,null);assert(e.moving,'Walking resumes after recovery');t.damage(e,0);assert.equal(e.hurt,null,'Zero damage has no reaction');
// A sidestep out of range must avoid a telegraphed thrust.
t.start();t.state.attack=99;t.spawn('roman');e=t.state.enemies[0];e.x=t.state.p.x+20;e.y=t.state.p.y;t.update(.02);assert(e.action);const beforeDodge=t.state.p.hp;t.state.p.y+=160;for(let i=0;i<18;i++)t.update(.02);assert.equal(t.state.p.hp,beforeDodge,'Escaping windup avoids damage');
// Walk phase advances only on displacement; paused game loop never advances it.
t.start();const idleWalk=t.state.p.walk||0;t.update(.02);assert.equal(t.state.p.walk,idleWalk);t.keys.add('KeyD');t.update(.05);assert(t.state.p.walk>idleWalk);t.keys.clear();const walk=t.state.p.walk;t.update(.02);assert.equal(t.state.p.walk,walk);assert.equal(t.state.p.moving,false);
t.start();for(let i=0;i<6002;i++){t.state.p.inv=1;t.state.stats.damage=0;t.update(.05);if(t.mode==='level')t.pickUpgrade(0);if(i%100===0)t.draw();}assert(t.state.bossSpawned,'Boss should spawn');assert.equal(t.mode,'play','Time alone must not win with living boss');const boss=t.state.enemies.find(e=>e.boss);assert(boss);t.damage(boss,1e6);t.update(.05);assert.equal(t.mode,'end');assert.equal(nodes.get('endTitle').textContent,'Пир начинается!');
t.start();t.state.p.hp=-1;t.update(.02);assert.equal(t.mode,'end');assert.equal(nodes.get('endTitle').textContent,'Нужен ещё глоток зелья');t.start();assert.equal(t.state.kills,0);assert.equal(t.state.level,1);t.menu();assert.equal(t.mode,'menu');
console.log('PASS: movement, pause, both attacks, XP, upgrade choice, healing, contact damage, invulnerability, full 5-minute simulation, boss victory, defeat and restart.');



// Village/legion integration regressions.
const V=env.Village,L=env.Legion;
const {getWaveSchedule,selectWaveUnit}=await loadModule(env,require('node:path').join(projectRoot,'src/systems/wave-schedule.js'));
for(let time=0;time<=300;time+=5)for(let r=0;r<1;r+=.01)assert(['roman','spear','pilum','veteran'].includes(selectWaveUnit(getWaveSchedule('village'),time,r)),'Only legion in regular waves');
let body={x:680,y:900};V.move(body,200,0,14);assert(body.x<800,'House blocks swept movement');assert(!V.blocked(body.x,body.y,14));
body={x:700,y:840};const goal={x:970,y:840};for(let i=0;i<900;i++){const d=V.direction(body,goal,14);V.move(body,d.x*3,d.y*3,14);}assert(Math.hypot(body.x-goal.x,body.y-goal.y)<20,'Navigation goes around a house');
function isolated(unit,x=1250,y=1100){t.select('asterix');t.start();t.state.spawn=999;t.state.attack=999;t.state.enemies=[];const e=t.spawn(unit);e.x=x;e.y=y;e.heading=Math.PI;t.state.p.x=1100;t.state.p.y=1100;return e;}
e=isolated('turtle');assert.equal(e.hp,480);t.damage(e,100);assert.equal(e.hp,445,'Front shields absorb 65%');t.state.p.x=1400;t.damage(e,100);assert.equal(e.hp,345,'Rear receives full damage');
e=isolated('spear',1195);t.update(.02);assert(e.action,'Long-range thrust begins');t.state.p.y+=55;const spearHP=t.state.p.hp;for(let i=0;i<30;i++)t.update(.02);assert.equal(t.state.p.hp,spearHP,'Sidestep avoids locked spear line');
e=isolated('pilum',1320);t.update(.02);for(let i=0;i<36;i++)t.update(.02);assert(t.state.enemyShots.length,'Pilum released after windup');for(let i=0;i<65;i++)t.update(.02);assert(t.state.p.hp<t.state.p.max,'Pilum hits hero');
e=isolated('pilum',950,900);t.state.enemyShots=[{x:990,y:695,vx:235,vy:0,damage:13,life:2}];t.update(.2);assert.equal(t.state.enemyShots.length,0,'House intercepts pilum');
e=isolated('ram',960,1170);e.cd=99;e.charge={x:-1,y:0,left:2};e.heading=Math.PI;for(let i=0;i<60;i++)t.update(.02);assert.equal(e.charge,null,'Ram stops at house');assert(e.x>=820,'Ram stays outside expanded house footprint');assert(!V.blocked(e.x,e.y,e.r));
t.start();t.state.stats.damage=0;t.state.p.inv=999;t.state.t=100;t.state.spawn=999;t.update(.02);assert(t.state.enemies.some(e=>e.unit==='turtle'));t.state.t=155;t.update(.02);assert(t.state.enemies.some(e=>e.unit==='ram'));assert(t.state.enemies.every(e=>L.units[e.unit]));t.draw();
console.log('PASS: legion-only waves, house collision/navigation, turtle front/rear armor, spear dodge, pilum release/hit/cover, ram collision and siege schedule.');

// Corpses are decoration, never live enemies or additional rewards.
t.start();t.state.spawn=999;t.state.attack=999;e=t.spawn('roman');e.x=1250;e.y=1100;t.damage(e,1000);assert.equal(t.state.corpses.length,1);const deadBody=t.state.corpses[0];t.damage(e,1000);assert.equal(t.state.corpses.length,1);assert.equal(t.state.kills,1);t.update(.05);assert.equal(t.state.enemies.length,0);assert.equal(t.state.corpses.length,1);t.draw();for(let i=0;i<119;i++)t.update(.05);assert.equal(env.Corpses.opacity(deadBody),1);for(let i=0;i<20;i++)t.update(.05);assert(env.Corpses.opacity(deadBody)<.6&&env.Corpses.opacity(deadBody)>.4);for(let i=0;i<22;i++)t.update(.05);assert.equal(t.state.corpses.length,0);
t.start();e=t.spawn('turtle');t.damage(e,10000);assert.equal(t.state.corpses.length,6);e=t.spawn('ram');t.damage(e,10000);assert.equal(t.state.corpses.length,10);assert.equal(t.state.kills,2);for(let i=0;i<200;i++){e=t.spawn('roman');t.damage(e,10000);}assert.equal(t.state.corpses.length,env.Corpses.limit);t.start();assert.equal(t.state.corpses.length,0);
console.log('PASS: noninteractive corpses, no duplicate rewards, six seconds visible / two seconds fade, siege crews, bounded count and reset.');

// Fatal impulse chooses corpse direction; facing and stale velocity do not.
for(const [sx,sy,nx,ny]of [[-100,0,1,0],[100,0,-1,0],[0,-100,0,1],[0,100,0,-1],[-100,-100,Math.SQRT1_2,Math.SQRT1_2]]){t.start();e=t.spawn('roman');e.x=1100;e.y=1100;e.heading=Math.PI;e.vx=999;e.vy=-999;t.damage(e,999,0,0,{x:e.x+sx,y:e.y+sy});const body=t.state.corpses[0];assert(Math.abs(body.fallX-nx)<1e-9);assert(Math.abs(body.fallY-ny)<1e-9);const hx=Math.sin(body.angle),hy=-Math.cos(body.angle)*.58,hlen=Math.hypot(hx,hy);assert(Math.abs(hx/hlen-nx)<1e-9);assert(Math.abs(hy/hlen-ny)<1e-9);}
t.start();e=t.spawn('roman');t.damage(e,999,-200,0,{x:e.x-10,y:e.y});assert.equal(t.state.corpses[0].fallX,-1,'Projectile impulse takes precedence over player position');
console.log('PASS: fatal hit direction from all sides and diagonal, correct visual rotation, last-hit impulse precedence.');

// Directional attacks follow movement input, persist at rest, and turn during windup.
const directions=[
 ['KeyD',null,1,0],['KeyA',null,-1,0],['KeyW',null,0,-1],['KeyS',null,0,1],
 ['KeyD','KeyW',Math.SQRT1_2,-Math.SQRT1_2],['KeyD','KeyS',Math.SQRT1_2,Math.SQRT1_2],
 ['KeyA','KeyW',-Math.SQRT1_2,-Math.SQRT1_2],['KeyA','KeyS',-Math.SQRT1_2,Math.SQRT1_2]
];
function prepare(hero){t.select(hero);t.start();t.state.spawn=999;t.state.attack=999;t.state.p.inv=999;}
function dummy(x,y){const e=t.spawn('roman');e.x=x;e.y=y;e.speed=0;e.cd=999;return e;}
for(const [k1,k2,dx,dy] of directions){
 prepare('asterix');t.keys.add(k1);if(k2)t.keys.add(k2);t.update(.02);t.keys.clear();
 assert(Math.abs(t.state.p.facing.x-dx)<1e-9&&Math.abs(t.state.p.facing.y-dy)<1e-9,'All eight input directions');
 t.update(.1);const p=t.state.p;
 const front=dummy(p.x+dx*45,p.y+dy*45),rear=dummy(p.x-dx*30,p.y-dy*30),side=dummy(p.x-dy*60,p.y+dx*60);
 t.state.attack=0;t.update(.01);assert(t.state.p.action.direction);for(let i=0;i<6;i++)t.update(.04);
 assert.equal(front.hp,35,'Front enemy hit');assert.equal(rear.hp,60,'Closer enemy behind cannot redirect punch');assert.equal(side.hp,60,'Side enemy outside sector spared');
 prepare('obelix');t.keys.add(k1);if(k2)t.keys.add(k2);t.update(.02);t.keys.clear();t.update(.1);
 dummy(t.state.p.x-dx*100,t.state.p.y-dy*100);t.state.attack=0;t.update(.01);for(let i=0;i<10;i++)t.update(.04);
 const shot=t.state.shots[0];assert(shot,'Throws without a target ahead');assert(Math.abs(shot.vx-320*dx)<1e-6&&Math.abs(shot.vy-320*dy)<1e-6,'Menhir follows last movement');
}
prepare('asterix');let punchRight=dummy(t.state.p.x+45,t.state.p.y),punchLeft=dummy(t.state.p.x-45,t.state.p.y);
t.state.attack=0;t.update(.01);assert.equal(t.state.p.action.direction.x,1,'Punch starts toward the current facing');
t.keys.add('KeyA');t.update(.03);assert.equal(t.state.p.action.direction.x,-1,'Punch turns toward movement during windup');
assert.equal(t.state.p.action.flip,true,'Attack animation turns during windup');for(let i=0;i<5;i++)t.update(.04);
assert.equal(punchLeft.hp,35,'Punch hits in the latest facing at impact');assert.equal(punchRight.hp,60,'Punch does not hit in its original direction');
prepare('obelix');t.state.attack=0;t.update(.01);t.keys.add('KeyA');t.update(.03);t.keys.clear();
assert.equal(t.state.p.facing.x,-1);assert.equal(t.state.p.action.direction.x,-1,'Active throw turns toward movement during windup');
assert.equal(t.state.p.action.flip,true,'Throw animation turns during windup');
for(let i=0;i<9;i++)t.update(.04);assert(t.state.shots[0].vx<0,'Menhir follows the facing at release');
t.state.shots=[];t.state.stats.stones=3;t.state.menhir=0;t.update(.01);assert.equal(t.state.shots.length,3);assert(t.state.shots.every(b=>b.vx<0),'Bonus menhir fan follows current facing');
t.start();assert.equal(t.state.p.facing.x,1);assert.equal(t.state.p.facing.y,0);
console.log('PASS: eight-direction punches and throws, no rear/side damage, remembered facing, turning windup, bonus menhir fan, reset.');

// New villagers: actual combat integration and permanent purchases.
env.Progression.earn(1000);
for(const id of ['cacofonix','antisanitarix','automatix','panoramix'])assert(env.Progression.buyHero(id));
nodes.get('start').onclick();assert.equal(nodes.get('runHeroes').children.length,6,'Newly unlocked heroes appear in the run selector');const druid=nodes.get('runHeroes').children.find(card=>card.dataset.hero==='panoramix');druid.onclick();nodes.get('runHeroStart').onclick();assert.equal(nodes.get('heroLabel').textContent,'ПАНОРАМИКС');assert.equal(t.state.p.speed,130,'Confirming selection starts the chosen hero');t.menu();
prepare('cacofonix');let near=dummy(1140,1100),far=dummy(1280,1100);t.update(.01);assert.equal(near.hp,48);assert.equal(far.hp,60);assert.equal(t.state.p.action,undefined);
prepare('automatix');assert.equal(t.state.p.speed,105);near=dummy(1130,1140);let behind=dummy(1060,1100);t.state.attack=0;t.update(.01);for(let i=0;i<8;i++)t.update(.04);assert.equal(near.hp,10);assert.equal(behind.hp,60);
prepare('antisanitarix');near=dummy(1200,1100);t.state.attack=0;t.update(.01);for(let i=0;i<7;i++)t.update(.04);assert(t.state.fish.length);t.state.attack=999;const fish=t.state.fish[0];assert(fish.vx>0,'Thrown fish starts facing its outbound direction');while(!fish.back&&fish.age<.8)t.update(.02);assert(fish.back&&fish.vx<0,'Returning fish faces its actual return direction');for(let i=0;i<70;i++)t.update(.02);assert.equal(near.hp,12,'Fish hits once outbound and once on return');assert.equal(t.state.fish.length,0,'Fish returns to its owner');
prepare('panoramix');t.update(.05);assert.equal(t.state.poison.length,0,'Idle druid leaves no puddles');t.keys.add('KeyD');for(let i=0;i<8;i++)t.update(.05);t.keys.clear();assert(t.state.poison.length>=2);const puddle=t.state.poison[0];near=dummy(puddle.x,puddle.y);t.state.poisonTick=0;t.update(.01);assert.equal(near.hp,52,'Overlapping poison does not multiply tick damage');for(let i=0;i<80;i++)t.update(.05);assert.equal(t.state.poison.length,0);
prepare('asterix');const wallet=env.Progression.data.helmets;t.state.helmets.push({x:1100,y:1100,value:3});t.update(.01);assert.equal(env.Progression.data.helmets,wallet+3);assert.equal(t.state.earned,3);t.update(.01);assert.equal(env.Progression.data.helmets,wallet+3,'Pickup counted once');
assert(env.Progression.buyUpgrade('health'));assert(env.Progression.buyUpgrade('power'));assert(env.Progression.buyUpgrade('speed'));
prepare('asterix');assert.equal(t.state.p.max,120);assert.equal(t.state.stats.damage,1.05);assert.equal(t.state.stats.speed,1.03);
console.log('PASS: all four unlocked heroes, musical aura, 180-degree hammer, returning fish with two hits, moving poison trail/expiry, helmet pickup once, permanent bonuses.');

prepare('asterix');const beforeKills=env.Progression.data.kills,bank=env.Progression.data.helmets,oldRandom=env.Math.random;
let victim=dummy(1200,1100);
try{env.Math.random=()=>.01;t.damage(victim,999);assert.equal(t.state.helmets.length,1,'Rare roll drops a helmet pile');assert.equal(t.state.helmets[0].value,3);t.damage(victim,999);assert.equal(t.state.helmets.length,1,'Dead soldier cannot drop twice');}
finally{env.Math.random=oldRandom;}
assert.equal(env.Progression.data.kills,beforeKills+1);assert.equal(env.Progression.data.helmets,bank+((beforeKills+1)%10===0?1:0),'Uncollected helmets are not credited');
victim=dummy(1250,1100);try{env.Math.random=()=>.9;t.damage(victim,999);assert.equal(t.state.helmets.length,1,'Ordinary roll drops no helmets');}finally{env.Math.random=oldRandom;}
const credited=env.Progression.data.helmets;t.state.p.hp=-1;t.update(.01);t.menu();t.start();assert.equal(env.Progression.data.helmets,credited,'Defeat and restart preserve bank');assert.equal(t.state.helmets.length,0,'Uncollected field loot resets');
console.log('PASS: rare drop and no-drop rolls, no duplicate loot, kill accounting, uncollected loot, bank survives defeat/restart.');

context.getImageData=()=>{throw new Error('SecurityError: canvas readback blocked');};
t.menu();nodes.get('shopOpen').onclick();assert.equal(nodes.get('shopHeroes').children.length,6);assert.equal(nodes.get('shopUpgrades').children.filter(c=>c.onclick).length,14);nodes.get('shopClose').onclick();nodes.get('shopOpen').onclick();assert.equal(nodes.get('shopHeroes').children.length,6);
console.log('PASS: shop opens and reopens with all heroes/upgrades when canvas pixel readback is blocked.');

assert(nodes.get('menu').classList.contains('hidden'),'Shop replaces the main screen');
for(const card of nodes.get('shopHeroes').children){const b=card.children[card.children.length-1];assert.equal(b.textContent,'Доступен для забега');assert.equal(b.disabled,true,'Owned heroes are not selected from the shop');}
listeners.keydown({code:'Escape',repeat:false,preventDefault:noop});assert(nodes.get('shop').classList.contains('hidden'));assert.equal(nodes.get('menu').classList.contains('hidden'),false);
console.log('PASS: dedicated shop, owned hero labels and Escape returns to main menu.');

nodes.get('achievementsOpen').onclick();
assert(nodes.get('menu').classList.contains('hidden'), 'Achievements overlay replaces the main menu');
assert(!nodes.get('achievements').classList.contains('hidden'), 'Achievements panel is visible');
assert(nodes.get('achievementsList').children.length > 0, 'Achievements cards rendered');
assert(nodes.get('achievementsSummary').children.length > 0, 'Achievements summary rendered');
nodes.get('achievementsClose').onclick();
assert(nodes.get('achievements').classList.contains('hidden'), 'Achievements closed');
assert(!nodes.get('menu').classList.contains('hidden'), 'Returned to main menu');
nodes.get('achievementsOpen').onclick();
listeners.keydown({code:'Escape',repeat:false,preventDefault:noop});
assert(nodes.get('achievements').classList.contains('hidden'), 'Escape closes achievements');
assert(!nodes.get('menu').classList.contains('hidden'), 'Escape returns to main menu');
console.log('PASS: achievements tab opens, renders cards, closes via button and Escape key.');

nodes.get('settingsOpen').onclick();
assert(nodes.get('menu').classList.contains('hidden'), 'Settings overlay replaces main menu');
assert(!nodes.get('settings').classList.contains('hidden'), 'Settings panel is visible');
assert.equal(nodes.get('settingShake').textContent, 'ВКЛ');
nodes.get('settingShake').onclick();
assert.equal(nodes.get('settingShake').textContent, 'ВЫКЛ');
nodes.get('settingShake').onclick();
assert.equal(nodes.get('settingShake').textContent, 'ВКЛ');
assert.equal(nodes.get('settingHints').textContent, 'ВКЛ');
nodes.get('settingHints').onclick();
assert.equal(nodes.get('settingHints').textContent, 'ВЫКЛ');
assert(nodes.get('hint').classList.contains('hidden'), 'Hints are hidden when disabled');
assert(nodes.get('menuHint').classList.contains('hidden'), 'Menu hints are hidden when disabled');
nodes.get('settingHints').onclick();
assert.equal(nodes.get('settingHints').textContent, 'ВКЛ');
assert(!nodes.get('menuHint').classList.contains('hidden'), 'Menu hints are shown when enabled');
nodes.get('settingsClose').onclick();
assert(nodes.get('settings').classList.contains('hidden'), 'Settings closed via close button');
assert(!nodes.get('menu').classList.contains('hidden'), 'Returned to main menu');

nodes.get('settingsOpen').onclick();
listeners.keydown({code:'Escape',repeat:false,preventDefault:noop});
assert(nodes.get('settings').classList.contains('hidden'), 'Escape closes settings');
assert(!nodes.get('menu').classList.contains('hidden'), 'Escape returns to main menu from settings');

t.start();
assert(!nodes.get('hint').classList.contains('hidden'), 'Hints are visible during game when enabled');
t.pause();
assert(!nodes.get('paused').classList.contains('hidden'), 'Game is paused');
nodes.get('pauseSettings').onclick();
assert(nodes.get('paused').classList.contains('hidden'), 'Settings opens from pause menu');
assert(!nodes.get('settings').classList.contains('hidden'), 'Settings panel is visible during pause');
nodes.get('settingHints').onclick();
assert(nodes.get('hint').classList.contains('hidden'), 'Hints are hidden immediately when disabled in settings during pause');
nodes.get('settingsBack').onclick();
assert(nodes.get('settings').classList.contains('hidden'), 'Settings closed from pause');
assert(!nodes.get('paused').classList.contains('hidden'), 'Returned to pause menu');
t.pause();
assert(nodes.get('hint').classList.contains('hidden'), 'Hints remain hidden after unpausing');
t.pause();
nodes.get('pauseSettings').onclick();
nodes.get('settingHints').onclick();
assert(!nodes.get('hint').classList.contains('hidden'), 'Hints are shown immediately when re-enabled');
nodes.get('settingsBack').onclick();
t.pause();
assert(!nodes.get('hint').classList.contains('hidden'), 'Hints visible during active play');
t.menu();
console.log('PASS: settings panel opens from main menu and pause menu, toggles options, hides hints properly, and restores origin on close and Escape.');

// Weapon-specific bonuses are exercised through the live combat loop.
function boost(hero,id){t.upgrades.apply(t.upgrades.heroes[hero].find(u=>u.id===id),t.state);}
prepare('obelix');boost('obelix','stoneCount');boost('obelix','stoneDamage');boost('obelix','stoneSize');t.state.attack=0;for(let i=0;i<12;i++)t.update(.04);assert.equal(t.state.shots.length,2);assert(t.state.shots.every(b=>b.damage>52&&b.r>11));
prepare('asterix');boost('asterix','punchReach');near=dummy(1188,1100);t.state.attack=0;for(let i=0;i<8;i++)t.update(.04);assert(near.hp<60,'Extended punch reaches farther');
prepare('automatix');boost('automatix','hammerDamage');near=dummy(1140,1100);t.state.attack=0;for(let i=0;i<10;i++)t.update(.04);assert(near.hp<=0,'Upgraded hammer kills 60 HP target');
prepare('cacofonix');boost('cacofonix','musicRange');boost('cacofonix','musicDamage');boost('cacofonix','musicPush');near=dummy(1215,1100);t.update(.01);assert(near.hp<48);assert(near.vx>0,'Music pushes away');
prepare('antisanitarix');boost('antisanitarix','fishCount');boost('antisanitarix','fishSpeed');env.Villagers.fish(t.state,{x:1,y:0});t.update(.01);assert.equal(t.state.fish.length,2);assert(t.state.fish.every(f=>Math.hypot(f.vx,f.vy)>310));
prepare('panoramix');boost('panoramix','poisonRange');boost('panoramix','poisonDuration');boost('panoramix','poisonDamage');t.keys.add('KeyD');t.update(.01);t.keys.clear();assert(t.state.poison[0].r>30&&t.state.poison[0].life>3.5);near=dummy(t.state.p.x,t.state.p.y);t.state.poisonTick=0;t.update(.01);assert(near.hp<52);
console.log('PASS: weapon upgrades affect actual stone volleys, melee reach/damage, music push, fish speed/count and poison area/duration/damage.');


}
main().catch(error=>{console.error(error);process.exitCode=1;});
