// Leaderboard and «Моя статистика» rows: the field in a stats scope, its title and how the
// value is shown. Records name the hero (and load) that set them; totals do not and are shown
// only in «Моя статистика». A record's `short` name is its leaderboard button; `hint` explains
// how a table ranks, under its caption.
export const statMetrics = [
  {
    field: 'bestTime',
    title: 'Лучшее время',
    short: 'Время',
    kind: 'record',
    format: 'time',
    hero: 'bestTimeHero',
    load: 'bestTimeLoad',
  },
  {
    field: 'bestKills',
    title: 'Убийств за забег',
    short: 'Убийства',
    kind: 'record',
    format: 'count',
    hero: 'bestKillsHero',
    load: 'bestKillsLoad',
  },
  {
    field: 'bestCodes',
    title: 'Кодов за забег',
    short: 'Коды',
    kind: 'record',
    format: 'count',
    hero: 'bestCodesHero',
    load: 'bestCodesLoad',
  },
  // The load is part of the score: victoryFromScore() in src/systems/run-records.js.
  {
    field: 'victoryScore',
    title: 'Быстрая победа',
    short: 'Победа',
    kind: 'record',
    format: 'victory',
    hero: 'victoryHero',
    hint: 'Выше нагрузка — выше место; при равной нагрузке выше тот, кто быстрее.',
  },
  {
    field: 'productionTime',
    title: 'Продакшен',
    short: 'Продакшен',
    kind: 'record',
    format: 'time',
    hero: 'productionHero',
    load: 'productionLoad',
  },
  { field: 'totalKills', title: 'Всего убийств', kind: 'total', format: 'count' },
  { field: 'totalCodes', title: 'Всего кодов', kind: 'total', format: 'count' },
  { field: 'games', title: 'Всего игр', kind: 'total', format: 'count' },
];
