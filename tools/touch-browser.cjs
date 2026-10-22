// Two fingers on a phone: one holds the movement stick, the other presses an ability button.
// Touches go through the DevTools protocol, as a phone's browser sends them.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { startPreview } = require('./preview-server.cjs');

(async () => {
  fs.mkdirSync('test-results', { recursive: true });
  const server = await startPreview();
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
  });
  try {
    const context = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(server.url + '?bench');
    await page.waitForFunction(() => !!window.__utraceSession);
    await page.evaluate(() => {
      const s = window.__utraceSession;
      s.selectMap('empty');
      s.start();
      s.state.p.hp = s.state.p.max = 10000;
    });
    await page.waitForFunction(() => window.__utraceSession.mode === 'play');
    const button = await page.locator('#ability0').boundingBox();
    assert(button, 'the ability button is shown on a phone');
    const cdp = await context.newCDPSession(page);
    const touch = (type, points) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map(([x, y], id) => ({ x, y, id, radiusX: 4, radiusY: 4 })),
      });
    const stick = [120, 250],
      held = [150, 250],
      finger = [button.x + button.width / 2, button.y + button.height / 2];
    await touch('touchStart', [stick]);
    await touch('touchMove', [held]);
    assert(await page.evaluate(() => !!window.__utraceSession.views.run().pointer), 'stick held');
    const ready = await page.evaluate(() => window.__utraceSession.state.abilities[0].cd);
    assert.equal(ready, 0, 'the ability is ready');
    // Every event lists the fingers still down; leaving one out lifts it.
    await touch('touchStart', [held, finger]);
    await touch('touchMove', [held]);
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => ({
      cd: window.__utraceSession.state.abilities[0].cd,
      pointer: !!window.__utraceSession.views.run().pointer,
    }));
    assert(after.cd > 0, 'the second finger cast the ability');
    assert(after.pointer, 'the stick stays held');
    await touch('touchEnd', []);
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS touch browser: an ability cast by a second finger while the stick is held');
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
