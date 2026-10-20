import { abilityRank } from '../../data/characters/abilities.js';
import { effectiveStats } from './queries/abilities.js';

const TAU = Math.PI * 2;

// Q/E abilities: casting, timers and their effects. Q is the shared dash; E is the hero's own
// (overclock, registry, volley, negotiations or regression zone). rendering/abilities.js draws them.
export const AbilitySystem = {
  create({ run, world, damage, progression, audio, heroes, units }) {
    const ordinary = (e) => !e.boss && !units?.[e.unit]?.miniboss;

    // Instant effects at the moment of casting.
    const cast = {
      // Serialization: a fan of piercing packets in every direction.
      volley(s, a) {
        const spec = heroes.defs[run.selected],
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
            kind: 'code',
            tag: 'volley',
          });
        }
        audio.effect('throw');
      },
      // BA: ordinary enemies nearby and the chosen client anywhere stop attacking.
      negotiate(s, a) {
        const client = s.baSpecialization?.client;
        for (const e of s.enemies) {
          if (e.hp <= 0 || !ordinary(e)) continue;
          const near = Math.hypot(e.x - s.p.x, e.y - s.p.y) < a.radius + e.r;
          if (!near && e.unit !== client) continue;
          e.pacifiedUntil = a.endsAt;
          e.action = null;
        }
      },
      // QA: the zone stays where it was cast.
      regress(s, a) {
        a.origin = { x: s.p.x, y: s.p.y };
      },
    };

    function activate(slot) {
      if (run.mode !== 'play' || !run.state || run.state.p.hp <= 0) return false;
      const s = run.state,
        a = s.abilities[slot],
        p = s.p;
      if (!a || a.cd > 0 || a.left > 0) return false;
      if (a.id === 'dash') {
        const probe = { x: p.x, y: p.y };
        world.arena.move(probe, p.facing.x * 6, p.facing.y * 6, 14);
        if (Math.hypot(probe.x - p.x, probe.y - p.y) < 0.01) return false;
        p.action = null;
      }
      a.castRank = abilityRank(s, a.id);
      a.cd = a.cooldown;
      a.left = a.duration + (a.rankDuration || 0) * a.castRank;
      a.endsAt = s.t + a.left;
      a.elapsed = 0;
      a.direction = { ...p.facing };
      a.hit = new Set();
      cast[a.id]?.(s, a);
      progression.recordAbility?.();
      audio.effect('magic');
      return true;
    }

    function updateDash(s, a, step) {
      const p = s.p,
        st = effectiveStats(s);
      const n = Math.max(1, Math.ceil((180 * step) / a.duration / 6));
      for (let i = 0; i < n; i++) {
        world.arena.move(
          p,
          (a.direction.x * 180 * step) / a.duration / n,
          (a.direction.y * 180 * step) / a.duration / n,
          14,
        );
        for (const e of s.enemies) {
          const dx = e.x - p.x,
            dy = e.y - p.y,
            d = Math.hypot(dx, dy);
          if (e.hp <= 0 || a.hit.has(e) || d >= 22 * st.range + e.r || !world.arena.clear(p, e, 2))
            continue;
          a.hit.add(e);
          damage(
            e,
            35 * st.damage * (1 + 0.25 * a.castRank),
            (dx / Math.max(1, d)) * 180,
            (dy / Math.max(1, d)) * 180,
            p,
            'dash',
          );
        }
      }
    }
    // Each ordinary enemy entering the zone freezes once per cast.
    function updateRegress(s, a) {
      const stun = a.stun + 0.5 * a.castRank;
      for (const e of s.enemies) {
        if (e.hp <= 0 || a.hit.has(e) || !ordinary(e)) continue;
        if (Math.hypot(e.x - a.origin.x, e.y - a.origin.y) > a.radius + e.r) continue;
        a.hit.add(e);
        e.abilityStun = Math.max(e.abilityStun || 0, stun);
        e.action = null;
      }
    }

    function update(dt) {
      const s = run.state;
      for (const e of s.enemies) e.abilityStun = Math.max(0, (e.abilityStun || 0) - dt);
      for (const a of s.abilities) {
        a.cd = Math.max(0, a.cd - dt);
        if (a.left <= 0) continue;
        const step = Math.min(dt, a.left);
        a.elapsed += step;
        a.left = Math.max(0, a.left - step);
        if (a.left < 1e-9) a.left = 0;
        if (a.id === 'dash') updateDash(s, a, step);
        else if (a.id === 'regress' && a.origin) updateRegress(s, a);
      }
    }

    return { activate, update };
  },
};
