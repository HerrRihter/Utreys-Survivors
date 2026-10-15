export function heroAttack(c, action, stats) {
  const s = c.state,
    p = s.p,
    spec = c.Heroes.defs[c.selected];
  const dir = action.direction || p.facing;
  const range = (spec.range + (stats.punchReach || 0)) * stats.range;
  const power = spec.damage * stats.damage;
  const push = spec.push + (stats.punchForce || 0);
  const angle = Math.atan2(dir.y, dir.x);
  if (spec.attack === 'packet') {
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
      color: spec.color,
      kind: 'code',
    });
    c.soundEffect('throw');
    return;
  }
  if (spec.attack === 'chain') {
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
        c.Arena.clear(p, e, 2)
      ) {
        first = e;
        firstDistance = d;
      }
    }
    if (!first) return;
    // Breadth-first over neighbours; chainLimit caps the targets per strike (null = whole group).
    const limit = spec.chainLimit ?? Infinity;
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
          !c.Arena.clear(target, next, 2)
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
    c.soundEffect('magic');
    return;
  }
  const radial = spec.attack === 'scan';
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
    const outside = radial ? Math.max(Math.abs(dx), Math.abs(dy)) >= range + e.r : d >= range + e.r;
    if (e.hp <= 0 || outside || !c.Arena.clear(p, e, 2)) continue;
    if (!radial && (along < 0 || delta > spec.half + Math.asin(Math.min(1, e.r / Math.max(1, d)))))
      continue;
    c.damage(
      e,
      power,
      (radial ? dx / Math.max(1, d) : dir.x) * push,
      (radial ? dy / Math.max(1, d) : dir.y) * push,
    );
    if (radial)
      s.fx.push({
        kind: 'scanTarget',
        x: e.x,
        y: e.y - 8,
        r: e.r + 8,
        color: spec.color,
        life: 0.6,
        max: 0.6,
      });
    if (radial && e.hp > 0 && !e.boss && !c.Enemies.units[e.unit].miniboss) {
      e.abilityStun = Math.max(e.abilityStun || 0, 0.6);
      e.action = null;
    }
  }
}
