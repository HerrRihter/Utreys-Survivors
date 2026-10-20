// Headless balance runs: a simple kiting bot plays each hero on natural waves and reports
// survival, level, who dealt the damage and who got killed. Not a skill benchmark: the bot
// only dodges, collects experience and picks cards by a fixed priority, so compare runs
// against each other, not against human play. Each run starts from its seed (1000, 8919, ...),
// so the same options repeat the same runs exactly.
//   node --experimental-vm-modules tools/balance-sim.cjs [--load N] [--seeds N] [--time S]
//        [--boss S] [--hero id] [--map id|all] [--json file] [--passive]
// `--boss S` resolves all nodes at S seconds so the CRPT arrives and its fight is measured.
const fs = require('node:fs');
const { createHarness } = require('../tests/helpers/game-harness.cjs');
const { heroDefinitions } = require('../data/characters/heroes.js');
const { nodeGuardian } = require('../src/systems/node-objectives.js');
const { mapDefinitions } = require('../data/maps/maps.js');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : fallback;
};
const load = Number(option('load', 1)),
  seeds = Number(option('seeds', 3)),
  duration = Number(option('time', 600)),
  bossAt = option('boss', null) === null ? null : Number(option('boss')),
  onlyHero = option('hero', null),
  mapOption = option('map', 'empty'),
  mapIds = mapOption === 'all' ? Object.keys(mapDefinitions) : [mapOption],
  jsonFile = option('json', null),
  objectiveAt = Number(option('objective', 25)),
  // `--passive`: no dodging at all, only walking to experience, nodes and the boss.
  passive = args.includes('--passive'),
  // `--first`: always take the first card (the old, weak build).
  firstCard = args.includes('--first');
const heroIds = ['utrace', 'traceability', 'serialization', 'ba', 'qa'];

// Card choice like a player's: weapons first, then damage, tempo, health and the rest.
const cardScore = {
  weapon: 10,
  hero: 8,
  might: 7,
  tempo: 6,
  area: 5,
  vitality: 5,
  recovery: 4,
  ability: 3,
};
function pickCard(cards) {
  let best = 0,
    score = -1;
  cards.forEach((card, i) => {
    const v = (cardScore[card.id] ?? cardScore[card.kind] ?? 1) + (card.isNew ? 0 : 0.5);
    if (v > score) ((best = i), (score = v));
  });
  return best;
}

