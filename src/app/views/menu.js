import { heroDefinitions } from '../../../data/characters/heroes.js';
import { weaponDefinitions } from '../../../data/weapons.js';
import { nearestGoals } from '../unlocks.js';
import { clock } from './format.js';

function unclaimedAchievements(progression) {
  const data = progression.data;
  return progression.achievements.list.filter(
    (a) => a.getProgress(data) >= a.target && !progression.achievements.isClaimed(a.id),
  ).length;
}

// What the player has opened so far, counted from the data so it never goes stale.
function collection(progression) {
  const heroIds = Object.keys(heroDefinitions),
    weaponIds = Object.keys(weaponDefinitions),
    evolutions = [...weaponIds, ...heroIds.map((id) => 'hero_' + id)];
  return [
    {
      label: 'Герои',
      have: heroIds.filter((id) => progression.shop.owned(id)).length,
      total: heroIds.length,
    },
    {
      label: 'Оружие',
      have: weaponIds.filter((id) => progression.achievements.weaponUnlocked(id)).length,
      total: weaponIds.length,
    },
    {
      label: 'Эволюции',
      have: evolutions.filter((id) => progression.records.evolutionSeen(id)).length,
      total: evolutions.length,
    },
  ];
}

export function menuView({ run, progression, snapshot = null }) {
  const unclaimed = unclaimedAchievements(progression);
  const hero = snapshot && heroDefinitions[snapshot.hero];
  const maxTime = progression.data.stats.maxTime;
  return {
    collection: collection(progression),
    resume: hero ? `${hero.name} · ${clock(snapshot.state.t)} · ур. ${snapshot.state.level}` : null,
    wallet: 'КОДЫ: ' + progression.wallet.codes,
    record: maxTime
      ? `ЛУЧШЕЕ ВРЕМЯ: ${clock(maxTime)}`
      : 'Лучшее время появится после первого забега.',
    achievementsLabel: unclaimed > 0 ? `ДОСТИЖЕНИЯ (${unclaimed}!)` : 'ДОСТИЖЕНИЯ',
    goals: nearestGoals(progression, 3),
    hint: run.touchOnly
      ? 'Джойстик справа внизу — движение · атака и оружие срабатывают сами · умения — кнопки слева внизу'
      : 'WASD или стрелки — перемещение · трассировка кодов выполняется автоматически · Q / E — умения',
  };
}
