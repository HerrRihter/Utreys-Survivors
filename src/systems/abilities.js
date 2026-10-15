import {
  abilityDefinitions,
  abilityRank,
  abilityUpgradeMax,
  abilityUpgradeDescriptions,
} from '../../data/characters/abilities.js';
export const AbilitySystem = {
  create(c) {
    const active = (id) =>
      c.state?.abilities?.some((a) => a.id === id && a.left > 0 && c.state.t < a.endsAt);
    const protectedMove = () => active('dash');
    const blocksAttack = protectedMove;
    function effectiveStats() {
      const stats = c.state.stats;
      if (!active('potion')) return stats;
      return {
        ...stats,
        haste: stats.haste * 1.6,
        speed: stats.speed * 1.15,
        punchForce: ((stats.punchForce || 0) + 145) * 1.5 - 145,
      };
    }
    function init() {
      c.state.abilities = abilityDefinitions[c.selected].map((a) => ({ ...a, cd: 0, left: 0 }));
    }
    function activate(slot) {
      if (c.mode !== 'play' || !c.state || c.state.p.hp <= 0 || c.state.p.stun > 0) return false;
      const s = c.state,
        a = s.abilities[slot],
        p = s.p;
      if (!a || a.cd > 0 || a.left > 0) return false;
      if (a.id === 'dash') {
        const probe = { x: p.x, y: p.y };
        c.Arena.move(probe, p.facing.x * 6, p.facing.y * 6, 14);
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
      c.Progression?.recordAbility?.();
      c.soundEffect('magic');
      hud();
      return true;
    }
    function update(dt) {
      const s = c.state,
        p = s.p;
      for (const e of s.enemies) e.abilityStun = Math.max(0, (e.abilityStun || 0) - dt);
      for (const a of s.abilities) {
        a.cd = Math.max(0, a.cd - dt);
        if (a.left <= 0) continue;
        const step = Math.min(dt, a.left),
          st = effectiveStats();
        a.elapsed += step;
        a.left = Math.max(0, a.left - step);
        if (a.left < 1e-9) a.left = 0;
        if (a.id !== 'dash') continue;
        const n = Math.max(1, Math.ceil((180 * step) / a.duration / 6));
        if (p.stun > 0) {
          a.left = 0;
          continue;
        }
        for (let i = 0; i < n; i++) {
          c.Arena.move(
            p,
            (a.direction.x * 180 * step) / a.duration / n,
            (a.direction.y * 180 * step) / a.duration / n,
            14,
          );
          for (const e of s.enemies) {
            const dx = e.x - p.x,
              dy = e.y - p.y,
              d = Math.hypot(dx, dy);
            if (e.hp <= 0 || a.hit.has(e) || d >= 22 * st.range + e.r || !c.Arena.clear(p, e, 2))
              continue;
            a.hit.add(e);
            c.damage(
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
    // Avoid recreating text nodes and invalidating layout on every animation frame.
    let controls = null,
      buttons = null;
    function hud() {
      const s = c.state,
        visible = !!s && c.mode === 'play';
      controls = c.$('abilities');
      if (controls?.classList && controls.classList.contains('hidden') === visible)
        controls.classList.toggle('hidden', !visible);
      if (!s?.abilities) return;
      buttons = [c.$('ability0'), c.$('ability1')];
      for (let i = 0; i < 2; i++) {
        const a = s.abilities[i],
          b = buttons[i];
        if (!a || !b) continue;
        const max = false;
        const text = `${i ? 'E' : 'Q'} · ${a.name} · ${abilityRank(s, a.id)}/${abilityUpgradeMax}\n${max ? 'Максимум' : a.left > 0 ? 'Активно ' + a.left.toFixed(1) + ' с' : a.cd > 0 ? Math.ceil(a.cd) + ' с' : 'Готово'}`;
        const disabled = c.mode !== 'play' || a.cd > 0 || a.left > 0 || max || s.p.stun > 0;
        if (b.textContent !== text) b.textContent = text;
        // Keep the touch face compact while preserving the full keyboard label.
        const status = max
          ? 'Максимум'
          : a.left > 0
            ? 'Активно'
            : a.cd > 0
              ? Math.ceil(a.cd) + ' с'
              : 'Готово';
        if (b.dataset.name !== a.name) b.dataset.name = a.name;
        if (b.dataset.status !== status) b.dataset.status = status;
        b.setAttribute?.('aria-label', `${a.name}: ${status}`);
        const title = a.description + ' Улучшение: ' + abilityUpgradeDescriptions[a.id];
        if (b.title !== title) b.title = title;
        if (b.disabled !== disabled) b.disabled = disabled;
      }
    }

    function draw(g) {
      if (!c.state || !active('potion')) return;
      g.strokeStyle = '#6ca99a';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(c.state.p.x, c.state.p.y, 32, 0, Math.PI * 2);
      g.stroke();
    }
    return {
      init,
      activate,
      update,
      active,
      protectedMove,
      blocksAttack,
      effectiveStats,
      hud,
      draw,
    };
  },
};
