import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHarness } from './helpers/game-harness.js';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'vitest';

test('audio', async () => {
  const resourcePath = (value) =>
    value.startsWith('file:')
      ? fileURLToPath(value)
      : path.resolve(import.meta.dirname, '..', value);
  async function main() {
    const handlers = {},
      created = [],
      storage = {};
    let now = 0;
    class Audio {
      constructor(src) {
        this.src = src;
        this.paused = true;
        this.ended = false;
        this.currentTime = 0;
        created.push(this);
      }
      play() {
        this.paused = false;
        return Promise.resolve();
      }
      pause() {
        this.paused = true;
      }
    }
    const c = {
      window: { Audio },
      document: {
        hidden: false,
        addEventListener(name, fn) {
          handlers[name] = fn;
        },
      },
      storage: {
        getItem: (key) => storage[key] ?? null,
        setItem: (key, value) => (storage[key] = value),
      },
      performance: { now: () => now },
      Math,
      mode: 'menu',
      random: () => c.Math.random(),
      getMode: () => c.mode,
    };
    const { AudioSystem } = Object.assign({}, await import('../src/core/audio.js'));
    const audio = AudioSystem.create(c);
    audio.sync();
    assert.equal(created.length, 0, 'No media before a gesture');
    handlers.pointerdown();
    const menu = created[0];
    assert(menu.src.endsWith('tavern.mp3'));
    assert(!menu.paused);
    assert(menu.loop);
    c.mode = 'play';
    audio.sync();
    const battle = created[1];
    assert(menu.paused);
    assert(!battle.paused);
    audio.effect('hit');
    assert.equal(created.length, 3);
    audio.effect('hit');
    assert.equal(created.length, 3, 'Rate limit repeated impacts');
    for (let i = 0; i < 20; i++) {
      now += 100;
      audio.effect('hit');
    }
    assert(created.length <= 8, 'Bound effect voices');
    audio.effect('punchSwing');
    assert(created.some((item) => item.src.endsWith('punch.mp3') && !item.paused));
    assert(
      created
        .filter((item) => /hit-[12]\./.test(item.src))
        .every((item) => item.src.endsWith('.mp3')),
      'Impacts use the replacement MP3 files',
    );
    const originalMath = c.Math;
    c.Math = Object.create(Math);
    for (const variant of [0, 0.4, 0.8]) {
      c.Math.random = () => variant;
      now += 200;
      audio.effect('death');
    }
    assert.equal(created.filter((item) => /death-[123]\.mp3$/.test(item.src)).length, 3);
    const voices = created.length;
    for (let i = 0; i < 100; i++) audio.effect('death');
    assert.equal(created.length, voices, 'Mass kills share a voice cooldown');
    c.Math = originalMath;
    c.mode = 'pause';
    audio.sync();
    assert(created.every((item) => item.paused));
    battle.currentTime = 17;
    c.mode = 'play';
    audio.sync();
    assert.equal(battle.currentTime, 17);
    assert(!battle.paused);
    c.document.hidden = true;
    handlers.visibilitychange();
    assert(created.every((item) => item.paused));
    c.document.hidden = false;
    handlers.visibilitychange();
    assert(!battle.paused);
    audio.toggle();
    assert(created.every((item) => item.paused));
    assert.equal(JSON.parse(storage['utreys-audio']).enabled, false);
    audio.toggle();
    assert(!battle.paused);
    audio.setVolume('music', 0);
    assert(battle.paused);
    now += 100;
    audio.effect('pickup');
    assert(created.some((item) => item.src.endsWith('pickup.ogg') && !item.paused));
    audio.setVolume('music', 45);
    assert.equal(battle.volume, 0.45);
    c.mode = 'level';
    audio.sync();
    assert.equal(battle.volume, 0.45 * 0.45);
    audio.finish(true);
    c.mode = 'end';
    audio.sync();
    const victory = created.find((item) => item.src.endsWith('victory.mp3'));
    assert(victory && !victory.loop && !victory.paused);
    assert(battle.paused);
    audio.stop();
    assert(created.every((item) => item.paused));
    audio.resume();
    assert(!victory.paused);
    victory.ended = true;
    victory.paused = true;
    audio.sync();
    assert(victory.paused, 'A result jingle does not restart');
    for (const item of created) {
      assert.equal(item.preservesPitch, false, 'Avoid time stretching short effects');
      const buffer = fs.readFileSync(resourcePath(item.src));
      assert(buffer.length > 1000);
      assert(!buffer.subarray(0, 100).toString().includes('<html'), 'Downloaded file is audio');
    }
    const reloaded = AudioSystem.create(c);
    assert.equal(reloaded.settings.music, 0.45, 'mix persists across sessions');
    reloaded.stop();
    console.log(
      'PASS: gesture unlock, local audio files, scene switching, pause/resume, visibility, mute, persistent mixing, cooldowns, bounded voices and one-shot endings.',
    );
    const h = await createHarness();
    h.session.start();
    const sounds = [];
    const run = { selected: 'utrace', state: h.session.state };
    run.state.rng.random = () => 0.5;
    const combat = h.env.CombatSystem.create({
        run,
        corpses: { add() {} },
        wallet: h.env.Progression.wallet,
        records: h.env.Progression.records,
        world: { arena: { clear: () => true } },
        audio: { effect: (name) => sounds.push(name) },
        cosmetic: () => 0.5,
        toast() {},
      }),
      p = run.state.p;
    combat.beginAction(p, 0.4, { x: p.x + 10, y: p.y });
    assert.deepEqual(sounds, ['punchSwing']);
    combat.heroImpact({ direction: { x: 1, y: 0 } });
    assert.deepEqual(sounds, ['punchSwing'], 'Utrace does not play a blade at impact');
    sounds.length = 0;
    const enemy = {
      unit: 'l3',
      type: 'enemy',
      hp: 20,
      x: p.x + 20,
      y: p.y,
      r: 12,
      vx: 0,
      vy: 0,
      cd: 0,
    };
    combat.damage(enemy, 1);
    assert.deepEqual(sounds, ['hit'], 'Nonfatal hits do not cry out');
    combat.damage(enemy, 100);
    assert.deepEqual(sounds, ['hit', 'hit', 'death']);
    combat.damage(enemy, 100);
    assert.equal(sounds.filter((name) => name === 'death').length, 1, 'A corpse cannot cry twice');
    console.log(
      'PASS: fist swing at windup, no Utrace blade sound, fatal-only enemy voice and mass-kill cooldown.',
    );
  }
  await main();
});
