'use strict';
// Asset packaging only. Artwork and poses are generated, never painted by this tool.
// Crop sheet cells, preserve alpha, apply ONE scale per character, anchor feet.
const fs=require('node:fs'),path=require('node:path');
const sharp=require(process.env.SHARP_MODULE||'sharp');
const root=path.resolve(__dirname,'..');
const specs={auxiliary:{height:86},merchant:{height:105},courtesan:{height:78},boar:{height:52},stoneSquad:{folder:'stone-squad',height:116},netter:{height:84},tower:{height:158},cavalry:{height:116},caius:{height:94},wine:{height:86}};
async function bounds(buffer){
 const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let left=info.width,top=info.height,right=0,bottom=0,count=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>12){left=Math.min(left,x);right=Math.max(right,x+1);top=Math.min(top,y);bottom=Math.max(bottom,y+1);count++;}
 if(!count)throw Error('Empty animation cell');
 if(count>info.width*info.height*.85)throw Error('Opaque background: regenerate with alpha');
 return {left,top,width:right-left,height:bottom-top};
}
async function main(){
 const [id,source]=process.argv.slice(2),spec=specs[id];if(!spec||!source)throw Error('Usage: node tools/import-expansion-art.cjs <unit> <transparent-sheet.png>');
 const archive=path.join(root,'assets/source/expansion-v1');fs.mkdirSync(archive,{recursive:true});
 const saved=path.join(archive,id+'.png');if(path.resolve(source)!==saved)fs.copyFileSync(source,saved);
 const meta=await sharp(saved).metadata();if(!meta.hasAlpha)throw Error('Source must have real transparency');
 const raw=await sharp(saved).ensureAlpha().raw().toBuffer();
 const {labels,items}=require('./sprite-sheet-components.cjs').components(raw,meta.width,meta.height);
 const main=items.filter(c=>c.area>1000).sort((a,b)=>b.area-a.area).slice(0,12);
 if(main.length!==12)throw Error(id+': expected 12 disconnected poses');
 main.sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
 const ordered=[];for(let row=0;row<3;row++)ordered.push(...main.slice(row*4,row*4+4).sort((a,b)=>a.left-b.left));
 const owner=new Map(main.map(c=>[c.id,c.id]));
 for(const c of items){
  if(owner.has(c.id)||c.area<5)continue;
  const x=(c.left+c.right)/2,y=(c.top+c.bottom)/2;
  const nearest=main.reduce((best,m)=>{
   const d=Math.hypot(Math.max(m.left-x,0,x-m.right),Math.max(m.top-y,0,y-m.bottom));
   return !best||d<best.d?{m,d}:best;
  },null);
  if(nearest.d<60)owner.set(c.id,nearest.m.id);
 }
 const cells=[];
 for(const m of ordered){
  const parts=items.filter(c=>owner.get(c.id)===m.id);
  const left=Math.max(0,Math.min(...parts.map(c=>c.left))-2),top=Math.max(0,Math.min(...parts.map(c=>c.top))-2);
  const right=Math.min(meta.width,Math.max(...parts.map(c=>c.right))+2),bottom=Math.min(meta.height,Math.max(...parts.map(c=>c.bottom))+2);
  const width=right-left,height=bottom-top,pixels=Buffer.alloc(width*height*4);
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++){
   const pos=y*meta.width+x;let keep=owner.get(labels[pos])===m.id;
   // Retain low-alpha antialiasing immediately beside this component.
   if(!labels[pos]&&raw[pos*4+3]>0)for(let dy=-1;dy<=1&&!keep;dy++)for(let dx=-1;dx<=1;dx++)if(owner.get(labels[(y+dy)*meta.width+x+dx])===m.id)keep=true;
   if(keep)raw.copy(pixels,((y-top)*width+x-left)*4,pos*4,pos*4+4);
  }
  const cell=await sharp(pixels,{raw:{width,height,channels:4}}).png().toBuffer(),box=await bounds(cell);
  let footLeft=m.right,footRight=m.left;
  for(let y=m.bottom-Math.max(6,Math.round((m.bottom-m.top)*.09));y<m.bottom;y++)for(let x=m.left;x<m.right;x++)if(labels[y*meta.width+x]===m.id){footLeft=Math.min(footLeft,x);footRight=Math.max(footRight,x);}
  cells.push({cell,box,footX:(footLeft+footRight)/2-left-box.left});
 }
 const heights=cells.slice(0,4).map(c=>c.box.height).sort((a,b)=>a-b);
 const scale=Math.min(spec.height/((heights[1]+heights[2])/2),118/Math.max(...cells.map(c=>Math.max(c.footX,c.box.width-c.footX))),220/Math.max(...cells.map(c=>c.box.height)));
 const folder=spec.folder||id,actions={},metrics=[];
 for(let row=0;row<3;row++){
  const action=['walk','attack','hurt'][row];actions[action]=[];
  const dir=path.join(root,'assets/runtime/characters/enemies',folder,'animations',action);fs.mkdirSync(dir,{recursive:true});
  for(let col=0;col<4;col++){
   const {cell,box,footX}=cells[row*4+col];
   const width=Math.max(1,Math.round(box.width*scale)),height=Math.max(1,Math.round(box.height*scale));
   const sprite=await sharp(cell).extract(box).resize(width,height).ensureAlpha().png().toBuffer();
   const left=Math.round(128-footX*scale),top=236-height;
   await sharp({create:{width:256,height:256,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left,top}]).png({palette:false}).toFile(path.join(dir,col+'.png'));
   actions[action].push('characters/enemies/'+folder+'/animations/'+action+'/'+col+'.png');metrics.push({action,frame:col,source:box,width,height,left,top});
  }
 }
 const file=path.join(root,'data/animations/character-frames.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 manifest.characters[id]={renderer:'unit',actions,idle:{action:'attack',index:3}};
 fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 fs.writeFileSync(path.join(archive,id+'-layout.json'),JSON.stringify({source:path.relative(root,saved),scale,metrics},null,2)+'\n');
 console.log(id+': imported 12 RGBA frames, fixed scale '+scale.toFixed(4));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
