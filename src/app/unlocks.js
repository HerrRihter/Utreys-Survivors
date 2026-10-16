import { weaponDefinitions } from '../../data/weapons.js';

// What an achievement opens, in words; '' when it only pays codes.
export function unlockText(achievement) {
  const weapon = achievement.unlocks?.weapon;
  return weapon ? 'Оружие: ' + (weaponDefinitions[weapon]?.name || weapon) : '';
}

function clockText(seconds) {
  const s = Math.floor(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * @typedef {{ id: string, title: string, desc: string, percent: number, progressText: string,
 *   unlock: string }} UnlockGoal
 */
// The unfinished achievements closest to completion; ones that open content come first.
/** @returns {UnlockGoal[]} */
export function nearestGoals(progression, best, count = 3) {
  const data = progression.data;
  return progression.achievements
    .map((a) => ({ a, progress: a.getProgress(data, best) }))
    .filter(({ a, progress }) => progress < a.target)
    .map(({ a, progress }) => ({ a, progress, ratio: progress / a.target }))
    .sort((x, y) => !!y.a.unlocks - !!x.a.unlocks || y.ratio - x.ratio)
    .slice(0, count)
    .map(({ a, progress, ratio }) => ({
      id: a.id,
      title: a.title,
      desc: a.desc,
      percent: Math.min(100, Math.floor(ratio * 100)),
      progressText:
        a.format === 'time'
          ? `${clockText(progress)} / ${clockText(a.target)}`
          : `${progress} / ${a.target}`,
      unlock: unlockText(a),
    }));
}

// Achievements done now that were not done when the run started.
export function newlyDone(progression, best, before = []) {
  return progression.achievements
    .filter((a) => !before.includes(a.id) && progression.achievementDone(a, best))
    .map((a) => ({ id: a.id, title: a.title, unlock: unlockText(a) }));
}
