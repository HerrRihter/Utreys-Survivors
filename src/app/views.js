import {
  abilityDefinitions,
  abilityRank,
  abilityUpgradeMax,
  abilityUpgradeDescriptions,
} from '../../data/characters/abilities.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { arenaDefinitions } from '../world/arenas.js';

// Pure read models for the React screens. Each takes the explicit pieces it reads and
// returns plain data; React renders it, the session's commands change the underlying state.

export function clock(time) {
  const minutes = Math.floor(time / 60),
    seconds = Math.floor(time % 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function unclaimedAchievements(progression, best) {
  const data = progression.data;
  return progression.achievements.filter(
    (a) => a.getProgress(data, best) >= a.target && !progression.isClaimed(a.id),
  ).length;
}

export function menuView({ run, progression }) {
  const unclaimed = unclaimedAchievements(progression, run.best);
  return {
    wallet: 'КОДЫ: ' + progression.codes,
    record: run.best.time
      ? `ЛУЧШЕЕ ВРЕМЯ: ${clock(run.best.time)}`
      : 'Лучшее время появится после первого забега.',
    achievementsLabel: unclaimed > 0 ? `ДОСТИЖЕНИЯ (${unclaimed}!)` : 'ДОСТИЖЕНИЯ',
  };
}

export function heroSelectView({ run, progression, heroes, enemies }) {
  const owned = Object.keys(heroes.defs).filter((id) => progression.owned(id));
  const hero = heroes.defs[run.pendingHero];
  return {
    heroes: owned.map((id) => ({ id, name: heroes.defs[id].name, weapon: heroes.defs[id].weapon })),
    pending: run.pendingHero,
    stats:
      (hero.desc || `Здоровье: ${hero.hp} · Скорость: ${hero.speed}`) +
      '\n' +
      abilityDefinitions[run.pendingHero]
        .map(
          (a, i) => `${i ? 'E' : 'Q'} · ${a.name}: ${a.description} Перезарядка ${a.cooldown} с.`,
        )
        .join('\n'),
    showBaClients: run.pendingHero === 'ba',
    baClients: baClientIds.map((id) => ({ id, name: enemies.units[id].name })),
    baClient: run.baClient,
    maps: Object.entries(arenaDefinitions).map(([id, map]) => ({ id, name: map.name })),
    map: run.selectedMap,
    mapDescription: arenaDefinitions[run.selectedMap].description,
    // A single arena is shown for context but cannot be switched.
    mapLocked: Object.keys(arenaDefinitions).length < 2,
  };
}

/** @typedef {{ id: string, label: string, disabled: boolean }} ShopItem */

export function shopView({ progression, heroes }) {
  const codes = progression.codes;
  const heroCards = Object.entries(heroes.defs).map(([id, hero]) => {
    const owned = progression.owned(id);
    return {
      id,
      name: hero.name,
      desc: hero.desc,
      info: hero.hp + ' HP · скорость ' + hero.speed,
      owned,
      label: owned ? 'Доступен для забега' : 'Купить · ' + progression.prices[id] + ' кодов',
      disabled: owned || codes < progression.prices[id],
    };
  });
  /** @type {{ title: string, items: ShopItem[] }[]} */
  const groups = [];
  for (const [id, u] of Object.entries(progression.upgrades)) {
    const title = u.hero ? 'Личные усиления' : 'Общие усиления';
    if (groups.at(-1)?.title !== title) groups.push({ title, items: [] });
    const level = progression.data.levels[id],
      locked = u.hero && !progression.owned(u.hero);
    groups.at(-1).items.push({
      id,
      label:
        (u.hero ? heroes.defs[u.hero].name + ' · ' : '') +
        `${u.name} ${level}/${u.max} · ${u.desc} · ` +
        (level >= u.max ? 'Максимум' : progression.cost(id) + ' кодов') +
        (locked ? ' · Сначала открой героя' : ''),
      disabled: locked || level >= u.max || codes < progression.cost(id),
    });
  }
  return {
    heroes: heroCards,
    groups,
    wallet:
      `У вас ${codes} кодов · до следующей награды: ${10 - (progression.data.kills % 10)} побед` +
      (progression.persistent ? '' : ' · Не удалось сохранить прогресс. Не закрывай игру.'),
  };
}

/**
 * @typedef {{ id: string, title: string, desc: string, icon: string,
 *   progressText: string, percent: number, reward: number, rewardText: string, codeToken: boolean,
 *   done: boolean, claimed: boolean, order: number, ratio: number }} AchievementCard
 * @returns {{ cards: AchievementCard[], total: number, completed: number, claimed: number, percent: number }}
 */
export function achievementsView({ run, progression }) {
  const data = progression.data;
  const cards = progression.achievements.map((ach) => {
    const progress = ach.getProgress(data, run.best);
    const done = progress >= ach.target,
      claimed = progression.isClaimed(ach.id);
    const time = ach.format === 'time';
    const percent = Math.min(100, Math.floor((progress / ach.target) * 100));
    const codeToken = !ach.rewardType || ach.rewardType === 'codes';
    return {
      id: ach.id,
      title: ach.title,
      desc: ach.desc,
      icon: ach.icon || '🏆',
      progressText: `${time ? clock(progress) : progress} / ${time ? clock(ach.target) : `${ach.target}${ach.unit ? ' ' + ach.unit : ''}`}`,
      percent,
      reward: ach.reward,
      rewardText: codeToken ? `+${ach.reward}` : `+${ach.reward} ${ach.rewardType}`,
      codeToken,
      done,
      claimed,
      order: claimed ? -1 : done ? 2 : 1,
      ratio: progress / ach.target,
    };
  });
  cards.sort((a, b) => (a.order !== b.order ? b.order - a.order : b.ratio - a.ratio));
  const total = cards.length,
    completed = cards.filter((c) => c.done).length;
  return {
    cards,
    total,
    completed,
    claimed: cards.filter((c) => c.claimed).length,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

/** @returns {{ icon: string, name: string, detail: string, desc: string }[]} */
export function levelUpView({ run }) {
  return run.choice.map((u) => ({
    icon: u.icon,
    name: u.name,
    detail:
      u.group + (u.max ? ` · Ранг ${(run.state?.upgradeRanks?.[u.id] || 0) + 1}/${u.max}` : ''),
    desc: u.desc,
  }));
}

const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];

function nodeProgress(s) {
  let next = null,
    nextDistance = Infinity,
    resolved = 0;
  for (const n of s.nodes) {
    if (n.status !== 'guarded') {
      resolved++;
      continue;
    }
    const d = Math.hypot(n.x - s.p.x, n.y - s.p.y);
    if (d < nextDistance) {
      next = n;
      nextDistance = d;
    }
  }
  const arrow =
    next &&
    arrows[(Math.round(Math.atan2(next.y - s.p.y, next.x - s.p.x) / (Math.PI / 4)) + 8) % 8];
  return (
    `Узлы: ${resolved}/${s.nodes.length}` +
    (next
      ? ` · ${next.id} ${arrow} ${Math.round(nextDistance / 10) * 10} px`
      : ' · Шлюз ЦРПТ разблокирован')
  );
}

function abilityButtons(run) {
  const s = run.state;
  return (s.abilities || []).slice(0, 2).map((a, i) => {
    const status = a.left > 0 ? 'Активно' : a.cd > 0 ? Math.ceil(a.cd) + ' с' : 'Готово';
    return {
      label: `${i ? 'E' : 'Q'} · ${a.name} · ${abilityRank(s, a.id)}/${abilityUpgradeMax}\n${
        a.left > 0 ? 'Активно ' + a.left.toFixed(1) + ' с' : status
      }`,
      name: a.name,
      status,
      title: a.description + ' Улучшение: ' + abilityUpgradeDescriptions[a.id],
      disabled: run.mode !== 'play' || a.cd > 0 || a.left > 0,
    };
  });
}

// Everything the in-run overlay shows; refreshed about ten times a second.
export function hudView({ run, progression, heroes, enemies, settings }) {
  const s = run.state;
  if (!s) return null;
  const hero = heroes.defs[run.selected];
  const boss = s.enemies.find((e) => e.boss);
  const ba = s.baSpecialization;
  return {
    heroLabel: hero.name.toUpperCase(),
    healthPct: Math.round((s.p.hp / s.p.max) * 1000) / 10,
    levelText: `УР. ${s.level}  ·  ${Math.ceil(s.p.hp)} / ${s.p.max} HP`,
    xpPct: Math.min(100, (s.xp / s.need) * 100),
    time: clock(s.t),
    kills: `${s.kills} ПОБЕЖДЕНО`,
    weapon:
      hero.weapon +
      ' · ' +
      arenaDefinitions[s.map]?.name +
      (ba ? ` · Клиент: ${enemies.units[ba.client].name} · +${ba.bonus} HP` : ''),
    codes: `КОДЫ: ${progression.codes} (+${s.earned})`,
    progress: nodeProgress(s),
    boss: boss
      ? { name: boss.name || 'ШЛЮЗ ЦРПТ', pct: Math.round((boss.hp / boss.max) * 1000) / 10 }
      : null,
    abilities: abilityButtons(run),
    showAbilities: run.mode === 'play',
    showPause: run.mode !== 'end',
    showHint: settings.hints,
    stick: run.stickView,
  };
}
