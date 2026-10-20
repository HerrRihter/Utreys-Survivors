const assert = require('node:assert/strict'),
  path = require('node:path');
const { loadModule } = require('./helpers/load-modules.cjs');
(async () => {
  const saved = new Map();
  const storage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  const load = async () => {
    const env = { localStorage: storage };
    await loadModule(env, path.resolve('src/systems/progression/index.js'));
    env.Progression = env.createProgression({ storage: env.localStorage });
    return env.Progression;
  };
  saved.set(
    'utreys-progression-v1',
    JSON.stringify({
      helmets: 170,
      unlocked: ['utrace', 'qa'],
      claimedAchievements: ['helmets_100'],
      levels: { power: 2 },
    }),
  );
  const p = await load();
  assert.equal(p.wallet.codes, 170);
  assert(p.shop.owned('qa'));
  assert.equal(p.data.levels.power, 2);
  assert(p.achievements.isClaimed('codes_100'));
  assert(!p.achievements.claimAchievement('codes_100'), 'migration cannot re-award achievement');
  assert(p.shop.buyHero('traceability'));
  const migrated = JSON.parse(saved.get('utreys-progression-v1'));
  assert.equal(migrated.codes, 90);
  assert(!('helmets' in migrated));
  saved.set('utreys-progression-v1', JSON.stringify({ codes: 0, helmets: 900 }));
  assert.equal((await load()).wallet.codes, 0, 'new zero balance takes precedence');

  // The old best-run record ('utreys-best') joins the progression once and its key goes.
  saved.set('utreys-progression-v1', JSON.stringify({ stats: { maxTime: 100 } }));
  saved.set('utreys-best', JSON.stringify({ time: 250, kills: 400 }));
  let best = await load();
  assert.equal(best.data.stats.maxTime, 250);
  assert.equal(best.data.stats.maxKills, 400);
  assert(
    best.achievements.isClaimed('survive_run_180') ||
      best.achievements.claimAchievement('survive_run_180'),
    'time achievements read the merged record',
  );
  assert.equal(JSON.parse(saved.get('utreys-best')), null, 'the old key is gone');
  assert.equal(JSON.parse(saved.get('utreys-progression-v1')).stats.maxKills, 400);
  assert.equal(best.previous, null, 'claiming changed the save');
  best = await load();
  assert.equal(best.data.stats.maxTime, 250, 'merged once, kept after reload');
  // A larger record in the save wins; a save that cannot be written keeps the old key.
  saved.set('utreys-best', JSON.stringify({ time: 90, kills: 3 }));
  best = await load();
  assert.equal(best.data.stats.maxTime, 250);
  assert.equal(best.data.stats.maxKills, 400);
  saved.set('utreys-best', JSON.stringify({ time: 900, kills: 3 }));
  const blocked = {
    getItem: storage.getItem,
    setItem() {
      throw Error('blocked');
    },
  };
  const env = {};
  await loadModule(env, path.resolve('src/systems/progression/index.js'));
  assert.equal(env.createProgression({ storage: blocked }).data.stats.maxTime, 900);
  assert.equal(JSON.parse(saved.get('utreys-best')).time, 900, 'kept for the next try');
  saved.delete('utreys-best');
  // The save as the previous build had it, for cloud sync: without the new field.
  saved.set('utreys-progression-v1', JSON.stringify({ codes: 7, stats: { maxTime: 5 } }));
  const fresh = await load();
  assert.equal(fresh.previous.codes, 7);
  assert(!('maxKills' in fresh.previous.stats));
  fresh.wallet.earn(1);
  assert.equal(fresh.previous, null, 'any change ends the allowance');
  const { AudioSystem } = await loadModule({}, path.resolve('src/core/audio.js'));
  const target = { addEventListener() {}, removeEventListener() {} };
  const c = {
    storage,
    window: target,
    document: target,
    performance: { now: () => 0 },
    random: Math.random,
    getMode: () => 'menu',
  };
  saved.set('gaul-audio', JSON.stringify({ enabled: false, music: 0.17, effects: 0.42 }));
  let audio = AudioSystem.create(c);
  assert.equal(audio.settings.music, 0.17);
  assert.equal(audio.settings.effects, 0.42);
  assert.equal(audio.settings.enabled, false);
  audio.dispose();
  assert.equal(JSON.parse(saved.get('utreys-audio')).music, 0.17);
  saved.set('utreys-audio', JSON.stringify({ enabled: true, music: 0.3, effects: 0.5 }));
  audio = AudioSystem.create(c);
  assert.equal(audio.settings.music, 0.3);
  assert.equal(audio.settings.enabled, true);
  audio.dispose();
  assert.doesNotThrow(() =>
    AudioSystem.create({
      ...c,
      storage: {
        getItem: storage.getItem,
        setItem() {
          throw Error('blocked');
        },
      },
    }).dispose(),
  );
  console.log(
    'PASS: currency and audio migration, new-key precedence and achievement deduplication',
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
