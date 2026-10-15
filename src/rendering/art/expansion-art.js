import {expansionUnits} from '../../../data/enemies/units.js';
import {drawMalosinus} from './malosinus-art.js';

export function drawExpansion(g,e){
  if(drawMalosinus(g,e))return true;
  if(!expansionUnits[e.unit])return false;
  g.save();g.translate(Math.round(e.x),Math.round(e.y));g.scale(Math.cos(e.heading)<0?-3:3,3);
  const step=e.moving?Math.round(Math.sin((e.walk||0)*6)*2):0;
  const r=(c,x,y,w,h)=>{g.fillStyle=e.hit>0?'#fff0cb':c;g.fillRect(x,y,w,h);};
  const soldier=(x,y,wide=1)=>{
    r('#302c28',x-4,y-19,8*wide,18);r('#b7b9a6',x-4,y-23,8,4);r('#b34436',x-1,y-26,4,4);
    r('#e5b582',x-3,y-19,6,5);r('#bf5542',x-4,y-13,8*wide,8);r('#e6d2a1',x-3,y-12,6*wide,5);
    r('#332f2c',x-4,y-5,3,5+step);r('#332f2c',x+2,y-5,3,5-step);
  };
  if(e.unit==='boar'){
    r('#332d27',-13,-13,24,10);r('#80563a',-12,-15,20,10);r('#aa784d',5,-12,10,7);
    r('#342b25',-9,-5,4,5+step);r('#342b25',6,-5,4,5-step);r('#dcd2a8',10,-6,5,2);r('#171f1c',9,-12,2,2);
    r('#493829',-10,-18,16,4);
  }else if(e.unit==='stoneSquad'){
    for(const x of [-10,1,11])soldier(x,0);
    const drop=e.crush?Math.round((.65-e.crush)*24):0;
    r('#414c4b',-19,-43+drop,39,17);r('#7f8980',-17,-48+drop,34,18);r('#b9bbaa',-12,-48+drop,20,4);
  }else if(e.unit==='tower'){
    for(const x of [-13,9])r('#34332c',x,-6,6,6);
    r('#65482d',-13,-48,26,42);r('#b98c51',-13,-48,4,42);r('#b98c51',9,-48,4,42);
    for(let y=-42;y<-7;y+=10)r('#c49a61',-9,y,18,3);
    soldier(-7,-34);soldier(7,-34);r('#795338',-17,-44,34,8);
    for(let x=-17;x<17;x+=8)r('#a7804d',x,-49,5,5);
  }else if(e.unit==='cavalry'){
    r('#785137',-17,-16,31,10);r('#a77649',10,-25,7,17);r('#a77649',14,-25,9,7);
    for(const x of [-14,-5,6,12])r('#3d332d',x,-7,3,7+(x%2?step:-step));
    soldier(-2,-13);r('#d4c4a2',5,-38,27,2);
  }else if(e.unit==='caius'){
    r('#782f39',-13,-22,25,21);soldier(-4,0,2);r('#e1bd5c',-9,-15,19,3);r('#f2d676',-6,-27,13,4);
  }else{
    soldier(0,0);
    if(e.unit==='wine'){
      r('#53392e',3,-19,11,17);r('#98603d',4,-18,9,14);r('#d4ba78',3,-16,11,2);r('#d4ba78',3,-7,11,2);r('#ae547c',11,-5,4,4);
    }else{
      r('#4c6840',-7,-18,4,15);r('#b1c593',-8,-23,14,3);
      for(let x=5;x<18;x+=4)r('#cfcea6',x,-17,1,15);
      for(let y=-17;y<-1;y+=4)r('#cfcea6',5,y,13,1);
      if(e.hidden){g.globalAlpha=.7;r('#416039',-12,-8,23,8);}
    }
  }
  g.restore();return true;
}

export function expansionTelegraph(g,e){
  if(!expansionUnits[e.unit])return false;
  if(!e.crush&&(!e.action||e.action.hit))return true;
  g.save();g.strokeStyle='#ffd38a';g.fillStyle='#e79e4938';g.lineWidth=2;
  if(e.crush){g.beginPath();g.arc(e.x,e.y,85,0,Math.PI*2);g.fill();g.stroke();}
  else if(e.action&&!e.action.hit){
    g.translate(e.x,e.y);g.rotate(Math.atan2(e.action.aim.y-e.y,e.action.aim.x-e.x));
    const charge=['boar','stoneSquad','cavalry'].includes(e.unit);
    const reach=e.unit==='cavalry'?2200:charge?430:expansionUnits[e.unit].range;
    g.fillRect(0,charge?-e.r:-9,reach,charge?e.r*2:18);g.strokeRect(0,charge?-e.r:-9,reach,charge?e.r*2:18);
  }
  g.restore();return true;
}

export function drawHazards(g,s){
  for(const h of s.winePools||[]){g.fillStyle=h.life<1?'#873b6555':'#873b65aa';g.fillRect(h.x-28,h.y-18,56,36);g.fillStyle='#ce8aaa';g.fillRect(h.x-16,h.y-10,16,4);}
  const p=s.p;
  if(p.stun>0){g.strokeStyle='#ebdfb1';g.lineWidth=2;for(let i=-24;i<=24;i+=12){g.beginPath();g.moveTo(p.x+i,p.y-48);g.lineTo(p.x+i,p.y+8);g.stroke();g.beginPath();g.moveTo(p.x-24,p.y+i-20);g.lineTo(p.x+24,p.y+i-20);g.stroke();}}
  if(p.stun>0||p.poisoned>0){g.fillStyle=p.stun>0?'#fff1ba':'#e6a1d0';g.font='bold 12px monospace';g.textAlign='center';g.fillText(p.stun>0?'СЕТЬ · СТАН':'ОТРАВЛЕНИЕ',p.x,p.y-105);}
}
