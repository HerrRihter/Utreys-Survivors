import {Village} from '../world/village/village.js';
import {createArenas,arenaDefinitions} from '../world/arenas.js';

const arenas=createArenas(Village);
const mapSelect=document.getElementById('arena');
mapSelect.innerHTML=Object.entries(arenaDefinitions).map(([id,map])=>'<option value="'+id+'">'+map.name+'</option>').join('');
mapSelect.value='empty';
const canvas=document.getElementById('map'),g=canvas.getContext('2d');let close=false;
document.getElementById('overview').onclick=()=>close=false;document.getElementById('square').onclick=()=>close=true;
function render(){const id=document.getElementById("arena").value,world=arenas.get(id);g.setTransform(1,0,0,1,0,0);g.fillStyle='#89954e';g.fillRect(0,0,1320,1000);const scale=close?.95:.43;g.translate(660,500);g.scale(scale,scale);g.translate(-1100,close?-1070:-1090);world.draw(g);
if(document.getElementById('bounds').checked&&world.collision)world.collision.draw(g);
if(document.getElementById('labels').checked)for(const h of world.houses){if(!h.name)continue;g.font='bold 19px Georgia';g.textAlign='center';g.lineWidth=5;g.strokeStyle='#24301ee0';g.strokeText(h.name,h.x+h.w/2,h.y+h.h+37);g.fillStyle='#fff0ba';g.fillText(h.name,h.x+h.w/2,h.y+h.h+37);}
requestAnimationFrame(render);}render();
