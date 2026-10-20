// Extra weapons a run can pick up, their level curve and evolutions.
// `base` holds level-1 values; each entry of `levels` describes levels 2..6 and the change it
// makes (fields add to the running values, `damage` is a multiplier step). Evolution needs the
// weapon at level 6 plus the named passive; a bug archive (a node guardian kill) performs it.
// `kind` names the behaviour (src/systems/weapons/, drawn by src/rendering/weapons.js); the
// rest of `evolution` is what the evolved form changes, read by that kind:
//   orbiter    count, rehit (s between hits of one enemy), spinFactor, ring (drawn as a ring)
//   seeker     split { turns, life, damage }: on a hit the shot breaks into shots at these
//              turns, living `life` s with this damage share
//   minefield  countFactor, limitFactor, chain { reach, delay }: a blast sets off mines
//              within `reach` blast radii after `delay` s
//   pulse      aura { every, damage, slow, slowFor }: a standing aura instead of pulses; enemies
//              inside lose `slow` of their speed for `slowFor` s
//   lob        fan { count, speed, life }: straight out in every direction
//   boomerang  persist (`count` stay alive for good), collect { reach }: carry experience
//   zone       radiusFactor, heal (HP/s for the hero inside)
//   beam       directions: [dx, dy] of the lines

export const weaponSlots = 3; // besides the hero's own attack
export const passiveSlots = 4;
export const weaponMaxLevel = 6;

export const weaponDefinitions = {
  orbit: {
    kind: 'orbiter',
    name: 'Орбитальный сканер',
    icon: '◎',
    color: '#4fc3f7',
    desc: 'Сканеры вращаются вокруг героя и бьют всех, кого задевают.',
    base: { damage: 12, count: 2, radius: 72, spin: 3.2, rehit: 0.5, size: 11 },
    levels: [
      { desc: '+1 сканер', count: 1 },
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+20% к радиусу орбиты', radius: 14 },
      { desc: '+1 сканер', count: 1 },
      { desc: '+30% урона, быстрее вращение', damage: 0.3, spin: 0.8 },
    ],
    evolution: {
      passive: 'area',
      name: 'Кольцо валидации',
      desc: '8 сканеров образуют сплошное кольцо и бьют чаще.',
      count: 8,
      rehit: 0.3,
      spinFactor: 1.3,
      ring: true,
    },
  },
  homing: {
    kind: 'seeker',
    name: 'Криптохвост',
    icon: '➶',
    color: '#ffd54f',
    desc: 'Самонаводящийся снаряд летит в ближайшего врага.',
    base: { damage: 22, count: 1, cooldown: 1.4, speed: 330, life: 2.2, size: 7 },
    levels: [
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+1 снаряд', count: 1 },
      { desc: '−15% перезарядки', cooldown: -0.21 },
      { desc: '+1 снаряд', count: 1 },
      { desc: '+35% урона', damage: 0.35 },
    ],
    evolution: {
      passive: 'might',
      name: 'Криптоподпись',
      desc: 'Каждый снаряд при попадании раскалывается на три.',
      split: { turns: [-0.9, 0, 0.9], life: 0.8, damage: 0.5 },
    },
  },
  mine: {
    kind: 'minefield',
    name: 'DataMatrix-мина',
    icon: '▦',
    color: '#ff8a65',
    desc: 'Оставляет мины на месте героя. Мина взрывается, когда рядом враг.',
    base: { damage: 34, count: 1, cooldown: 2.3, radius: 58, limit: 4, life: 12, size: 9 },
    levels: [
      { desc: '+20% радиуса взрыва', radius: 12 },
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+1 мина за раз', count: 1 },
      { desc: '−15% перезарядки', cooldown: -0.35 },
      { desc: '+35% урона, +3 мины на поле', damage: 0.35, limit: 3 },
    ],
    evolution: {
      passive: 'tempo',
      name: 'Минное поле агрегации',
      desc: 'Взрыв поджигает соседние мины: цепные подрывы, вдвое больше мин.',
      countFactor: 2,
      limitFactor: 2,
      chain: { reach: 2, delay: 0.12 },
    },
  },
  ping: {
    kind: 'pulse',
    name: 'Пинг',
    icon: '◉',
    color: '#80deea',
    desc: 'Периодический импульс вокруг героя отбрасывает врагов.',
    base: { damage: 14, cooldown: 2.6, radius: 95, push: 220 },
    levels: [
      { desc: '+20% радиуса', radius: 19 },
      { desc: '+30% урона', damage: 0.3 },
      { desc: '−15% перезарядки', cooldown: -0.39 },
      { desc: '+20% радиуса', radius: 19 },
      { desc: '+40% урона', damage: 0.4 },
    ],
    evolution: {
      passive: 'armor',
      name: 'Firewall',
      desc: 'Постоянная аура: урон каждые 0,35 с и замедление врагов на 35%.',
      aura: { every: 0.35, damage: 0.4, slow: 0.35, slowFor: 0.2 },
    },
  },
  printer: {
    kind: 'lob',
    name: 'Принтер этикеток',
    icon: '⎙',
    color: '#ce93d8',
    desc: 'Бросает этикетки по дуге вверх; они пробивают всех на пути.',
    base: { damage: 28, count: 1, cooldown: 1.7, size: 9 },
    levels: [
      { desc: '+1 этикетка', count: 1 },
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+1 этикетка', count: 1 },
      { desc: '−15% перезарядки', cooldown: -0.25 },
      { desc: '+35% урона, +1 этикетка', damage: 0.35, count: 1 },
    ],
    evolution: {
      passive: 'vitality',
      name: 'Промышленная печать',
      desc: 'Веер из 8 этикеток во все стороны.',
      fan: { count: 8, speed: 380, life: 0.9 },
    },
  },
  retry: {
    kind: 'boomerang',
    name: 'Ретрай',
    icon: '↻',
    color: '#a5d6a7',
    desc: 'Снаряд-бумеранг: бьёт по пути туда и обратно.',
    base: { damage: 20, count: 1, cooldown: 1.9, speed: 430, size: 10 },
    levels: [
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+1 бумеранг', count: 1 },
      { desc: '+20% скорости', speed: 86 },
      { desc: '+30% урона', damage: 0.3 },
      { desc: '+1 бумеранг', count: 1 },
    ],
    evolution: {
      passive: 'magnet',
      name: 'Бесконечный цикл',
      desc: 'Бумеранги не исчезают и собирают опыт по пути.',
      persist: true,
      collect: { reach: 50 },
    },
  },
  cache: {
    kind: 'zone',
    name: 'Горячий кэш',
    icon: '▣',
    color: '#ffab40',
    desc: 'Зона урона на земле рядом с врагами.',
    base: { damage: 9, count: 1, cooldown: 3.2, radius: 52, life: 3, tick: 0.5 },
    levels: [
      { desc: '+20% радиуса', radius: 10 },
      { desc: '+30% урона', damage: 0.3 },
      { desc: '+1 зона', count: 1 },
      { desc: 'Зона держится на 1 с дольше', life: 1 },
      { desc: '+40% урона', damage: 0.4 },
    ],
    evolution: {
      passive: 'recovery',
      name: 'Резервная копия',
      desc: 'Зоны крупнее и лечат героя на 3 HP/с, пока он внутри.',
      radiusFactor: 1.35,
      heal: 3,
    },
  },
  log: {
    kind: 'beam',
    name: 'Лог-поток',
    icon: '≡',
    color: '#90caf9',
    desc: 'Линия урона влево и вправо от героя.',
    base: { damage: 24, cooldown: 1.35, length: 150, width: 28 },
    levels: [
      { desc: '+25% урона', damage: 0.25 },
      { desc: '+20% длины', length: 30 },
      { desc: '−15% перезарядки', cooldown: -0.2 },
      { desc: '+30% урона', damage: 0.3 },
      { desc: '+20% длины и ширины', length: 30, width: 6 },
    ],
    evolution: {
      passive: 'boots',
      name: 'Трассировка стека',
      desc: 'Удар сразу в четыре стороны.',
      directions: [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ],
    },
  },
};