// Steering: away from nearby enemies (weighted by their hit), across incoming shots, out of
// ground hazards, toward the nearest experience and back from the walls.
function steer(s, units, size, reachOf) {
  const p = s.p;
  // Telegraphs first: step out of ground marks and off a charger's line.
  let ex = 0,
    ey = 0;
  for (const h of s.hazards || []) {
    const dx = p.x - h.x,
      dy = p.y - h.y,
      d = Math.hypot(dx, dy) || 1;
    if (d < h.r + 25) ((ex += dx / d), (ey += dy / d));
  }
  for (const e of s.enemies) {
    if (e.dash?.phase !== 'wind' && e.dash?.phase !== 'go') continue;
    const rx = p.x - e.x,
      ry = p.y - e.y,
      along = rx * e.dash.dx + ry * e.dash.dy,
      across = rx * -e.dash.dy + ry * e.dash.dx;
    if (along > -20 && along < 260 && Math.abs(across) < 50) {
      const side = Math.sign(across) || 1;
      ex += -e.dash.dy * side;
      ey += e.dash.dx * side;
    }
  }
  if (!passive && (ex || ey)) {
    const l = Math.hypot(ex, ey);
    return { x: ex / l, y: ey / l };
  }
  // The hero strikes where it faces: turn to the nearest target while a strike is due.
  if (s.attack < 0.12 || (p.action && !p.action.hit)) {
    let target = null,
      near = reachOf;
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.hp > 0 && d < near) ((target = e), (near = d));
    }
    // At a node the bug is the target.
    for (const e of s.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (e.hp > 0 && (e.nodeId || e.boss) && d < reachOf) ((target = e), (near = d));
    }
    if (target) {
      const d = Math.max(1, near);
      return { x: ((target.x - p.x) / d) * 0.25, y: ((target.y - p.y) / d) * 0.25 };
    }
  }
  let x = 0,
    y = 0;
  for (const e of passive ? [] : s.enemies) {
    if (e.hp <= 0) continue;
    const dx = p.x - e.x,
      dy = p.y - e.y,
      d = Math.hypot(dx, dy) || 1,
      u = units[e.unit],
      reach = Math.max(170, (u?.attack === 'pulse' ? u.range : 0) + 90);
    if (d > reach || (u?.attack === 'projectile' && d > 140)) continue;
    const w = (1 - d / reach) ** 2 * (e.damage || 10) * (e.boss ? 3 : 1);
    x += (dx / d) * w;
    y += (dy / d) * w;
  }
  for (const b of passive ? [] : s.enemyShots) {
    if (b.wait > 0) continue;
    const dx = p.x - b.x,
      dy = p.y - b.y,
      d = Math.hypot(dx, dy) || 1;
    if (d > 160) continue;
    const v = Math.hypot(b.vx, b.vy) || 1,
      side = Math.sign(dx * -b.vy + dy * b.vx) || 1;
    x += (-b.vy / v) * side * 25;
    y += (b.vx / v) * side * 25;
  }
  for (const h of passive ? [] : s.hazards || []) {
    const dx = p.x - h.x,
      dy = p.y - h.y,
      d = Math.hypot(dx, dy) || 1;
    if (d > h.r + 30) continue;
    x += (dx / d) * 60;
    y += (dy / d) * 60;
  }
  let best = null,
    bestD = 520;
  for (const g of s.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < bestD) ((best = g), (bestD = d));
  }
  if (best) {
    x += ((best.x - p.x) / Math.max(1, bestD)) * 8;
    y += ((best.y - p.y) / Math.max(1, bestD)) * 8;
  }
  // The run's goal: the nearest unresolved node (standing on the side away from its bug),
  // then the CRPT. Gems first for the opening seconds.
  const boss = s.enemies.find((e) => e.boss && e.hp > 0);
  let goal = null;
  if (boss) goal = Math.hypot(boss.x - p.x, boss.y - p.y) > 170 ? boss : null;
  else if (s.t > objectiveAt) {
    let nearest = Infinity;
    for (const n of s.nodes || []) {
      const g = n.status === 'guarded' ? nodeGuardian(s, n) : null;
      if (!g) continue;
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d >= nearest) continue;
      nearest = d;
      // Stand just inside striking reach of the bug.
      const k = Math.max(0, d - reachOf * 0.6) / Math.max(1, d);
      goal = { x: p.x + (g.x - p.x) * k, y: p.y + (g.y - p.y) * k };
    }
  }
  if (goal) {
    const gx = goal.x - p.x,
      gy = goal.y - p.y,
      g = Math.hypot(gx, gy);
    if (g > 12) {
      x += (gx / g) * 9;
      y += (gy / g) * 9;
    }
  }
  const cx = size / 2 - p.x,
    cy = size / 2 - p.y,
    c = Math.hypot(cx, cy) || 1;
  x += (cx / c) * 6 * (c / (size / 2)) ** 2;
  y += (cy / c) * 6 * (c / (size / 2)) ** 2;
  const l = Math.hypot(x, y);
  return l > 0.5 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

