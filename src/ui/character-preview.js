// Fit the union of all poses, including the mirrored poses, once per card.
// Keeping one scale and one foot position prevents zooming between frames.
export function fitCharacterPreview(bounds,anchor,width,height){
 const padding=18,groundGap=8,[ax,ay]=anchor;
 const halfWidth=Math.max(ax-bounds.left,bounds.right-ax,1);
 const above=Math.max(ay-bounds.top,1),below=Math.max(bounds.bottom-ay,0);
 const scale=Math.min(1.6,(width-2*padding)/(2*halfWidth),(height-2*padding-groundGap)/(above+below));
 return {scale,x:width/2,y:height-padding-groundGap-below*scale};
}
export function drawCharacterPreview(g,frame,anchor,placement,reverse=false){
 const {x,y,scale}=placement;
 g.save();g.translate(x,y);g.scale(reverse?-scale:scale,scale);
 g.drawImage(frame,-anchor[0],-anchor[1]);g.restore();
}
