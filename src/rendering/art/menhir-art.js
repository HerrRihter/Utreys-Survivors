import {MenhirBounds} from '../../../data/animations/menhir-layout.js';
import {AssetPaths} from '../asset-paths.js';
export let MenhirArt;
/* Cached stone sprite, ground-plane position kept separate from flight height. */
(() => {
  let art=null;
  MenhirArt={status:'loading',draw(g,b){
    const age=b.age||0,height=48+Math.sin(Math.min(1,age/2.2)*Math.PI)*12;
    const scale=b.r/11;
    g.save();g.fillStyle='#14261b55';g.beginPath();g.ellipse(b.x,b.y+9,12*scale,4*scale,0,0,Math.PI*2);g.fill();
    g.translate(b.x,b.y-height);g.rotate(b.angle);
    if(art)g.drawImage(art,-32*scale,-20*scale,64*scale,40*scale);
    else{g.fillStyle='#929392';g.strokeStyle='#252726';g.lineWidth=2;g.beginPath();g.moveTo(-30*scale,0);g.quadraticCurveTo(0,-27*scale,26*scale,-13*scale);g.quadraticCurveTo(39*scale,18*scale,8*scale,18*scale);g.quadraticCurveTo(-20*scale,17*scale,-30*scale,0);g.fill();g.stroke();}
    g.restore();
  }};
  if(typeof Image==='undefined')return;
  const image=new Image();image.onload=()=>{const c=document.createElement('canvas');c.width=128;c.height=80;const g=c.getContext('2d');g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';const bounds=MenhirBounds||[0,0,image.naturalWidth,image.naturalHeight];const [x,y,w,h]=bounds;g.drawImage(image,x,y,w,h,2,4,124,72);art=c;MenhirArt.status='ready';document.dispatchEvent(new Event('menhir-art-ready'));};
  image.onerror=()=>{MenhirArt.status='fallback';};image.src=AssetPaths.url('projectiles/menhir-flight-v2.png');
})();
