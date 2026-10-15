'use strict';
const path=require('node:path');
const {loadModule}=require('./load-modules.cjs');
const {canvasContext}=require('./canvas-context.cjs');
async function frameHarness(module){
 const images=[],draws=[],events=[];
 const env={URL,console,Event:class{constructor(type){this.type=type;}},document:{dispatchEvent(event){events.push(event.type);},createElement(){return {getContext(){return canvasContext({drawImage(...args){draws.push(args);}});}};}},Image:class{naturalWidth=256;naturalHeight=256;set src(url){this.url=url;images.push(this);}}};
 await loadModule(env,path.resolve(__dirname,'../..',module));
 return {env,images,draws,events,load:id=>images.filter(i=>i.url.includes('/'+id+'/animations/')).forEach(i=>i.onload())};
}
module.exports={frameHarness};
