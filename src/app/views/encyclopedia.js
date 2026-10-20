import { abilityDefinitions } from '../../../data/characters/abilities.js';
import { heroPassives } from '../../../data/characters/hero-passives.js';
import { slotKey } from './format.js';
import { heroDefinitions } from '../../../data/characters/heroes.js';
import { weaponDefinitions, weaponMaxLevel, heroEvolutions } from '../../../data/weapons.js';

/**
 * @typedef {{ id: string, icon: string, name: string, desc: string, locked: boolean,
 *   condition: string, evolution: { name: string, desc: string, recipe: string,
 *   discovered: boolean } | null }} EncyclopediaEntry
 * @returns {{ weapons: EncyclopediaEntry[], passives: EncyclopediaEntry[],
 *   heroes: EncyclopediaEntry[], found: number, total: number }}
 */
// Weapons, passives and evolutions. Locked weapons show their condition; an evolution shows
// its recipe until the player assembles it once, then its name and effect.
export function encyclopediaView({ progression, upgrades }) {
  const passiveName = Object.fromEntries(upgrades.common.map((u) => [u.id, u.name]));
  const evolution = (id, evo, recipe) => {
    const discovered = progression.records.evolutionSeen(id);
    return {
      name: discovered ? evo.name : '???',
      desc: discovered ? evo.desc : 'Собери эволюцию, чтобы узнать её эффект.',
      recipe,
      discovered,
    };
  };
  const weapons = Object.entries(weaponDefinitions).map(([id, def]) => {
    const locked = !progression.achievements.weaponUnlocked(id);
    const gate = progression.achievements.list.find((a) => a.unlocks?.weapon === id);
    return {
      id,
      icon: def.icon,
      name: locked ? '???' : def.name,
      desc: locked ? 'Оружие ещё не открыто.' : def.desc,
      locked,
      condition: locked && gate ? `${gate.title}: ${gate.desc}` : '',
      evolution: evolution(
        id,
        def.evolution,
        `ур. ${weaponMaxLevel} + ${passiveName[def.evolution.passive]} + архив бага`,
      ),
    };
  });
  const passives = upgrades.common.map((u) => {
    const pairs = Object.values(weaponDefinitions).filter((d) => d.evolution.passive === u.id);
    return {
      id: u.id,
      icon: u.icon,
      name: u.name,
      desc: u.desc + ` До ${u.max} рангов.`,
      locked: false,
      condition: pairs.length ? 'Нужна для эволюции: ' + pairs.map((d) => d.name).join(', ') : '',
      evolution: null,
    };
  });
  // The full account of each hero: attack, abilities with cooldowns and the passive.
  const heroCards = Object.entries(heroDefinitions).map(([id, hero]) => ({
    id,
    icon: '⚔',
    name: `${hero.weapon} · ${hero.name}`,
    desc: [
      hero.details,
      ...abilityDefinitions[id].map(
        (a, i) => `${slotKey(i)} · ${a.name}: ${a.description} Перезарядка ${a.cooldown} с.`,
      ),
      heroPassives[id] && `Пассивка «${heroPassives[id].name}»: ${heroPassives[id].details}`,
    ]
      .filter(Boolean)
      .join('\n'),
    locked: false,
    condition: '',
    evolution: evolution('hero_' + id, heroEvolutions[id], 'атака героя ур. 6'),
  }));
  const all = [...weapons, ...heroCards];
  return {
    weapons,
    passives,
    heroes: heroCards,
    found: all.filter((e) => e.evolution.discovered).length,
    total: all.length,
  };
}
