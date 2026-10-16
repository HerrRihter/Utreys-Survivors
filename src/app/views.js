import {
  abilityDefinitions,
  abilityRank,
  abilityUpgradeMax,
  abilityUpgradeDescriptions,
} from '../../data/characters/abilities.js';
import { baClientIds } from '../../data/characters/ba-specialization.js';
import { heroPassives } from '../../data/characters/hero-passives.js';
import { loadLevels, rewardPerLevel } from '../../data/difficulty.js';
import { productionMinutes } from '../systems/difficulty.js';
import { arenaDefinitions } from '../world/arenas.js';
import { defaultBindings, bindingLabels, uiScales } from './run-state.js';
import { nearestGoals, unlockText } from './unlocks.js';

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

export function menuView({ run, progression, heroes, snapshot = null }) {
  const unclaimed = unclaimedAchievements(progression, run.best);
  const hero = snapshot && heroes?.defs[snapshot.hero];
  return {
    resume: hero ? `${hero.name} · ${clock(snapshot.state.t)} · ур. ${snapshot.state.level}` : null,
    wallet: 'КОДЫ: ' + progression.codes,
    record: run.best.time
      ? `ЛУЧШЕЕ ВРЕМЯ: ${clock(run.best.time)}`
      : 'Лучшее время появится после первого забега.',
    achievementsLabel: unclaimed > 0 ? `ДОСТИЖЕНИЯ (${unclaimed}!)` : 'ДОСТИЖЕНИЯ',
    goals: nearestGoals(progression, run.best, 3),
  };
}

