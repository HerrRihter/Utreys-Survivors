// The learning map's quiz rules. A terminal's test asks `questions` and passes with `passing`
// right answers; the revival test is the same. A passed terminal drops an update bundle
// (`terminalReward`, a map pickup type); every wrong answer calls an audit: `auditPack`
// enemies of the current waves arrive `auditDistance` away, at most `auditMax` packs per test.
export const learningRules = {
  questions: 3,
  passing: 2,
  points: 10,
  terminalReward: 'bundle',
  auditPack: 3,
  auditMax: 2,
  auditDistance: [320, 620],
  reviveHealth: 0.5,
  reviveInvulnerability: 3,
  interactionRadius: 110,
  // Grace after moving to the next room, and the delay before its first wave.
  roomEntryInvulnerability: 2,
  roomEntryWave: 2,
  // Ordinary waves arrive this far (straight line) from the hero in a maze: out of sight,
  // close enough to find their way to the hero through the corridors.
  waveDistance: [420, 900],
};

// Every maze: `cols` × `rows` cells over the whole arena, walls `wall` px thick, `braid` the
// share of dead ends opened into loops, `terminals` guarded terminals to find.
export const learningMaze = { cols: 10, rows: 10, wall: 36, braid: 0.15, terminals: 3 };

// Rooms in order; each one fills the arena, the next replaces it. A `maze` room is generated
// from the run's seed: its terminals test the `topic` (index in learningCourse.topics) and
// its door opens once all are passed. `strength` scales its enemies' health and damage,
// `waves` its wave size (`batch`) and limit (`cap`); the whole roster comes in every room.
// The last room is the central hall: `racks` as cover, the hero at `entry`, the boss at `boss`.
export const learningRooms = [
  { name: 'Лабиринт основ', topic: 0, maze: true, strength: 1, waves: { batch: 1, cap: 1 } },
  {
    name: 'Лабиринт резервирования',
    topic: 1,
    maze: true,
    strength: 1.3,
    waves: { batch: 1.25, cap: 1.3 },
  },
  {
    name: 'Лабиринт ошибок',
    topic: 2,
    maze: true,
    strength: 1.6,
    waves: { batch: 1.5, cap: 1.6 },
  },
  {
    name: 'Центральный зал',
    entry: { x: 1100, y: 1900 },
    boss: { x: 1100, y: 900 },
    racks: [
      [560, 560, 120, 120],
      [1520, 560, 120, 120],
      [560, 1300, 120, 120],
      [1520, 1300, 120, 120],
    ],
  },
];
