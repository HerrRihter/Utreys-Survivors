'use strict';
// Package generated 4x4 civilian walk sheet; preserve alpha and a fixed scale per person.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const ids=['citizen-0','citizen-1','citizen-2'],rows=[0,1,3];
(async()=>{
 const source=process.argv[2];if(!source)throw Error('Pass the generated civilian sheet');
 const archive='assets/source/expansion-v1/civilians.png';fs.copyFileSync(source,archive);
 const meta=await sharp(source).metadata();if(!meta.hasAlpha)throw Error('Transparent alpha required');
 const cw=Math.floor(meta.width/4),ch=Math.floor(meta.height/4),manifest=JSON.parse(fs.readFileSync('data/animations/character-frames.json','utf8'));
 for(let variant=0;variant<ids.length;variant++){
  const row=rows[variant],id=ids[variant];
  const frames=[];
  for(let col=0;col<4;col++){
   const cell=await sharp(source).extract({left:col*cw,top:row*ch,width:cw,height:ch}).png().toBuffer();
   const {data,info}=await sharp(cell).raw().toBuffer({resolveWithObject:true});
   let left=cw,top=ch,right=0,bottom=0,filled=0;
   for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(data[(y*cw+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);filled++;}
   if(!filled||filled>cw*ch*.8)throw Error('Invalid transparency in '+id);
   frames.push({cell,box:{left,top,width:right-left,height:bottom-top}});
  }
  const scale=[70,76,74][variant]/Math.max(...frames.map(f=>f.box.height));
  const files=[],dir='assets/runtime/characters/civilians/'+id+'/animations/walk';fs.mkdirSync(dir,{recursive:true});
  for(let col=0;col<4;col++){
   const {cell,box}=frames[col],width=Math.round(box.width*scale),height=Math.round(box.height*scale);
   const input=await sharp(cell).extract(box).resize(width,height).png().toBuffer();
   const file=dir+'/'+col+'.png';
   await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input,left:128-Math.floor(width/2),top:236-height}]).png().toFile(file);
   files.push(file.replace('assets/runtime/',''));
  }
  // Civilians have no attack action; aliases satisfy the shared preview/corpse interface.
  manifest.characters[id]={renderer:'unit',actions:{walk:files,attack:[files[0]],hurt:[files[2]]},idle:{action:'walk',index:0}};
 }
 fs.writeFileSync('data/animations/character-frames.json',JSON.stringify(manifest,null,2)+'\n');
 console.log('Packaged one citizen with three skins, 12 running poses; unused third source row excluded.');
})().catch(e=>{console.error(e);process.exitCode=1;});
