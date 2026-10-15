import {CharacterFrames} from '../character-frames.js';
const ids=Object.keys(CharacterFrames.manifest.characters).filter(id=>CharacterFrames.manifest.characters[id].renderer==='animation');
export const AnimationArt={
 status:CharacterFrames.register(ids,'animation-art-ready'),
 get(name,variant=0,action='walk',progress=0){
  const id=name==='roman'?'roman-'+((Math.floor(variant)%3+3)%3):name;
  return ids.includes(id)?CharacterFrames.get(id,action,progress):null;
 },
};
