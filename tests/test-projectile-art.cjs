const {loadModule,resourcePath}=require('./helpers/load-modules.cjs');
async function main(){
const projectRoot = require('node:path').resolve(__dirname, '..');
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const env={};env.AssetPaths={url:relative=>'assets/runtime/'+relative};vm.createContext(env);await loadModule(env,projectRoot+'/src/rendering/art/projectile-art.js',{fresh:false});
for(const file of ['src/entities/heroes.js','src/entities/legion.js'])await loadModule(env,projectRoot+'/'+file,{fresh:false});
function canvas(){
 const calls=[],g={calls,save(){calls.push(['save']);},restore(){calls.push(['restore']);},translate(...a){calls.push(['translate',...a]);},rotate(...a){calls.push(['rotate',...a]);},scale(...a){calls.push(['scale',...a]);},beginPath(){calls.push(['beginPath']);},moveTo(...a){calls.push(['moveTo',...a]);},lineTo(...a){calls.push(['lineTo',...a]);},quadraticCurveTo(...a){calls.push(['quadraticCurveTo',...a]);},closePath(){calls.push(['closePath']);},fill(){calls.push(['fill',this.fillStyle]);},stroke(){calls.push(['stroke',this.strokeStyle]);},arc(...a){calls.push(['arc',...a]);},ellipse(...a){calls.push(['ellipse',...a]);}};
 return g;
}
const f=canvas();env.ProjectileArt.drawFish(f,{x:120,y:90,age:0,dx:1,dy:0});
assert(f.calls.some(c=>c[0]==='translate'&&c[1]===120&&c[2]===42),'Fish flies at the release hand height');
assert(Math.abs(f.calls.find(c=>c[0]==='rotate')[1])<1e-9,'Fish points toward its outbound velocity');
assert(f.calls.some(c=>c[0]==='arc'&&c[3]===3.5),'Fish keeps the visible yellow eye from its handheld design');
assert(f.calls.some(c=>c[0]==='fill'&&c[1]==='#748568'),'Fish uses the mottled green of the handheld art');
assert.equal(f.calls.filter(c=>c[0]==='save').length,f.calls.filter(c=>c[0]==='restore').length,'Fish balances canvas state');
const returning=canvas();env.ProjectileArt.drawFish(returning,{x:40,y:60,age:0,vx:-310,vy:0,dx:1,dy:0});
assert.equal(returning.calls.find(c=>c[0]==='translate')[2],12,'Returning fish keeps the same hand height');
assert(Math.abs(returning.calls.find(c=>c[0]==='rotate')[1]-Math.PI)<1e-9,'Returning fish turns around to follow its return trajectory');
const diagonal=canvas();env.ProjectileArt.drawFish(diagonal,{x:0,y:0,age:0,vx:0,vy:310});
assert(Math.abs(diagonal.calls.find(c=>c[0]==='rotate')[1]-Math.PI/2)<1e-9,'Fish follows diagonal and vertical flight direction');
const p=canvas();env.ProjectileArt.drawPilum(p,{x:75,y:50,vx:0,vy:-235});
assert(p.calls.some(c=>c[0]==='translate'&&c[1]===75&&c[2]===34),'Pilum draws at its flight position');
assert(Math.abs(p.calls.find(c=>c[0]==='rotate')[1]+Math.PI/2)<1e-9,'Pilum head points toward its velocity');
assert(p.calls.some(c=>c[0]==='stroke'&&c[1]==='#80552f'),'Pilum has a wooden shaft matching the held weapon');
assert(p.calls.some(c=>c[0]==='fill'&&c[1]==='#aeb9c0'),'Pilum has a forged steel head matching the held weapon');
assert.equal(p.calls.filter(c=>c[0]==='save').length,p.calls.filter(c=>c[0]==='restore').length,'Pilum balances canvas state');
const fishIntegration=canvas();env.Villagers.projectiles(fishIntegration,{fish:[{x:0,y:0,age:0,dx:1,dy:0}]});
assert(fishIntegration.calls.some(c=>c[0]==='arc'&&c[3]===3.5),'Villager projectile rendering uses the detailed fish');
const pilumIntegration=canvas();env.Legion.projectile(pilumIntegration,{x:0,y:0,vx:1,vy:0});
assert(pilumIntegration.calls.some(c=>c[0]==='fill'&&c[1]==='#aeb9c0'),'Legion projectile rendering uses the detailed pilum');
console.log('PASS: detailed fish and pilum projectiles match their held weapons, follow their flight paths and restore canvas state.');

const loaded=[];const raster={Image:class{set src(v){this.path=v;loaded.push(this);}}};raster.AssetPaths={url:relative=>'assets/runtime/'+relative};vm.createContext(raster);await loadModule(raster,projectRoot+'/src/rendering/art/projectile-art.js',{fresh:false});loaded[0].onload();
for(const [kind,shot] of [['drawFish',{x:10,y:30,age:0,vx:-1,vy:0}],['drawPilum',{x:10,y:30,vx:0,vy:-1}]]){const g=canvas();g.drawImage=(...args)=>g.calls.push(['image',...args]);raster.ProjectileArt[kind](g,shot);assert.equal(g.calls.find(c=>c[0]==='translate')[2],kind==='drawFish'?-18:14,'Loaded art uses the same release height as fallback');assert.equal(g.calls.filter(c=>c[0]==='image').length,1);assert.equal(g.calls.filter(c=>c[0]==='fill').length,0);assert(fs.existsSync(resourcePath(loaded[0].path)));}
console.log('PASS: loaded raster projectiles replace fallback drawings in both flight directions.');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
