'use strict';
// Layout check across every screen and the plan's target sizes (plan, stage 5, «Вёрстка»).
//   npm run build && npm run test:layout [-- --only phone-390] [--screen hud] [--quick]
// Each screen is opened through the session handle the app exposes with ?bench, then checked:
//   - no horizontal page scroll;
//   - every visible control can be scrolled into view, stays inside the viewport and is the
//     element under its own centre (nothing covers it);
//   - on touch devices enabled controls are at least 44×44 px;
//   - button labels are not clipped; HUD panels do not overlap each other.
// Screenshots go to test-results/layout/<size>/<screen>.png, findings to report.json.
// Duplicate labels on one screen are reported as warnings for the manual button audit.
// Uses Playwright's Chromium, or a system browser with BROWSER_CHANNEL=msedge|chrome.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startPreview } = require('./preview-server.cjs');

const out = path.resolve(__dirname, '../test-results/layout');
const dist = path.resolve(__dirname, '../dist');
const MIN_TOUCH = 44;

const phone = (name, width, height, dpr) => [
  { name, width, height, dpr, touch: true },
  { name: name + '-land', width: height, height: width, dpr, touch: true },
];
const viewports = [
  ...phone('phone-360', 360, 640, 2),
  ...phone('phone-390', 390, 844, 3),
  ...phone('phone-412', 412, 915, 3),
  { name: 'tablet', width: 768, height: 1024, dpr: 2, touch: true },
  { name: 'tablet-land', width: 1024, height: 768, dpr: 2, touch: true },
  { name: 'laptop', width: 1366, height: 768, dpr: 1 },
  { name: 'fullhd', width: 1920, height: 1080, dpr: 1 },
  { name: 'qhd', width: 2560, height: 1440, dpr: 1 },
  { name: 'laptop-ui80', width: 1366, height: 768, dpr: 1, uiScale: 0.8 },
  { name: 'laptop-ui130', width: 1366, height: 768, dpr: 1, uiScale: 1.3 },
  // UI scale on touch devices: the HUD grows with it while the arena does not.
  ...phone('phone-360-ui80', 360, 640, 2).map((v) => ({ ...v, uiScale: 0.8 })),
  ...phone('phone-360-ui130', 360, 640, 2).map((v) => ({ ...v, uiScale: 1.3 })),
  ...phone('phone-390-ui130', 390, 844, 3).map((v) => ({ ...v, uiScale: 1.3 })),
  { name: 'tablet-ui130', width: 768, height: 1024, dpr: 2, touch: true, uiScale: 1.3 },
  { name: 'tablet-land-ui80', width: 1024, height: 768, dpr: 2, touch: true, uiScale: 0.8 },
];
// In play, the interface may cover at most this share of the screen, and this share of the
// circle around the hero (radius a quarter of the shorter side) where the fight happens.
const MAX_COVER = 0.3,
  MAX_COVER_HERO = 0.08;
const quick = ['phone-360', 'phone-390-land', 'tablet', 'laptop'];

// Screens: `open` runs in the page with the session `s`.
const screens = [
  { name: 'menu', open: () => {} },
  { name: 'hero-select', open: (s) => s.commands.openHeroSelect() },
  { name: 'shop', open: (s) => s.commands.openShop() },
  { name: 'achievements', open: (s) => s.commands.openAchievements() },
  { name: 'encyclopedia', open: (s) => s.commands.openEncyclopedia() },
  { name: 'settings', open: (s) => s.commands.openSettings('menu') },
  {
    name: 'hud',
    open: (s) => {
      s.start();
      s.state.spawn = 9999;
      s.state.eventPlan = [{ time: 0, type: 'incident' }];
      s.state.eventIndex = 0;
      s.update(0.016);
    },
  },
  {
    name: 'level-up',
    open: (s) => {
      s.start();
      s.state.xp = s.state.need;
      s.update(0.016);
      s.views.run().levelLock = 0;
    },
  },
  {
    name: 'pause',
    open: (s) => {
      s.start();
      s.pause();
    },
  },
  {
    name: 'pause-settings',
    open: (s) => {
      s.start();
      s.pause();
      s.commands.openSettings('paused');
    },
  },
  {
    name: 'bestiary-page',
    open: () =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'ВРАГИ И КЛИЕНТЫ')
        .click(),
  },
  {
    name: 'arena-page',
    open: () =>
      [...document.querySelectorAll('button')]
        .find((b) => b.textContent.trim() === 'КАРТА')
        .click(),
  },
  // Learning map: the test button by a terminal, then a test's intro, question and revival.
  {
    name: 'learning-hud',
    hud: true,
    open: (s) => {
      s.selectMap('learningLab');
      s.start();
      s.state.spawn = 9999;
      const terminal = s.state.nodes.find((n) => n.status === 'available');
      Object.assign(s.state.p, { x: terminal.x, y: terminal.y });
      s.update(0.016);
    },
  },
  {
    name: 'learning-intro',
    open: (s) => {
      s.selectMap('learningLab');
      s.start();
      const terminal = s.state.nodes.find((n) => n.status === 'available');
      Object.assign(s.state.p, { x: terminal.x, y: terminal.y });
      s.commands.startLearningTest(terminal.id);
    },
  },
  {
    name: 'learning-question',
    open: (s) => {
      s.selectMap('learningLab');
      s.start();
      const terminal = s.state.nodes.find((n) => n.status === 'available');
      Object.assign(s.state.p, { x: terminal.x, y: terminal.y });
      s.commands.startLearningTest(terminal.id);
      s.commands.advanceLearning(s.state.learning.active.id);
    },
  },
  {
    name: 'learning-revive',
    open: (s) => {
      s.selectMap('learningLab');
      s.start();
      s.state.p.hp = 0;
      s.update(0.016);
    },
  },
  {
    name: 'result',
    open: (s) => {
      s.start();
      s.state.t = 200;
      s.finish(true);
    },
  },
];

