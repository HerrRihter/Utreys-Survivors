// Browser render throughput on the built site (run `npm run build` first).
// Chromium is uncapped unless BENCH_VSYNC=1; Firefox uses its normal RAF cadence.
// fps counts RAF callbacks, not confirmed screen presentations; js* includes update + draw.
// gap* captures scheduling stalls as well. See docs/benchmarks/freeze-investigation.md.
const fs = require('node:fs');
const path = require('node:path');
const { chromium, firefox } = require('playwright');
const { createServer } = require('./server.cjs');

const units = ['l3', 'pepsi', 'inbev', 'mars', 'baltika', 'multon', 'loreal', 'ferrero'];

(async () => {
  const isFirefox = process.env.BROWSER === 'firefox';
  const viewport = {
    width: Number(process.env.BENCH_WIDTH || 1280),
    height: Number(process.env.BENCH_HEIGHT || 720),
  };
  const duration = Number(process.env.BENCH_SECONDS || 8);
  const counts = (process.env.BENCH_COUNTS || '50,300').split(',').map(Number);
  const deviceScaleFactor = Number(process.env.BENCH_DPR || 1);
  const browser = await (isFirefox ? firefox : chromium).launch({
    headless: true,
    ...(!isFirefox && process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
    ...(!isFirefox && !process.env.BENCH_VSYNC
      ? { args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'] }
      : {}),
  });
  const server = createServer({ root: path.resolve(__dirname, '../dist'), prefix: '/' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const result = {
    date: new Date().toISOString().slice(0, 10),
    browser: `${isFirefox ? 'firefox' : process.env.BROWSER_CHANNEL || 'chromium'} ${browser.version()}`,
    viewport,
    deviceScaleFactor,
    duration,
    cadence: isFirefox || process.env.BENCH_VSYNC ? 'vsync' : 'uncapped',
  };
  try {
    for (const count of counts) {
      const page = await browser.newPage({ viewport, deviceScaleFactor });
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__frames = [];
        window.__gaps = [];
        let last = null;
        window.requestAnimationFrame = (callback) =>
          raf((time) => {
            const start = performance.now();
            if (last !== null) window.__gaps.push(time - last);
            last = time;
            callback(time);
            window.__frames.push(performance.now() - start);
          });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/?bench`);
      await page.locator('#start').click();
      await page.evaluate(() => window.__utraceSession.commands.chooseSeed('123456'));
      await page.locator('#runHeroStart').click();
      await page.waitForFunction(() => document.body.dataset.mode === 'play');
      await page.evaluate(
        ({ count, units }) => {
          const game = window.__utraceSession;
          let k = 0;
          setInterval(() => {
            const s = game.state;
            if (!s) return;
            if (game.mode === 'level') game.pickUpgrade(0);
            s.spawn = 1e9;
            s.p.hp = s.p.max;
            s.p.inv = 1;
            while (s.enemies.length < count) {
              const a = (k * 2.399) % (Math.PI * 2),
                r = 120 + ((k * 37) % 420);
              const e = game.spawn(units[k++ % units.length], false, {
                x: s.p.x + Math.cos(a) * r,
                y: s.p.y + Math.sin(a) * r * 0.6,
              });
              if (e) e.speed *= 0.3;
            }
          }, 50);
        },
        { count, units },
      );
      await page.waitForTimeout(1500);
      const startTime = await page.evaluate(() => {
        window.__frames.length = 0;
        window.__gaps.length = 0;
        return window.__utraceSession.state.t;
      });
      await page.waitForTimeout(duration * 1000);
      const frames = (await page.evaluate(() => window.__frames.slice())).sort((a, b) => a - b);
      const gaps = (await page.evaluate(() => window.__gaps.slice())).sort((a, b) => a - b);
      const at = (q) => +frames[Math.floor(frames.length * q)].toFixed(2);
      result[count + ' enemies'] = {
        fps: +(frames.length / duration).toFixed(1),
        jsMedianMs: at(0.5),
        jsP95Ms: at(0.95),
        jsMaxMs: +frames.at(-1).toFixed(2),
        gapP95Ms: +gaps[Math.floor(gaps.length * 0.95)].toFixed(2),
        gapMaxMs: +gaps.at(-1).toFixed(2),
        gapsOver50Ms: gaps.filter((gap) => gap > 50).length,
        simulatedSeconds: await page.evaluate(
          (start) => window.__utraceSession.state.t - start,
          startTime,
        ),
      };
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const output = process.env.BENCH_OUTPUT
    ? path.resolve(process.env.BENCH_OUTPUT)
    : path.resolve(__dirname, '../docs/benchmarks/render.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
