// The learning map's quiz rules. A test at a required terminal asks `questions` and passes with
// `passing` right answers; a bonus terminal asks `bonusQuestions` and passes with
// `bonusPassing`. A revival test follows the required terminals' numbers.
export const learningRules = {
  questions: 3,
  passing: 2,
  bonusQuestions: 1,
  bonusPassing: 1,
  points: 10,
  terminalHeal: 0.2,
  bonusHeal: 0.25,
  reviveHealth: 0.5,
  reviveInvulnerability: 3,
  interactionRadius: 110,
  // Grace after moving to the next room, and the delay before its first wave.
  roomEntryInvulnerability: 2,
  roomEntryWave: 2,
};

// Rooms in order. `bounds` = [left, top, right, bottom]; the hero enters at `entry`. A room with
// a `terminal` holds a required test on its `topic` (index in learningCourse.topics) and opens
// `exit` once passed; `bonus` is an optional terminal on the same topic. The last room has the
// `boss` point instead.
export const learningRooms = [
  {
    name: 'Основы',
    topic: 0,
    bounds: [80, 120, 1040, 1040],
    entry: { x: 300, y: 350 },
    terminal: { id: 'lesson-basics', x: 800, y: 760 },
    exit: { x: 910, y: 920 },
  },
  {
    name: 'Резервирование',
    topic: 1,
    bounds: [1160, 120, 2120, 1040],
    entry: { x: 1350, y: 350 },
    terminal: { id: 'lesson-reserve', x: 1850, y: 760 },
    bonus: { id: 'bonus-reserve', label: 'Бонус знаний', x: 1370, y: 820 },
    exit: { x: 1960, y: 920 },
  },
  {
    name: 'Ошибки и исключения',
    topic: 2,
    bounds: [1160, 1160, 2120, 2120],
    entry: { x: 1350, y: 1370 },
    terminal: { id: 'lesson-errors', x: 1850, y: 1840 },
    exit: { x: 1960, y: 2000 },
  },
  {
    name: 'Партионный учёт',
    bounds: [80, 1160, 1040, 2120],
    entry: { x: 300, y: 1390 },
    boss: { x: 720, y: 1800 },
  },
];
