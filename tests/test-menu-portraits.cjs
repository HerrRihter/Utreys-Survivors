const {loadModule,resourcePath}=require('./helpers/load-modules.cjs');
async function main(){
const projectRoot = require('node:path').resolve(__dirname, '..');
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const code=fs.readFileSync(projectRoot+'/src/ui/menu-portraits.js','utf8'),frames=[],draws=[];
const env={AnimationArt:{status:{heroes:'ready'}},HeroArt:{status:'ready'},sprite(g,name,x,y,size,flip,bob,flash,phase,actor){g.pose=actor;},
document:{createElement(){const context={pose:null,getImageData(){throw new Error('SecurityError: canvas readback blocked');}};const c={getContext:()=>context};frames.push(c);return c;}}};
vm.createContext(env);await loadModule(env,projectRoot+'/src/ui/menu-portraits.js',{fresh:false});
let status='ready';
const portraits=env.MenuPortraits.create({document:env.document,sprite:env.sprite,artStatus:()=>status});
const canvas={width:64,height:80,getContext:()=>({clearRect(){},drawImage(...args){draws.push(args);}})};
for(let i=0;i<8;i++)portraits.fit(canvas,'obelix',i);
assert.equal(frames.length,8,'Frames cached once');assert.equal(new Set(draws.map(d=>d[0])).size,8,'All poses animate');
for(const d of draws){assert.deepEqual(d.slice(1),draws[0].slice(1),'Shared crop and scale prevent jitter');assert(d[5]>=6&&d[6]>=6);assert(d[5]+d[7]<=58.001&&d[6]+d[8]<=74.001,'Full silhouette fits with margins');}
console.log('PASS: eight animated menu poses, one common silhouette bound, stable scale, safe margins, cache reuse.');
portraits.fit(canvas,'obelix');assert.equal(frames.length,8,'Repeated calls reuse cached poses');
status='fallback';portraits.fit(canvas,'obelix');assert.equal(frames.length,16,'Changed art status invalidates cached poses');
portraits.clear();portraits.fit(canvas,'obelix');assert.equal(frames.length,24,'Explicit invalidation rebuilds all poses');

}
main().catch(error=>{console.error(error);process.exitCode=1;});
