const { loadModule } = require('./helpers/load-modules.cjs');
async function main() {
  const projectRoot = require('node:path').resolve(__dirname, '..');
  const vm = require('node:vm'),
    assert = require('node:assert/strict');
  const saved = new Map(),
    e = { localStorage: { getItem: (k) => saved.get(k), setItem: (k, v) => saved.set(k, v) } };
  e.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
  vm.createContext(e);
  for (const f of ['src/systems/upgrades.js', 'src/systems/persistence.js'])
    await loadModule(e, projectRoot + '/' + f, { fresh: false });
  const P = e.Progression,
    U = e.UpgradeSystem.create(P);
  const state = () => ({
    stats: { damage: 1, haste: 1, range: 1, speed: 1, magnet: 75, regen: 0, armor: 0 },
    p: { max: 100, hp: 50 },
    earned: 0,
  });
  for (const hero of Object.keys(U.heroes)) {
    const s = state();
    assert.equal(U.pool(hero, s).length, 13);
    for (let n = 0; n < 80; n++) {
      const choices = U.offer(hero, s);
      assert.equal(choices.length, 4);
      assert.equal(new Set(choices.map((u) => u.id)).size, 4);
      for (const c of choices)
        assert(
          U.common.some((u) => u.id === c.id) ||
            U.heroes[hero].some((u) => u.id === c.id) ||
            U.abilities[hero].some((u) => u.id === c.id) ||
            !c.max,
          'No other hero weapon offered',
        );
      if (U.heroes[hero].some((u) => (s.upgradeRanks?.[u.id] || 0) < u.max))
        assert(choices.some((c) => c.group === 'Оружие героя'));
      if (
        U.abilities[hero].some(
          (u) => (s.upgradeRanks?.[u.id] || 0) < u.max && (!u.available || u.available(s)),
        )
      )
        assert(choices.some((u) => u.group === 'Активное умение'));
      U.apply(choices[0], s);
    }
    for (const u of [...U.common, ...U.heroes[hero], ...U.abilities[hero]]) {
      while ((s.upgradeRanks?.[u.id] || 0) < u.max) assert(U.apply(u, s));
      assert(!U.apply(u, s));
    }
    assert(U.offer(hero, s).every((u) => !u.max));
    assert.equal(U.pool(hero, state()).length, 13, 'New run resets rank caps');
  }
  P.earn(1000);
  assert(!P.buyUpgrade('training_panoramix'), 'Cannot train locked hero');
  assert(P.buyUpgrade('training_utrace'));
  const a = state(),
    o = state();
  U.permanent(a, 'utrace', P.data.levels);
  U.permanent(o, 'obelix', P.data.levels);
  assert.equal(a.stats.punchTempo, 0.06);
  assert.equal(o.stats.punchTempo, undefined);
  assert(P.buyUpgrade('armor'));
  assert.equal(P.data.levels.armor, 1);
  const reload = { localStorage: e.localStorage };
  reload.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
  vm.createContext(reload);
  await loadModule(reload, projectRoot + '/src/systems/persistence.js', { fresh: true });
  assert.equal(reload.Progression.data.levels.training_utrace, 1);
  saved.set(
    'utreys-progression-v1',
    JSON.stringify({
      codes: 44,
      kills: 37,
      unlocked: ['panoramix'],
      levels: { health: 2, power: 1, speed: 3 },
    }),
  );
  await loadModule(reload, projectRoot + '/src/systems/persistence.js', { fresh: true });
  assert.equal(reload.Progression.data.codes, 44);
  assert.equal(reload.Progression.data.levels.health, 2);
  assert.equal(reload.Progression.data.levels.training_panoramix, undefined);
  assert(!reload.Progression.owned('panoramix'));
  console.log(
    'PASS: current hero pools, guaranteed personal choice, unique offers, caps, endgame supplies, run reset, locked training, isolated permanent bonuses and legacy saves.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
