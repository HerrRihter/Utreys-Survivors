import {drawExpansion} from '../rendering/art/expansion-art.js';
import {unitDefinitions} from '../../data/enemies/units.js';
import {getWaveSchedule,waveRoster} from '../systems/wave-schedule.js';
import {waveTiming} from '../ui/wave-preview.js';
import {arenaDefinitions,createArenas} from '../world/arenas.js';
import {CharacterFrameManifest} from '../../data/animations/character-frames.js';
import {CharacterBounds} from '../../data/animations/character-bounds.js';
import {AnimationArt} from '../rendering/art/animation-art.js';
import {UnitArt} from '../rendering/art/unit-art.js';
import {Village} from '../world/village/village.js';
import {fitCharacterPreview,drawCharacterPreview} from '../ui/character-preview.js';

const opponentDescriptions={
malosinus:'Главный противник. 2200 HP. Атакует вблизи; уклоняйся во время замаха.',
citizen:'Нейтральный персонаж. Не атакует.',
auxiliary:'Быстро сокращает дистанцию и атакует выпадом.',
merchant:'Остаётся на месте и атакует с большого расстояния.',
courtesan:'Подбирает предметы и избегает столкновений.',
boar:'Предупреждает о рывке и движется по прямой.',
stoneSquad:'Разбегается и атакует в указанной области.',
netter:'Бросает сеть и временно замедляет движение.',
tower:'Медленный противник с дальними атаками.',
cavalry:'Быстро пересекает арену.',
caius:'Не атакует. При получении урона оставляет бонусы.',
wine:'Оставляет временный опасный след.',
roman:'Базовый противник с короткой атакой.',
spear:'Атакует выпадом по заранее указанному направлению.',
pilum:'Атакует с расстояния метательным снарядом.',
veteran:'Медленно готовит сильную атаку.',
turtle:'Использует защиту спереди; атакуй с другой стороны.',
ram:'Разгоняется по прямой и наносит урон при столкновении.',
boss:'Главный противник арены. Победи его и заверши забег.'};

const anchor=CharacterFrameManifest.anchor,previews=[];
const arenas=createArenas(Village);
document.getElementById('locations').innerHTML=Object.entries(arenaDefinitions).map(([id,map])=>'<a href="#'+id+'">'+map.name+'</a>').join('');
let selectedMap='empty';
function showLocation(){
 const requested=location.hash.slice(1);
 selectedMap=Object.hasOwn(arenaDefinitions,requested)?requested:'empty';
 const arena=arenaDefinitions[selectedMap];
 document.title=arena.name+' · Противники';
 document.getElementById('locationTitle').textContent=arena.name+' · Противники';
 document.getElementById('locationIntro').textContent=arena.description;
 document.getElementById('mapTitle').textContent='Карта: '+arena.name;
 document.getElementById('mapNotes').textContent=arena.notes;
 document.getElementById('map').setAttribute('aria-label','План арены: '+arena.name);
 for(const link of document.querySelectorAll('.locations a')){
  if(link.hash==='#'+selectedMap)link.setAttribute('aria-current','page');
  else link.removeAttribute('aria-current');
 }
 previews.length=0;
 document.getElementById('cards').replaceChildren();
 const schedule=getWaveSchedule(selectedMap),roster=waveRoster(schedule),units=roster.map(entry=>entry.unit);
 document.getElementById('rosterCount').textContent='Типов противников: '+units.length;
 for(const unit of units){
 const u=unitDefinitions[unit];
 const card=document.createElement('article');card.className='card';
 const timing=(schedule.boss?.unit===unit?'БОСС АРЕНЫ · ':'')+waveTiming(schedule,unit),description=opponentDescriptions[unit]||'';
 card.innerHTML=`<canvas width="280" height="210" data-unit="${unit}" aria-label="${u.name}"></canvas><h2>${u.name}</h2><div class="stats">${u.hp} HP · ${u.damage} урона · ${u.xp} опыта</div><p style="color:#e5c480">${timing}</p><p>${description}</p>`;
 document.getElementById('cards').append(card);
 const canvas=card.querySelector('canvas'),id=unit==='roman'?'roman-0':unit==='citizen'?'citizen-0':unit;
 const bounds=CharacterBounds[id]||{left:0,top:0,right:256,bottom:256};
 previews.push({unit,id,g:canvas.getContext('2d'),placement:fitCharacterPreview(bounds,anchor,canvas.width,canvas.height),wide:u.r>30});
 }
 drawMap();
}
let motion='walk',frozen=false,reverse=false,phase=0,lastTime=0;
document.getElementById('motion').onchange=e=>{motion=e.target.value;phase=0;};
document.getElementById('freeze').onclick=e=>{frozen=!frozen;e.target.textContent=frozen?'Продолжить анимацию':'Пауза анимации';};
document.getElementById('reverse').onchange=e=>{reverse=e.target.checked;};
function frame(t){
 const dt=Math.min(.05,(t-lastTime)/1000||0);lastTime=t;if(!frozen)phase+=dt;
 const duration=motion==='attack'?1.8:motion==='hurt'?1.2:1.1;
 const progress=(phase%duration)/duration;
 let loaded=0,failed=0;
 for(const {unit,id,g,placement,wide}of previews){
  g.clearRect(0,0,g.canvas.width,g.canvas.height);g.imageSmoothingEnabled=false;
  const art=UnitArt.get(unit,motion,progress)||AnimationArt.get(unit,0,motion,progress);
  if(!art){
  if(drawExpansion(g,{unit,x:140,y:196,action:motion==='attack'?{elapsed:progress,duration:1}:null,heading:reverse?Math.PI:0,moving:motion==='walk',walk:phase,hit:motion==='hurt'?1:0,crush:unit==='stoneSquad'&&motion==='attack'?Math.max(.01,.65-progress*.65):0})){loaded++;continue;}
   const missing=(UnitArt.status[id]||AnimationArt.status[id])==='fallback';if(missing)failed++;
   g.fillStyle='#b1c4a4';g.font='14px Consolas,monospace';g.textAlign='center';g.fillText(missing?'Кадры недоступны':'Загрузка…',g.canvas.width/2,g.canvas.height/2);continue;
  }
  loaded++;
  g.fillStyle='#172d2266';g.beginPath();g.ellipse(placement.x,placement.y+5,(wide?58:24)*placement.scale,5,0,0,Math.PI*2);g.fill();
  drawCharacterPreview(g,art,anchor,placement,reverse);
 }
 const label=loaded===previews.length?'Анимации готовы':failed?'Не удалось загрузить '+failed+' анимаций':('Загружено '+loaded+' / '+previews.length);
 const status=document.getElementById('artStatus');if(status.textContent!==label)status.textContent=label;
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
function drawMap(){const g=document.getElementById('map').getContext('2d');g.setTransform(.25,0,0,.25,0,0);g.fillStyle='#344b34';g.fillRect(0,0,2200,2200);arenas.get(selectedMap).draw(g);g.fillStyle='#f6cb72';g.beginPath();g.arc(1100,1100,22,0,Math.PI*2);g.fill();}
window.addEventListener('hashchange',showLocation);
showLocation();
setInterval(drawMap,500);
