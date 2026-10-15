'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');

// Read the alpha channel of the project's non-interlaced RGBA8 PNG frames.
// Bounds are generated offline so the preview also works with file:// images,
// where browser pixel readback is unavailable. No runtime image scanning needed.
function pngBounds(file){
 const png=fs.readFileSync(file),chunks=[];
 if(!png.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw Error('Not a PNG: '+file);
 const width=png.readUInt32BE(16),height=png.readUInt32BE(20);
 if(png[24]!==8||png[25]!==6||png[28]!==0)throw Error('Export this frame as non-interlaced RGBA8 PNG: '+file);
 for(let offset=8;offset<png.length;){
  const length=png.readUInt32BE(offset),type=png.toString('ascii',offset+4,offset+8);
  if(type==='IDAT')chunks.push(png.subarray(offset+8,offset+8+length));
  offset+=length+12;
 }
 const raw=zlib.inflateSync(Buffer.concat(chunks)),stride=width*4;
 if(raw.length!==(stride+1)*height)throw Error('Invalid PNG scanline length: '+file);
 let previous=Buffer.alloc(stride),left=width,top=height,right=0,bottom=0;
 const paeth=(a,b,c)=>{const p=a+b-c,da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c);return da<=db&&da<=dc?a:db<=dc?b:c;};
 for(let y=0;y<height;y++){
  const start=y*(stride+1),filter=raw[start],row=Buffer.alloc(stride);
  if(filter>4)throw Error('Invalid PNG filter: '+file);
  for(let i=0;i<stride;i++){
   const a=i>=4?row[i-4]:0,b=previous[i],c=i>=4?previous[i-4]:0;
   const predict=filter===0?0:filter===1?a:filter===2?b:filter===3?Math.floor((a+b)/2):paeth(a,b,c);
   row[i]=(raw[start+1+i]+predict)&255;
  }
  for(let x=0;x<width;x++)if(row[x*4+3]>0){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x+1);bottom=Math.max(bottom,y+1);}
  previous=row;
 }
 if(right<=left||bottom<=top)throw Error('Empty character frame: '+file);
 return {left,top,right,bottom};
}
function generateCharacterBounds({root=path.resolve(__dirname,'..'),check=false}={}){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'data/animations/character-frames.json'),'utf8'));
 const bounds={},cache=new Map(),[ax,ay]=manifest.anchor;
 for(const [id,spec]of Object.entries(manifest.characters)){
  const box={left:manifest.width,top:manifest.height,right:0,bottom:0};
  for(const [action,files]of Object.entries(spec.actions))for(const file of files){
   if(!cache.has(file))cache.set(file,pngBounds(path.join(root,'assets/runtime',file)));
   const b=cache.get(file),s=spec.actionScale?.[action]??1;
   if(!Number.isFinite(s)||s<=0)throw Error('Invalid action scale: '+id+'/'+action);
   // One extra pixel covers interpolation when a sequence is normalized at load.
   box.left=Math.min(box.left,Math.max(0,Math.floor(ax+(b.left-ax)*s)-1));
   box.top=Math.min(box.top,Math.max(0,Math.floor(ay+(b.top-ay)*s)-1));
   box.right=Math.max(box.right,Math.min(manifest.width,Math.ceil(ax+(b.right-ax)*s)+1));
   box.bottom=Math.max(box.bottom,Math.min(manifest.height,Math.ceil(ay+(b.bottom-ay)*s)+1));
  }
  bounds[id]=box;
 }
 const target=path.join(root,'data/animations/character-bounds.js');
 const output='// Generated from all character poses; run npm run generate after changing PNGs.\nexport const CharacterBounds='+JSON.stringify(bounds)+';\n';
 if(check){if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==output)throw Error('Outdated character bounds. Run npm run generate.');}
 else fs.writeFileSync(target,output);
 return bounds;
}
module.exports={pngBounds,generateCharacterBounds};
