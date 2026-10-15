'use strict';
// Packaging only: crop transparent padding, uniformly resize and place on the game canvas.
const fs=require('node:fs'),path=require('node:path');
const sharp=require(process.env.SHARP_MODULE||'sharp');
async function main(){
 const root=path.resolve(__dirname,'..'),source=process.argv[2];
 if(!source)throw Error('Pass the corrected transparent source PNG.');
 const target=path.join(root,'assets/runtime/characters/enemies/turtle/animations/walk/0.png');
 const archive=path.join(root,'assets/source/turtle-first-frame');fs.mkdirSync(archive,{recursive:true});
 const before=path.join(archive,'walk-0-before.png');if(!fs.existsSync(before))fs.copyFileSync(target,before);
 fs.copyFileSync(source,path.join(archive,'walk-0-generated.png'));
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0;
 // Ignore almost invisible generation residue when measuring transparent margins.
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
 if(right<=left)throw Error('Empty sprite');
 const frame=await sharp(source).extract({left,top,width:right-left,height:bottom-top}).resize({height:106}).png().toBuffer();
 const meta=await sharp(frame).metadata();
 await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}})
  .composite([{input:frame,left:Math.round(130.5-meta.width/2),top:130}]).png({palette:false}).toFile(target);
 console.log('Imported only turtle/walk/0.png: 256x256 RGBA, 106px visible height, baseline 236.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
