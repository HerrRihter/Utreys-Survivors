import {drawExpansion} from '../rendering/art/expansion-art.js';
import {unitDefinitions} from '../../data/enemies/units.js';
import {getWaveSchedule, waveRoster} from '../systems/wave-schedule.js';
import {waveTiming} from '../ui/wave-preview.js';
import {arenaDefinitions, createArenas} from '../world/arenas.js';
import {CharacterFrameManifest} from '../../data/animations/character-frames.js';
import {CharacterBounds} from '../../data/animations/character-bounds.js';
import {AnimationArt} from '../rendering/art/animation-art.js';
import {UnitArt} from '../rendering/art/unit-art.js';
import {Village} from '../world/village/village.js';
import {fitCharacterPreview, drawCharacterPreview} from '../ui/character-preview.js';
import {Legion} from '../entities/legion.js';

const opponentDescriptions = {
  l3: 'Промежуточный контур L3. Обеспечивает связь производственных линий со складом, регулярно передаёт пакеты агрегированных кодов.',
  crpt: 'Эмиссионный шлюз ЦРПТ (Честный ЗНАК). Ключевой регулятор: колоссальный запас прочности, строгие проверки криптохвостов и массивная валидация.',
  pepsi: 'Клиент Пепси. Скоростные линии розлива напитков, генерация сотен запросов в секунду и постоянная верификация партий.',
  inbev: 'Клиент Инбев. Пивоваренный гигант с тяжёлыми паллетами и высокой плотностью групповой агрегации кодов. Обладает защитой с фронтальной стороны.',
  mars: 'Клиент Марс. Международный FMCG-производитель кондитерских изделий и кормов. Непрерывная выгрузка отчётов нанесения и дистанционные запросы.',
  malosinus: 'Главный противник. 2200 HP. Атакует вблизи; уклоняйся во время замаха.',
  citizen: 'Нейтральный персонаж. Не атакует.',
  boss: 'Главный регулятор или босс контура.'
};

const anchor = CharacterFrameManifest.anchor, previews = [];
const arenas = createArenas(Village);
const locationsEl = document.getElementById('locations');
if (locationsEl) {
  locationsEl.innerHTML = Object.entries(arenaDefinitions).map(([id, map]) => '<a href="#' + id + '">' + map.name + '</a>').join('');
}

let selectedMap = 'empty';

function showLocation() {
  const requested = location.hash.slice(1);
  selectedMap = Object.hasOwn(arenaDefinitions, requested) ? requested : 'empty';
  const arena = arenaDefinitions[selectedMap];
  document.title = arena.name + ' · Противники';
  const locTitle = document.getElementById('locationTitle');
  if (locTitle) locTitle.textContent = arena.name + ' · Противники';
  const locIntro = document.getElementById('locationIntro');
  if (locIntro) locIntro.textContent = arena.description;
  const mapTitle = document.getElementById('mapTitle');
  if (mapTitle) mapTitle.textContent = 'Карта: ' + arena.name;
  const mapNotes = document.getElementById('mapNotes');
  if (mapNotes) mapNotes.textContent = arena.notes;
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.setAttribute('aria-label', 'План арены: ' + arena.name);

  for (const link of document.querySelectorAll('.locations a')) {
    if (link.hash === '#' + selectedMap) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }

  previews.length = 0;
  const cardsEl = document.getElementById('cards');
  if (cardsEl) cardsEl.replaceChildren();

  let schedule = null;
  try {
    schedule = getWaveSchedule(selectedMap);
  } catch (err) {
    console.warn(err);
  }

  let units = [];
  if (schedule) {
    try {
      const roster = waveRoster(schedule);
      units = roster.map(entry => entry.unit);
    } catch {
      units = Object.keys(unitDefinitions);
    }
  } else {
    units = Object.keys(unitDefinitions);
  }

  const rosterCount = document.getElementById('rosterCount');
  if (rosterCount) rosterCount.textContent = 'Типов противников: ' + units.length;

  for (const unit of units) {
    const u = unitDefinitions[unit];
    if (!u) continue;
    const card = document.createElement('article');
    card.className = 'card';
    let timing = '';
    try {
      timing = (schedule?.boss?.unit === unit ? 'БОСС АРЕНЫ · ' : '') + (schedule ? waveTiming(schedule, unit) : 'Активный поток');
    } catch {
      timing = 'Активный поток';
    }
    const description = opponentDescriptions[unit] || '';
    card.innerHTML = `<canvas width="280" height="210" data-unit="${unit}" aria-label="${u.name}"></canvas><h2 style="color:${u.color || '#00e5ff'}">${u.name}</h2><div class="stats">${u.hp} HP · ${u.damage} урона · ${u.xp} кодов</div><p style="color:#00e5ff">${timing}</p><p>${description}</p>`;
    if (cardsEl) cardsEl.append(card);
    const canvas = card.querySelector('canvas');
    if (!canvas) continue;
    const id = unit === 'roman' ? 'roman-0' : unit === 'citizen' ? 'citizen-0' : unit;
    const bounds = CharacterBounds[id] || {left: 0, top: 0, right: 256, bottom: 256};
    previews.push({
      unit,
      id,
      g: canvas.getContext('2d'),
      placement: fitCharacterPreview(bounds, anchor, canvas.width, canvas.height),
      wide: u.r > 30,
      isLegion: ['l3', 'crpt', 'pepsi', 'inbev', 'mars'].includes(unit)
    });
  }
  drawMap();
}

