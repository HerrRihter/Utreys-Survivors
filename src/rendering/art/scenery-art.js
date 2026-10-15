import {AssetPaths} from '../asset-paths.js';
export const SceneryArt={};
if(typeof Image!=='undefined')for(const name of ['tent','tent-round','weapons','rocks','command','supplies','fire','standard']){
 const image=new Image();SceneryArt[name]={image,ready:false};
 image.onload=()=>SceneryArt[name].ready=true;
 image.src=AssetPaths.url('world/scenery/'+name+'-v1.png');
}