// Final values of a weapon at `level` (1..6).
export function weaponStats(id, level) {
  const def = weaponDefinitions[id];
  const out = { ...def.base };
  let damage = 1;
  for (let i = 0; i < level - 1 && i < def.levels.length; i++) {
    for (const [key, value] of Object.entries(def.levels[i])) {
      if (key === 'desc') continue;
      if (key === 'damage') damage += value;
      else out[key] = (out[key] || 0) + value;
    }
  }
  out.damage = def.base.damage * damage;
  return out;
}

// The hero's own attack levels up the same way (level 1 is the start, 6 evolves it).
export const heroWeaponLevels = [
  { desc: '+15% к темпу атаки', stat: 'punchTempo', value: 0.15 },
  { desc: '+12 к дальности атаки', stat: 'punchReach', value: 12 },
  { desc: '+15% к темпу, +55 к отбрасыванию', stat: 'punchTempo', value: 0.15, force: 55 },
  { desc: '+12 к дальности, +20% урона атаки', stat: 'punchReach', value: 12, power: 0.2 },
  { desc: 'Эволюция атаки героя', evolve: true },
];

// What each hero's evolution changes, read by the hero's attack kind (src/systems/hero-attacks.js)
// and by combat:
//   backSweep     the sector or scan strikes behind the hero as well
//   returnChain   the chain runs back along its targets for this damage share
//   split         { turns, life, damage }: the packet breaks apart at the end of its flight
//   clientDamage  damage gained per kill of the BA client
//   mark          { factor, seconds }: scanned targets take `factor` damage from every source
export const heroEvolutions = {
  utrace: { name: 'Двойная трассировка', desc: 'Второй сектор бьёт за спиной.', backSweep: true },
  traceability: {
    name: 'Обратная цепь',
    desc: 'Цепь возвращается по тем же целям и наносит ещё 60% урона.',
    returnChain: 0.6,
  },
  serialization: {
    name: 'Пакетная фрагментация',
    desc: 'В конце пути пакет распадается на три.',
    split: { turns: [-0.45, 0, 0.45], life: 0.45, damage: 0.6 },
  },
  ba: {
    name: 'Ключевой клиент',
    desc: 'Каждое убийство выбранного клиента ещё и даёт +1% урона до конца забега.',
    clientDamage: 0.01,
  },
  qa: {
    name: 'Баг-репорт',
    desc: 'Отмеченные сканом цели 3 с получают +30% урона от всех источников.',
    mark: { factor: 1.3, seconds: 3 },
  },
};
