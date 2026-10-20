import { heroUnlockPrices, permanentUpgrades, priceOf } from '../../../data/upgrades.js';
const prices = heroUnlockPrices,
  upgrades = permanentUpgrades;

// Heroes and permanent upgrades bought with codes, and the refund of upgrades.
export function createShop(store) {
  const owned = (id) => store.data.unlocked.includes(id);
  const cost = (id) =>
    Object.hasOwn(upgrades, id) ? priceOf(id, store.data.levels[id]) : prices[id];
  function buyHero(id) {
    const data = store.data;
    if (!Object.hasOwn(prices, id) || owned(id) || data.codes < prices[id]) return false;
    data.codes -= prices[id];
    data.unlocked.push(id);
    store.save();
    return true;
  }
  const hasWon = () => store.data.stats.wins > 0;
  // Why an upgrade cannot be bought yet, or '' when it can be (prices aside).
  function upgradeLock(id) {
    const u = upgrades[id];
    if (u?.hero && !owned(u.hero)) return 'hero';
    if (u?.requires === 'win' && !hasWon()) return 'win';
    return '';
  }
  function buyUpgrade(id) {
    const data = store.data;
    if (
      !Object.hasOwn(upgrades, id) ||
      upgradeLock(id) ||
      data.levels[id] >= upgrades[id].max ||
      data.codes < cost(id)
    )
      return false;
    data.codes -= cost(id);
    data.levels[id]++;
    store.save();
    return true;
  }
  // Codes spent on permanent upgrades: the prices of every rank bought.
  function upgradeSpent() {
    let total = 0;
    for (const [id, level] of Object.entries(store.data.levels))
      if (Object.hasOwn(upgrades, id))
        for (let rank = 0; rank < level; rank++) total += priceOf(id, rank);
    return total;
  }
  // Returns every code spent on permanent upgrades and resets their ranks.
  function respec() {
    const refund = upgradeSpent();
    if (!refund) return 0;
    const data = store.data;
    for (const id of Object.keys(data.levels)) data.levels[id] = 0;
    data.codes += refund;
    store.save();
    return refund;
  }
  return { prices, upgrades, owned, cost, buyHero, buyUpgrade, upgradeLock, upgradeSpent, respec };
}