let motion = 'walk', frozen = false, reverse = false, phase = 0, lastTime = 0;
const motionEl = document.getElementById('motion');
if (motionEl) motionEl.onchange = e => { motion = e.target.value; phase = 0; };
const freezeEl = document.getElementById('freeze');
if (freezeEl) freezeEl.onclick = e => { frozen = !frozen; e.target.textContent = frozen ? 'Продолжить анимацию' : 'Пауза анимации'; };
const reverseEl = document.getElementById('reverse');
if (reverseEl) reverseEl.onchange = e => { reverse = e.target.checked; };

function frame(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
  lastTime = t;
  if (!frozen) phase += dt;
  const duration = motion === 'attack' ? 1.8 : motion === 'hurt' ? 1.2 : 1.1;
  const progress = (phase % duration) / duration;
  let loaded = 0, failed = 0;

  for (const item of previews) {
    const {unit, id, g, placement, wide, isLegion} = item;
    g.clearRect(0, 0, g.canvas.width, g.canvas.height);
    g.imageSmoothingEnabled = false;

    if (isLegion) {
      // Draw grid background
      g.fillStyle = '#0f2427';
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      const cx = g.canvas.width / 2;
      const cy = g.canvas.height * 0.65;
      const bob = motion === 'walk' ? Math.sin(phase * 8) * 3 : 0;
      const lunge = motion === 'attack' ? (reverse ? -1 : 1) * Math.max(0, Math.sin(phase * 6) * 12) : 0;
      const mock = {
        x: cx + lunge,
        y: cy + bob,
        unit,
        heading: reverse ? Math.PI : 0,
        hit: motion === 'hurt' && Math.sin(phase * 12) > 0.1 ? 1 : 0,
        action: motion === 'attack' ? { aim: { x: cx + (reverse ? -120 : 120), y: cy }, hit: false } : null
      };
      if (motion === 'attack') {
        Legion.telegraph(g, mock);
        if (unit === 'l3') {
          const prog = (phase * 2.4) % 1;
          const px = cx + (reverse ? -1 : 1) * (prog * 75);
          Legion.projectile(g, { x: px, y: cy - 14, kind: 'l3' });
        } else if (unit === 'crpt') {
          const waveR = 24 + ((phase * 80) % 95);
          const waveAlpha = Math.max(0, 1 - waveR / 95) * 0.75;
          g.strokeStyle = `rgba(255, 214, 0, ${waveAlpha})`;
          g.lineWidth = 3;
          g.beginPath();
          g.arc(cx, cy - 16, waveR, 0, Math.PI * 2);
          g.stroke();
        } else if (unit === 'pepsi') {
          const prog = (phase * 2.6) % 1;
          const px = cx + (reverse ? -1 : 1) * (prog * 80);
          Legion.projectile(g, { x: px, y: cy - 16 + Math.sin(phase * 14) * 5, kind: 'pepsi' });
        } else if (unit === 'inbev') {
          g.strokeStyle = 'rgba(212, 175, 55, 0.85)';
          g.lineWidth = 3.5;
          g.beginPath();
          const arcAngle = reverse ? Math.PI : 0;
          g.arc(cx + (reverse ? -26 : 26), cy - 14, 22, arcAngle - 1.1, arcAngle + 1.1);
          g.stroke();
        } else if (unit === 'mars') {
          const prog = (phase * 1.8) % 1;
          const px = cx + (reverse ? -1 : 1) * (prog * 110);
          Legion.projectile(g, { x: px, y: cy - 10, kind: 'mars' });
        }
      }
      Legion.draw(g, mock, () => {});
      loaded++;
      continue;
    }

    const art = UnitArt.get(unit, motion, progress) || AnimationArt.get(unit, 0, motion, progress);
    if (!art) {
      if (drawExpansion(g, {
        unit,
        x: 140,
        y: 196,
        action: motion === 'attack' ? {elapsed: progress, duration: 1} : null,
        heading: reverse ? Math.PI : 0,
        moving: motion === 'walk',
        walk: phase,
        hit: motion === 'hurt' ? 1 : 0,
        crush: unit === 'stoneSquad' && motion === 'attack' ? Math.max(0.01, 0.65 - progress * 0.65) : 0
      })) {
        loaded++;
        continue;
      }
      const missing = (UnitArt.status[id] || AnimationArt.status[id]) === 'fallback';
      if (missing) failed++;
      g.fillStyle = '#b1c4a4';
      g.font = '14px Consolas,monospace';
      g.textAlign = 'center';
      g.fillText(missing ? 'Кадры недоступны' : 'Загрузка…', g.canvas.width / 2, g.canvas.height / 2);
      continue;
    }
    loaded++;
    g.fillStyle = '#172d2266';
    g.beginPath();
    g.ellipse(placement.x, placement.y + 5, (wide ? 58 : 24) * placement.scale, 5, 0, 0, Math.PI * 2);
    g.fill();
    drawCharacterPreview(g, art, anchor, placement, reverse);
  }

  const label = loaded === previews.length ? 'Анимации готовы' : failed ? 'Не удалось загрузить ' + failed + ' анимаций' : ('Загружено ' + loaded + ' / ' + previews.length);
  const status = document.getElementById('artStatus');
  if (status && status.textContent !== label) status.textContent = label;
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

function drawMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const g = mapEl.getContext('2d');
  g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  g.fillStyle = '#0a1619';
  g.fillRect(0, 0, 2200, 2200);
  arenas.get(selectedMap).draw(g);
  g.fillStyle = '#00e5ff';
  g.beginPath();
  g.arc(1100, 1100, 26, 0, Math.PI * 2);
  g.fill();
}

window.addEventListener('hashchange', showLocation);
showLocation();
setInterval(drawMap, 500);
