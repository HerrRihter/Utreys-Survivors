const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startPreview } = require('./preview-server.cjs');
const { learningCourse } = require('../data/learning-questions.js');
const { learningRooms } = require('../data/learning-rules.js');

(async () => {
  fs.mkdirSync('test-results', { recursive: true });
  const server = await startPreview();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '?bench');
    await page.locator('#start').waitFor();
    await page.evaluate(() => {
      const s = window.__utraceSession;
      s.selectMap('learningLab');
      s.start();
      s.state.p.hp = s.state.p.max = 10000;
    });
    const answerTest = async () => {
      await page.getByRole('button', { name: 'Начать тест', exact: true }).click();
      for (let i = 0; i < 3; i++) {
        const id = await page.evaluate(() => {
          const a = window.__utraceSession.state.learning.active;
          return a.questions[a.index].id;
        });
        const q = learningCourse.questions.find((q) => q.id === id);
        for (const oid of q.correct)
          await page.getByLabel(q.options.find((o) => o.id === oid).text, { exact: true }).check();
        await page.getByRole('button', { name: 'Подтвердить ответ' }).click();
        await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
      }
      await page.getByRole('button', { name: 'Продолжить', exact: true }).click();
    };
    for (let room = 0; room < 3; room++) {
      await page.evaluate((index) => {
        const s = window.__utraceSession,
          n = s.state.nodes.find((n) => n.room === index && n.required);
        s.state.p.x = n.x;
        s.state.p.y = n.y;
      }, room);
      await page
        .getByRole('button', { name: 'Тест: ' + learningRooms[room].name, exact: true })
        .click();
      if (room === 0) {
        const time = await page.evaluate(() => window.__utraceSession.state.t);
        await page.keyboard.press('Escape');
        await page.keyboard.press('q');
        assert.equal(await page.evaluate(() => window.__utraceSession.mode), 'quiz');
        for (const [width, height] of [
          [1366, 768],
          [390, 844],
          [844, 390],
          [360, 640],
        ]) {
          await page.setViewportSize({ width, height });
          await page.screenshot({ path: `test-results/learning-intro-${width}.png` });
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        }
        assert.equal(await page.evaluate(() => window.__utraceSession.state.t), time);
        await page.reload();
        await page.locator('#start').waitFor();
        await page.evaluate(() => {
          window.__utraceSession.resume();
        });
        assert.equal(await page.evaluate(() => window.__utraceSession.mode), 'quiz');
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await answerTest();
      await page.evaluate((point) => {
        Object.assign(window.__utraceSession.state.p, point);
      }, learningRooms[room].exit);
      await page.getByRole('button', { name: 'В следующую комнату →', exact: true }).click();
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForFunction(() => window.__utraceSession.state.bossSpawned);
    await page.evaluate(() => {
      const s = window.__utraceSession,
        boss = s.state.enemies.find((e) => e.boss);
      s.state.p.x = boss.x - 140;
      s.state.p.y = boss.y;
      s.state.attack = 9999;
      boss.summonCd = 0;
    });
    await page.waitForFunction(() =>
      window.__utraceSession.state.enemies.some((e) => e.summonerId !== null),
    );
    await page.screenshot({ path: 'test-results/learning-boss.png' });
    assert.match(await page.locator('#bossname').innerText(), /Партионный учёт/);
    await page.evaluate(() => {
      const s = window.__utraceSession;
      s.state.p.hp = -10;
    });
    await page.getByRole('button', { name: 'Начать тест', exact: true }).waitFor();
    await page.screenshot({ path: 'test-results/learning-revive.png' });
    await answerTest();
    await page.evaluate(() => {
      const s = window.__utraceSession,
        b = s.state.enemies.find((e) => e.boss);
      s.damage(b, 999999, 0, 0, s.state.p, 'hero');
    });
    await page.waitForFunction(() => window.__utraceSession.mode === 'end');
    await page.screenshot({ path: 'test-results/learning-result.png' });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(
      'PASS learning browser: rooms, mobile questions, reload, boss summons, revival, victory',
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
