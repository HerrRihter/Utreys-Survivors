import {
  abilityDefinitions,
  abilityUpgradeDescriptions,
  abilityUpgradeMax,
  abilityUpgradeId,
} from '../../data/characters/abilities.js';
import { permanentUpgradeDefinitions, heroTrainingDefinitions } from '../../data/upgrades.js';
import { heroPassives } from '../../data/characters/hero-passives.js';
import {
  weaponDefinitions,
  weaponSlots,
  passiveSlots,
  weaponMaxLevel,
  heroWeaponLevels,
  heroEvolutions,
} from '../../data/weapons.js';

// Level-up choices. A run owns the hero's attack plus up to `weaponSlots` extra weapons (more
// with the `weaponSlots` stat) and `passiveSlots` passives; once the slots are full only owned
// items keep levelling.
export const UpgradeSystem = {
  create(Progression) {
    const add = (key, value) => (s) => (s.stats[key] = (s.stats[key] || 0) + value);
    const passive = (id, name, desc, key, value, max = 5) => ({
      id,
      name,
      desc,
      icon: '✦',
      max,
      kind: 'passive',
      apply: add(key, value),
    });
    const common = [
      passive('might', 'Сила атаки', '+15% к базовому урону всех атак.', 'damage', 0.15),
      passive('tempo', 'Второе дыхание', '+12% к темпу атак и перезарядке оружия.', 'haste', 0.12),
      passive('area', 'Широкий размах', '+12% к размеру оружия и областей урона.', 'range', 0.12),
      passive('boots', 'Лёгкий шаг', '+8% к скорости передвижения.', 'speed', 0.08),
      {
        id: 'vitality',
        name: 'Запас здоровья',
        desc: '+20 к максимуму здоровья и восстановление 30 HP.',
        icon: '♥',
        max: 5,
        kind: 'passive',
        apply: (s) => {
          s.p.max += 20;
          s.p.hp = Math.min(s.p.max, s.p.hp + 30);
        },
      },
      passive('recovery', 'Восстановление', 'Ещё 0,5 HP в секунду.', 'regen', 0.5),
      passive('armor', 'Защита', 'На 1 меньше урона от каждого попадания; минимум 1.', 'armor', 1),
      passive(
        'magnet',
        'Притяжение предметов',
        '+30 к радиусу притяжения кодов и опыта.',
        'magnet',
        30,
      ),
    ];
    const passiveName = Object.fromEntries(common.map((u) => [u.id, u.name]));

    // The hero's own attack: one item, five ranks (levels 2..6), the last one evolves it.
    const heroes = Object.fromEntries(
      Object.keys(abilityDefinitions).map((hero) => [
        hero,
        [
          {
            id: 'heroWeapon',
            name: 'Атака героя',
            desc: '',
            icon: '⚔',
            max: heroWeaponLevels.length,
            kind: 'hero',
            apply: (s) => {
              const step = heroWeaponLevels[s.upgradeRanks?.heroWeapon || 0];
              if (step.stat) add(step.stat, step.value)(s);
              if (step.force) add('punchForce', step.force)(s);
              if (step.power) add('heroPower', step.power)(s);
              if (step.evolve) s.stats.heroEvo = true;
            },
          },
        ],
      ]),
    );

    const weapons = Object.entries(weaponDefinitions).map(([id, def]) => ({
      id: 'w_' + id,
      weapon: id,
      name: def.name,
      desc: def.desc,
      icon: def.icon,
      max: weaponMaxLevel,
      kind: 'weapon',
      available: () => Progression.weaponUnlocked?.(id) ?? true,
      apply: (s) => {
        s.weapons ??= [];
        const owned = s.weapons.find((w) => w.id === id);
        if (owned) owned.level++;
        else s.weapons.push({ id, level: 1, cd: 0.5, evolved: false, phase: 0 });
      },
    }));

    const abilities = Object.fromEntries(
      Object.entries(abilityDefinitions).map(([hero, defs]) => [
        hero,
        defs.map((a) => ({
          id: abilityUpgradeId(a.id),
          ability: a.id,
          name: a.name,
          desc: abilityUpgradeDescriptions[a.id],
          icon: '◆',
          max: abilityUpgradeMax,
          kind: 'ability',
          apply: () => {},
        })),
      ]),
    );
    const fallback = [
      {
        id: 'herbs',
        name: 'Восстановление',
        desc: '+0,1 HP регенерации в секунду.',
        icon: '♥',
        apply: add('regen', 0.1),
      },
      {
        id: 'food',
        name: 'Передышка',
        desc: 'Восстановить всё здоровье.',
        icon: '♥',
        apply: (s) => (s.p.hp = s.p.max),
      },
      {
        id: 'loot',
        name: 'Бонусные коды',
        desc: 'Получить 3 кода маркировки.',
        icon: '◈',
        apply: (s) => {
          Progression.earn(3);
          s.earned += 3;
        },
      },
      {
        id: 'reserve',
        name: 'Запас сил',
        desc: '+5 к максимуму и текущему здоровью.',
        icon: '♥',
        apply: (s) => {
          s.p.max += 5;
          s.p.hp += 5;
        },
      },
    ];

    const rank = (s, u) =>
      u.kind === 'weapon'
        ? s.weapons?.find((w) => w.id === u.weapon)?.level || 0
        : s.upgradeRanks?.[u.id] || 0;
    const ownedWeapons = (s) => s.weapons?.length || 0;
    const extraSlots = (s) => weaponSlots + (s.stats?.weaponSlots || 0);
    const ownedPassives = (s) => common.filter((u) => (s.upgradeRanks?.[u.id] || 0) > 0).length;

    // What a card says about itself: group, rank change, what the next rank does.
    function describe(u, s, hero) {
      const r = rank(s, u);
      if (u.kind === 'hero') {
        const step = heroWeaponLevels[r];
        return {
          ...u,
          name: s.heroWeaponName || u.name,
          group: 'Оружие героя',
          detail: `Ур. ${r + 1} → ${r + 2}`,
          desc: step.evolve
            ? `Эволюция: ${heroEvolutions[hero]?.name}. ${heroEvolutions[hero]?.desc}`
            : step.desc,
          isNew: false,
          evolves: !!step.evolve,
        };
      }
      if (u.kind === 'weapon') {
        const def = weaponDefinitions[u.weapon];
        const pair = `Эволюция: ${def.evolution.name} (+ ${passiveName[def.evolution.passive]})`;
        return {
          ...u,
          group: r ? 'Оружие' : 'Новое оружие',
          detail: r ? `Ур. ${r} → ${r + 1}` : 'Новое',
          desc:
            (r ? def.levels[r - 1].desc : def.desc) +
            (r + 1 === weaponMaxLevel ? ' · ' + pair : ''),
          hint: pair,
          isNew: !r,
        };
      }
      if (u.kind === 'passive')
        return {
          ...u,
          group: r ? 'Пассивка' : 'Новая пассивка',
          detail: r ? `Ранг ${r} → ${r + 1} из ${u.max}` : 'Новое',
          isNew: !r,
        };
      return {
        ...u,
        group: 'Активное умение',
        detail: `Ранг ${r} → ${r + 1} из ${u.max}`,
        isNew: !r,
      };
    }

    function pool(hero, s) {
      const banned = s.banned || [];
      const weaponRoom = ownedWeapons(s) < extraSlots(s),
        passiveRoom = ownedPassives(s) < passiveSlots;
      return [
        ...(heroes[hero] || []),
        ...weapons.filter((u) => rank(s, u) > 0 || weaponRoom),
        ...common.filter((u) => rank(s, u) > 0 || passiveRoom),
        ...(abilities[hero] || []),
      ]
        .filter((u) => rank(s, u) < u.max && (!u.available || u.available(s)))
        .filter((u) => !banned.includes(u.id))
        .map((u) => describe(u, s, hero));
    }
    // Four cards; one of them is always a weapon (the hero's or an extra) while any remains.
    function offer(hero, s, random = Math.random) {
      const all = pool(hero, s),
        armed = all.filter((u) => u.kind === 'weapon' || u.kind === 'hero'),
        result = [];
      if (armed.length) result.push(armed[Math.floor(random() * armed.length)]);
      const rest = all.filter((u) => !result.includes(u));
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      result.push(...rest.slice(0, 4 - result.length));
      for (const u of fallback) {
        if (result.length === 4) break;
        result.push({ ...u, group: 'Припасы', detail: '', isNew: false });
      }
      return result;
    }
    function apply(u, s) {
      if (u.available && !u.available(s)) return false;
      s.upgradeRanks ??= {};
      if (u.max && rank(s, u) >= u.max) return false;
      u.apply(s);
      if (u.max && u.kind !== 'weapon') s.upgradeRanks[u.id] = (s.upgradeRanks[u.id] || 0) + 1;
      return true;
    }
    function permanent(s, hero, levels) {
      for (const key of ['haste', 'range', 'magnet', 'armor', 'regen']) {
        const factor = permanentUpgradeDefinitions[key]?.factor;
        if (factor !== undefined) s.stats[key] += (levels[key] || 0) * factor;
      }
      // The hero's innate passive, then its training on top.
      for (const [key, value] of Object.entries(heroPassives[hero]?.stats || {}))
        add(key, value)(s);
      const training = heroTrainingDefinitions[hero];
      if (training) add(training.stat, training.factor * (levels['training_' + hero] || 0))(s);
    }
    // The run's build for HUD, pause and result screens.
    function build(hero, s) {
      const heroRank = s.upgradeRanks?.heroWeapon || 0;
      return {
        weapons: [
          {
            id: 'hero',
            icon: '⚔',
            name: s.heroWeaponName || 'Атака героя',
            level: heroRank + 1,
            max: heroWeaponLevels.length + 1,
            evolved: !!s.stats.heroEvo,
            evolution: heroEvolutions[hero]?.name,
          },
          ...(s.weapons || []).map((w) => {
            const def = weaponDefinitions[w.id];
            return {
              id: w.id,
              icon: def.icon,
              name: w.evolved ? def.evolution.name : def.name,
              level: w.level,
              max: weaponMaxLevel,
              evolved: w.evolved,
              evolution: def.evolution.name,
              needs: passiveName[def.evolution.passive],
            };
          }),
        ],
        passives: common
          .filter((u) => (s.upgradeRanks?.[u.id] || 0) > 0)
          .map((u) => ({
            id: u.id,
            icon: u.icon,
            name: u.name,
            level: s.upgradeRanks[u.id],
            max: u.max,
          })),
        weaponSlots: extraSlots(s) + 1,
        passiveSlots,
      };
    }
    return { common, heroes, weapons, abilities, pool, offer, apply, permanent, build, describe };
  },
};
