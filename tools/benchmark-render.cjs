// Browser render throughput on the built site (run `npm run build` first).
// Uncapped requestAnimationFrame, N live enemies kept on screen, invulnerable player.
// fps = frames drawn per second; js* = time spent inside one frame callback (update + draw).
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { createServer } = require('./server.cjs');

const units = ['l3', 'pepsi', 'inbev', 'mars', 'baltika', 'multon', 'loreal', 'ferrero'];

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'],
  });
  const server = createServer({ root: path.resolve(__dirname, '../dist'), prefix: '/' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const result = { date: new Date().toISOString().slice(0, 10), viewport: '1280x720' };
  try {
    for (const count of [50, 300]) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      await page.addInitScript(() => {
        const raf = window.requestAnimationFrame.bind(window);
        window.__frames = [];
        window.requestAnimationFrame = (callback) =>
          raf((time) => {
            const start = performance.now();
            callback(time);
            window.__frames.push(performance.now() - start);
          });
      });
      await page.goto(`http://127.0.0.1:${server.address().port}/?bench`);
      await page.locator('#start').click();
      await page.locator('#runHeroStart').click();
      await page.waitForFunction(() => document.body.dataset.mode === 'play');
      await page.evaluate(
        ({ count, units }) => {
          const game = window.__utraceSession;
          let k = 0;
          setInterval(() => {
            const s = game.state;
            if (!s) return;
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
      await page.evaluate(() => (window.__frames.length = 0));
      await page.waitForTimeout(8000);
      const frames = (await page.evaluate(() => window.__frames.slice())).sort((a, b) => a - b);
      const at = (q) => +frames[Math.floor(frames.length * q)].toFixed(2);
      result[count + ' enemies'] = {
        fps: +(frames.length / 8).toFixed(1),
        jsMedianMs: at(0.5),
        jsP95Ms: at(0.95),
        jsMaxMs: +frames.at(-1).toFixed(2),
      };
      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  const output = path.resolve(__dirname, '../docs/benchmarks/render.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
