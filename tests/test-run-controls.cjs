const assert = require('node:assert/strict');
const { nodeGuardian } = require('../src/systems/node-objectives.js');
const { createHarness } = require('./helpers/game-harness.cjs');

// Level-up controls (reroll, skip, ban), key rebinding, the saved run and first-run tips.
(async () => {
  const h = await createHarness({ createSession: false });
  const store = new Map();
  h.env.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  const key = (code) => h.listeners.keydown({ code, preventDefault() {}, target: null });
  let game = h.createSession();
  const run = game.views.run();

  // Rebinding: the next key press is taken; a taken key swaps with the old one.
  game.commands.openSettings('menu');
  game.commands.startCapture('up');
  key('KeyI');
  assert.equal(game.views.settings().bindings.find((b) => b.action === 'up').key, 'I');
  game.commands.startCapture('down');
  key('KeyI');
  const keys = Object.fromEntries(game.views.settings().bindings.map((b) => [b.action, b.key]));
  assert.equal(keys.down, 'I');
  assert.equal(keys.up, 'S', 'taking a key swaps it with the previous action');
  game.commands.startCapture('left');
  key('Escape');
  assert.equal(run.capture, null, 'Escape cancels capture');
  game.commands.resetBindings();
  game.commands.toggleSetting('damageNumbers');
  game.commands.setUiScale(1.15);
  assert.equal(game.views.settings().damageNumbers, false);
  assert.equal(game.views.settings().uiScale, 1.15);
  game.commands.closeSettings();

  // Movement follows the bindings.
  game.start();
  game.state.spawn = 1e9;
  game.commands.toggleSetting('damageNumbers');
  const x0 = game.state.p.x;
  game.keys.add('KeyD');
  game.update(0.1);
  game.keys.clear();
  assert(game.state.p.x > x0, 'default right key moves');

  // Level-up controls: one of each per run.
  const s = game.state;
  assert.equal(s.rerolls, 1);
  assert.equal(s.skips, 1);
  assert.equal(s.banishes, 1);
  s.xp = s.need;
  game.update(0.01);
  assert.equal(game.mode, 'level');
  run.levelLock = 0;
  const first = run.choice.map((c) => c.id).join();
  key('KeyR');
  assert.equal(s.rerolls, 0);
  assert.equal(run.choice.length, 4);
  key('KeyR');
  assert.equal(s.rerolls, 0, 'no rerolls left');
  key('KeyB');
  assert(run.banishArmed);
  const banned = run.choice.find((c) => c.max);
  key('Digit' + (run.choice.indexOf(banned) + 1));
  assert.equal(game.mode, 'level', 'banning keeps the level-up open');
  assert.equal(s.banishes, 0);
  assert(!run.choice.some((c) => c.id === banned.id), 'banned card is gone');
  for (let i = 0; i < 30; i++)
    assert(!game.upgrades.offer(game.views.run().selected, s).some((c) => c.id === banned.id));
  key('KeyX');
  assert.equal(game.mode, 'play', 'skip closes the level-up');
  assert.equal(s.skips, 0);
  assert(first.length > 0);

  // Saved run: pause saves, a new session offers Continue and restores the run paused.
  for (let i = 0; i < 3; i++) game.spawn('pepsi', false, { x: s.p.x + 300 + i * 40, y: s.p.y });
  s.weapons.push({ id: 'mine', level: 3, cd: 1, evolved: false, phase: 0 });
  s.upgradeRanks.might = 2;
  s.t = 95;
  s.kills = 17;
  const guardian = nodeGuardian(s, s.nodes[0]);
  guardian.hp = 123;
  // A workaround removes the node's guardian, as the game does.
  s.nodes[1].status = 'workaround';
  s.enemies = s.enemies.filter((e) => e !== nodeGuardian(s, s.nodes[1]));
  game.pause();
  assert(store.has('utreys-run-v4'), 'pausing saves the run');
  const enemies = s.enemies.filter((e) => !e.nodeId).length;
  game.dispose();

  game = h.createSession();
  assert.match(game.views.menu().resume, /01:35/);
  assert(game.resume());
  const r = game.state;
  assert.equal(game.mode, 'pause', 'a resumed run starts paused');
  assert.equal(r.t, 95);
  assert.equal(r.kills, 17);
  assert.equal(r.weapons[0].id, 'mine');
  assert.equal(r.weapons[0].level, 3);
  assert.equal(r.upgradeRanks.might, 2);
  assert.equal(r.rerolls, 0, 'spent controls stay spent');
  assert.equal(r.enemies.filter((e) => !e.nodeId).length, enemies);
  assert.equal(nodeGuardian(r, r.nodes[0]).hp, 123, 'guardian health is restored');
  assert.equal(r.nodes[1].status, 'workaround');
  assert.equal(nodeGuardian(r, r.nodes[1]), null);
  game.pause();
  game.update(0.05);
  game.finish(false);
  assert(!store.has('utreys-run-v4'), 'a finished run is not offered again');
  assert.equal(game.views.menu().resume, null);

  // A level-up open when the tab closes comes back with the same cards and the run's random
  // source where it was.
  game.start();
  game.state.xp = game.state.need;
  game.update(1 / 60);
  assert.equal(game.mode, 'level');
  const offered = game.views.run().choice.map((card) => card.id);
  const position = game.state.rng.getState();
  h.listeners.pagehide({});
  game.dispose();
  game = h.createSession();
  assert(game.resume());
  assert.equal(game.mode, 'level');
  assert.deepEqual(
    game.views.run().choice.map((card) => card.id),
    offered,
    'the same cards are offered',
  );
  assert.equal(game.state.rng.getState(), position, 'no new cards were drawn');
  game.pickUpgrade(0);
  game.menu();

  // Tips: shown once, only with hints on.
  game.start();
  game.state.spawn = 1e9;
  game.run();
  for (let t = 16; t <= 1200; t += 16) h.tick(t);
  assert.match(game.views.hud().tip, /движение/);
  game.menu();
  game.start();
  for (let t = 1216; t <= 2400; t += 16) h.tick(t);
  assert.doesNotMatch(game.views.hud().tip || '', /движение/, 'a tip is shown once');
  game.dispose();
  console.log('PASS: reroll, ban, skip, key rebinding, settings, saved run and first-run tips');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
