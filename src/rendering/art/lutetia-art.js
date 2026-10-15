import {AssetPaths} from '../asset-paths.js';
import {scaledScenery} from '../scaled-scenery.js';
// Ground outlines trace masonry, steps and planters, excluding roofs and foliage.
// Coordinates refer to the original square PNG, before horizontal reflection.
export const LutetiaShapes={
 'house-balcony-v3':[[.10,.78],[.58,.76],[.93,.85],[.92,.94],[.56,.97],[.10,.92]],
 'house-cottage-v3':[[.10,.79],[.65,.77],[.95,.84],[.96,.89],[.64,.93],[.19,.89],[.19,.87],[.10,.87]],
 'house-terrace-v3':[[.09,.79],[.58,.77],[.94,.86],[.94,.94],[.57,.98],[.10,.94]],
 'house-portico-v3':[[.09,.71],[.68,.70],[.95,.77],[.94,.83],[.59,.86],[.14,.83]],
 'house-shop-v3':[[.08,.80],[.61,.79],[.95,.86],[.95,.96],[.56,.98],[.08,.94]],
 'house-stairs-v3':[[.07,.76],[.53,.74],[.94,.84],[.94,.92],[.70,.95],[.44,.94],[.39,.98],[.04,.94]],
 'tree-broadleaf-v3':[[.35,.90],[.64,.88],[.69,.94],[.62,.98],[.36,.98],[.31,.94]],
 'tree-cypress-v3':[[.37,.91],[.61,.91],[.67,.95],[.60,.98],[.38,.98],[.33,.95]],
 'fountain-v3':[[.05,.66],[.46,.55],[.96,.65],[.96,.82],[.52,.97],[.05,.83]],
 'guardpost-v3':[[.23,.78],[.53,.76],[.84,.80],[.85,.91],[.49,.96],[.22,.91]]
};
const sprites={},status={};
if(typeof Image!=='undefined'){
 for(const name of [...Object.keys(LutetiaShapes),'garden-v2']){
  const sprite=new Image();status[name]='loading';sprite.onload=()=>status[name]='ready';sprite.onerror=()=>status[name]='error';sprite.src=AssetPaths.url('world/lutetia/'+name+'.png');sprites[name]=sprite;
 }
}
export const LutetiaArt={
 status,
 draw(g,kind,x,y,width,flip=false){
  const sprite=sprites[kind];if(!sprite||status[kind]!=='ready')return false;
  const height=width*sprite.naturalHeight/sprite.naturalWidth;
  g.save();g.translate(x,y);if(flip)g.scale(-1,1);g.drawImage(scaledScenery(sprite,width,false),-width/2,-height,width,height);g.restore();return true;
 }
};
