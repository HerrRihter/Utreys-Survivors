// Codes: run income and the kill counters. Combat calls these every kill, so they only
// change memory and leave the write to the store's deferred save.
export function createWallet(store) {
  function earn(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    store.data.codes += amount;
    store.deferSave();
    return amount;
  }
  // One enemy defeated by `tag`, the run's `runKills`-th: every tenth kill of a run pays a
  // code. Counting the run, not the account, keeps a run's codes the same for its seed and
  // input whoever plays it.
  function kill(tag, runKills) {
    const data = store.data;
    data.kills++;
    if (typeof tag === 'string' && /^[a-z_]+$/.test(tag))
      data.weaponKills[tag] = (data.weaponKills[tag] || 0) + 1;
    const reward = Number.isSafeInteger(runKills) && runKills > 0 && runKills % 10 === 0 ? 1 : 0;
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
