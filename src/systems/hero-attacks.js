import { scanMarkSeconds } from '../../data/characters/hero-passives.js';
import { heroEvolutions } from '../../data/weapons.js';
import { near } from '../core/math.js';

// One hero strike. `c` holds exactly what a strike touches:
// { state, hero, heroId, arena, units, effect, damage }. The hero's `attack` names the kind
// below; `stats.heroEvo` turns on the hero's evolution (level 6 of the attack), whose data
// in heroEvolutions (data/weapons.js) the kind reads.
export function heroAttack(c, action, stats) {
  const p = c.state.p,
    spec = c.hero;
  const dir = action.direction || p.facing;
  attackKinds[spec.attack](c, {
    dir,
    range: (spec.range + (stats.punchReach || 0)) * stats.range,
    power: spec.damage * stats.damage * (1 + (stats.heroPower || 0)),
    push: spec.push + (stats.punchForce || 0),
    angle: Math.atan2(dir.y, dir.x),
    evo: stats.heroEvo ? heroEvolutions[c.heroId] : null,
    stats,
  });
}

// Kinds of hero attacks: `(c, strike)` with the strike's direction, range, power, push,
// angle, the evolution data (or null) and the hero's effective stats.
export const attackKinds = {
  // A piercing packet along the attack; the evolution's `split` breaks it at the end.
  packet(c, { dir, range, power, push, angle, evo, stats }) {
    const s = c.state,
      p = s.p;
    s.shots.push({
      x: p.x,
      y: p.y,
      vx: dir.x * 360,
      vy: dir.y * 360,
      life: range / 360,
      r: 7 * stats.range,
      damage: power,
      push,
      hit: new Set(),
      age: 0,
      angle,
      color: c.hero.color,
      kind: 'packet',
      split: evo?.split ?? null,
    });
    c.effect('throw');
  },
  // A chain from the nearest target in front through its neighbours; the evolution's
  // `returnChain` runs it back along the same targets for that share of the damage.
  chain(c, { dir, range, power, push, evo, stats }) {
    const s = c.state,
      p = s.p,
      spec = c.hero;
    p.chainImpactAt = s.t;
    // Snapshot positions before knockback so traversal does not depend on damage side effects.
    const candidates = s.enemies.filter((e) => e.hp > 0).map((e) => ({ e, x: e.x, y: e.y }));
    // Nearest reachable target in front of the hero (first one wins on equal distance).
    let first = null,
      firstDistance = Infinity;
    for (const e of candidates) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (
        d <= range &&
        d < firstDistance &&
        (e.x - p.x) * dir.x + (e.y - p.y) * dir.y >= 0 &&
        c.arena.clear(p, e, 2)
      ) {
        first = e;
        firstDistance = d;
      }
    }
    if (!first) return;
    // Breadth-first over neighbours; chainLimit caps the targets per strike (null = whole group).
    // An ability with `chainUnlimited` (Traceability's Registry) lifts the cap while it lasts.
    const limit = stats.chainUnlimited ? Infinity : (spec.chainLimit ?? Infinity);
    const queue = [{ origin: { x: p.x, y: p.y }, target: first }];
    const seen = new Set();
    seen.add(first);
    for (let i = 0; i < queue.length; i++) {
      const { origin, target } = queue[i];
      for (const next of candidates) {
        if (seen.size >= limit) break;
        if (
          seen.has(next) ||
          Math.hypot(next.x - target.x, next.y - target.y) > range ||
          !c.arena.clear(target, next, 2)
        )
          continue;
        seen.add(next);
        queue.push({ origin: target, target: next });
      }
      s.fx.push({
        kind: 'link',
        x: origin.x,
        y: origin.y - 8,
        toX: target.x,
        toY: target.y - 8,
        color: spec.color,
        life: 0.65,
        max: 0.65,
      });
      const dx = target.x - origin.x,
        dy = target.y - origin.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      c.damage(target.e, power, (dx / distance) * push, (dy / distance) * push, origin);
    }
    if (evo?.returnChain)
      for (let i = queue.length - 1; i >= 0; i--) {
        const { origin, target } = queue[i];
        c.damage(target.e, power * evo.returnChain, 0, 0, target);
        s.fx.push({
          kind: 'link',
          x: target.x,
          y: target.y - 8,
          toX: origin.x,
          toY: origin.y - 8,
          color: '#ffffff',
          life: 0.4,
          max: 0.4,
        });
      }
    c.effect('magic');
  },
  // A sector of `half` around the attack; the evolution's `backSweep` strikes behind too.
  sector(c, strike) {
    sweep(c, strike, false);
  },
  // A square scan around the hero that stuns ordinary enemies briefly and marks them for the
  // hero passive; the evolution's `mark` makes them take `factor` damage for `seconds`.
  scan(c, strike) {
    sweep(c, strike, true);
  },
};

function sweep(c, { dir, range, power, push, angle, evo }, radial) {
  strikeArea(c, dir, angle, range, power, push, evo, radial);
  if (evo?.backSweep)
    strikeArea(c, { x: -dir.x, y: -dir.y }, angle + Math.PI, range, power, push, evo, radial);
}

function strikeArea(c, dir, angle, range, power, push, evo, radial) {
  const s = c.state,
    p = s.p,
    spec = c.hero;
  s.fx.push({
    kind: radial ? 'scan' : 'slash',
    x: p.x,
    y: p.y - 8,
    r: range,
    angle,
    half: spec.half,
    color: spec.color,
    life: radial ? 0.6 : 0.2,
    max: radial ? 0.6 : 0.2,
  });
  for (const e of s.enemies) {
    const dx = e.x - p.x,
      dy = e.y - p.y,
      d = Math.hypot(dx, dy),
      along = dx * dir.x + dy * dir.y;
    const delta = Math.abs(Math.atan2(dx * dir.y - dy * dir.x, along));
    const outside = radial ? !near(p, e, range + e.r) : d >= range + e.r;
    if (e.hp <= 0 || outside || !c.arena.clear(p, e, 2)) continue;
    if (!radial && (along < 0 || delta > spec.half + Math.asin(Math.min(1, e.r / Math.max(1, d)))))
      continue;
    c.damage(
      e,
      power,
      (radial ? dx / Math.max(1, d) : dir.x) * push,
      (radial ? dy / Math.max(1, d) : dir.y) * push,
    );
    if (!radial) continue;
    s.fx.push({
      kind: 'scanTarget',
      x: e.x,
      y: e.y - 8,
      r: e.r + 8,
      color: spec.color,
      life: 0.6,
      max: 0.6,
    });
    // QA passive: recently scanned targets are easier to crit.
    e.scannedUntil = s.t + scanMarkSeconds;
    if (evo?.mark) e.markedUntil = s.t + evo.mark.seconds;
    if (e.hp > 0 && !e.boss && !c.units[e.unit].miniboss) {
      e.abilityStun = Math.max(e.abilityStun || 0, 0.6);
      e.action = null;
    }
  }
}
