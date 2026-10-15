import {CharacterFrames} from '../character-frames.js';
import {RomanArt as LegacyRomanArt} from './roman-art-legacy.js';
const ids=['roman-0','roman-1','roman-2','boss'];
const status=CharacterFrames.register(ids,'roman-art-ready'),portraits=new Map();
export const RomanArt={width:96,height:128,
 get status(){return Object.values(status).every(s=>s==='ready')?'ready':Object.values(status).some(s=>s==='loading')?'loading':'fallback';},
 get(variant=0,frame=0,boss=false){
  const id=boss?'boss':'roman-'+((Math.floor(variant)%3+3)%3);
  const pose=CharacterFrames.get(id,'idle');
  if(!pose)return LegacyRomanArt.get(variant,frame,boss);
  if(!portraits.has(id)){const c=document.createElement('canvas');c.width=96;c.height=128;c.getContext('2d').drawImage(pose,64,108,128,128,0,0,96,128);portraits.set(id,c);}
  return portraits.get(id);
 },
};
