// The learning map's quiz rules. A terminal's test asks `questions` and passes with `passing`
// right answers; the revival test is the same. A passed terminal drops the map pickups of the
// first `terminalRewards` entry its right answers reach; every wrong answer calls an audit:
// `auditPack` enemies of the current waves arrive `auditDistance` away, at most `auditMax`
// packs per test. A failed terminal stays shut for `failLock` s and the waves swell by `surge`.
export const learningRules = {
  questions: 3,
  passing: 2,
  points: 10,
  terminalRewards: [
    { correct: 3, pickups: ['bundle', 'food'] },
    { correct: 2, pickups: ['food'] },
  ],
  auditPack: 6,
  auditMax: 2,
  auditDistance: [320, 620],
  failLock: 10,
  surge: { seconds: 20, batch: 1.5, cap: 1.5 },
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

// The run's grade: a question scores `attemptScore[n - 1]` when first answered right on its
// n-th attempt (the last entry for later ones), 0 when never; the grade is the first entry of
// `grades` whose `min` the average share reaches.
export const learningGrading = {
  attemptScore: [1, 0.6, 0.3],
  grades: [
    { min: 0.9, name: 'Отлично' },
    { min: 0.75, name: 'Хорошо' },
    { min: 0.6, name: 'Удовлетворительно' },
    { min: 0, name: 'Не сдано' },
  ],
};

// Every maze: `cols` × `rows` cells over the whole arena, walls `wall` px thick, `braid` the
// share of dead ends opened into loops, `terminals` guarded terminals to find.
export const learningMaze = { cols: 10, rows: 10, wall: 36, braid: 0.15, terminals: 3 };

// Rooms in order; each one fills the arena, the next replaces it. A `maze` room is generated
// from the run's seed: its terminals test the `topic` (index in the course's topics) and its
// door opens once all are passed; its name comes from the course (`rooms`). `strength` scales
// its enemies' health and damage, `waves` its wave size (`batch`) and limit (`cap`); the whole
// roster comes in every room. The last room is the central hall: `racks` as cover, the hero at
// `entry`, the course's boss at `boss`. Every course has the same plan: three mazes, one per
// topic, then the hall.
const ramp = [
  { strength: 1, waves: { batch: 1, cap: 1 } },
  { strength: 1.3, waves: { batch: 1.25, cap: 1.3 } },
  { strength: 1.6, waves: { batch: 1.5, cap: 1.6 } },
];
const hall = {
  name: 'Центральный зал',
  entry: { x: 1100, y: 1900 },
  boss: { x: 1100, y: 900 },
  racks: [
    [560, 560, 120, 120],
    [1520, 560, 120, 120],
    [560, 1300, 120, 120],
    [1520, 1300, 120, 120],
  ],
};
export const learningRooms = [...ramp.map((r, topic) => ({ topic, maze: true, ...r })), hall];
