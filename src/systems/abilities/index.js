import { heroDefinitions } from '../../../data/characters/heroes.js';
import { effectiveStats } from '../queries/abilities.js';

const TAU = Math.PI * 2;

// Kinds of Q/E abilities. An ability in data/characters/abilities.js names its `kind`; a kind
// may have
//   ready(c, s, a)        may the ability start now (false refuses the cast)
//   cast(c, s, a)         the instant effect when it starts
//   update(c, s, a, step) every step while it runs (`step` is the part of dt it ran)
// A kind without any of them only changes stats while it runs (`statMods` in the data, read
// by effectiveStats). `c` is the ability system's context: { run, world, damage, ordinary }.
// Damage is tagged with the ability's id.
export const abilityKinds = {
  // A short dash along the facing that hits each enemy on the way once.
  lunge: {
    // Only when there is room to move; the dash cancels the hero's own strike.
    ready(c, s) {
      const p = s.p,
        probe = { x: p.x, y: p.y };
      c.world.arena.move(probe, p.facing.x * 6, p.facing.y * 6, 14);
      if (Math.hypot(probe.x - p.x, probe.y - p.y) < 0.01) return false;
      p.action = null;
      return true;
    },
    update(c, s, a, step) {
      const p = s.p,
        st = effectiveStats(s);
      const n = Math.max(1, Math.ceil((180 * step) / a.duration / 6));
      for (let i = 0; i < n; i++) {
        c.world.arena.move(
          p,
          (a.direction.x * 180 * step) / a.duration / n,
          (a.direction.y * 180 * step) / a.duration / n,
          14,
        );
        for (const e of s.enemies) {
          const dx = e.x - p.x,
            dy = e.y - p.y,
            d = Math.hypot(dx, dy);
          if (
            e.hp <= 0 ||
            a.hit.has(e) ||
            d >= 22 * st.range + e.r ||
            !c.world.arena.clear(p, e, 2)
          )
            continue;
          a.hit.add(e);
          c.damage(
            e,
            35 * st.damage * (1 + 0.25 * a.castRank),
            (dx / Math.max(1, d)) * 180,
            (dy / Math.max(1, d)) * 180,
            p,
            a.id,
          );
        }
      }
    },
  },
  // Stat changes while it runs (`statMods`); nothing else to do.
  boost: {},
  // A fan of `count` piercing packets in every direction with `power` of the hero's damage.
  fan: {
    cast(c, s, a) {
      const spec = heroDefinitions[c.run.selected],
        st = effectiveStats(s);
      const power =
        spec.damage * st.damage * (1 + (st.heroPower || 0)) * a.power * (1 + 0.25 * a.castRank);
      const range = (spec.range + (st.punchReach || 0)) * st.range;
      for (let i = 0; i < a.count; i++) {
        const angle = Math.atan2(s.p.facing.y, s.p.facing.x) + (i / a.count) * TAU;
        s.shots.push({
          x: s.p.x,
          y: s.p.y,
          vx: Math.cos(angle) * 360,
          vy: Math.sin(angle) * 360,
          life: range / 360,
          r: 7 * st.range,
          damage: power,
          push: spec.push,
          hit: new Set(),
          age: 0,
          angle,
          color: spec.color,
          kind: 'packet',
          tag: a.id,
        });
      }
      c.audio.effect('throw');
    },
  },
  // Ordinary enemies within `radius` and the BA client anywhere stop attacking until it ends.
  truce: {
    cast(c, s, a) {
      const client = s.baSpecialization?.client;
      for (const e of s.enemies) {
        if (e.hp <= 0 || !c.ordinary(e)) continue;
        const near = Math.hypot(e.x - s.p.x, e.y - s.p.y) < a.radius + e.r;
        if (!near && e.unit !== client) continue;
        e.pacifiedUntil = a.endsAt;
        e.action = null;
      }
    },
  },
  // A zone of `radius` where it was cast: each ordinary enemy entering it freezes once per
  // cast for `stun` seconds (+0.5 s per rank).
  field: {
    cast(c, s, a) {
      a.origin = { x: s.p.x, y: s.p.y };
    },
    update(c, s, a) {
      if (!a.origin) return;
      const stun = a.stun + 0.5 * a.castRank;
      for (const e of s.enemies) {
        if (e.hp <= 0 || a.hit.has(e) || !c.ordinary(e)) continue;
        if (Math.hypot(e.x - a.origin.x, e.y - a.origin.y) > a.radius + e.r) continue;
        a.hit.add(e);
        e.abilityStun = Math.max(e.abilityStun || 0, stun);
        e.action = null;
      }
    },
  },
};
