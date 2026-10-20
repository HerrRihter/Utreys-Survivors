export const learningRules = {
  questions: 3,
  passing: 2,
  points: 10,
  terminalHeal: 0.2,
  bonusHeal: 0.25,
  reviveHealth: 0.5,
  reviveInvulnerability: 3,
  interactionRadius: 110,
};

export const learningRooms = [
  {
    name: 'Основы',
    bounds: [80, 120, 1040, 1040],
    entry: { x: 300, y: 350 },
    terminal: { x: 800, y: 760 },
    exit: { x: 910, y: 920 },
  },
  {
    name: 'Резервирование',
    bounds: [1160, 120, 2120, 1040],
    entry: { x: 1350, y: 350 },
    terminal: { x: 1850, y: 760 },
    exit: { x: 1960, y: 920 },
  },
  {
    name: 'Ошибки и исключения',
    bounds: [1160, 1160, 2120, 2120],
    entry: { x: 1350, y: 1370 },
    terminal: { x: 1850, y: 1840 },
    exit: { x: 1960, y: 2000 },
  },
  {
    name: 'Партионный учёт',
    bounds: [80, 1160, 1040, 2120],
    entry: { x: 300, y: 1390 },
    boss: { x: 720, y: 1800 },
  },
];
