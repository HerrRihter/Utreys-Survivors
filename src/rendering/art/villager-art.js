import {CharacterFrames} from '../character-frames.js';
import {VillagerLayout} from '../../../data/animations/villager-layout.js';
import {AssetPaths} from '../asset-paths.js';
const names=Object.keys(CharacterFrames.manifest.characters).filter(id=>CharacterFrames.manifest.characters[id].renderer==='villager');
function get(name,action='idle',progress=0){return names.includes(name)?CharacterFrames.get(name,action,progress):null;}
 function draw(g,name,x,y,actor,flip=false){
  const a=actor||{},reaction=a.hurt,attack=a.action||a.visualAction;
  const action=reaction?'hurt':attack?'attack':a.moving?'walk':'idle';
  const progress=reaction?reaction.elapsed/reaction.duration:attack?attack.elapsed/attack.duration:a.walk||0;
  const frame=get(name,action,progress);if(!frame)return false;
  g.save();g.translate(Math.round(x),Math.round(y));if(reaction?reaction.flip:attack?attack.flip:flip)g.scale(-1,1);g.drawImage(frame,-CharacterFrames.manifest.anchor[0],-CharacterFrames.manifest.anchor[1]);g.restore();return true;
 }

export const VillagerArt={status:CharacterFrames.register(names,'villager-art-ready'),get,draw};
export let HelmetArt;
HelmetArt=(()=>{
 let art=null;const api={status:'loading',draw(g,x,y,scale=1){if(!art)return false;g.save();g.fillStyle='#17271c66';g.beginPath();g.ellipse(x,y+7*scale,12*scale,4*scale,0,0,Math.PI*2);g.fill();g.drawImage(art,x-15*scale,y-20*scale,30*scale,30*scale);g.restore();return true;}};
 if(typeof Image!=='undefined'){const image=new Image();image.onload=()=>{art=document.createElement('canvas');art.width=art.height=64;const g=art.getContext('2d'),[x,y,w,h]=VillagerLayout.helmet;const scale=58/Math.max(w,h);g.drawImage(image,x,y,w,h,(64-w*scale)/2,(64-h*scale)/2,w*scale,h*scale);api.status='ready';};image.onerror=()=>api.status='fallback';image.src=AssetPaths.url('ui/roman-helmet-v1.png');}
 return api;
})();
