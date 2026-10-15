import { abilityDefinitions, abilityRank } from '../../data/characters/abilities.js';
import { abilityActive, effectiveStats } from './ability-state.js';

// Q/E abilities: casting, timers and the dash's sweep damage.
export const AbilitySystem = {
  create({ run, world, damage, progression, audio }) {
    function init() {
      run.state.abilities = abilityDefinitions[run.selected].map((a) => ({ ...a, cd: 0, left: 0 }));
    }
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
      a.left = a.duration + (a.id === 'potion' ? a.castRank : 0);
      a.endsAt = s.t + a.left;
      a.elapsed = 0;
      a.direction = { ...p.facing };
      a.hit = new Set();
      progression.recordAbility?.();
      audio.effect('magic');
      return true;
    }
    function update(dt) {
      const s = run.state,
        p = s.p;
      for (const e of s.enemies) e.abilityStun = Math.max(0, (e.abilityStun || 0) - dt);
      for (const a of s.abilities) {
        a.cd = Math.max(0, a.cd - dt);
        if (a.left <= 0) continue;
        const step = Math.min(dt, a.left),
          st = effectiveStats(s);
        a.elapsed += step;
        a.left = Math.max(0, a.left - step);
        if (a.left < 1e-9) a.left = 0;
        if (a.id !== 'dash') continue;
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
            if (
              e.hp <= 0 ||
              a.hit.has(e) ||
              d >= 22 * st.range + e.r ||
              !world.arena.clear(p, e, 2)
            )
              continue;
            a.hit.add(e);
            damage(
              e,
              35 * st.damage * (1 + 0.25 * a.castRank),
              (dx / Math.max(1, d)) * 180,
              (dy / Math.max(1, d)) * 180,
              p,
            );
          }
        }
      }
    }
    function draw(g) {
      if (!run.state || !abilityActive(run.state, 'potion')) return;
      g.strokeStyle = '#6ca99a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(run.state.p.x, run.state.p.y, 32, 0, Math.PI * 2);
      g.stroke();
    }
    return { init, activate, update, draw };
  },
};
