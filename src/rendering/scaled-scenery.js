// Keep static scenery near its screen resolution instead of repeatedly sampling
// the large source PNGs. Bound the cache across maps and preview zoom changes.
const cache=new Map();
let pixels=0;
const budget=16*1024*1024;
export function scaledScenery(image,width,smooth=true){
 if(typeof document==='undefined'||!image.naturalWidth)return image;
 const ratio=Math.min(globalThis.devicePixelRatio||1,2);
 const w=Math.min(image.naturalWidth,Math.ceil(width*ratio));
 if(w<=0||w>=image.naturalWidth)return image;
 const h=Math.max(1,Math.round(w*image.naturalHeight/image.naturalWidth));
 if(w*h>budget)return image;
 let sizes=cache.get(image);
 const key=w+':'+smooth;
 if(sizes?.has(key))return sizes.get(key);
 while(pixels+w*h>budget&&cache.size){
  const [source,entries]=cache.entries().next().value;
  for(const surface of entries.values())pixels-=surface.width*surface.height;
  cache.delete(source);
 }
 sizes=cache.get(image)||new Map();cache.set(image,sizes);
 const surface=document.createElement('canvas');surface.width=w;surface.height=h;
 const ink=surface.getContext('2d');ink.imageSmoothingEnabled=smooth;
 ink.drawImage(image,0,0,w,h);sizes.set(key,surface);pixels+=w*h;
 return surface;
}
