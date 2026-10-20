// Arenas. `nodeZones` are [x, y, width, height] areas where a run may place its objectives
// (one per zone, at least `nodeSpacing` apart). `racks` are [x, y, width, height] obstacles.
// `unlock: 'win'` opens a map after the first victory, `unlock: { winOn: id }` after a victory
// on that map; `unlockHint` says so in the map picker.
// `objective` is what clears the way to the CRPT (default: the five component nodes):
//   { type: 'desks', unit, count }  — `count` structures of `unit` that must be destroyed.
import { learningRooms } from '../learning-rules.js';

export const nodeSpacing = 450;

export const mapDefinitions = {
  empty: {
    notes: 'Высоконагруженный контур валидации данных и стресс-тестирования сервисов Utrace.',
    victoryTag: 'ВАЛИДАЦИЯ УСПЕШНА',
    name: 'Дата-центр Utrace',
    description: 'Серверный кластер и контур валидации кодов маркировки.',
    racks: [],
    nodeZones: [
      [300, 350, 300, 300],
      [950, 250, 300, 250],
      [1600, 350, 300, 300],
      [250, 950, 250, 300],
      [1700, 950, 250, 300],
      [300, 1550, 300, 300],
      [950, 1700, 300, 250],
      [1600, 1550, 300, 300],
    ],
  },
  serverRoom: {
    notes: 'Ряды серверных стоек с узкими проходами между ними.',
    victoryTag: 'ЗАЛ СТАБИЛИЗИРОВАН',
    name: 'Серверный зал',
    description: 'Ряды стоек и узкие коридоры: врагов можно разводить по проходам.',
    unlock: 'win',
    unlockHint: 'Серверный зал откроется после первой победы.',
    racks: [
      [300, 260, 520, 70],
      [1380, 260, 520, 70],
      [300, 560, 70, 380],
      [1830, 560, 70, 380],
      [620, 700, 360, 70],
      [1220, 700, 360, 70],
      [620, 1430, 360, 70],
      [1220, 1430, 360, 70],
      [300, 1260, 70, 380],
      [1830, 1260, 70, 380],
      [300, 1870, 520, 70],
      [1380, 1870, 520, 70],
    ],
    nodeZones: [
      [450, 380, 250, 150],
      [980, 330, 240, 220],
      [1500, 380, 250, 150],
      [430, 1000, 200, 200],
      [1570, 1000, 200, 200],
      [450, 1670, 250, 150],
      [980, 1650, 240, 220],
      [1500, 1670, 250, 150],
    ],
  },
  pepsiDesk: {
    notes: 'Офис поддержки Пепси: сервисдески без остановки плодят тикеты.',
    victoryTag: 'БЭКЛОГ ЗАКРЫТ',
    name: 'Сервисдеск Пепси',
    description:
      'Три сервисдеска выпускают Пепси, и чем дольше они работают, тем больше за раз. Снеси все три, чтобы закрыть бэклог, — тогда придёт ЦРПТ.',
    unlock: { winOn: 'serverRoom' },
    unlockHint: 'Сервисдеск Пепси откроется после победы в Серверном зале.',
    // Desks are shown as `label` and their number.
    objective: { type: 'desks', unit: 'pepsi_desk', count: 3, label: 'Сервисдеск' },
    // Office desks: short cover in the middle ring, open lanes between them.
    racks: [
      [700, 640, 220, 50],
      [1280, 640, 220, 50],
      [640, 1040, 50, 120],
      [1510, 1040, 50, 120],
      [700, 1510, 220, 50],
      [1280, 1510, 220, 50],
    ],
    nodeZones: [
      [300, 300, 300, 250],
      [950, 250, 300, 200],
      [1600, 300, 300, 250],
      [250, 950, 200, 300],
      [1750, 950, 200, 300],
      [300, 1650, 300, 250],
      [950, 1750, 300, 200],
      [1600, 1650, 300, 250],
    ],
  },
  learningLab: {
    name: 'Учебный полигон · эксперимент',
    description:
      'Три комнаты с мини-тестами и босс «Партионный учёт». Знания открывают путь и дают вторую жизнь.',
    notes:
      'Комнаты связаны переходами: пройди тест, затем подойди к выходу. Учебные результаты не входят в рейтинг.',
    victoryTag: 'ПАРТИОННЫЙ УЧЁТ ОСВОЕН',
    ranked: false,
    objective: { type: 'learning', count: 3, label: 'Терминал' },
    rooms: learningRooms,
    racks: [
      [40, 80, 2120, 40],
      [40, 2120, 2120, 40],
      [40, 80, 40, 2080],
      [2120, 80, 40, 2080],
      [1040, 80, 120, 2080],
      [40, 1040, 2120, 120],
    ],
    nodeZones: [
      [700, 650, 160, 160],
      [1750, 650, 160, 160],
      [1750, 1730, 160, 160],
    ],
  },
};

// Whether a map can be picked with these saved stats.
export function mapUnlocked(map, stats = {}) {
  if (!map?.unlock) return !!map;
  if (map.unlock === 'win') return stats.wins > 0;
  return (stats.mapWins?.[map.unlock.winOn] || 0) > 0;
}
