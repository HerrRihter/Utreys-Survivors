import {CharacterFrameManifest} from '../../data/animations/character-frames.js';
import {AssetPaths} from './asset-paths.js';

// One decoded image per pose, shared by every actor. No crop or canvas allocation
// occurs during animation playback. The manifest is the character's source of truth.
const loaded=new Map();
export const CharacterFrames={
 manifest:CharacterFrameManifest,
 register(ids,eventName){
  const status={};
  for(const id of ids){
   const spec=CharacterFrameManifest.characters[id];
   if(!spec)throw new Error('Unknown character frame set: '+id);
   status[id]='loading';
   let entry=loaded.get(id);
   if(!entry){
    entry={status:'loading',images:new Map(),listeners:[]};loaded.set(id,entry);
    if(typeof Image!=='undefined'){
     const files=new Map();
     for(const [action,sequence]of Object.entries(spec.actions)){
      const scale=spec.actionScale?.[action]??1;
      if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid action scale: '+id+'/'+action);
      for(const file of sequence){
       if(files.has(file)&&files.get(file)!==scale)throw new Error('Conflicting frame scales: '+file);
       files.set(file,scale);
      }
     }
     let remaining=files.size;
     const notify=()=>{for(const listener of entry.listeners)listener(entry.status);};
     for(const [file,scale]of files){
      const image=new Image();entry.images.set(file,image);
      image.onload=()=>{
       if(entry.status!=='loading')return;
       if(image.naturalWidth!==CharacterFrameManifest.width||image.naturalHeight!==CharacterFrameManifest.height){
        entry.status='fallback';notify();return;
       }
       // Normalize mismatched source actions once, around the same foot anchor.
       // Every pose in an action gets the same scale: crouches remain crouches.
       if(scale!==1){
        const frame=document.createElement('canvas');
        frame.width=CharacterFrameManifest.width;frame.height=CharacterFrameManifest.height;
        const g=frame.getContext('2d'),[ax,ay]=CharacterFrameManifest.anchor;
        g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
        g.drawImage(image,ax*(1-scale),ay*(1-scale),frame.width*scale,frame.height*scale);
        entry.images.set(file,frame);
       }
       if(--remaining===0){entry.status='ready';notify();}
      };
      image.onerror=()=>{if(entry.status==='loading'){entry.status='fallback';notify();}};
      image.src=AssetPaths.url(file);
     }
    }
   }
   entry.listeners.push(value=>{status[id]=value;document.dispatchEvent(new Event(eventName));});
   status[id]=entry.status;
  }
  return status;
 },
 get(id,action='idle',progress=0){
  const entry=loaded.get(id),spec=CharacterFrameManifest.characters[id];
  if(!spec||entry?.status!=='ready')return null;
  if(action==='idle')return entry.images.get(spec.actions[spec.idle.action][spec.idle.index]);
  const sequence=spec.actions[action]||spec.actions.walk;
  if(!sequence?.length)return null;
  const p=Number.isFinite(progress)?progress:0;
  const index=action==='walk'?Math.floor(((p%1)+1)%1*sequence.length):Math.min(sequence.length-1,Math.floor(Math.max(0,p)*sequence.length));
  return entry.images.get(sequence[index]);
 },
};
