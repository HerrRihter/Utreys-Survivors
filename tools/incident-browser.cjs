const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startPreview } = require('./preview-server.cjs');
const { incidentRules: rules } = require('../data/incident-rules.js');
const { mapDefinitions } = require('../data/maps/maps.js');
const { courseQuestion } = require('../src/systems/queries/incident.js');
const { reviewQuestions } = require('../src/systems/escalation.js');

const map = Object.keys(mapDefinitions).find(
  (id) => mapDefinitions[id].objective?.type === 'escalation',
);
const metric = rules.metrics.find((m) => m.kind === 'units');

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
    await page.locator('#start').click();
    await page.locator('#runMap').selectOption(map);
    await page.locator('#runSeed').fill('21');
    await page.locator('#runHeroStart').click();
    await page.waitForFunction(() => window.__utraceSession.mode === 'play');
    // Keep combat out of this UI scenario; advance the real seeded plan to its first fault.
    const component = await page.evaluate((clock) => {
      const game = window.__utraceSession;
      const s = game.state;
      s.p.hp = s.p.max = 1e7;
      s.spawn = 1e9;
      s.enemies.length = 0;
      const fault = s.incident.plan.find((f) => f.cause && f.from == null);
      while (s.t < (fault.at + 1) * clock.minuteSeconds && game.mode === 'play')
        game.update(1 / 60);
      return fault.component;
    }, rules.clock);
    await page.locator('#console').click();
    const consolePanel = page.locator('#escalation');
    await consolePanel.waitFor();
    const pausedAt = await page.evaluate(() => window.__utraceSession.state.t);
    await consolePanel.getByLabel(/^Где сбой:/).selectOption(component);
    await consolePanel.getByRole('button', { name: 'Начать эскалацию', exact: true }).click();
    const creation = courseQuestion(rules.protocol.creation.question);
    await consolePanel
      .getByLabel(creation.options.find((o) => o.id === creation.correct[0]).text, { exact: true })
      .check();
    await consolePanel.getByRole('button', { name: 'Завести тикет', exact: true }).click();
    assert.equal(
      await page.evaluate(() => window.__utraceSession.state.incident.tickets.length),
      1,
    );
    assert(await page.evaluate(() => window.__utraceSession.state.incident.tickets[0].created));
    await consolePanel.getByRole('tab', { name: 'Метрики', exact: true }).click();
    const metricPanel = consolePanel.locator('.esc-metric').filter({
      has: page.getByRole('heading', { name: metric.name, exact: true }),
    });
    await metricPanel.getByRole('button', { name: 'Заказать', exact: true }).click();
    assert.match(await metricPanel.innerText(), /Заказано: 0\//);
    assert.equal(await page.evaluate(() => window.__utraceSession.state.t), pausedAt);
    for (const [width, height] of [
      [1366, 768],
      [390, 844],
    ]) {
      await page.setViewportSize({ width, height });
      await page.screenshot({ path: `test-results/incident-console-${width}.png` });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    const saved = await page.evaluate(() => ({
      seed: window.__utraceSession.state.seed,
      incident: window.__utraceSession.state.incident,
    }));
    await page.reload();
    await page.locator('#resumeRun').click();
    await page.locator('#resume').waitFor();
    assert.equal(await page.evaluate(() => window.__utraceSession.mode), 'pause');
    assert.deepEqual(
      await page.evaluate(() => ({
        seed: window.__utraceSession.state.seed,
        incident: window.__utraceSession.state.incident,
      })),
      saved,
      'reload preserves the entire shift, ticket and pending metric',
    );
    await page.locator('#resume').click();
    // Real combat deaths fulfill the order; no direct writes to metric state.
    await page.evaluate((metric) => {
      const game = window.__utraceSession;
      for (let i = 0; i < metric.kills; i++) {
        const enemy = game.spawn(metric.units[0], false, {
          x: game.state.p.x + 500,
          y: game.state.p.y,
        });
        game.damage(enemy, 1e9, 0, 0, game.state.p, 'hero');
      }
      game.state.enemies.length = 0;
    }, metric);
    await page.locator('#console').click();
    await consolePanel.getByRole('tab', { name: 'Метрики', exact: true }).click();
    await metricPanel.getByRole('button', { name: 'Заказать свежий снимок' }).waitFor();
    assert((await metricPanel.getByRole('img').count()) > 0, 'metric charts are visible');
    await page.screenshot({ path: 'test-results/incident-metric.png' });
    await consolePanel.getByRole('button', { name: 'Вернуться в бой' }).click();
    // Cross the shift boundary through simulation, not finish(), as in the session test.
    await page.evaluate((clock) => {
      const game = window.__utraceSession;
      game.state.t = (clock.minutes - 0.1) * clock.minuteSeconds;
      game.state.enemies.length = 0;
      for (let i = 0; i < 60 && game.mode === 'play'; i++) game.update(1 / 60);
    }, rules.clock);
    await page.locator('#shiftReview').waitFor();
    assert(await page.evaluate(() => window.__utraceSession.views.run().result.win));
    assert.equal(await page.locator('#shiftReport').count(), 0);
    await page.screenshot({ path: 'test-results/incident-review.png' });
    for (const [key, step] of Object.entries(reviewQuestions())) {
      const q = step.parts ? step : courseQuestion(step.question);
      const answers = step.parts ? step.parts.filter((p) => p.right).map((p) => p.id) : q.correct;
      const field = page.locator('#shiftReview fieldset').filter({
        has: page.locator(`input[name="review-${key}"]`),
      });
      for (const id of answers)
        await field
          .getByLabel((step.parts ?? q.options).find((o) => o.id === id).text, { exact: true })
          .check();
    }
    await page.getByRole('button', { name: 'Завершить разбор', exact: true }).click();
    const report = page.locator('#shiftReport');
    await report.waitFor();
    assert.match(await report.innerText(), /Оценка смены: .+ · \d+%/);
    assert((await report.locator('.learning-report-q').count()) > 0);
    const journal = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('utreys-run-log-v1')),
    );
    assert.equal(journal.length, 1);
    assert.equal(journal[0].incident.reviewed, Object.keys(reviewQuestions()).length);
    assert.equal(journal[0].incident.groups.review, 1);
    assert((await report.innerText()).includes(journal[0].incident.grade));
    await page.screenshot({ path: 'test-results/incident-result.png' });
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(
      'PASS incident browser: map, console pause, escalation, metric order and chart, reload, shift ending, PIR, grade and journal',
    );
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
