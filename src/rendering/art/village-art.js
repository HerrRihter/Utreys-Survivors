import {AssetPaths} from '../asset-paths.js';
export let VillageArt;
'use strict';
// Isolated, alpha-masked components from the generated scenery atlases.
VillageArt=(()=>{
 const images={},status={};
 if(typeof Image!=='undefined')for(const name of ['chief','asterix','obelix','bard','forge','fish','gate','trees','fence','ground-v1']){
  const image=new Image();status[name]='loading';image.onload=()=>status[name]='ready';image.onerror=()=>status[name]='error';image.src=AssetPaths.url('world/village/village-'+name+'.png');images[name]=image;
 }
 function draw(g,name,x,bottom,width){
  const image=images[name];if(status[name]!=='ready')return false;
  const height=width*image.naturalHeight/image.naturalWidth;
  g.save();g.imageSmoothingEnabled=true;g.drawImage(image,x-width/2,bottom-height,width,height);g.restore();return true;
 }
 return {images,status,draw};
})();
