const assert = require('node:assert/strict'),
  path = require('node:path');
const { loadModule } = require('./helpers/load-modules.cjs');
(async () => {
  const saved = new Map();
  const storage = { getItem: (k) => saved.get(k) ?? null, setItem: (k, v) => saved.set(k, v) };
  const load = async () => {
    const env = { localStorage: storage };
    await loadModule(env, path.resolve('src/systems/persistence.js'));
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
  assert.equal(p.codes, 170);
  assert(p.owned('qa'));
  assert.equal(p.data.levels.power, 2);
  assert(p.isClaimed('codes_100'));
  assert(!p.claimAchievement('codes_100'), 'migration cannot re-award achievement');
  assert(p.buyHero('traceability'));
  const migrated = JSON.parse(saved.get('utreys-progression-v1'));
  assert.equal(migrated.codes, 90);
  assert(!('helmets' in migrated));
  saved.set('utreys-progression-v1', JSON.stringify({ codes: 0, helmets: 900 }));
  assert.equal((await load()).codes, 0, 'new zero balance takes precedence');
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