// A save with everything open, so every screen shows its full content.
const progression = {
  codes: 500,
  kills: 120,
  unlocked: ['utrace', 'traceability', 'serialization', 'ba', 'qa'],
  levels: { health: 1, power: 1 },
  stats: { bossKills: 1, wins: 1, maxTime: 320, totalTime: 900 },
  loads: { utrace: 2 },
};

// Runs inside the page: returns problems and warnings for the current screen.
function inspect({ minTouch, touch, hud, maxCover, maxCoverHero }) {
  const problems = [],
    warnings = [];
  const W = window.innerWidth,
    H = window.innerHeight;
  const name = (el) =>
    el.id
      ? '#' + el.id
      : `${el.tagName.toLowerCase()} «${(el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 40)}»`;
  const visible = (el) => {
    if (el.closest('[inert]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (el.checkVisibility)
      return el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const st = window.getComputedStyle(el);
    return st.visibility !== 'hidden' && st.display !== 'none' && Number(st.opacity) > 0;
  };
  const root = document.documentElement;
  if (root.scrollWidth > W + 1)
    problems.push(`горизонтальная прокрутка страницы: ${root.scrollWidth} > ${W}`);

  const controls = [
    ...document.querySelectorAll('button, select, input, textarea, a[href], [role="button"]'),
  ].filter(visible);
  const labels = new Map();
  for (const el of controls) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    if (r.left < -1 || r.right > W + 1)
      problems.push(
        `${name(el)} выходит за экран по ширине (${Math.round(r.left)}…${Math.round(r.right)})`,
      );
    if (r.top < -1 || r.bottom > H + 1)
      problems.push(
        `${name(el)} недостижим прокруткой (${Math.round(r.top)}…${Math.round(r.bottom)})`,
      );
    const x = Math.min(W - 1, Math.max(0, r.left + r.width / 2)),
      y = Math.min(H - 1, Math.max(0, r.top + r.height / 2));
    const hit = document.elementFromPoint(x, y);
    if (hit && hit !== el && !el.contains(hit))
      problems.push(`${name(el)} перекрыт элементом ${name(hit)}`);
    // A checkbox inside a label is tapped through the whole label.
    const target =
      (el.type === 'checkbox' || el.type === 'radio') && el.closest('label')
        ? el.closest('label').getBoundingClientRect()
        : r;
    if (
      touch &&
      !el.disabled &&
      el.type !== 'range' &&
      (target.width < minTouch || target.height < minTouch)
    )
      problems.push(`${name(el)} мал для касания: ${Math.round(r.width)}×${Math.round(r.height)}`);
    if (touch && el.type === 'range' && r.height < minTouch / 2)
      problems.push(`${name(el)} ползунок ниже ${minTouch / 2} px`);
    if (el.tagName === 'BUTTON' && el.scrollWidth > el.clientWidth + 2)
      problems.push(`${name(el)}: подпись обрезана`);
    const label = (el.getAttribute('aria-label') || el.textContent || '')
      .trim()
      .replace(/\s+/g, ' ');
    if (label.length > 1) labels.set(label, (labels.get(label) || 0) + 1);
  }
  for (const [label, count] of labels)
    if (count > 1) warnings.push(`подпись «${label.slice(0, 50)}» повторяется ${count} раза`);

  if (hud) {
    const panels = [
      '#hud > .hudbox:not(.hudright)',
      '#hud .build-panel',
      '#hud .hudright',
      '#hud .topcenter',
      '#nodeProgress',
      '#runEvent',
      '.learning-hud',
      '#abilities',
      '#actions',
      '#stick',
    ]
      .map((selector) => [selector, document.querySelector(selector)])
      .filter(([, el]) => el && visible(el));
    for (let i = 0; i < panels.length; i++)
      for (let j = i + 1; j < panels.length; j++) {
        const [outer, inner] = [panels[i][1], panels[j][1]];
        const a = outer.getBoundingClientRect(),
          b = inner.getBoundingClientRect();
        // A panel inside another (slots in the health box) must stay within it.
        if (outer.contains(inner) || inner.contains(outer)) {
          const [box, part] = outer.contains(inner) ? [a, b] : [b, a];
          if (part.bottom > box.bottom + 2 || part.right > box.right + 2)
            problems.push(`HUD: ${panels[j][0]} выходит за ${panels[i][0]}`);
          continue;
        }
        const overlap =
          Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
        if (overlap) problems.push(`HUD: ${panels[i][0]} пересекается с ${panels[j][0]}`);
      }
    for (const [selector, el] of panels) {
      const r = el.getBoundingClientRect();
      if (r.left < -1 || r.right > W + 1 || r.top < -1 || r.bottom > H + 1)
        problems.push(`HUD: ${selector} выходит за экран`);
    }
  }
  // How much of the arena the interface hides. HUD panels let clicks through to the canvas,
  // so hit testing cannot see them: collect every painted element (background, border, text,
  // image) of the interface and sample which screen points they cover.
  let coverage = null;
  if (hud) {
    // Messages come and go (toast, tip, event line); they are measured but not judged.
    const messages = ['#toast', '#tip', '#runEvent'].map((q) => document.querySelector(q));
    const painted = [],
      passing = [];
    const transparent = (color) => !color || color === 'transparent' || /,\s*0\)$/.test(color);
    for (const el of document.body.querySelectorAll('*')) {
      if (el.tagName === 'CANVAS' || !visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width * r.height > W * H * 0.5) continue;
      const st = window.getComputedStyle(el);
      const paints =
        !transparent(st.backgroundColor) ||
        (parseFloat(st.borderTopWidth) > 0 && !transparent(st.borderTopColor)) ||
        ['IMG', 'svg', 'BUTTON', 'INPUT', 'SELECT'].includes(el.tagName) ||
        [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (paints) (messages.some((m) => m && m.contains(el)) ? passing : painted).push(r);
    }
    const step = 8,
      cx = W / 2,
      cy = H / 2,
      radius = Math.min(W, H) / 4;
    let total = 0,
      hidden = 0,
      near = 0,
      nearHidden = 0,
      shown = 0,
      nearShown = 0;
    for (let y = step / 2; y < H; y += step)
      for (let x = step / 2; x < W; x += step) {
        const covered = painted.some(
          (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
        );
        const message =
          covered ||
          passing.some((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
        total++;
        hidden += covered ? 1 : 0;
        shown += message ? 1 : 0;
        if (Math.hypot(x - cx, y - cy) <= radius) {
          near++;
          nearHidden += covered ? 1 : 0;
          nearShown += message ? 1 : 0;
        }
      }
    coverage = {
      screen: Math.round((hidden / total) * 100),
      hero: Math.round((nearHidden / Math.max(1, near)) * 100),
      withMessages: Math.round((shown / total) * 100),
      heroWithMessages: Math.round((nearShown / Math.max(1, near)) * 100),
    };
    if (hidden / total > maxCover)
      problems.push(`интерфейс закрывает ${coverage.screen}% экрана (норма до ${maxCover * 100}%)`);
    if (nearHidden / Math.max(1, near) > maxCoverHero)
      problems.push(
        `интерфейс закрывает ${coverage.hero}% зоны вокруг героя (норма до ${maxCoverHero * 100}%)`,
      );
  }
  // Every screen offers a reachable sound toggle.
  const sound = [...document.querySelectorAll('[aria-label="Переключить звук"]')].filter(visible);
  if (!sound.length) problems.push('нет кнопки звука');
  // One way back: two back/close/done buttons on one screen duplicate each other.
  const back = controls.filter((el) =>
    /^(←|назад|в меню|готово|закрыть)/i.test((el.textContent || '').trim()),
  );
  if (back.length > 1)
    problems.push('несколько кнопок «назад»: ' + back.map((el) => name(el)).join(', '));
  // Without a keyboard, keyboard hints and key settings are noise.
  if (touch) {
    const keyText =
      /WASD|Нажми \d|\[\s?\d\s?\]|\[[A-ZА-Я]\]|\bEsc\b|горяч\S* клавиш|клавиш[уи] действия|^[QE] · /;
    const walker = document.createTreeWalker(document.body, window.NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent.trim();
      if (!text || !keyText.test(text) || !visible(n.parentElement)) continue;
      problems.push(`подсказка про клавиатуру на сенсорном экране: «${text.slice(0, 50)}»`);
    }
    if (document.querySelector('[id^="bind-"]'))
      problems.push('настройка клавиш на сенсорном экране');
  }
  window.scrollTo(0, 0);
  return { problems, warnings, coverage };
}

async function main(argv) {
  const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : null;
  const screenOnly = argv.includes('--screen')
    ? argv[argv.indexOf('--screen') + 1].split(',')
    : null;
  const sizes = viewports.filter((v) =>
    only ? only.includes(v.name) : argv.includes('--quick') ? quick.includes(v.name) : true,
  );
  if (!fs.existsSync(path.join(dist, 'index.html'))) {
    console.error('Нет сборки: сначала npm run build');
    return 1;
  }
  fs.mkdirSync(out, { recursive: true });
  const server = await startPreview();
  const url = server.url + '?bench';
  const channel = process.env.BROWSER_CHANNEL;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  } catch (error) {
    if (channel) throw error;
    browser = await chromium.launch({ headless: true, channel: 'msedge' });
  }
  const report = [];
  let failed = 0;
  try {
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.dpr,
        isMobile: !!size.touch,
        hasTouch: !!size.touch,
      });
      await context.addInitScript(
        ({ progression, uiScale }) => {
          if (window.sessionStorage.getItem('layout-seeded')) return;
          window.sessionStorage.setItem('layout-seeded', '1');
          localStorage.clear();
          localStorage.setItem('utreys-progression-v1', JSON.stringify(progression));
          localStorage.setItem('utreys-settings', JSON.stringify({ uiScale, hints: true }));
        },
        { progression, uiScale: size.uiScale || 1 },
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      fs.mkdirSync(path.join(out, size.name), { recursive: true });
      for (const screen of screens) {
        if (screenOnly && !screenOnly.includes(screen.name)) continue;
        await page.goto(url);
        await page.waitForFunction(() => !!window.__utraceSession);
        await page.evaluate(`(${screen.open})(window.__utraceSession)`);
        await page.waitForTimeout(250);
        await page.evaluate(
          () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
        );
        const result = await page.evaluate(inspect, {
          minTouch: MIN_TOUCH,
          touch: !!size.touch,
          hud: screen.hud ?? screen.name === 'hud',
          maxCover: MAX_COVER,
          maxCoverHero: MAX_COVER_HERO,
        });
        await page.screenshot({ path: path.join(out, size.name, screen.name + '.png') });
        if (errors.length) result.problems.push(...errors.splice(0).map((e) => 'ошибка JS: ' + e));
        report.push({ size: size.name, screen: screen.name, ...result });
        if (result.problems.length) failed++;
        const mark = result.problems.length ? 'FAIL' : 'ok  ';
        const cover = result.coverage
          ? ` · интерфейс ${result.coverage.screen}% экрана, ${result.coverage.hero}% у героя` +
            ` (с сообщениями ${result.coverage.withMessages}% и ${result.coverage.heroWithMessages}%)`
          : '';
        console.log(`${mark} ${size.name.padEnd(18)} ${screen.name}${cover}`);
        for (const p of result.problems) console.log('       ✗ ' + p);
      }
      await context.close();
    }
  } finally {
    await browser.close();
    await server.close();
  }
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  const warnings = report.reduce((n, r) => n + r.warnings.length, 0);
  console.log(
    `\n${report.length - failed}/${report.length} экранов без проблем · предупреждений: ${warnings}` +
      ` · отчёт и скриншоты: test-results/layout/`,
  );
  return failed ? 1 : 0;
}

if (require.main === module)
  main(process.argv.slice(2)).then(
    (code) => (process.exitCode = code),
    (error) => {
      console.error(error);
      process.exitCode = 1;
    },
  );

module.exports = { viewports, screens };
