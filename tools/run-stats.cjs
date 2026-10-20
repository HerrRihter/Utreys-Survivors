'use strict';
// Balance statistics from exported run journals (settings → «Журнал забегов» → «Экспорт JSON»).
//   node tools/run-stats.cjs runs-1.json [runs-2.json ...] [--json] [--min 10]
// Prints card pick rates, win rates per hero and load level, death causes and damage shares,
// and flags the plan's targets: no card picked above 70% or below 5% of its offers, and win
// rates of heroes on the same load level within 1.5× of each other.
const fs = require('node:fs');
const path = require('node:path');
const { normalizeLogEntry } = require('../src/systems/run-log.js');

const PICK_HIGH = 0.7,
  PICK_LOW = 0.05,
  WIN_SPREAD = 1.5;

// Runs from a file: the export object `{ runs: [...] }` or a bare array. Card ids of older
// journals are read under their current names (src/systems/run-log.js normalizeLogEntry).
function readRuns(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const runs = Array.isArray(data) ? data : data?.runs;
  if (!Array.isArray(runs)) throw new Error(file + ': no runs in this file');
  return runs
    .filter((r) => r && typeof r === 'object' && typeof r.hero === 'string')
    .map(normalizeLogEntry);
}

const round = (n, digits = 1) => Math.round(n * 10 ** digits) / 10 ** digits;

// `min`: offers a card needs before its pick rate is judged.
function computeStats(runs, { min = 10, minRuns = 5 } = {}) {
  // Production endings are logged as separate entries; they count toward production only.
  const base = runs.filter((r) => !r.endless);
  const production = runs.filter((r) => r.endless);

  const cards = new Map();
  const card = (id) => {
    if (!cards.has(id)) cards.set(id, { id, offered: 0, picked: 0, banned: 0 });
    return cards.get(id);
  };
  let offers = 0,
    skips = 0,
    rerolls = 0;
  for (const run of runs)
    for (const offer of run.offers || []) {
      offers++;
      rerolls += offer.rerolls || 0;
      if (offer.action === 'skip') skips++;
      for (const id of offer.cards || []) card(id).offered++;
      if (offer.picked) card(offer.picked).picked++;
      for (const id of offer.banned || []) card(id).banned++;
    }
  const cardRows = [...cards.values()]
    .map((c) => {
      const rate = c.offered ? c.picked / c.offered : 0;
      const judged = c.offered >= min;
      return {
        ...c,
        rate: round(rate * 100),
        flag: !judged ? 'few' : rate > PICK_HIGH ? 'high' : rate < PICK_LOW ? 'low' : '',
      };
    })
    .sort((a, b) => b.rate - a.rate || b.offered - a.offered);

  // Heroes per load level.
  const groups = new Map();
  for (const run of base) {
    const key = `${run.load || 1}|${run.hero}`;
    if (!groups.has(key))
      groups.set(key, { load: run.load || 1, hero: run.hero, runs: 0, wins: 0, time: 0 });
    const g = groups.get(key);
    g.runs++;
    g.wins += run.win ? 1 : 0;
    g.time += run.time || 0;
  }
  const heroRows = [...groups.values()]
    .map((g) => ({
      load: g.load,
      hero: g.hero,
      runs: g.runs,
      wins: g.wins,
      winRate: round((g.wins / g.runs) * 100),
      avgTime: round(g.time / g.runs),
    }))
    .sort((a, b) => a.load - b.load || b.winRate - a.winRate);

  // Win-rate spread per load level among heroes with enough runs.
  const spread = [];
  for (const load of [...new Set(heroRows.map((r) => r.load))]) {
    const rows = heroRows.filter((r) => r.load === load && r.runs >= minRuns);
    if (rows.length < 2) continue;
    const rates = rows.map((r) => r.winRate);
    const best = Math.max(...rates),
      worst = Math.min(...rates);
    const ratio = worst > 0 ? best / worst : best > 0 ? Infinity : 1;
    spread.push({
      load,
      heroes: rows.length,
      best,
      worst,
      ratio: round(ratio, 2),
      flag: ratio > WIN_SPREAD,
    });
  }

  const causes = new Map();
  for (const run of base)
    if (!run.win && run.cause) causes.set(run.cause, (causes.get(run.cause) || 0) + 1);

  const damage = new Map();
  let damageTotal = 0;
  for (const run of runs)
    for (const [tag, n] of Object.entries(run.damage || {})) {
      damage.set(tag, (damage.get(tag) || 0) + n);
      damageTotal += n;
    }

  return {
    runs: runs.length,
    finished: base.length,
    wins: base.filter((r) => r.win).length,
    quits: base.filter((r) => r.cause === 'quit').length,
    production: {
      runs: production.length,
      bestTime: round(Math.max(0, ...production.map((r) => r.productionTime || 0))),
    },
    offers,
    skips,
    rerolls,
    cards: cardRows,
    heroes: heroRows,
    spread,
    causes: [...causes]
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count),
    damage: [...damage]
      .map(([tag, amount]) => ({ tag, share: round((amount / (damageTotal || 1)) * 100) }))
      .sort((a, b) => b.share - a.share),
  };
}

