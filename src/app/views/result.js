import { heroDefinitions } from '../../../data/characters/heroes.js';
import { weaponDefinitions } from '../../../data/weapons.js';
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
    canContinue: win && !endless,
    stats: [
      ...resultStats({ s, endless, productionBest, before }),
      { value: String(s.level), label: 'УРОВЕНЬ' },
      { value: '+' + s.earned, label: 'КОДОВ' },
    ],
    damage: damageReport(s, hero),
    build: upgrades.build(hero, s),
    seed: seedText(s.seed),
    unlocked: newlyDone(progression, s.doneBefore),
    goals: nearestGoals(progression, 2),
  };
}

function resultHeader({ s, map, win, endless, opened, bonus }) {
  const loadText = `НАГРУЗКА ${s.load}`;
  if (endless)
    return {
      win: false,
      tag: `ПРОДАКШЕН · ${loadText}`,
      title: 'Продакшен упал',
      text: 'Забег уже засчитан как победа. Рекорд продакшена хранится по герою и нагрузке.',
    };
  return {
    win,
    tag: (win ? map.victoryTag : 'ЗАБЕГ ОКОНЧЕН') + ' · ' + loadText,
    title: win ? 'Забег завершён' : 'Контур перегружен',
    text: win
      ? 'Шлюз ЦРПТ пройден.' +
        (opened ? ` Открыта нагрузка ${s.load + 1}.` : '') +
        (bonus ? ` Бонус нагрузки: +${codes(bonus)}.` : '') +
        ' Можно продолжить в продакшене: сложность растёт каждую минуту.'
      : 'Попробуй другую сборку: другое оружие и пассивки меняют забег.',
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
    { value: clock(s.t), label: 'ВРЕМЯ', best: s.t > before.maxTime },
    { value: String(s.kills), label: 'ПРОТИВНИКОВ ПОБЕЖДЕНО', best: s.kills > before.maxKills },
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
