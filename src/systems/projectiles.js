import { compact } from '../core/compact.js';
import { clamp } from '../core/math.js';

const TAU = Math.PI * 2;
const isLive = (item) => item.life > 0;

// The player's projectiles: the hero's packets (`s.shots`, the serialization attack and the
// volley) and the weapons' shots (`s.wfx`). Both lists are updated here, each at its own
// point of the step (weapons before the enemies move, packets after), with one set of kinds:
//   packet     flies straight and pierces; with `split` it breaks apart when its flight ends
//   seeker     turns toward the nearest enemy and stops at its first hit; with `split` it
//              breaks apart there (the pieces ignore that enemy)
//   label      flies under `gravity` and pierces
//   boomerang  flies out for `out` s, comes back to the hero and pierces both ways; with
//              `collect` it relaunches at the hero and carries nearby experience to them
// A kind is `(c, s, b, dt, spawned)`; `c` holds { damage }, `spawned` collects new
// projectiles that join the list after the update. `split` is { turns, life, damage }.
export const projectileKinds = {
  packet(c, s, b, dt, spawned) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 && b.split) split(b, spawned);
    b.age = (b.age || 0) + dt;
    b.angle += dt * 4.5;
    pierce(c, s, b, strikePacket);
  },
  seeker(c, s, f, dt, spawned) {
    if (!f.target || f.target.hp <= 0) f.target = nearestEnemy(s, f.x, f.y, 420);
    if (f.target) {
      const want = Math.atan2(f.target.y - 10 - f.y, f.target.x - f.x),
        have = Math.atan2(f.vy, f.vx);
      const turn = Math.atan2(Math.sin(want - have), Math.cos(want - have));
      const a = have + clamp(turn, -7 * dt, 7 * dt);
      f.vx = Math.cos(a) * f.speed;
      f.vy = Math.sin(a) * f.speed;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    for (const e of s.enemies) {
      if (e.hp <= 0 || e === f.ignore || !touches(e, f)) continue;
      strikeAlong(c, f, e);
      f.life = 0;
      if (f.split) split(f, spawned, e);
      break;
    }
  },
  label(c, s, f, dt) {
    f.vy += f.gravity * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    pierce(c, s, f, strikeLabel);
  },
  boomerang(c, s, f, dt) {
    f.spin += dt * 14;
    if (!f.back) {
      f.out -= dt;
      if (f.out <= 0) {
        f.back = true;
        f.hit.clear();
      }
    } else {
      const dx = s.p.x - f.x,
        dy = s.p.y - 10 - f.y,
        d = Math.hypot(dx, dy);
      if (d < 24) {
        if (f.collect) {
          // Relaunch toward the nearest enemy instead of despawning.
          const target = nearestEnemy(s, s.p.x, s.p.y, 480);
          const a = target ? Math.atan2(target.y - s.p.y, target.x - s.p.x) : s.rng.rand(0, TAU);
          f.vx = Math.cos(a) * f.speed;
          f.vy = Math.sin(a) * f.speed;
          f.back = false;
          f.out = 0.55;
          f.hit.clear();
        } else f.life = 0;
      } else {
        f.vx = (dx / d) * f.speed;
        f.vy = (dy / d) * f.speed;
      }
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    pierce(c, s, f, strikeAlong);
    if (f.collect) {
      const reach = f.collect.reach;
      for (const g of s.gems)
        if (Math.abs(g.x - f.x) < reach && Math.abs(g.y - f.y) < reach) {
          g.x = s.p.x;
          g.y = s.p.y;
        }
    }
  },
};

// Moves every projectile of `list` by its kind (`kinds` may add non-projectile effects),
// drops the spent ones and appends what split off.
export function updateProjectiles(c, s, list, dt, kinds = projectileKinds) {
  const spawned = [];
  for (const b of list) kinds[b.kind](c, s, b, dt, spawned);
  for (const b of spawned) list.push(b);
  compact(list, isLive);
}

export function nearestEnemy(s, x, y, maxDistance = Infinity) {
  let best = null,
    bestD = maxDistance;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

// A projectile touches an enemy's body (aimed 10 px above its feet).
const touches = (e, b) => Math.hypot(e.x - b.x, e.y - 10 - b.y) <= e.r + b.r;

// Each enemy is hit once per flight (`hit` remembers whom).
function pierce(c, s, b, strike) {
  for (const e of s.enemies) {
    if (e.hp <= 0 || b.hit.has(e) || !touches(e, b)) continue;
    b.hit.add(e);
    strike(c, b, e);
  }
}

// How each kind pushes what it hits.
function strikePacket(c, b, e) {
  const impulse = b.push === undefined ? 0.25 : b.push / Math.max(1, Math.hypot(b.vx, b.vy));
  c.damage(e, b.damage, b.vx * impulse, b.vy * impulse, { x: e.x - b.vx, y: e.y - b.vy }, b.tag);
}
function strikeAlong(c, b, e) {
  c.damage(e, b.damage, b.vx * 0.15, b.vy * 0.15, { x: b.x, y: b.y }, b.tag);
}
function strikeLabel(c, b, e) {
  c.damage(e, b.damage, b.vx * 0.1, 40, { x: b.x, y: b.y }, b.tag);
}

// The one split: pieces fly off at `split.turns` from the course at the same speed, live
// `split.life` s with `split.damage` of the damage and do not split again. `ignore` is an
// enemy the pieces pass through.
function split(b, spawned, ignore) {
  const { turns, life, damage } = b.split,
    a = Math.atan2(b.vy, b.vx),
    speed = b.speed ?? Math.hypot(b.vx, b.vy);
  b.split = null;
  for (const turn of turns)
    spawned.push({
      ...b,
      vx: Math.cos(a + turn) * speed,
      vy: Math.sin(a + turn) * speed,
      life,
      damage: b.damage * damage,
      hit: b.hit && new Set(),
      target: null,
      ignore,
    });
}
