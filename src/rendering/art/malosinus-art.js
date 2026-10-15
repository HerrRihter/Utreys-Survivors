import {actionTiming} from '../../../data/animations/action-timing.js';

// Canvas-native silhouette, articulated money bag and walking sandals.
export function drawMalosinus(g,e){
  if(e.unit!=='malosinus')return false;
  g.save();g.translate(Math.round(e.x),Math.round(e.y));
  g.scale(Math.cos(e.heading||0)<0?-1:1,1);
  g.lineWidth=2.4;g.lineJoin='round';g.lineCap='round';g.strokeStyle='#24251e';
  const poly=(points,color)=>{g.fillStyle=e.hit>0?'#fff1ca':color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();g.stroke();};
  const oval=(x,y,rx,ry,color)=>{g.fillStyle=e.hit>0?'#fff1ca':color;g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fill();g.stroke();};
  const line=(points,color='#24251e')=>{g.strokeStyle=color;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.stroke();g.strokeStyle='#24251e';};
  const step=e.moving?Math.sin((e.walk||0)*6)*5:0;
  poly([[-24,-86],[14,-90],[29,-44],[20,-13],[-33,-24],[-38,-52]],'#147861');
  poly([[-17,-35],[-5,-34],[-11,-10+step],[-23,-4+step],[-31,-5+step]],'#f1d0a6');
  poly([[5,-35],[15,-33],[20,-11-step],[34,-5-step],[24,-2-step],[9,-8-step]],'#f1d0a6');
  poly([[-30,-10+step],[-16,-8+step],[-10,-3+step],[-32,1+step],[-37,-2+step]],'#f5edcf');
  poly([[14,-9-step],[25,-9-step],[37,-3-step],[33,1-step],[12,-3-step]],'#f5edcf');
  line([[-26,-8+step],[-21,-2+step],[-16,-6+step]]);line([[18,-7-step],[23,-2-step],[27,-6-step]]);
  poly([[-20,-85],[12,-86],[19,-37],[-18,-32],[-26,-41]],'#b4d7a2');
  poly([[-22,-49],[17,-49],[18,-43],[-23,-42]],'#e5bf4e');
  for(let x=-17;x<15;x+=9)oval(x,-46,2.4,2.4,'#fff0a0');
  poly([[-23,-38],[18,-37],[18,-32],[-17,-27],[-24,-31]],'#eee2b2');
  poly([[-25,-85],[-34,-75],[-32,-56],[-23,-51],[-18,-58],[-25,-64],[-20,-75]],'#edc99f');
  poly([[-14,-102],[-15,-88],[-23,-84],[5,-73],[17,-89],[7,-101]],'#f2d0a6');
  // Bald crown, pronounced aquiline nose, raised brow and pinched mouth.
  poly([[-16,-119],[-11,-133],[2,-136],[15,-130],[35,-133],[26,-122],[14,-116],[21,-105],[13,-99],[9,-86],[-1,-90],[-9,-106],[-17,-108]],'#f2d0a6');
  oval(-15,-113,6,9,'#e3b98e');line([[-16,-117],[-12,-119],[-12,-111],[-16,-113]]);
  poly([[3,-125],[10,-126],[14,-121],[6,-118]],'#fff9e6');oval(10,-122,1.4,2.5,'#24251e');
  line([[0,-130],[8,-129],[14,-125]]);line([[16,-122],[11,-111],[22,-114]]);
  line([[3,-102],[10,-105],[15,-103]]);line([[0,-98],[8,-96],[10,-99]]);
  poly([[-27,-88],[-13,-86],[7,-82],[15,-92],[20,-85],[7,-69],[-19,-72],[-32,-80]],'#23947a');
  line([[-25,-82],[-8,-77],[5,-78]],'#b4d7a2');oval(11,-85,5,4,'#edc757');
  // The bag is held by its neck and swings through the telegraphed impact.
  const a=e.action,progress=a?Math.min(1,a.elapsed/a.duration):0;
  const impact=actionTiming.impactProgress;
  const swing=a?(progress<impact?-1.5*progress/impact:-1.5+2.6*Math.min(1,(progress-impact)/.18)):.12;
  g.save();g.translate(17,-74);g.rotate(swing);
  poly([[0,-6],[10,-3],[22,9],[19,17],[11,12],[3,5]],'#efcda4');
  poly([[19,9],[26,12],[30,24],[14,24]],'#a1783f');
  oval(23,40,22,24,'#ae8045');
  poly([[12,21],[20,18],[31,21],[29,27],[16,27]],'#e7c15c');
  line([[11,34],[8,47],[14,55]],'#dcb878');line([[34,33],[37,45],[31,57]],'#735332');
  oval(23,42,10,11,'#e5bb4e');
  g.fillStyle='#735332';g.font='bold 17px serif';g.textAlign='center';g.fillText('¤',23,48);
  g.restore();g.restore();return true;
}
