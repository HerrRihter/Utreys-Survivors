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

export function resolveEnemyStrike(c, e, u, aim) {
  const s = c.state,
    p = s.p;
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
    c.soundEffect('throw');
    return;
  }
  const area = u.attack === 'pulse' ? pulseArea(u) : u.burst;
  if (area) {
    if (c.dist(e, p) < u.range + area.reach) c.hurtPlayer(e);
    s.fx.push({
      kind: 'ring',
      x: e.x,
      y: e.y,
      r: area.ring.r,
      life: area.ring.life,
      max: area.ring.life,
      color: area.ring.color,
    });
    c.soundEffect(area.sound);
    return;
  }
  const along = (p.x - e.x) * ax + (p.y - e.y) * ay;
  if (c.dist(e, p) < u.range + 8 && along >= -8 && c.Arena.clear(e, p, 2)) c.hurtPlayer(e);
}
