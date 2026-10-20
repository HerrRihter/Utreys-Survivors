// Role mechanics of opponents, driven by the optional fields of data/enemies/units.js:
// movement (dash, flank, keep), support (heal, aura), enrage, summons, ground hazards and
// boss phases. `c` = { arena, spawn, hurtPlayer, effect, toast, units }; random choices draw from `s.rng`.

import { unitDefinitions } from '../../data/enemies/units.js';

const hazardColor = '#ff7043';

// Where an enemy walks this frame: a point to approach, or null to hold its ground.
export function moveGoal(c, s, e, u, d) {
  const p = s.p;
  if (u.keep) {
    if (d < u.keep - 40) {
      // Back away from the player.
      return { x: e.x + (e.x - p.x), y: e.y + (e.y - p.y), straight: true };
    }
    if (d <= u.keep + 30 && d < u.range - 20) return null;
    return p;
  }
  if (u.attack === 'projectile' || u.attack === 'mortar') return d > u.range - 20 ? p : null;
  if (d <= e.r + 10) return null;
  if (u.flank && d > 150) {
    // Approach from the side: aim at a point off the straight line.
    e.flankSide ??= s.rng.random() < 0.5 ? -1 : 1;
    const a = Math.atan2(e.y - p.y, e.x - p.x) + e.flankSide * u.flank,
      r = d * 0.55;
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, straight: true };
  }
  return p;
}

// Off-line goals (flank, retreat) go straight while the way is clear; everything else follows
// the shared flow field toward the player.
export function goalDirection(arena, e, goal, p) {
  if (goal.straight && arena.clear(e, goal, e.r)) {
    const l = Math.max(1, Math.hypot(goal.x - e.x, goal.y - e.y));
    return { x: (goal.x - e.x) / l, y: (goal.y - e.y) / l };
  }
  return arena.direction(e, p, e.r);
}

// A telegraphed lunge. Returns true while the dash owns the enemy's movement.
export function updateDash(c, s, e, u, dt, d, canAct) {
  const spec = u.dash;
  if (!spec) return false;
  const p = s.p;
  e.dashCd = Math.max(0, (e.dashCd ?? 1.5) - dt);
  if (!e.dash) {
    if (
      !canAct ||
      e.action ||
      e.dashCd > 0 ||
      d > spec.trigger ||
      d < u.range + 20 ||
      !c.arena.clear(e, p, e.r)
    )
      return false;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.dash = { phase: 'wind', t: 0, dx: Math.cos(a), dy: Math.sin(a), hit: false };
    e.heading = a;
  }
  const dash = e.dash;
  dash.t += dt;
  if (dash.phase === 'wind') {
    if (dash.t >= spec.wind) {
      dash.phase = 'go';
      dash.t = 0;
      c.effect('throw');
    }
    return true;
  }
  const step = spec.speed * (e.speed / u.speed) * dt;
  c.arena.move(e, dash.dx * step, dash.dy * step, e.r);
  if (!dash.hit && Math.hypot(e.x - p.x, e.y - p.y) < e.r + 20) {
    dash.hit = true;
    c.hurtPlayer(e);
  }
  if (dash.t >= spec.time) {
    e.dash = null;
    e.dashCd = spec.cooldown;
    e.cd = Math.max(e.cd, 0.6);
  }
  return true;
}

// Multipliers from enrage (wounded berserkers) and boss phases.
export function speedFactor(e, u) {
  return (e.enraged ? u.enrage.speed : 1) * (e.phaseEnrage?.speed || 1);
}
export function cooldownFactor(e, u) {
  return (e.enraged ? u.enrage.cooldown : 1) * (e.phaseEnrage?.cooldown || 1);
}

function summonAround(c, s, e, units, count) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = s.rng.random() * Math.PI * 2,
      r = e.r + 40 + s.rng.random() * 40,
      unit = units[Math.floor(s.rng.random() * units.length)];
    const m = c.spawn(unit, false, { x: e.x + Math.cos(a) * r, y: e.y + Math.sin(a) * r });
    if (m) {
      m.summonerId = e.id;
      out.push(m);
    }
  }
  return out;
}

function enterPhase(c, s, e, phase, quiet) {
  if (phase.shots) e.phaseShots = phase.shots;
  if (phase.mortar) e.phaseMortar = phase.mortar;
  if (phase.enrage) e.phaseEnrage = phase.enrage;
  if (quiet) return;
  if (phase.summon) summonAround(c, s, e, phase.summon.units, phase.summon.count);
  if (phase.message) c.toast(phase.message);
  c.effect('boss');
  s.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 160, life: 0.6, max: 0.6, color: '#ffd600' });
  s.shake = Math.max(s.shake, 6);
}

