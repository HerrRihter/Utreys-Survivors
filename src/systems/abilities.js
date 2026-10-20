import { abilityRank } from '../../data/characters/abilities.js';
import { unitDefinitions } from '../../data/enemies/units.js';
import { abilityKinds } from './abilities/index.js';

// Q/E abilities: casting, timers and their effects. Q is the shared dash; E is the hero's own.
// Each ability's `kind` (src/systems/abilities/) says what it does; rendering/abilities.js
// draws them.
export const AbilitySystem = {
  create({ run, world, damage, progression, audio }) {
    const context = {
      run,
      world,
      damage,
      audio,
      ordinary: (e) => !e.boss && !unitDefinitions[e.unit]?.miniboss,
    };

    function activate(slot) {
      if (run.mode !== 'play' || !run.state || run.state.p.hp <= 0) return false;
      const s = run.state,
        a = s.abilities[slot],
        p = s.p;
      if (!a || a.cd > 0 || a.left > 0) return false;
      const kind = abilityKinds[a.kind];
      if (kind.ready && !kind.ready(context, s, a)) return false;
      a.castRank = abilityRank(s, a.id);
      a.cd = a.cooldown;
      a.left = a.duration + (a.rankDuration || 0) * a.castRank;
      a.endsAt = s.t + a.left;
      a.elapsed = 0;
      a.direction = { ...p.facing };
      a.hit = new Set();
      kind.cast?.(context, s, a);
      progression.recordAbility();
      audio.effect('magic');
      return true;
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
        abilityKinds[a.kind].update?.(context, s, a, step);
      }
    }

    return { activate, update };
  },
};
