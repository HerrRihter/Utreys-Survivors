// Arenas. `nodeZones` are [x, y, width, height] areas where a run may place its objectives
// (one per zone, at least `nodeSpacing` apart). `racks` are [x, y, width, height] obstacles.
// `unlock: 'win'` opens a map after the first victory, `unlock: { winOn: id }` after a victory
// on that map; `unlockHint` says so in the map picker.
// `objective` is what clears the way to the CRPT (default: the five component nodes):
//   { type: 'desks', unit, count }  — `count` structures of `unit` that must be destroyed.
import { learningRooms } from '../learning-rules.js';

export const nodeSpacing = 450;

// The incident shift's floor (data/incident-rules.js): three component rooms above a central
// hall and three below, each with a doorway in the middle of its wall to the hall. `rooms`
// gives each component its room [x, y, width, height] and the spot of its operations panel;
// `lamp` is where the outside receiver's lamp stands; `lanes` are the heights at which the
// feeds' pipes cross the hall, one per feed in the rules' order.
const shiftFloor = (() => {
  const size = 2200,
    wall = 40,
    door = 240,
    top = 680,
    bottom = 1480;
  const edges = [0, 733, 1466, size];
  const centres = [366, 1100, 1833];
  const racks = [];
  for (const y of [top, bottom]) {
    let x = 0;
    for (const c of centres) {
      racks.push([x, y, c - door / 2 - x, wall]);
      x = c + door / 2;
    }
    racks.push([x, y, size - x, wall]);
  }
  for (const x of edges.slice(1, -1)) {
    racks.push([x - wall / 2, 0, wall, top]);
    racks.push([x - wall / 2, bottom + wall, wall, size - bottom - wall]);
  }
  const room = (/** @type {number} */ i, /** @type {boolean} */ up) => {
    const y = up ? 0 : bottom + wall,
      h = up ? top : size - bottom - wall;
    return {
      box: [edges[i], y, edges[i + 1] - edges[i], h],
      panel: { x: centres[i], y: up ? 380 : bottom + wall + 300 },
    };
  };
  return {
    racks,
    rooms: {
      'inport-operation-processor': room(0, true),
      artemis: room(1, true),
      'production-aggreagtion': room(2, true),
      'code-usage-report': room(0, false),
      'logistic-processor': room(1, false),
      'goods-reports': room(2, false),
    },
    lamp: { x: 1500, y: 1060 },
    lanes: [790, 850, 1250, 1310, 1370],
  };
})();

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
    notes:
      'Три сервисдеска выпускают Пепси, и чем дольше они работают, тем больше за раз. Когда все три снесены, приходит ЦРПТ.',
    victoryTag: 'БЭКЛОГ ЗАКРЫТ',
    name: 'Сервисдеск Пепси',
    description: 'Снеси три сервисдеска, пока тикеты Пепси не завалили офис.',
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
  // One map for every course: the course is chosen with the map (data/learning-courses.js)
  // and brings its questions, room names and boss.
  learningCenter: {
    name: 'Учебный центр',
    description:
      'Три случайных лабиринта с терминалами-тестами, затем центральный зал с боссом курса.',
    notes:
      'Выбери курс. Каждый забег — новые лабиринты. В каждом три терминала под охраной багов: победи стража или найди воркэраунд, затем пройди тест. Пройденный тест даёт награду, провал на время закрывает терминал и зовёт врагов. После трёх терминалов открывается дверь дальше. Знания дают вторую жизнь. Учебные забеги не идут в рейтинг.',
    ranked: false,
    // Rooms are generated per run (data/learning-rules.js, src/world/maze.js); no fixed racks.
    objective: { type: 'learning', label: 'Терминал' },
    rooms: learningRooms,
  },
  // The incident escalation mode (docs/INCIDENT-ESCALATION-PLAN.md): a night shift in the
  // component rooms; won by finishing the shift, graded by the escalation.
  opsCenter: {
    name: 'Ситуационный центр',
    description:
      'Ночная смена: шесть комнат производства, сбои, каскад и эскалация по регламенту критических инцидентов.',
    notes:
      'Следи за операциями в комнатах: серые идут, зелёные готовы, красные упали. Заметил сбой — открывай эскалацию на пульте, заполняй карточку, зови людей по матрице и пиши клиенту. Метрики открываются победами над врагами нужного типа. Смена не идёт в рейтинг.',
    victoryTag: 'СМЕНА СДАНА',
    ranked: false,
    objective: { type: 'escalation', label: 'Компонент' },
    racks: shiftFloor.racks,
    nodeZones: [],
    shift: { rooms: shiftFloor.rooms, lamp: shiftFloor.lamp, lanes: shiftFloor.lanes },
  },
};

// Whether a map can be picked with these saved stats.
export function mapUnlocked(map, stats = {}) {
  if (!map?.unlock) return !!map;
  if (map.unlock === 'win') return stats.wins > 0;
  return (stats.mapWins?.[map.unlock.winOn] || 0) > 0;
}
