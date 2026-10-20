import { achievementDefinitions } from '../../../data/achievements.js';

// Achievements: progress is read from the save, claiming pays the reward once.
export function createAchievements(store) {
  const achievementDone = (a, best) => a.getProgress(store.data, best) >= a.target;
  // Content opened by achievements; anything no achievement names is open from the start.
  function weaponUnlocked(id) {
    const gate = achievementDefinitions.find((a) => a.unlocks?.weapon === id);
    return !gate || achievementDone(gate);
  }
  function claimAchievement(id, best) {
    const data = store.data;
    const a = achievementDefinitions.find((x) => x.id === id);
    if (!a || data.claimedAchievements.includes(id)) return false;
    if (!achievementDone(a, best)) return false;
    data.claimedAchievements.push(id);
    if (a.reward) data.codes += a.reward;
    store.save();
    return true;
  }
  const isClaimed = (id) => store.data.claimedAchievements.includes(id);
  return {
    list: achievementDefinitions,
    achievementDone,
    weaponUnlocked,
    claimAchievement,
    isClaimed,
  };
}
