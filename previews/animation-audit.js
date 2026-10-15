import {VillagerArt} from '../src/rendering/art/villager-art.js';
import {AnimationArt} from '../src/rendering/art/animation-art.js';
import {UnitArt} from '../src/rendering/art/unit-art.js';
import {CharacterFrames} from '../src/rendering/character-frames.js';

const specs=Object.entries(CharacterFrames.manifest.characters);
function run(){
 if(Object.values(VillagerArt.status).some(s=>s!=='ready')||Object.values(AnimationArt.status).some(s=>s!=='ready')||Object.values(UnitArt.status).some(s=>s!=='ready'))return;
 const root=document.getElementById('frames');root.replaceChildren();let count=0,clipped=[];
 for(const [name,spec] of specs){const title=document.createElement('h2');title.textContent=name;root.append(title);const row=document.createElement('section');root.append(row);
 for(const [action,sequence]of Object.entries(spec.actions))for(let i=0;i<sequence.length;i++){
 const frame=CharacterFrames.get(name,action,(i+.01)/sequence.length),w=frame.width,h=frame.height;
 const audit=document.createElement('canvas');audit.width=w;audit.height=h;const ag=audit.getContext('2d');ag.drawImage(frame,0,0);
 const data=ag.getImageData(0,0,w,h).data;let edge=0;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if((x===0||x===w-1||y===0||y===h-1)&&data[(y*w+x)*4+3]>8)edge++;
 if(edge)clipped.push(name+'/'+action+'/'+i);count++;
 const c=document.createElement('canvas');c.width=180;c.height=200;const g=c.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(frame,0,0,w,h,5,5,170,170);g.fillStyle=edge?'#ff6666':'#eee';g.font='15px monospace';g.fillText(action+' '+i,8,194);row.append(c);
 }}
 document.getElementById('status').textContent=count+' frames · '+clipped.length+' touching frame edges'+(clipped.length?' · '+clipped.join(', '):' · PASS');
 clearInterval(timer);
}
const timer=setInterval(run,250);run();
