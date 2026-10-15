const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');

// Screen navigation, Escape handling, store notifications and read models used by React.
(async () => {
  const h = await createHarness();
  const s = h.session,
    run = s.views.run(),
    { commands } = s;
  const escape = () => h.listeners.keydown({ code: 'Escape', preventDefault() {} });
  let uiChanges = 0,
    hudChanges = 0;
  s.ui.subscribe(() => uiChanges++);
  s.hud.subscribe(() => hudChanges++);

  assert.equal(run.screen, 'menu');
  commands.openShop();
  assert.equal(run.screen, 'shop');
  assert(uiChanges > 0, 'opening a screen notifies the UI');
  escape();
  assert.equal(run.screen, 'menu', 'Escape closes the shop');
  commands.openSettings('menu');
  escape();
  assert.equal(run.screen, 'menu', 'Escape returns from settings to the menu');

  const shop = s.views.shop();
  assert.equal(shop.heroes.find((hero) => hero.id === 'utrace').owned, true);
  assert(shop.heroes.find((hero) => hero.id === 'qa').disabled, 'cannot afford QA yet');
  h.env.Progression.earn(500);
  const before = uiChanges;
  commands.buyHero('qa');
  assert(uiChanges > before && s.views.shop().heroes.find((hero) => hero.id === 'qa').owned);

  commands.openHeroSelect();
  assert.equal(run.screen, 'heroSelect');
  commands.chooseHero('qa');
  assert.match(s.views.heroSelect().stats, /^.+\nQ · /);
  assert.equal(s.views.heroSelect().showBaClients, false);
  commands.startSelected();
  assert.equal(s.mode, 'play');
  assert.equal(run.screen, null);
  assert.equal(s.views.hud().heroLabel, 'QA');
  assert(run.toast.left > 0, 'arena toast shown on start');

  escape();
  assert.equal(s.mode, 'pause', 'Escape in a run pauses');
  commands.openSettings('paused');
  escape();
  assert.equal(run.screen, null, 'Escape from pause settings returns to the pause panel');
  assert.equal(s.mode, 'pause');
  commands.pause();
  assert.equal(s.mode, 'play');

  // The frame loop refreshes the HUD about ten times a second.
  s.run();
  const hudBefore = hudChanges;
  for (let t = 16; t <= 1000; t += 16) h.tick(t);
  assert(hudChanges - hudBefore >= 8 && hudChanges - hudBefore <= 12, 'HUD at ~10 Hz');

  s.state.xp = s.state.need;
  s.update(0.01);
  assert.equal(s.mode, 'level');
  assert.equal(s.views.levelUp().length, run.choice.length);
  commands.pickUpgrade(0);
  assert.equal(s.mode, 'play');

  s.finish(true);
  assert.equal(s.mode, 'end');
  assert.equal(run.result.title, 'Забег завершён');
  assert.equal(s.views.hud().showPause, false, 'pause button hidden after the run');
  commands.menu();
  assert.equal(s.mode, 'menu');
  assert.equal(s.views.hud(), null);
  assert.match(s.views.menu().record, /ЛУЧШЕЕ ВРЕМЯ/);
  s.dispose();
  console.log('PASS: screen navigation, Escape routing, UI/HUD notifications and read models');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