// Timers that run whatever the enemy is doing: healing, summons, pools, enrage, phases.
export function updateTraits(c, s, e, u, dt) {
  if (u.enrage && !e.enraged && e.hp <= e.max * u.enrage.below) {
    e.enraged = true;
    s.fx.push({ kind: 'ring', x: e.x, y: e.y, r: e.r + 18, life: 0.4, max: 0.4, color: u.color });
  }
  if (u.phases) {
    // A restored boss resumes at its phase without replaying the arrivals.
    if (e.phaseIndex === undefined) {
      e.phaseIndex = 0;
      while (e.phaseIndex < u.phases.length && e.hp < e.max * u.phases[e.phaseIndex].at)
        enterPhase(c, s, e, u.phases[e.phaseIndex++], true);
    }
    while (e.phaseIndex < u.phases.length && e.hp <= e.max * u.phases[e.phaseIndex].at)
      enterPhase(c, s, e, u.phases[e.phaseIndex++], false);
  }
  if (u.heal) {
    e.healCd = (e.healCd ?? u.heal.every) - dt;
    if (e.healCd <= 0) {
      e.healCd = u.heal.every;
      let healed = 0;
      for (const o of s.enemies) {
        if (o === e || o.hp <= 0 || o.boss || o.hp >= o.max) continue;
        if (Math.hypot(o.x - e.x, o.y - e.y) > u.heal.radius) continue;
        o.hp = Math.min(o.max, o.hp + o.max * u.heal.amount);
        healed++;
      }
      if (healed)
        s.fx.push({
          kind: 'ring',
          x: e.x,
          y: e.y,
          r: u.heal.radius,
          life: 0.45,
          max: 0.45,
          color: u.color,
        });
    }
  }
  if (u.summon) {
    const spec = u.summon;
    e.summonCd = (e.summonCd ?? spec.every / 2) - dt;
    if (e.summonCd <= 0 && Math.hypot(s.p.x - e.x, s.p.y - e.y) < (spec.reach ?? 650)) {
      e.summonCd = spec.every;
      let alive = 0;
      for (const o of s.enemies) if (o.summonerId === e.id && o.hp > 0) alive++;
      // `grow`: one more per call after every `grow` calls, up to `countMax`.
      const size = spec.grow
        ? Math.min(spec.countMax, spec.count + Math.floor((e.summons || 0) / spec.grow))
        : spec.count;
      e.summons = (e.summons || 0) + 1;
      const count = Math.min(size, spec.max - alive);
      if (count > 0) summonAround(c, s, e, spec.units, count);
    }
  }
  if (u.pools) {
    const spec = u.pools;
    e.poolCd = (e.poolCd ?? spec.every / 2) - dt;
    if (e.poolCd <= 0 && Math.hypot(s.p.x - e.x, s.p.y - e.y) < spec.reach) {
      e.poolCd = spec.every;
      for (let i = 0; i < spec.count; i++) {
        const a = s.rng.random() * Math.PI * 2,
          r = i === 0 ? 0 : spec.scatter * (0.5 + s.rng.random() * 0.5);
        s.hazards.push({
          kind: 'pool',
          x: s.p.x + Math.cos(a) * r,
          y: s.p.y + Math.sin(a) * r,
          r: spec.radius,
          t: 0,
          arm: 0.6,
          life: spec.life,
          damage: Math.max(1, Math.round(e.damage * spec.damage)),
          unit: e.unit,
          color: u.color,
        });
      }
    }
  }
}

// Ground marks that explode after a delay (`blast`) and lingering zones (`pool`).
export function placeMortar(c, s, e, u, spec, aim) {
  for (let i = 0; i < spec.count; i++) {
    const a = s.rng.random() * Math.PI * 2,
      r = i === 0 ? 0 : spec.scatter * (0.5 + s.rng.random() * 0.5);
    s.hazards.push({
      kind: 'blast',
      x: aim.x + Math.cos(a) * r,
      y: aim.y + Math.sin(a) * r,
      r: spec.radius,
      t: 0,
      delay: spec.delay,
      damage: Math.max(1, Math.round(e.damage * (spec.damage ?? 1))),
      unit: e.unit,
      color: u.color,
    });
  }
}

export function deathBlast(s, e, u) {
  const spec = u.deathBlast;
  s.hazards.push({
    kind: 'blast',
    x: e.x,
    y: e.y,
    r: spec.radius,
    t: 0,
    delay: spec.delay,
    damage: Math.max(1, Math.round(e.damage * spec.damage)),
    unit: e.unit,
    color: u.color || hazardColor,
  });
}

export function updateHazards(c, s, dt) {
  const p = s.p;
  for (const h of s.hazards) {
    h.t += dt;
    const inside = Math.hypot(p.x - h.x, p.y - h.y) < h.r + 10;
    if (h.kind === 'blast') {
      if (h.t < h.delay) continue;
      if (inside) c.hurtPlayer(h);
      s.fx.push({ kind: 'ring', x: h.x, y: h.y, r: h.r, life: 0.3, max: 0.3, color: h.color });
      c.effect('hit');
      h.done = true;
    } else if (h.t >= h.life) h.done = true;
    else if (h.t >= h.arm && inside) c.hurtPlayer(h);
  }
  if (s.hazards.some((h) => h.done)) s.hazards = s.hazards.filter((h) => !h.done);
}

// Damage share an enemy takes because a guard stands next to it.
// A shielded unit (`frontDamageMultiplier`) takes less damage from hits that land on its
// front; `p` is where the hit comes from.
export function mitigation(e, p) {
  const multiplier = unitDefinitions[e.unit]?.frontDamageMultiplier;
  if (multiplier == null) return 1;
  const a = Math.atan2(p.y - e.y, p.x - e.x);
  return Math.cos(a - (e.heading || 0)) > 0.15 ? multiplier : 1;
}

export function auraFactor(s, e, units) {
  const guards = s.runtime.guards;
  if (!guards.length) return 1;
  let best = 0;
  for (const g of guards) {
    if (g === e || g.hp <= 0) continue;
    const aura = units[g.unit].aura;
    if (Math.hypot(g.x - e.x, g.y - e.y) <= aura.radius) best = Math.max(best, aura.reduction);
  }
  return 1 - best;
}
