export function heroAttack(c, action, stats) {
  const s = c.state,
    p = s.p,
    spec = c.Villagers.defs[c.selected];
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
    let origin = p;
    const seen = new Set();
    for (let i = 0; i < 3; i++) {
      const target = s.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            !seen.has(e) &&
            Math.hypot(e.x - origin.x, e.y - origin.y) < range + e.r &&
            (i > 0 || (e.x - p.x) * dir.x + (e.y - p.y) * dir.y >= 0) &&
            c.Village.clear(origin, e, 2),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - origin.x, a.y - origin.y) - Math.hypot(b.x - origin.x, b.y - origin.y),
        )[0];
      if (!target) break;
      seen.add(target);
      s.fx.push({
        kind: 'link',
        x: origin.x,
        y: origin.y - 8,
        toX: target.x,
        toY: target.y - 8,
        color: spec.color,
        life: 0.25,
        max: 0.25,
      });
      c.damage(target, power * Math.pow(0.8, i), dir.x * push, dir.y * push, origin);
      origin = target;
    }
    return;
  }
  const radial = spec.attack === 'pulse';
  s.fx.push({
    kind: radial ? 'ring' : 'slash',
    x: p.x,
    y: p.y - 8,
    r: range,
    angle,
    half: spec.half,
    color: spec.color,
    life: 0.2,
    max: 0.2,
  });
  for (const e of s.enemies) {
    const dx = e.x - p.x,
      dy = e.y - p.y,
      d = Math.hypot(dx, dy),
      along = dx * dir.x + dy * dir.y;
    const delta = Math.abs(Math.atan2(dx * dir.y - dy * dir.x, along));
    if (e.hp <= 0 || d >= range + e.r || !c.Village.clear(p, e, 2)) continue;
    if (!radial && (along < 0 || delta > spec.half + Math.asin(Math.min(1, e.r / Math.max(1, d)))))
      continue;
    c.damage(
      e,
      power,
      (radial ? dx / Math.max(1, d) : dir.x) * push,
      (radial ? dy / Math.max(1, d) : dir.y) * push,
    );
    if (radial && e.hp > 0 && !e.boss && !c.Legion.units[e.unit].miniboss) {
      e.abilityStun = Math.max(e.abilityStun || 0, 0.25);
      e.action = null;
    }
  }
}
