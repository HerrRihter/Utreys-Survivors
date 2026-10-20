import {
  abilityDefinitions,
  abilityUpgradeDescriptions,
  abilityUpgradeMax,
  abilityUpgradeId,
} from '../../data/characters/abilities.js';
import {
  weaponDefinitions,
  weaponSlots,
  passiveSlots,
  weaponMaxLevel,
  heroWeaponLevels,
  heroEvolutions,
} from '../../data/weapons.js';
import {
  levelUpPassives,
  passiveIcon,
  passiveMaxRank,
  supplyCards,
  cardTexts,
} from '../../data/upgrades.js';

// A card text with its `{name}` placeholders filled in.
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => values[key]);

// Level-up choices. A run owns the hero's attack plus up to `weaponSlots` extra weapons (more
// with the `weaponSlots` stat) and `passiveSlots` passives; once the slots are full only owned
// items keep levelling.
export const UpgradeSystem = {
  create({ wallet, achievements }) {
    const add = (key, value) => (s) => (s.stats[key] = (s.stats[key] || 0) + value);
    // One rank of a card's `effect` (data/upgrades.js).
    function applyEffect(s, effect) {
      if (effect.stat) add(effect.stat, effect.value)(s);
      if (effect.maxHp) s.p.max += effect.maxHp;
      if (effect.hp) s.p.hp += effect.hp;
      if (effect.heal) s.p.hp = Math.min(s.p.max, s.p.hp + effect.heal);
      if (effect.fullHeal) s.p.hp = s.p.max;
      if (effect.codes) {
        wallet.earn(effect.codes);
        s.earned += effect.codes;
      }
    }
    const common = levelUpPassives.map((u) => ({
      id: u.id,
      name: u.name,
      desc: u.desc,
      icon: u.icon || passiveIcon,
      max: passiveMaxRank,
      kind: 'passive',
      apply: (s) => applyEffect(s, u.effect),
    }));
    const passiveName = Object.fromEntries(common.map((u) => [u.id, u.name]));

    // The hero's own attack: one item, five ranks (levels 2..6), the last one evolves it.
    const heroes = Object.fromEntries(
      Object.keys(abilityDefinitions).map((hero) => [
        hero,
        [
          {
            id: 'heroWeapon',
            name: cardTexts.heroWeapon.name,
            desc: '',
            icon: cardTexts.heroWeapon.icon,
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
      available: () => achievements.weaponUnlocked(id),
      apply: (s) => {
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
          icon: cardTexts.abilityIcon,
          max: abilityUpgradeMax,
          kind: 'ability',
          apply: () => {},
        })),
      ]),
    );
    const fallback = supplyCards.map((u) => ({
      id: u.id,
      name: u.name,
      desc: u.desc,
      icon: u.icon,
      apply: (s) => applyEffect(s, u.effect),
    }));

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
          group: cardTexts.groups.hero,
          detail: fill(cardTexts.level, { from: r + 1, to: r + 2 }),
          desc: step.evolve
            ? fill(cardTexts.heroEvolution, {
                name: heroEvolutions[hero]?.name,
                desc: heroEvolutions[hero]?.desc,
              })
            : step.desc,
          isNew: false,
          evolves: !!step.evolve,
        };
      }
      if (u.kind === 'weapon') {
        const def = weaponDefinitions[u.weapon];
        const pair = fill(cardTexts.weaponEvolution, {
          name: def.evolution.name,
          passive: passiveName[def.evolution.passive],
        });
        return {
          ...u,
          group: r ? cardTexts.groups.weapon : cardTexts.groups.newWeapon,
          detail: r ? fill(cardTexts.level, { from: r, to: r + 1 }) : cardTexts.isNew,
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
          group: r ? cardTexts.groups.passive : cardTexts.groups.newPassive,
          detail: r ? fill(cardTexts.rank, { from: r, to: r + 1, max: u.max }) : cardTexts.isNew,
          isNew: !r,
        };
      return {
        ...u,
        group: cardTexts.groups.ability,
        detail: fill(cardTexts.rank, { from: r, to: r + 1, max: u.max }),
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
    function offer(hero, s, random = s.rng.random) {
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
        result.push(supply(u));
      }
      return result;
    }
    const supply = (u) => ({ ...u, group: cardTexts.groups.supply, detail: '', isNew: false });
    // The cards of a saved offer, by id; null when one of them can no longer be offered.
    function cards(hero, s, ids) {
      const all = [...pool(hero, s), ...fallback.map(supply)];
      const out = ids.map((id) => all.find((u) => u.id === id));
      return out.length && out.every(Boolean) ? out : null;
    }
    function apply(u, s) {
      if (u.available && !u.available(s)) return false;
      if (u.max && rank(s, u) >= u.max) return false;
      u.apply(s);
      if (u.max && u.kind !== 'weapon') s.upgradeRanks[u.id] = (s.upgradeRanks[u.id] || 0) + 1;
      return true;
    }
    // The run's build for HUD, pause and result screens.
    // Everything build() reads, as a string: equal keys give equal builds.
    function buildKey(hero, s) {
      let key =
        hero +
        '|' +
        (s.upgradeRanks?.heroWeapon || 0) +
        '|' +
        (s.heroWeaponName || '') +
        '|' +
        (s.stats.heroEvo ? 1 : 0) +
        '|' +
        extraSlots(s);
      for (const w of s.weapons || []) key += '|' + w.id + ':' + w.level + (w.evolved ? '*' : '');
      for (const u of common)
        if (s.upgradeRanks?.[u.id]) key += '|' + u.id + ':' + s.upgradeRanks[u.id];
      return key;
    }
    function build(hero, s) {
      const heroRank = s.upgradeRanks?.heroWeapon || 0;
      return {
        weapons: [
          {
            id: 'hero',
            icon: cardTexts.heroWeapon.icon,
            name: s.heroWeaponName || cardTexts.heroWeapon.name,
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
    return {
      common,
      heroes,
      weapons,
      abilities,
      pool,
      offer,
      cards,
      apply,
      build,
      buildKey,
      describe,
    };
  },
};
