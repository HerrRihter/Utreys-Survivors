import { placeMortar } from './enemy-behaviors.js';

// How an enemy's strike lands, driven by its data in data/enemies/units.js:
//  attack 'projectile' → shots fly toward the aim point (`shots` sets fan, burst or ring);
//  attack 'mortar'     → marks on the ground that explode after a delay;
//  attack 'pulse'      → a shockwave of radius `range` around the unit;
//  melee with `burst`  → an all-round hit within range + burst.reach, shown as a ring;
//  plain melee         → a frontal hit within range + 8 that needs a clear line to the player.
// A boss phase may add a ring of shots or mortar marks to every strike.
const shotSpeed = 235,
  shotLife = 2;

function pulseArea(u) {
  return {
    reach: 20,
    ring: { r: u.range, life: 0.5, color: u.color },
    sound: u.boss ? 'boss' : 'hit',
  };
}

function fire(s, e, angle, spec = {}) {
  const count = spec.count || 1,
    speed = spec.speed || shotSpeed,
    damage = Math.max(1, Math.round(e.damage * (spec.damage ?? 1)));
  for (let i = 0; i < count; i++) {
    const a = spec.radial
      ? angle + (i * Math.PI * 2) / count
      : angle + (i - (count - 1) / 2) * (spec.spread || 0);
    s.enemyShots.push({
      x: e.x,
      y: e.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      life: Math.max(shotLife, (spec.radial ? 420 : 0) / speed),
      wait: spec.delay ? i * spec.delay : 0,
      damage,
      kind: e.unit,
    });
  }
}

// `c` = { arena, effect, hurtPlayer, random }; `s` is the running state.
export function resolveEnemyStrike(c, s, e, u, aim) {
  const p = s.p;
  const angle = Math.atan2(aim.y - e.y, aim.x - e.x),
    ax = Math.cos(angle),
    ay = Math.sin(angle);
  if (e.phaseShots) fire(s, e, angle, e.phaseShots);
  if (e.phaseMortar) placeMortar(c, s, e, u, e.phaseMortar, p);
  if (u.attack === 'projectile') {
    fire(s, e, angle, u.shots);
    c.effect('throw');
    return;
  }
  if (u.attack === 'mortar') {
    // The mark lands where the player stands now, not where they stood at the wind-up.
    placeMortar(c, s, e, u, u.mortar, p);
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
