import {AssetPaths} from '../asset-paths.js';
export let HeroArt;
/* Both heroes share one scale and floor baseline: Obelix remains larger. */
(() => {
  const sprites={};
  const status={asterix:'loading',obelix:'loading'};
  HeroArt={get status(){return Object.values(status).every(s=>s==='ready')?'ready':Object.values(status).some(s=>s==='loading')?'loading':'fallback';},statuses:status,get(name){return sprites[name]||null;}};
  if(typeof Image==='undefined')return;
  for(const name of ['asterix','obelix']){
  const atlas=new Image();
  atlas.onload=()=>{
      const c=document.createElement('canvas');c.width=128;c.height=128;
      const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
      const size=name==='asterix'?112:128;
      g.drawImage(atlas,0,0,atlas.naturalWidth,atlas.naturalHeight,(128-size)/2,(128-size)*.95,size,size);
      sprites[name]=c;
    status[name]='ready';document.dispatchEvent(new Event('hero-art-ready'));
  };
  atlas.onerror=()=>{status[name]='fallback';console.warn('Hero portrait unavailable: '+name);document.dispatchEvent(new Event('hero-art-ready'));};
  atlas.src=AssetPaths.url('characters/heroes/'+name+'/portrait.png');
  }
})();