export function heroSelectView({ run, progression, heroes, enemies }) {
  const owned = Object.keys(heroes.defs).filter((id) => progression.owned(id));
  const hero = heroes.defs[run.pendingHero],
    passive = heroPassives[run.pendingHero];
  return {
    heroes: owned.map((id) => ({
      id,
      name: heroes.defs[id].name,
      weapon: heroes.defs[id].weapon,
      role: heroPassives[id]?.role || '',
    })),
    pending: run.pendingHero,
    role: passive ? `${passive.role.toUpperCase()} · ${passive.roleDesc}` : '',
    stats:
      (hero.desc || '') +
      ` Здоровье ${hero.hp} · скорость ${hero.speed}.` +
      '\n' +
      abilityDefinitions[run.pendingHero]
        .map(
          (a, i) => `${i ? 'E' : 'Q'} · ${a.name}: ${a.description} Перезарядка ${a.cooldown} с.`,
        )
        .join('\n') +
      (passive ? `\nПассивка · ${passive.name}: ${passive.desc}` : ''),
    ...loadView(run, progression),
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

// Load level picker for the pending hero: open levels, what the chosen one adds, records.
function loadView(run, progression) {
  const hero = run.pendingHero,
    available = progression.loadAvailable(hero),
    cleared = progression.loadCleared(hero),
    load = Math.min(Math.max(1, run.selectedLoad || 1), available),
    record = progression.productionRecord(hero, load);
  return {
    loads: loadLevels.map((entry) => ({
      level: entry.level,
      label: `Нагрузка ${entry.level}` + (entry.level <= cleared ? ' ✓' : ''),
      locked: entry.level > available,
    })),
    load,
    loadDescription:
      loadLevels
        .filter((entry) => entry.level > 1 && entry.level <= load)
        .map((entry) => entry.desc)
        .join(' ') || loadLevels[0].desc,
    loadProgress:
      (cleared ? `Пройдено: нагрузка ${cleared}.` : 'Побед ещё нет.') +
      (load > 1 ? ` Награда в кодах +${Math.round((load - 1) * rewardPerLevel * 100)}%.` : '') +
      (record ? ` Рекорд продакшена: ${clock(record.time)}, ${record.kills} побеждено.` : ''),
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
      info:
        (heroPassives[id] ? heroPassives[id].role + ' · ' : '') +
        hero.hp +
        ' HP · скорость ' +
        hero.speed +
        (heroPassives[id] ? ' · Пассивка: ' + heroPassives[id].name : ''),
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
      lock = progression.upgradeLock(id),
      locked = !!lock;
    groups.at(-1).items.push({
      id,
      label:
        (u.hero ? heroes.defs[u.hero].name + ' · ' : '') +
        `${u.name} ${level}/${u.max} · ${u.desc} · ` +
        (level >= u.max ? 'Максимум' : progression.cost(id) + ' кодов') +
        (lock === 'hero' ? ' · Сначала открой героя' : '') +
        (lock === 'win' ? ' · Откроется после первой победы' : ''),
      disabled: locked || level >= u.max || codes < progression.cost(id),
    });
  }
  const refund = progression.upgradeSpent();
  return {
    heroes: heroCards,
    groups,
    refund,
    refundLabel: refund ? `СБРОСИТЬ УЛУЧШЕНИЯ · +${refund} кодов` : 'Нечего сбрасывать',
    wallet:
      `У вас ${codes} кодов · до следующей награды: ${10 - (progression.data.kills % 10)} побед` +
      (progression.persistent ? '' : ' · Не удалось сохранить прогресс. Не закрывай игру.'),
  };
}

/**
 * @typedef {{ id: string, title: string, desc: string, icon: string,
 *   progressText: string, percent: number, reward: number, unlock: string, rewardText: string,
 *   codeToken: boolean,
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
      unlock: unlockText(ach),
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

/**
 * @typedef {{ icon: string, name: string, group: string, detail: string, desc: string,
 *   isNew: boolean, evolves: boolean, kind: string }} LevelCard
 * @returns {LevelCard[]}
 */
export function levelUpView({ run }) {
  return run.choice.map((u) => ({
    icon: u.icon,
    name: u.name,
    group: u.group || '',
    detail: u.detail || '',
    desc: u.desc,
    isNew: !!u.isNew,
    evolves: !!u.evolves,
    kind: u.kind || 'supply',
  }));
}

// The run's weapons and passives with empty slots, for the HUD and the pause panel.
export function buildView({ run, upgrades }) {
  const s = run.state;
  if (!s) return null;
  const build = upgrades.build(run.selected, s);
  return {
    ...build,
    emptyWeapons: Math.max(0, build.weaponSlots - build.weapons.length),
    emptyPassives: Math.max(0, build.passiveSlots - build.passives.length),
    archives: s.evoTokens || 0,
  };
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

function controlsHint(b = defaultBindings) {
  const k = (action) => keyLabel(b[action]);
  return (
    `${k('up')}${k('left')}${k('down')}${k('right')} / СТРЕЛКИ — ПЕРЕМЕЩЕНИЕ · АТАКА И ОРУЖИЕ — АВТОМАТИЧЕСКИ · ` +
    `${k('abilityQ')} / ${k('abilityE')} — УМЕНИЯ · ESC — ПАУЗА · УЗЛЫ: УБЕЙТЕ БАГА ИЛИ СТОЙТЕ В КРУГЕ 6 С`
  );
}

// Everything the in-run overlay shows; refreshed about ten times a second.
export function hudView({ run, progression, heroes, enemies, settings, upgrades }) {
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
      ` · Нагрузка ${s.load || 1}` +
      (s.endless ? ` · Продакшен ${productionMinutes(s)} мин` : '') +
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
    hint: controlsHint(settings.bindings),
    stick: run.stickView,
    build: upgrades ? buildView({ run, upgrades }) : null,
    tip: run.mode === 'play' && run.tip?.left > 0 ? run.tip.text : '',
  };
}

const keyNames = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'Пробел' };
export const keyLabel = (code) =>
  keyNames[code] ||
  (code || '')
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace(/^Numpad/, 'Num ');

export function settingsView({ run, settings, audio }) {
  return {
    shake: settings.shake,
    hints: settings.hints,
    damageNumbers: settings.damageNumbers,
    uiScale: settings.uiScale,
    scales: uiScales,
    capture: run.capture || null,
    bindings: Object.keys(defaultBindings).map((action) => ({
      action,
      label: bindingLabels[action],
      key: keyLabel(settings.bindings[action]),
    })),
    ...audio.settings,
  };
}

// Counters and key names for the level-up controls.
export function levelControlsView({ run, settings }) {
  const s = run.state;
  if (!s) return null;
  const b = settings.bindings;
  return {
    rerolls: s.rerolls || 0,
    skips: s.skips || 0,
    banishes: s.banishes || 0,
    banishArmed: !!run.banishArmed,
    keys: { reroll: keyLabel(b.reroll), skip: keyLabel(b.skip), banish: keyLabel(b.banish) },
  };
}