function table(rows, columns) {
  const widths = columns.map(([key, title]) =>
    Math.max(title.length, ...rows.map((r) => String(r[key]).length)),
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  return [
    line(columns.map(([, title]) => title)),
    ...rows.map((r) => line(columns.map(([k]) => r[k]))),
  ].join('\n');
}

function report(stats, min) {
  const flagText = { high: '⚠ > 70%', low: '⚠ < 5%', few: `мало данных (< ${min})`, '': '' };
  const out = [];
  out.push(
    `Забегов: ${stats.runs} (завершённых ${stats.finished}, побед ${stats.wins}, выходов ${stats.quits}); ` +
      `продакшен: ${stats.production.runs}, лучший ${stats.production.bestTime} с`,
  );
  out.push(`Левелапов: ${stats.offers}, пропусков: ${stats.skips}, рероллов: ${stats.rerolls}`);
  out.push('\nКарточки (доля взятий от предложений):');
  out.push(
    table(
      stats.cards.map((c) => ({ ...c, rate: c.rate + '%', flag: flagText[c.flag] })),
      [
        ['id', 'карточка'],
        ['offered', 'предложена'],
        ['picked', 'взята'],
        ['rate', 'доля'],
        ['banned', 'бан'],
        ['flag', ''],
      ],
    ),
  );
  out.push('\nГерои по нагрузке:');
  out.push(
    table(
      stats.heroes.map((h) => ({ ...h, winRate: h.winRate + '%' })),
      [
        ['load', 'нагрузка'],
        ['hero', 'герой'],
        ['runs', 'забеги'],
        ['wins', 'победы'],
        ['winRate', 'доля'],
        ['avgTime', 'ср. время, с'],
      ],
    ),
  );
  if (stats.spread.length) {
    out.push('\nРазброс доли побед между героями (цель — не больше 1,5×):');
    for (const s of stats.spread)
      out.push(
        `  нагрузка ${s.load}: ${s.best}% / ${s.worst}% = ${s.ratio}×${s.flag ? '  ⚠' : ''}`,
      );
  }
  if (stats.causes.length) {
    out.push('\nПричины поражений:');
    for (const c of stats.causes.slice(0, 10)) out.push(`  ${c.cause}: ${c.count}`);
  }
  if (stats.damage.length) {
    out.push('\nДоля урона по источникам:');
    for (const d of stats.damage.slice(0, 12)) out.push(`  ${d.tag}: ${d.share}%`);
  }
  return out.join('\n');
}

function main(argv) {
  const files = [],
    options = { json: false, min: 10 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') options.json = true;
    else if (argv[i] === '--min') options.min = Number(argv[++i]) || 10;
    else files.push(argv[i]);
  }
  if (!files.length) {
    console.error(
      'Использование: node tools/run-stats.cjs runs.json [ещё.json] [--json] [--min 10]',
    );
    return 1;
  }
  const runs = files.flatMap((file) => readRuns(path.resolve(file)));
  const stats = computeStats(runs, { min: options.min });
  console.log(options.json ? JSON.stringify(stats, null, 2) : report(stats, options.min));
  return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { computeStats, readRuns, report };
