'use strict';
// Split disconnected figures on an already transparent sheet; no color-keying.
function components(data,width,height){
 const labels=new Int32Array(width*height),queue=new Int32Array(width*height),items=[];
 for(let start=0;start<labels.length;start++){
  if(labels[start]||data[start*4+3]<=12)continue;
  const id=items.length+1,item={id,area:0,left:width,top:height,right:0,bottom:0};
  let head=0,tail=1;queue[0]=start;labels[start]=id;
  while(head<tail){
   const p=queue[head++],x=p%width,y=Math.floor(p/width);item.area++;
   item.left=Math.min(item.left,x);item.top=Math.min(item.top,y);item.right=Math.max(item.right,x+1);item.bottom=Math.max(item.bottom,y+1);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=width||ny>=height)continue;
    const q=ny*width+nx;if(!labels[q]&&data[q*4+3]>12){labels[q]=id;queue[tail++]=q;}
   }
  }
  items.push(item);
 }
 return {labels,items};
}
module.exports={components};
