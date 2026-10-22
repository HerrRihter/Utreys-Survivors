// Load levels ("Нагрузка 1–10") and the endless "Продакшен" mode.
// Each level adds its `mod` to all levels below it. Modifier fields (shares, 0.2 = +20%):
//   hp, speed, damage  enemy stats          bossHp      extra boss health
//   batch, cap         wave size and limit  interval    wave interval (negative = more often)
//   heal               healing received     workaround  workaround duration
// A win on level N opens N+1 for that hero; codes from a won run grow by `rewardPerLevel`.
export const maxLoad = 10;
export const rewardPerLevel = 0.12;

export const loadLevels = [
  { level: 1, desc: 'Базовая нагрузка.', mod: {} },
  { level: 2, desc: 'Враги: +20% здоровья.', mod: { hp: 0.2 } },
  { level: 3, desc: 'Враги: +10% скорости.', mod: { speed: 0.1 } },
  { level: 4, desc: 'Пачки врагов на треть больше.', mod: { batch: 0.34, cap: 0.15 } },
  { level: 5, desc: 'Враги бьют на 25% сильнее.', mod: { damage: 0.25 } },
  { level: 6, desc: 'Лечение и регенерация −35%.', mod: { heal: -0.35 } },
  { level: 7, desc: 'Враги: ещё +30% здоровья.', mod: { hp: 0.3 } },
  { level: 8, desc: 'Воркэраунд на узле на 50% дольше.', mod: { workaround: 0.5 } },
  { level: 9, desc: 'Волны на 20% чаще, лимит врагов +25%.', mod: { interval: -0.2, cap: 0.25 } },
  {
    level: 10,
    desc: 'ЦРПТ +50% здоровья, враги ещё +25% урона и +10% скорости.',
    mod: { bossHp: 0.5, damage: 0.25, speed: 0.1 },
  },
];

// Endless mode after the CRPT: every minute adds these shares; every `bossEvery` seconds a
// stronger CRPT arrives (+`bossGrowth` health per previous one).
export const production = {
  perMinute: { hp: 0.15, damage: 0.06, cap: 0.08, speed: 0.02 },
  bossEvery: 300,
  bossGrowth: 0.5,
  bossReward: 25,
};

// The hidden Penza mode as a run modifier: everything is 30% faster and stronger. `hero`
// raises the run's starting stats and healing; `enemy` adds to the load modifiers above.
export const penzaRun = {
  hero: { damage: 0.3, haste: 0.3, speed: 0.3, heal: 0.3 },
  enemy: { damage: 0.3, speed: 0.3 },
};

const zero = () => ({
  hp: 0,
  speed: 0,
  damage: 0,
  bossHp: 0,
  batch: 0,
  cap: 0,
  interval: 0,
  heal: 0,
  workaround: 0,
});

// Summed modifiers of `level` plus `minutes` of production, plus the Penza run's.
export function loadModifiers(level, minutes = 0, penza = false) {
  const out = zero();
  for (const entry of loadLevels)
    if (entry.level <= level)
      for (const [key, value] of Object.entries(entry.mod)) out[key] += value;
  for (const [key, value] of Object.entries(production.perMinute)) out[key] += value * minutes;
  if (penza) for (const [key, value] of Object.entries(penzaRun.enemy)) out[key] += value;
  return out;
}
