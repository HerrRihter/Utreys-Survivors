// Codes: run income and the kill counters. Combat calls these every kill, so they only
// change memory and leave the write to the store's deferred save.
export function createWallet(store) {
  function earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    store.data.codes += amount;
    store.deferSave();
    return amount;
  }
  function kill(tag) {
    const data = store.data;
    data.kills++;
    if (typeof tag === 'string' && /^[a-z_]+$/.test(tag))
      data.weaponKills[tag] = (data.weaponKills[tag] || 0) + 1;
    const reward = data.kills % 10 === 0 ? 1 : 0;
    data.codes += reward;
    store.deferSave();
    return reward;
  }
  return {
    earn,
    kill,
    get codes() {
      return store.data.codes;
    },
  };
}
