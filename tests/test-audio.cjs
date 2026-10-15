const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadModule, resourcePath} = require('./helpers/load-modules.cjs');
async function main() {
  const handlers = {}, nodes = {}, created = [], storage = {};
  let now = 0;
  class Audio {
    constructor(src) {this.src=src; this.paused=true; this.ended=false; this.currentTime=0; created.push(this);}
    play() {this.paused=false; return Promise.resolve();}
    pause() {this.paused=true;}
  }
  const c = {window:{Audio}, document:{hidden:false,addEventListener(name,fn){handlers[name]=fn;}},
    localStorage:{getItem:key=>storage[key]??null,setItem:(key,value)=>storage[key]=value},
    performance:{now:()=>now}, Math, mode:'menu', $:id=>nodes[id]??=( {setAttribute(){}} )};
  const {AudioSystem} = await loadModule({},path.resolve('src/core/audio.js'));
  const audio = AudioSystem.create(c);
  audio.sync(); assert.equal(created.length,0,'No media before a gesture');
  handlers.pointerdown(); const menu=created[0]; assert(menu.src.endsWith('tavern.mp3')); assert(!menu.paused);assert(menu.loop);
  c.mode='play';audio.sync();const battle=created[1];assert(menu.paused);assert(!battle.paused);
  audio.effect('hit');assert.equal(created.length,3);audio.effect('hit');assert.equal(created.length,3,'Rate limit repeated impacts');
  for(let i=0;i<20;i++){now+=100;audio.effect('hit');}assert(created.length<=8,'Bound effect voices');
  audio.effect('punchSwing');assert(created.some(item=>item.src.endsWith('punch.mp3')&&!item.paused));
  assert(created.filter(item=>/hit-[12]\./.test(item.src)).every(item=>item.src.endsWith('.mp3')),'Impacts use the replacement MP3 files');
  const originalMath=c.Math;c.Math=Object.create(Math);
  for(const variant of [0,.4,.8]){c.Math.random=()=>variant;now+=200;audio.effect('death');}
  assert.equal(created.filter(item=>/death-[123]\.ogg$/.test(item.src)).length,3);
  const voices=created.length;for(let i=0;i<100;i++)audio.effect('death');assert.equal(created.length,voices,'Mass kills share a voice cooldown');
  c.Math=originalMath;
  c.mode='pause';audio.sync();assert(created.every(item=>item.paused));
  battle.currentTime=17;c.mode='play';audio.sync();assert.equal(battle.currentTime,17);assert(!battle.paused);
  c.document.hidden=true;handlers.visibilitychange();assert(created.every(item=>item.paused));
  c.document.hidden=false;handlers.visibilitychange();assert(!battle.paused);
  nodes.sound.onclick();assert(created.every(item=>item.paused));assert.equal(JSON.parse(storage['gaul-audio']).enabled,false);
  nodes.sound.onclick();assert(!battle.paused);
  nodes.musicVolume.value=0;nodes.musicVolume.oninput();assert(battle.paused);now+=100;audio.effect('pickup');assert(created.some(item=>item.src.endsWith('pickup.ogg')&&!item.paused));
  nodes.musicVolume.value=45;nodes.musicVolume.oninput();assert.equal(battle.volume,.45);
  c.mode='level';audio.sync();assert.equal(battle.volume,.45*.45);
  audio.finish(true);c.mode='end';audio.sync();const victory=created.find(item=>item.src.endsWith('victory.mp3'));assert(victory&&!victory.loop&&!victory.paused);assert(battle.paused);
  audio.stop();assert(created.every(item=>item.paused));audio.resume();assert(!victory.paused);
  victory.ended=true;victory.paused=true;audio.sync();assert(victory.paused,'A result jingle does not restart');
  for(const item of created){assert.equal(item.preservesPitch,false,'Avoid time stretching short effects');const buffer=fs.readFileSync(resourcePath(item.src));assert(buffer.length>1000);assert(!buffer.subarray(0,100).toString().includes('<html'),'Downloaded file is audio');}
  const reloaded=AudioSystem.create(c);assert.equal(nodes.musicVolume.value,45);reloaded.stop();
  console.log('PASS: gesture unlock, local audio files, scene switching, pause/resume, visibility, mute, persistent mixing, cooldowns, bounded voices and one-shot endings.');
  const {createHarness}=require('./helpers/game-harness.cjs');
  const h=await createHarness();h.session.start();const sounds=[];
  const combatContext={Math,selected:'asterix',state:h.session.state,soundEffect:name=>sounds.push(name),
    Legion:h.env.Legion,Corpses:{add(){}},Progression:{kill:()=>0},rand:()=>0,
    Village:{clear:()=>true},Villagers:h.env.Villagers};
  const combat=h.env.CombatSystem.create(combatContext),p=combatContext.state.p;
  combat.beginAction(p,.4,{x:p.x+10,y:p.y});assert.deepEqual(sounds,['punchSwing']);
  combat.heroImpact({direction:{x:1,y:0}});assert.deepEqual(sounds,['punchSwing'],'Asterix does not play a blade at impact');
  sounds.length=0;combatContext.selected='automatix';combat.beginAction(p,.4,{x:p.x+10,y:p.y});assert.equal(sounds.length,0);
  combat.heroImpact({direction:{x:1,y:0}});assert.deepEqual(sounds,['throw'],'Other melee audio is preserved');
  sounds.length=0;
  const enemy={unit:'roman',type:'roman',hp:20,x:p.x+20,y:p.y,r:12,vx:0,vy:0,cd:0};
  combat.damage(enemy,1);assert.deepEqual(sounds,['hit'],'Nonfatal hits do not cry out');
  combat.damage(enemy,100);assert.deepEqual(sounds,['hit','hit','death']);
  combat.damage(enemy,100);assert.equal(sounds.filter(name=>name==='death').length,1,'A corpse cannot cry twice');
  console.log('PASS: fist swing at windup, no Asterix blade sound, fatal-only enemy voice and mass-kill cooldown.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