async function play(hero, map, seed) {
  const h = await createHarness();
  const P = h.env.Progression;
  P.earn(1e6);
  for (const id of heroIds) P.buyHero(id);
  // Every map open, as after the first win.
  for (const id of Object.keys(mapDefinitions))
    P.recordRunStats({ win: true, hero: 'utrace', map: id, time: 600 });
  const game = h.session;
  game.select(hero);
  game.selectMap(map);
  game.views.run().nextSeed = seed;
  game.start();
  const s = game.state,
    run = game.views.run(),
    units = h.env.unitDefinitions,
    size = 2200,
    spec = heroDefinitions[hero],
    reach = (spec?.attack === 'packet' ? 300 : (spec?.range || 80) * 1.4) + 20;
  s.load = load;
  if (process.env.SIM_NO_RECURRING)
    for (const id of Object.keys(s.waveNext)) s.waveNext[id] = Infinity;
  if (process.env.SIM_NO_ELITES) s.eliteNext = Infinity;
  // SIM_STRIP=dash,keep,... removes role fields for experiments.
  for (const field of (process.env.SIM_STRIP || '').split(',').filter(Boolean))
    for (const u of Object.values(units)) delete u[field];
  const bossHurt = {},
    hurt = {},
    kills = {},
    spawned = {};
  const hpBefore = () => s.p.hp;
  let bossSpawnedAt = null,
    bossKilledAt = null,
    lastUnit = null,
    seen = new WeakSet();
  const dt = 1 / 60;
  for (let frame = 0; frame < duration / dt; frame++) {
    if (game.mode === 'level') {
      run.levelLock = 0;
      game.pickUpgrade(firstCard ? 0 : pickCard(run.choice || []));
    }
    if (game.mode === 'end') break;
    if (game.mode !== 'play') {
      game.resume?.();
      if (game.mode !== 'play') break;
    }
    if (bossAt !== null && s.t >= bossAt && s.nodes.some((n) => n.status === 'guarded')) {
      for (const n of s.nodes) {
        s.enemies = s.enemies.filter((e) => e.id !== n.guardianId);
        n.status = 'workaround';
      }
    }
    for (const e of s.enemies)
      if (!seen.has(e)) {
        seen.add(e);
        spawned[e.unit] = (spawned[e.unit] || 0) + 1;
        if (e.boss && bossSpawnedAt === null) bossSpawnedAt = s.t;
      }
    const alive = new Set(s.enemies.filter((e) => e.hp > 0));
    run.stick = steer(s, units, size, reach);
    const before = hpBefore();
    game.update(dt);
    if (s.p.hp < before) {
      const by = s.lastHitBy || 'unknown';
      hurt[by] = (hurt[by] || 0) + before - s.p.hp;
      if (bossSpawnedAt !== null) bossHurt[by] = (bossHurt[by] || 0) + before - s.p.hp;
      lastUnit = by;
    }
    for (const e of alive)
      if (e.hp <= 0) {
        kills[e.unit] = (kills[e.unit] || 0) + 1;
        if (e.boss && bossKilledAt === null) bossKilledAt = s.t;
      }
    if (s.p.hp <= 0 && process.env.SIM_DEBUG) {
      const near = {};
      for (const e of s.enemies)
        if (e.hp > 0 && Math.hypot(e.x - s.p.x, e.y - s.p.y) < 450)
          near[e.unit] = (near[e.unit] || 0) + 1;
      console.log(
        '  death at',
        Math.round(s.t),
        'alive',
        s.enemies.length,
        'near',
        JSON.stringify(near),
        'hazards',
        (s.hazards || []).length,
        'shots',
        s.enemyShots.length,
        'slow',
        s.p.slowUntil > s.t,
      );
    }
    if (s.p.hp <= 0 || s.bossDead) break;
  }
  const result = {
    hero,
    map,
    seed,
    win: !!s.bossDead,
    // Damage dealt by source (hero, weapons, abilities) for the comparison of builds.
    damageBy: { ...s.damageBy },
    time: Math.round(s.t),
    died: s.p.hp <= 0,
    level: s.level,
    kills: s.kills,
    killedBy: s.p.hp <= 0 ? lastUnit : null,
    bossSpawnedAt: bossSpawnedAt && Math.round(bossSpawnedAt),
    bossKilledAt: bossKilledAt && Math.round(bossKilledAt),
    hurt,
    bossHurt,
    killsByUnit: kills,
    spawned,
  };
  game.dispose();
  return result;
}

(async () => {
  const results = [];
  for (const map of mapIds)
    for (const hero of onlyHero ? [onlyHero] : heroIds)
      for (let i = 0; i < seeds; i++) {
        const r = await play(hero, map, 1000 + i * 7919);
        results.push(r);
        console.log(
          `${map.padEnd(11)} ${hero.padEnd(14)} seed ${r.seed}: ${r.win ? 'won ' + r.time + 's' : r.died ? 'died ' + r.time + 's by ' + r.killedBy : 'alive ' + r.time + 's'}, lvl ${r.level}, kills ${r.kills}` +
            (r.bossSpawnedAt !== null ? `, boss ${r.bossSpawnedAt}s→${r.bossKilledAt ?? '-'}` : ''),
        );
      }
  const sum = (key) => {
    const out = {};
    for (const r of results)
      for (const [k, v] of Object.entries(r[key])) out[k] = (out[k] || 0) + v;
    return out;
  };
  const hurt = sum('hurt'),
    spawned = sum('spawned'),
    kills = sum('killsByUnit');
  const total = Object.values(hurt).reduce((a, b) => a + b, 0) || 1;
  console.log('\nunit             spawned  killed  dmg-to-hero  share');
  for (const unit of Object.keys({ ...spawned, ...hurt }).sort(
    (a, b) => (hurt[b] || 0) - (hurt[a] || 0),
  ))
    console.log(
      unit.padEnd(16),
      String(spawned[unit] || 0).padStart(7),
      String(kills[unit] || 0).padStart(7),
      String(Math.round(hurt[unit] || 0)).padStart(12),
      (((hurt[unit] || 0) / total) * 100).toFixed(1).padStart(5) + '%',
    );
  const died = results.filter((r) => r.died),
    won = results.filter((r) => r.win);
  const median = (list) =>
    list.length
      ? list.map((r) => r.time).sort((a, b) => a - b)[Math.floor(list.length / 2)] + 's'
      : '-';
  console.log(
    `\nload ${load}: ${won.length}/${results.length} won (median ${median(won)}), ${died.length} died (median ${median(died)}), mean level ${(results.reduce((a, r) => a + r.level, 0) / results.length).toFixed(1)}`,
  );
  if (jsonFile) fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
