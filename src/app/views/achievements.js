import { unlockText } from '../unlocks.js';
import { clock } from './format.js';

/**
 * @typedef {{ id: string, title: string, desc: string, icon: string,
 *   progressText: string, percent: number, reward: number, unlock: string, rewardText: string,
 *   codeToken: boolean,
 *   done: boolean, claimed: boolean, order: number, ratio: number }} AchievementCard
 * @returns {{ cards: AchievementCard[], total: number, completed: number, claimed: number, percent: number }}
 */
export function achievementsView({ progression }) {
  const data = progression.data;
  const cards = progression.achievements.list.map((ach) => {
    const progress = ach.getProgress(data);
    const done = progress >= ach.target,
      claimed = progression.achievements.isClaimed(ach.id);
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
