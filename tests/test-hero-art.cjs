const {loadModule}=require('./helpers/load-modules.cjs');
const assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
(async()=>{
  const images=[],draws=[];
  const env={URL,Event:class{},console:{warn(){}},document:{dispatchEvent(){},createElement(){return{getContext(){return{drawImage(...args){draws.push(args);}};}};}},
    Image:class{naturalWidth=887;naturalHeight=887;set src(url){this.url=url;images.push(this);}}};
  vm.createContext(env);
  await loadModule(env,path.resolve(__dirname,'../src/rendering/art/hero-art.js'));
  assert.equal(images.length,2);
  assert(images[0].url.endsWith('/asterix/portrait.png'));
  assert(images[1].url.endsWith('/obelix/portrait.png'));
  images[0].onload();
  assert(env.HeroArt.get('asterix'));assert.equal(env.HeroArt.get('obelix'),null);
  images[1].onerror();
  assert.equal(env.HeroArt.statuses.asterix,'ready');assert.equal(env.HeroArt.statuses.obelix,'fallback');
  assert(env.HeroArt.get('asterix'),'One missing portrait does not disable the other hero');
  assert.deepEqual(draws[0].slice(1,5),[0,0,887,887],'Portrait uses its whole independent image');
  images[1].onload();assert.equal(env.HeroArt.status,'ready');
  assert.equal(draws[0][7],112);assert.equal(draws[1][7],128,'Original relative hero sizes remain');
  console.log('PASS: independent hero portrait paths, loading, fallback and original relative sizes.');
})().catch(error=>{console.error(error);process.exitCode=1;});
