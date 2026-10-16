const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness.cjs');
const { edgeMarker, edgeTargets } = require('../src/rendering/edge-arrows.js');
const { runStats } = require('../src/app/views.js');

// Stage 5 leftovers: final stats on pause, edge arrows to the next node and the boss, and
// the encyclopedia of weapons, passives and evolutions.
(async () => {
  // Edge markers: none on screen, clamped to the inner rectangle off screen.
  assert.equal(edgeMarker({ x: 150, y: 100 }, 100, 50, 800, 600), null);
  const right = edgeMarker({ x: 5000, y: 50 + 321 }, 100, 50, 800, 600, 30);
  assert.equal(Math.round(right.x), 770);
  assert(Math.abs(right.y - 321) < 1e-6 && Math.abs(right.angle) < 1e-9);
  const corner = edgeMarker({ x: -5000, y: -5000 }, 0, 0, 800, 600, 30);
  assert(corner.x >= 30 && corner.x <= 770, 'inside the sides');
  assert(corner.y >= 600 * 0.27 - 1e-9 && corner.y <= 600 * 0.8 + 1e-9, 'clear of the HUD');

  const h = await createHarness();
  const game = h.session,
    P = h.env.Progression;
  game.start();
  const s = game.state;
  s.spawn = 9999;
  const targets = edgeTargets(s);
  assert.equal(targets.length, 1, 'only the nearest guarded node');
  for (const n of s.nodes) n.status = 'workaround';
  assert.equal(edgeTargets(s).length, 0);
  const boss = game.spawn('crpt', true, { x: s.p.x - 700, y: s.p.y });
  assert.equal(edgeTargets(s)[0].label, 'ЦРПТ');
  game.draw();
  boss.hp = 0;

  // Final stats reflect bonuses and active abilities.
  s.stats.damage = 1.3;
  s.stats.armor = 2;
  const rows = Object.fromEntries(runStats(s).map((r) => [r.label, r.value]));
  assert.equal(rows['Урон'], '130%');
  assert.equal(rows['Броня'], '2');
  assert(game.views.build().stats.length >= 9);
  assert(game.activateAbility(1));
  assert.equal(
    Object.fromEntries(runStats(s).map((r) => [r.label, r.value]))['Темп оружия'],
    '160%',
    'overclock shows in the final numbers',
  );

  // Encyclopedia: locked weapons and hidden evolutions until assembled.
  const view = () => game.views.encyclopedia();
  let codex = view();
  assert.equal(codex.weapons.length, 8);
  assert.equal(codex.weapons.filter((w) => w.locked).length, 4);
  assert(codex.weapons.find((w) => w.locked).condition, 'locked weapons show a condition');
  assert.equal(codex.found, 0);
  assert.equal(codex.weapons[0].evolution.name, '???');
  assert.equal(codex.passives.length, 8);
  assert(codex.passives.find((p) => p.id === 'area').condition.includes('Орбитальный сканер'));
  s.weapons.push({ id: 'orbit', level: 6, cd: 1, evolved: true, phase: 0 });
  s.stats.heroEvo = true;
  game.menu();
  assert(P.evolutionSeen('orbit') && P.evolutionSeen('hero_utrace'));
  codex = view();
  assert.equal(codex.found, 2);
  assert.equal(codex.weapons.find((w) => w.id === 'orbit').evolution.name, 'Кольцо валидации');
  h.session.dispose();

  console.log('PASS: pause stats, edge arrows and encyclopedia');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
