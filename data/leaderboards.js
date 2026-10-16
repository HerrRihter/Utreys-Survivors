// Leaderboard and «Моя статистика» rows: the field in a stats scope, its title and how the
// value is shown. Records name the hero (and load) that set them; totals do not.
export const statMetrics = [
  {
    field: 'bestTime',
    title: 'Лучшее время',
    kind: 'record',
    format: 'time',
    hero: 'bestTimeHero',
    load: 'bestTimeLoad',
  },
  {
    field: 'bestKills',
    title: 'Убийств за забег',
    kind: 'record',
    format: 'count',
    hero: 'bestKillsHero',
    load: 'bestKillsLoad',
  },
  {
    field: 'bestCodes',
    title: 'Кодов за забег',
    kind: 'record',
    format: 'count',
    hero: 'bestCodesHero',
    load: 'bestCodesLoad',
  },
  // The load is part of the score: victoryFromScore() in src/systems/run-records.js.
  {
    field: 'victoryScore',
    title: 'Победа',
    kind: 'record',
    format: 'victory',
    hero: 'victoryHero',
  },
  {
    field: 'productionTime',
    title: 'Продакшен',
    kind: 'record',
    format: 'time',
    hero: 'productionHero',
    load: 'productionLoad',
  },
  { field: 'totalKills', title: 'Всего убийств', kind: 'total', format: 'count' },
  { field: 'totalCodes', title: 'Всего кодов', kind: 'total', format: 'count' },
  { field: 'games', title: 'Всего игр', kind: 'total', format: 'count' },
];
