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
  e.Progression = e.createProgression({ storage: e.localStorage });
  const P = e.Progression,
    U = e.UpgradeSystem.create(P);
  const state = () => ({
    stats: { damage: 1, haste: 1, range: 1, speed: 1, magnet: 75, regen: 0, armor: 0 },
    p: { max: 100, hp: 50 },
    earned: 0,
  });
  const weaponIds = U.weapons.map((u) => u.id);
  for (const hero of Object.keys(U.heroes)) {
    const s = state();
    assert.equal(U.pool(hero, s).length, 1 + 8 + 8 + 2, 'hero attack, weapons, passives, Q/E');
    for (let n = 0; n < 80; n++) {
      const choices = U.offer(hero, s);
      assert.equal(choices.length, 4);
      assert.equal(new Set(choices.map((u) => u.id)).size, 4);
      for (const c of choices)
        assert(c.group && typeof c.detail === 'string', 'cards describe themselves');
      if (U.pool(hero, s).some((u) => u.kind === 'weapon' || u.kind === 'hero'))
        assert(
          choices.some((c) => c.kind === 'weapon' || c.kind === 'hero'),
          'a weapon is offered',
        );
      U.apply(choices[0], s);
      // Slots: three extra weapons and four passives at most.
      assert((s.weapons || []).length <= 3, 'weapon slots');
      assert(U.common.filter((u) => s.upgradeRanks?.[u.id] > 0).length <= 4, 'passive slots');
    }
    if (s.weapons.length === 3)
      assert(
        U.pool(hero, s).every(
          (u) => u.kind !== 'weapon' || s.weapons.some((w) => 'w_' + w.id === u.id),
        ),
        'full weapon slots offer only owned weapons',
      );
    for (const u of U.pool(hero, s)) {
      const card = U.pool(hero, s).find((c) => c.id === u.id);
      while (card && U.apply(card, s));
      assert(!U.apply(card, s));
    }
    assert(s.stats.heroEvo, 'hero attack evolves at level 6');
    assert(s.weapons.every((w) => w.level === 6));
    assert(U.offer(hero, s).every((u) => !u.max || U.pool(hero, s).some((c) => c.id === u.id)));
    assert.equal(U.pool(hero, state()).length, 19, 'New run resets ranks');
    const banned = { ...state(), banned: ['w_orbit'] };
    assert(!U.pool(hero, banned).some((u) => u.id === 'w_orbit'), 'banned cards never return');
  }
  assert.equal(weaponIds.length, 8);
  const build = U.build('utrace', {
    stats: {},
    upgradeRanks: { might: 2 },
    weapons: [{ id: 'mine', level: 3, evolved: false }],
  });
  assert.equal(build.weapons.map((w) => w.id).join(), 'hero,mine');
  assert.equal(build.passives[0].level, 2);
  P.earn(1000);
  assert(!P.buyUpgrade('training_panoramix'), 'Cannot train locked hero');
  assert(P.buyUpgrade('training_utrace'));
  const a = state(),
    o = state();
  U.permanent(a, 'utrace', P.data.levels);
  U.permanent(o, 'obelix', P.data.levels);
  assert.equal(a.stats.weaponBonus, 0.06, 'Utrace training strengthens its passive');
  assert.equal(a.stats.weaponSlots, 1, 'Utrace passive: extra weapon slot');
  assert.equal(o.stats.weaponBonus, undefined);
  assert(P.buyUpgrade('armor'));
  assert.equal(P.data.levels.armor, 1);
  const reload = { localStorage: e.localStorage };
  reload.AssetPaths = { url: (relative) => 'assets/runtime/' + relative };
  vm.createContext(reload);
  await loadModule(reload, projectRoot + '/src/systems/persistence.js', { fresh: true });
  reload.Progression = reload.createProgression({ storage: reload.localStorage });
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
  reload.Progression = reload.createProgression({ storage: reload.localStorage });
  assert.equal(reload.Progression.data.codes, 44);
  assert.equal(reload.Progression.data.levels.health, 2);
  assert.equal(reload.Progression.data.levels.training_panoramix, undefined);
  assert(!reload.Progression.owned('panoramix'));
  console.log(
    'PASS: weapon and passive slots, guaranteed weapon offer, unique cards, caps, hero evolution, bans, run reset, locked training, permanent bonuses and legacy saves.',
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
