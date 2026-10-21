const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startPreview } = require('./preview-server.cjs');
const { learningCourse } = require('../data/learning-questions.js');
const { incidentCourse } = require('../data/learning-incidents.js');
const { learningRooms } = require('../data/learning-rules.js');
const { roomLayout } = require('../src/systems/queries/learning.js');

const mazes = learningRooms.filter((room) => room.maze).length;

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
    // The course is picked beside the learning map in the hero select.
    await page.locator('#start').click();
    await page.locator('#runMap').selectOption('learningCenter');
    const course = page.locator('#runCourse');
    await course.selectOption(incidentCourse.id);
    assert.equal(await page.locator('#courseDescription').innerText(), incidentCourse.description);
    await course.selectOption(learningCourse.id);
    await page.locator('#runHeroStart').click();
    await page.waitForFunction(() => window.__utraceSession.mode === 'play');
    await page.evaluate(() => {
      const s = window.__utraceSession;
      s.state.p.hp = s.state.p.max = 10000;
    });
    assert.equal(
      await page.evaluate(() => window.__utraceSession.state.learning.course),
      learningCourse.id,
    );
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
    // Beats a terminal's guard (the run's own loop spawns it) and stands at the terminal.
    const reach = async (room, k) => {
      await page.waitForFunction(
        ([room, k]) => {
          const s = window.__utraceSession.state,
            n = s.nodes.filter((n) => n.room === room)[k];
          return n.status !== 'guarded' || s.enemies.some((e) => e.id === n.guardianId);
        },
        [room, k],
      );
      await page.evaluate(
        ([room, k]) => {
          const g = window.__utraceSession,
            n = g.state.nodes.filter((n) => n.room === room)[k],
            guard = g.state.enemies.find((e) => e.id === n.guardianId);
          if (guard) g.damage(guard, 1e9, 0, 0, g.state.p, 'hero');
          Object.assign(g.state.p, { x: n.x, y: n.y });
        },
        [room, k],
      );
      await page.waitForFunction(
        ([room, k]) =>
          window.__utraceSession.state.nodes.filter((n) => n.room === room)[k].status ===
          'available',
        [room, k],
      );
    };
    const seed = await page.evaluate(() => window.__utraceSession.state.seed);
    for (let room = 0; room < mazes; room++) {
      for (let k = 0; k < 3; k++) {
        await reach(room, k);
        await page.getByRole('button', { name: `Тест: Терминал ${k + 1}`, exact: true }).click();
        if (room === 0 && k === 0)
          await page.screenshot({ path: 'test-results/learning-intro-maze.png' });
        if (room === 0 && k === 0) {
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
            assert(
              await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
            );
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
      }
      if (room === 0) {
        await page.setViewportSize({ width: 1366, height: 768 });
        await page.screenshot({ path: 'test-results/learning-maze.png' });
      }
      // The door: the arrow points at it; standing there offers the way on.
      await page.evaluate(
        (point) => {
          Object.assign(window.__utraceSession.state.p, point);
        },
        roomLayout('learningCenter', seed, room).exit,
      );
      await page.getByRole('button', { name: /^В .* →$/ }).click();
      assert.equal(
        await page.evaluate(() => window.__utraceSession.state.learning.roomIndex),
        room + 1,
      );
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
    // The victory's report card: the grade and every question asked.
    const report = page.locator('#learningReport');
    await report.waitFor();
    assert.match(await report.innerText(), /Оценка: .+ · \d+%/);
    assert((await report.locator('.learning-report-q').count()) > 0, 'questions in the report');
    await page.screenshot({ path: 'test-results/learning-result.png' });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(
      'PASS learning browser: guarded terminals in 3 mazes, mobile questions, reload, doors, hall boss, revival, victory, report card',
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
