const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
fs.mkdirSync('test-results', { recursive: true });
const { chromium } = require('playwright');
const { createServer } = require('./server.cjs');
const assets = require('./active-assets.json');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
  try {
    for (const prefix of ['/', '/utreys-survivors/']) {
      const server = createServer({ root: path.resolve(__dirname, '../dist'), prefix });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      const context = await browser.newContext();
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('response', (response) => {
        if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
      });
      const url = `http://127.0.0.1:${server.address().port}${prefix}`;
      try {
        await page.goto(url);
        await page.locator('#start').waitFor();
        for (const asset of assets)
          assert.equal(
            (await page.request.get(`${url}assets/runtime/${asset}`)).status(),
            200,
            asset,
          );
        await page.locator('#start').click();
        await page.locator('#runHeroStart').click();
        await page.waitForFunction(() => document.body.dataset.mode === 'play');
        assert.match(await page.locator('#nodeProgress').innerText(), /Узлы: 0\/5/);
        await page.screenshot({ path: 'test-results/nodes-gameplay.png' });
        await page.setViewportSize({ width: 390, height: 844 });
        await page.screenshot({ path: 'test-results/nodes-mobile.png' });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => document.body.dataset.mode === 'pause');
        await page.locator('#resume').click();
        await page.keyboard.press('q');
        await page.keyboard.press('e');
        await page.keyboard.press('Escape');
        await page.locator('#quit').click();
        await page.locator('#settingsOpen').click();
        await page.locator('#musicVolume').fill('17');
        await page.locator('#musicVolume').focus();
        await page.keyboard.press('ArrowRight');
        assert.equal(
          await page.locator('#musicVolume').inputValue(),
          '18',
          'game does not steal range keyboard input',
        );
        await page.locator('#musicVolume').fill('17');
        await page.locator('#settingsClose').click();
        await page.locator('#shopOpen').click();
        await page.locator('#shopClose').click();
        await page.locator('#achievementsOpen').click();
        await page.locator('#achievementsClose').click();
        await page.getByRole('button', { name: 'ВРАГИ И КЛИЕНТЫ', exact: true }).click();
        await page.getByRole('button', { name: '⏸ Пауза', exact: true }).click();
        const { unitDefinitions } = require('../data/enemies/units.js');
        for (const unit of Object.values(unitDefinitions))
          assert.equal(
            await page.locator(`canvas[aria-label="${unit.name}"]`).count(),
            1,
            unit.name,
          );
        const preview = page.locator('canvas[aria-label="L3"]');
        const { clientEmblems } = require('../src/rendering/art/client-emblems.js');
        const skinNames = Object.keys(clientEmblems).map((id) => unitDefinitions[id].name);
        const readSkins = () =>
          page.evaluate(
            (names) =>
              names.map((name) =>
                [...document.querySelectorAll('canvas')]
                  .find((canvas) => canvas.getAttribute('aria-label') === name)
                  .toDataURL(),
              ),
            skinNames,
          );
        const skins = await readSkins();
        assert.equal(new Set(skins).size, skinNames.length, 'individual client skins');
        await page.getByLabel('Отразить влево').check();
        await page.evaluate(
          () =>
            new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        assert.deepEqual(
          await readSkins(),
          skins,
          'client wordmarks stay readable when heading left',
        );
        await page.getByLabel('Отразить влево').uncheck();
        await page.evaluate(async (images) => {
          const sheet = document.createElement('div');
          sheet.id = 'skin-review-sheet';
          sheet.style.cssText =
            'position:fixed;top:0;left:0;z-index:9999;width:1280px;display:grid;grid-template-columns:repeat(4,320px);background:#08171a';
          for (const src of images) {
            const image = document.createElement('img');
            image.src = src;
            image.width = 320;
            image.height = 195;
            await image.decode();
            sheet.append(image);
          }
          document.body.append(sheet);
        }, skins);
        await page
          .locator('#skin-review-sheet')
          .screenshot({ path: 'test-results/client-skins.png' });
        await page.locator('#skin-review-sheet').evaluate((element) => element.remove());
        for (const motion of ['attack', 'hurt', 'walk']) {
          await page.getByRole('combobox').selectOption(motion);
          await page.evaluate(
            () =>
              new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
          );
        }
        const frozen = await preview.evaluate((canvas) => canvas.toDataURL());
        await page.waitForTimeout(250);
        assert.equal(
          await preview.evaluate((canvas) => canvas.toDataURL()),
          frozen,
          'freeze includes blinking LEDs',
        );
        const specification = page.getByRole('button', { name: /^Спецификация/ }).first();
        await specification.click();
        await page.getByRole('dialog').waitFor();
        await page.keyboard.press('Tab');
        assert(
          await page
            .getByRole('dialog')
            .evaluate((dialog) => dialog.contains(document.activeElement)),
          'focus stays inside dialog',
        );
        await page.keyboard.press('Escape');
        await page.getByRole('dialog').waitFor({ state: 'hidden' });
        assert(
          await specification.evaluate((button) => button === document.activeElement),
          'focus returns to trigger',
        );
        await page.getByRole('button', { name: '← В игру', exact: true }).click();
        await page.getByRole('button', { name: 'СЕРВЕРНЫЙ КОНТУР', exact: true }).click();
        await page.getByRole('button', { name: '← В игру', exact: true }).click();
        await page.reload();
        await page.locator('#settingsOpen').click();
        assert.equal(await page.locator('#musicVolume').inputValue(), '17');
        await page.locator('#settingsClose').click();
        for (const width of [360, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 900 });
          assert(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `overflow at ${width}`,
          );
        }
        if (prefix === '/') {
          await page.screenshot({ path: 'test-results/menu-desktop.png' });
          await page.setViewportSize({ width: 390, height: 844 });
          await page.screenshot({ path: 'test-results/menu-mobile.png' });
          await page.getByRole('button', { name: 'ВРАГИ И КЛИЕНТЫ', exact: true }).click();
          const nav = await page.locator('.view-navigation').boundingBox();
          assert(nav.x >= 0 && nav.x + nav.width <= 390, 'navigation fits mobile width');
          await page.screenshot({ path: 'test-results/opponents-mobile.png' });
          await page
            .getByRole('button', { name: /^Спецификация/ })
            .first()
            .click();
          await page.screenshot({ path: 'test-results/dialog-mobile.png' });
          await page.keyboard.press('Escape');
          await page.getByRole('button', { name: 'Дата-центр Utrace', exact: true }).click();
          await page.screenshot({ path: 'test-results/arena-mobile.png' });
        }
        await page.goto(url);
        await page.locator('#shopOpen').click();
        const { heroUnlockPrices } = require('../data/upgrades.js');
        const { heroDefinitions } = require('../data/characters/heroes.js');
        for (const price of Object.values(heroUnlockPrices))
          assert(
            await page
              .getByRole('button', { name: `Купить · ${price} кодов`, exact: true })
              .isDisabled(),
          );
        await page.evaluate(() =>
          localStorage.setItem(
            'utreys-progression-v1',
            JSON.stringify({ codes: 440, unlocked: ['utrace'] }),
          ),
        );
        await page.reload();
        await page.locator('#shopOpen').click();
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.locator('#shopHeroes').screenshot({ path: 'test-results/hero-roster.png' });
        for (const price of Object.values(heroUnlockPrices))
          await page.getByRole('button', { name: `Купить · ${price} кодов`, exact: true }).click();
        const savedHeroes = await page.evaluate(() =>
          JSON.parse(localStorage.getItem('utreys-progression-v1')),
        );
        assert.equal(savedHeroes.codes, 0);
        assert.equal(savedHeroes.unlocked.length, 5);
        await page.reload();
        for (const [id, hero] of Object.entries(heroDefinitions)) {
          await page.locator('#start').click();
          await page.locator(`[data-hero="${id}"]`).click();
          assert.equal(await page.locator('#baClientChoice').isVisible(), id === 'ba');
          if (id === 'ba') await page.locator('#baClient').selectOption('multon');
          await page.locator('#runHeroStart').click();
          await page.waitForFunction(() => document.body.dataset.mode === 'play');
          assert.equal(await page.locator('#heroLabel').innerText(), hero.name.toUpperCase());
          if (id === 'ba')
            assert.match(await page.locator('#weapon').innerText(), /Мултон.*\+0 HP/);
          await page.keyboard.press('q');
          await page.keyboard.press('e');
          await page.keyboard.press('Escape');
          await page.locator('#quit').click();
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('#start').click();
        await page.locator('[data-hero="ba"]').click();
        await page.locator('#baClient').selectOption('ferrero');
        assert(await page.locator('#baClientChoice').isVisible());
        await page.screenshot({ path: 'test-results/hero-selection-mobile.png' });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual(errors, []);
        console.log(
          `PASS browser: ${prefix}, navigation, audio persistence, session, assets, widths`,
        );
      } catch (error) {
        await page.screenshot({ path: 'test-results/failure.png' });
        throw error;
      } finally {
        await context.close();
        await new Promise((resolve) => server.close(resolve));
      }
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
