'use strict';
// Package disconnected generated scenery, preserving original alpha and colors.
const fs=require('node:fs'),sharp=require(process.env.SHARP_MODULE||'sharp');
const {components}=require('./sprite-sheet-components.cjs');
async function main(){
 const [source,...names]=process.argv.slice(2);
 if(!source||!names.length)throw Error('Usage: import-scenery.cjs source.png name ...');
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {labels,items}=components(data,info.width,info.height);
 const main=items.filter(c=>c.area>1000).sort((a,b)=>b.area-a.area).slice(0,names.length);
 if(main.length!==names.length)throw Error('Missing scenery components');
 main.sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
 if(names.length===4){for(let row=0;row<2;row++){const sorted=main.slice(row*2,row*2+2).sort((a,b)=>a.left-b.left);main.splice(row*2,2,...sorted);}}
 else main.sort((a,b)=>a.left-b.left);
 const owner=new Map(main.map(c=>[c.id,c.id]));
 for(const part of items){if(owner.has(part.id)||part.area<5)continue;const x=(part.left+part.right)/2,y=(part.top+part.bottom)/2;
 const nearest=main.map(m=>({m,d:Math.hypot(Math.max(m.left-x,0,x-m.right),Math.max(m.top-y,0,y-m.bottom))})).sort((a,b)=>a.d-b.d)[0];if(nearest.d<90)owner.set(part.id,nearest.m.id);}
 for(let i=0;i<main.length;i++){
 const m=main[i],parts=items.filter(c=>owner.get(c.id)===m.id),left=Math.min(...parts.map(c=>c.left)),top=Math.min(...parts.map(c=>c.top)),right=Math.max(...parts.map(c=>c.right)),bottom=Math.max(...parts.map(c=>c.bottom));
 const width=right-left,height=bottom-top,pixels=Buffer.alloc(width*height*4);
 for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){const p=y*info.width+x;let keep=owner.get(labels[p])===m.id;
 if(!labels[p]&&data[p*4+3])for(let dy=-1;dy<=1&&!keep;dy++)for(let dx=-1;dx<=1;dx++)if(owner.get(labels[(y+dy)*info.width+x+dx])===m.id)keep=true;
 if(keep)data.copy(pixels,((y-top)*width+x-left)*4,p*4,p*4+4);}
 await sharp(pixels,{raw:{width,height,channels:4}}).resize({width:600,withoutEnlargement:true}).png().toFile('assets/runtime/world/scenery/'+names[i]+'-v1.png');
 console.log(names[i],{left,top,width,height});
 }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
