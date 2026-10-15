// How an enemy's strike lands, driven by its data in data/enemies/units.js:
//  attack 'projectile' → a shot flies toward the aim point;
//  attack 'pulse'      → a shockwave of radius `range` around the unit;
//  melee with `burst`  → an all-round hit within range + burst.reach, shown as a ring;
//  plain melee         → a frontal hit within range + 8 that needs a clear line to the player.
const shotSpeed = 235,
  shotLife = 2;

function pulseArea(u) {
  return {
    reach: 20,
    ring: { r: u.range, life: 0.5, color: u.color },
    sound: u.boss ? 'boss' : 'hit',
  };
}

// `c` = { arena, effect, hurtPlayer }; `s` is the running state.
export function resolveEnemyStrike(c, s, e, u, aim) {
  const p = s.p;
  const angle = Math.atan2(aim.y - e.y, aim.x - e.x),
    ax = Math.cos(angle),
    ay = Math.sin(angle);
  if (u.attack === 'projectile') {
    s.enemyShots.push({
      x: e.x,
      y: e.y,
      vx: ax * shotSpeed,
      vy: ay * shotSpeed,
      life: shotLife,
      damage: e.damage,
      kind: e.unit,
    });
    c.effect('throw');
    return;
  }
  const area = u.attack === 'pulse' ? pulseArea(u) : u.burst;
  if (area) {
    if (Math.hypot(e.x - p.x, e.y - p.y) < u.range + area.reach) c.hurtPlayer(e);
    s.fx.push({
      kind: 'ring',
      x: e.x,
      y: e.y,
      r: area.ring.r,
      life: area.ring.life,
      max: area.ring.life,
      color: area.ring.color,
    });
    c.effect(area.sound);
    return;
  }
  const along = (p.x - e.x) * ax + (p.y - e.y) * ay;
  if (Math.hypot(e.x - p.x, e.y - p.y) < u.range + 8 && along >= -8 && c.arena.clear(e, p, 2))
    c.hurtPlayer(e);
}
