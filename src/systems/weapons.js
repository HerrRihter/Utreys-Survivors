import { weaponDefinitions, weaponStats, weaponMaxLevel } from '../../data/weapons.js';
import { compact } from '../core/compact.js';
import { effectiveStats } from './queries/abilities.js';
import { weaponEvolution } from './queries/weapons.js';
import { weaponKinds, effectKinds } from './weapons/index.js';

const isLive = (item) => item.life > 0;

// Extra weapons picked up during a run. State lives in `run.state`:
//   weapons: [{ id, level, cd, evolved, phase }] — owned weapons in pickup order (the upgrade
//            system adds and levels them; this system fires and evolves them,
//            rendering/weapons.js draws them)
//   wfx:     live projectiles, mines and zones these weapons spawned
//   evoTokens: bug archives (combat adds one per node guardian kill) waiting for an
//            eligible weapon
// Each weapon's `kind` (src/systems/weapons/) says how it fires and what its effects do.
// `damage(e, n, dx, dy, source, tag)` is the combat entry point; `tag` attributes the damage.
export const WeaponSystem = {
  create({ run, damage, audio, math }) {
    const passiveRank = (s, id) => s.upgradeRanks?.[id] || 0;

    // Weapons at max level whose passive is owned; the first one waiting is evolved.
    function eligible(s) {
      return s.weapons.filter(
        (w) =>
          !w.evolved &&
          w.level >= weaponMaxLevel &&
          passiveRank(s, weaponDefinitions[w.id].evolution.passive) > 0,
      );
    }
    function tryEvolve() {
      const s = run.state;
      while (s.evoTokens > 0) {
        const w = eligible(s)[0];
        if (!w) return;
        s.evoTokens--;
        w.evolved = true;
        s.evolutions++;
        const evo = weaponDefinitions[w.id].evolution;
        s.texts.push({ x: s.p.x, y: s.p.y - 50, v: 'ЭВОЛЮЦИЯ: ' + evo.name, life: 2 });
        audio.effect('level');
      }
    }

    function nearest(s, x, y, maxDistance = Infinity) {
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
    function hitArea(s, x, y, radius, n, push, tag, filter) {
      let hits = 0;
      for (const e of s.enemies) {
        if (e.hp <= 0) continue;
        const dx = e.x - x,
          dy = e.y - y,
          d = Math.hypot(dx, dy);
        if (d > radius + e.r) continue;
        if (filter && !filter(e)) continue;
        damage(e, n, (dx / Math.max(1, d)) * push, (dy / Math.max(1, d)) * push, { x, y }, tag);
        hits++;
      }
      return hits;
    }
    // What weapon kinds work with; `dt` is the current step.
    const context = {
      damage,
      audio,
      math,
      dt: 0,
      nearest,
      hitArea,
      enemyCd: (e, key) => e.wcd?.[key] || 0,
      setEnemyCd(e, key, until) {
        (e.wcd ||= {})[key] = until;
      },
    };

    function update(dt) {
      const s = run.state;
      if (!s.weapons) return;
      context.dt = dt;
      if (s.evoTokens > 0) tryEvolve();
      const st = effectiveStats(s);
      for (const w of s.weapons) {
        const v = weaponStats(w.id, w.level),
          kind = weaponKinds[weaponDefinitions[w.id].kind],
          evo = weaponEvolution(w);
        kind.tick?.(context, s, w, v, st, evo);
        if (!v.cooldown) continue;
        w.cd -= dt;
        if (w.cd > 0) continue;
        w.cd = Math.max(0.25, v.cooldown / st.haste);
        kind.fire(context, s, w, v, st, evo);
      }
      updateEffects(s, dt);
    }

    function updateEffects(s, dt) {
      const spawned = [];
      for (const f of s.wfx) effectKinds[f.kind](context, s, f, dt, spawned);
      for (const f of spawned) s.wfx.push(f);
      compact(s.wfx, isLive);
    }

    return { update };
  },
};
