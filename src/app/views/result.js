import { learningSummary } from '../../systems/learning.js';
import { courseOf } from '../../systems/queries/learning.js';
import { heroDefinitions } from '../../../data/characters/heroes.js';
import { weaponDefinitions } from '../../../data/weapons.js';
import { mapDefinitions } from '../../../data/maps/maps.js';
import { seedText } from '../../core/rng.js';
import { nearestGoals, newlyDone } from '../unlocks.js';
import { clock, codes, slotKey } from './format.js';

// The results screen of one ending, built once by finish() and kept in `run.result`.
// `before` holds the records as they were before this ending (for the «record» marks),
// `opened` / `bonus` what a win on the load level gave, `productionBest` the production records.
export function resultView({
  s,
  hero,
  map,
  win,
  opened,
  bonus,
  productionBest,
  before,
  progression,
  upgrades,
}) {
  const endless = !!s.endless;
  return {
    ...resultHeader({ s, map, win, endless, opened, bonus }),
    canContinue: win && !endless && !s.learning,
    learning: learningResult(s, win),
    stats: [
      ...resultStats({ s, endless, productionBest, before }),
      { value: String(s.level), label: 'УРОВЕНЬ' },
      { value: '+' + s.earned, label: 'КОДОВ' },
    ],
    damage: damageReport(s, hero),
    build: upgrades.build(hero, s),
    seed: seedText(s.seed),
    seedNote: seedNotes[mapDefinitions[s.map]?.objective?.type] ?? seedNotes.nodes,
    unlocked: newlyDone(progression, s.doneBefore),
    goals: nearestGoals(progression, 2),
  };
}

// What the same seed repeats, by the map's objective.
const seedNotes = {
  nodes: 'узлы, баги и события повторятся с тем же сидом',
  desks: 'сервисдески и события повторятся с тем же сидом',
  learning: 'лабиринты, терминалы и их стражи повторятся с тем же сидом',
};

const percent = (share) => Math.round(share * 100) + '%';
const attemptText = (n) =>
  n === null
    ? 'не решён'
    : n === 1
      ? 'с 1-й попытки'
      : n === 2
        ? 'со 2-й попытки'
        : `с ${n}-й попытки`;

// The learning run's report card: the grade, the topics and every question asked, grouped by
// topic. A defeat's grade is preliminary: the hall was not passed. Null on other maps.
export function learningResult(s, win) {
  const summary = learningSummary(s);
  if (!summary) return null;
  const course = courseOf(s);
  return {
    grade: summary.grade,
    percent: percent(summary.score),
    preliminary: !win,
    points: summary.points,
    firstCorrect: summary.firstCorrect,
    answered: summary.answered,
    retries: summary.retries,
    reviveUsed: summary.reviveUsed,
    topics: summary.topics.map((t, i) => ({
      name: t.name,
      percent: t.asked ? percent(t.score) : '—',
      mistakes: t.mistakes,
      questions: summary.questions
        .filter((q) => q.topic === i)
        .map((item) => {
          const q = course.questions.find((q) => q.id === item.id);
          const texts = (ids) => ids.map((id) => q.options.find((o) => o.id === id)?.text ?? id);
          return {
            id: item.id,
            text: q.text,
            verdict: attemptText(item.firstCorrectAt),
            attempts: item.attempts,
            percent: percent(item.score),
            firstTry: item.firstCorrectAt === 1,
            revive: item.revive,
            // What to review: the key and its explanation, unless it was right at once.
            correct: item.firstCorrectAt === 1 ? [] : texts(q.correct),
            wrong: texts(item.wrong),
            explanation: item.firstCorrectAt === 1 ? '' : q.explanation,
          };
        }),
    })),
  };
}

function resultHeader({ s, map, win, endless, opened, bonus }) {
  if (s.learning)
    return {
      win,
      tag: win ? courseOf(s).victoryTag : 'УЧЕБНЫЙ ЗАБЕГ ОКОНЧЕН',
      title: win ? `Курс пройден: ${courseOf(s).title}` : 'Практика продолжается',
      text: 'Учебный забег не идёт в рейтинг.',
    };
  const loadText = `НАГРУЗКА ${s.load}` + (s.penza ? ' · ПЕНЗА' : '');
  // A Penza run is 30% faster and stronger: it keeps codes and loads, not records.
  const unrated = s.penza ? ' Пензенский забег не идёт в рейтинг и рекорды.' : '';
  if (endless)
    return {
      win: false,
      tag: `ПРОДАКШЕН · ${loadText}`,
      title: 'Продакшен упал',
      text: 'Победа в забеге уже засчитана.' + unrated,
    };
  return {
    win,
    tag: (win ? map.victoryTag : 'ЗАБЕГ ОКОНЧЕН') + ' · ' + loadText,
    title: win ? 'Забег завершён' : 'Контур перегружен',
    text:
      (win
        ? 'Шлюз ЦРПТ пройден.' +
          (opened ? ` Открыта нагрузка ${s.load + 1}.` : '') +
          (bonus ? ` Бонус нагрузки: +${codes(bonus)}.` : '') +
          ' Можно продолжить в продакшене: сложность растёт каждую минуту.'
        : 'Попробуй другую сборку.') + unrated,
  };
}

function resultStats({ s, endless, productionBest, before }) {
  if (endless)
    return [
      { value: clock(s.t - s.endlessStart), label: 'В ПРОДАКШЕНЕ', best: productionBest.time },
      {
        value: String(s.kills - s.endlessKills),
        label: 'ПОБЕЖДЕНО В ПРОДАКШЕНЕ',
        best: productionBest.kills,
      },
      { value: clock(s.t), label: 'ВСЕГО' },
    ];
  return [
    { value: clock(s.t), label: 'ВРЕМЯ', best: !s.learning && s.t > before.maxTime },
    {
      value: String(s.kills),
      label: 'ПРОТИВНИКОВ ПОБЕЖДЕНО',
      best: !s.learning && s.kills > before.maxKills,
    },
  ];
}

// Damage per source, largest first, with display names.
export function damageReport(s, hero) {
  const total = Object.values(s.damageBy).reduce((sum, n) => sum + n, 0) || 1;
  return Object.entries(s.damageBy)
    .map(([tag, amount]) => ({
      tag,
      name: sourceName(s, hero, tag),
      amount: Math.round(amount),
      share: Math.round((amount / total) * 100),
    }))
    .sort((a, b) => b.amount - a.amount);
}

function sourceName(s, hero, tag) {
  if (tag === 'hero') return heroDefinitions[hero].weapon;
  const ability = s.abilities?.find((a) => a.id === tag);
  if (ability) return `${ability.name} (${slotKey(s.abilities.indexOf(ability))})`;
  const w = s.weapons?.find((item) => item.id === tag);
  const def = weaponDefinitions[tag];
  return def ? (w?.evolved ? def.evolution.name : def.name) : tag;
}
