import { abilityDefinitions } from '../../../data/characters/abilities.js';
import { baClientIds, baHealthPerKill } from '../../../data/characters/ba-specialization.js';
import { unitDefinitions } from '../../../data/enemies/units.js';
import { heroDefinitions } from '../../../data/characters/heroes.js';
import { heroPassives } from '../../../data/characters/hero-passives.js';
import { loadLevels, rewardPerLevel } from '../../../data/difficulty.js';
import { mapDefinitions } from '../../../data/maps/maps.js';
import { mapOpen } from '../selection.js';
import { clock, loadLabel, slotKey } from './format.js';

export function heroSelectView({ run, progression }) {
  const hero = heroDefinitions[run.pendingHero],
    passive = heroPassives[run.pendingHero];
  return {
    // Locked heroes stay in the list with their price, so the player sees what to save for.
    heroes: Object.keys(heroDefinitions).map((id) => ({
      id,
      name: heroDefinitions[id].name,
      weapon: heroDefinitions[id].weapon,
      role: heroPassives[id]?.role || '',
      locked: !progression.shop.owned(id),
      price: progression.shop.prices[id] || 0,
    })),
    pending: run.pendingHero,
    role: passive ? `${passive.role.toUpperCase()} · ${passive.roleDesc}` : '',
    stats:
      (hero.desc || '') +
      ` Здоровье ${hero.hp} · скорость ${hero.speed}.` +
      '\n' +
      abilityDefinitions[run.pendingHero]
        .map((a, i) => `${slotKey(i)} · ${a.name}: ${a.description} Перезарядка ${a.cooldown} с.`)
        .join('\n') +
      (passive ? `\nПассивка · ${passive.name}: ${passive.desc}` : ''),
    ...loadView(run, progression),
    showBaClients: !!heroDefinitions[run.pendingHero]?.keyClient,
    baClients: baClientIds.map((id) => ({ id, name: unitDefinitions[id].name })),
    baClient: run.baClient,
    baHealthPerKill,
    maps: Object.entries(mapDefinitions).map(([id, map]) => ({
      id,
      name: map.name,
      locked: !mapOpen(progression, id),
    })),
    map: run.selectedMap,
    seed: run.seedInput,
    mapDescription: mapDefinitions[run.selectedMap].description,
    // A single arena is shown for context but cannot be switched.
    mapLocked: Object.keys(mapDefinitions).length < 2,
    // The next map still closed, and what opens it.
    mapHint:
      Object.entries(mapDefinitions).find(
        ([id, map]) => map.unlockHint && !mapOpen(progression, id),
      )?.[1].unlockHint || '',
  };
}

// Load level picker for the pending hero: open levels, what the chosen one adds, records.
function loadView(run, progression) {
  const hero = run.pendingHero,
    available = progression.loads.loadAvailable(hero),
    cleared = progression.loads.loadCleared(hero),
    load = Math.min(Math.max(1, run.selectedLoad || 1), available),
    record = progression.loads.productionRecord(hero, load);
  return {
    loads: loadLevels.map((entry) => ({
      level: entry.level,
      label: loadLabel(entry.level) + (entry.level <= cleared ? ' ✓' : ''),
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
