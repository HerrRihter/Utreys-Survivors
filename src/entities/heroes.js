import {heroDefinitions} from '../../data/characters/heroes.js';
import {Village} from '../world/village/village.js';
import {ProjectileArt} from '../rendering/art/projectile-art.js';

export let Villagers;
'use strict';
Villagers = (() => {
  const defs = heroDefinitions;

  function draw(g, id, x, y, size = 3, flip = false, phase = 0) {
    g.save();
    g.translate(x, y);
    g.scale((flip ? -1 : 1) * size, size);
    const step = Math.sin(phase * 6.28) * 1.5;

    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(0, 2, 8, 3, 0, 0, Math.PI * 2);
    g.fill();

    // Legs / Thrusters
    g.fillStyle = '#0a192f';
    g.fillRect(-5, -4 + step, 4, 4);
    g.fillRect(1, -4 - step, 4, 4);
    g.fillStyle = '#00e5ff';
    g.fillRect(-4, -1 + step, 2, 2);
    g.fillRect(2, -1 - step, 2, 2);

    // Torso (Utrace Cyber Suit)
    g.fillStyle = '#102a43';
    g.fillRect(-6, -18, 12, 14);
    g.fillStyle = '#00e5ff';
    g.fillRect(-4, -16, 8, 10);
    // Core light
    g.fillStyle = '#ffffff';
    g.fillRect(-2, -14, 4, 6);

    // Head / Scanner Helmet
    g.fillStyle = '#0a192f';
    g.fillRect(-6, -28, 12, 10);
    // Glowing Visor / Code Scanner
    g.fillStyle = '#64ffda';
    g.fillRect(-5, -25, 10, 4);
    g.fillStyle = '#ffffff';
    g.fillRect(-2, -24, 4, 2);

    // Arms / Code Emitter
    g.fillStyle = '#102a43';
    g.fillRect(-8, -17, 3, 8);
    g.fillRect(5, -17, 3, 8);
    g.fillStyle = '#00e5ff';
    g.fillRect(-8, -10, 3, 3);
    g.fillRect(5, -10, 3, 3);

    // 'U' badge on forehead
    g.fillStyle = '#00e5ff';
    g.font = 'bold 6px monospace';
    g.textAlign = 'center';
    g.fillText('U', 0, -29);

    g.restore();
    return true;
  }

  function fish(s, dir, options = {}) {
    const count = options.count ?? 1 + (s.stats.fishCount || 0);
    const angle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < count; i++) {
      const a = angle + (i - (count - 1) / 2) * (options.spread ? options.spread / Math.max(1, count - 1) : 0.22);
      s.fish.push({
        x: s.p.x,
        y: s.p.y,
        dx: Math.cos(a),
        dy: Math.sin(a),
        age: 0,
        damage: options.damage ?? 24,
        back: false,
        hit: new Set(),
        r: 12 * s.stats.range,
      });
    }
  }

  function update(s, id, dt, hit, world = Village, effective = s.stats) {
    const p = s.p, st = effective;
    if (p.visualAction) {
      p.visualAction.elapsed += dt;
      if (p.visualAction.elapsed >= p.visualAction.duration) p.visualAction = null;
    }

    for (const f of s.fish) {
      f.age += dt;
      if (!f.back && f.age >= 0.65) {
        f.back = true;
        f.hit.clear();
      }
      const d = Math.hypot(p.x - f.x, p.y - f.y);
      if (f.back && d < 20) {
        f.dead = true;
        continue;
      }
      const speed = 310 * (1 + (st.fishSpeed || 0));
      const vx = (f.back ? (p.x - f.x) / Math.max(1, d) : f.dx) * speed;
      const vy = (f.back ? (p.y - f.y) / Math.max(1, d) : f.dy) * speed;
      f.vx = vx;
      f.vy = vy;
      const n = Math.max(1, Math.ceil(Math.hypot(vx, vy) * dt / 6));
      for (let i = 0; i < n && !f.dead; i++) {
        const next = {x: f.x + vx * dt / n, y: f.y + vy * dt / n};
        if (!world.clear(f, next, 3)) {
          if (f.back) f.dead = true;
          else {
            f.back = true;
            f.hit.clear();
          }
          break;
        }
        f.x = next.x;
        f.y = next.y;
        for (const e of s.enemies) {
          if (e.hp > 0 && !f.hit.has(e) && Math.hypot(e.x - f.x, e.y - f.y) < e.r + f.r) {
            f.hit.add(e);
            hit(e, (f.damage ?? 24) * st.damage * (f.back ? 1 + (st.fishReturn || 0) : 1), vx * 0.12, vy * 0.12, f);
          }
        }
      }
      if (f.age > 3) f.dead = true;
    }
    s.fish = s.fish.filter(f => !f.dead);
  }

  function ground(g, s, id, effective = s.stats) {}

  function projectiles(g, s) {
    for (const f of s.fish) ProjectileArt.drawFish(g, f);
  }

  // DataMatrix code token marker pickup
  function helmet(g, x, y, scale = 1) {
    g.save();
    g.translate(x, y);
    g.scale(scale, scale);
    g.fillStyle = '#00e5ff';
    g.fillRect(-10, -10, 20, 20);
    g.fillStyle = '#0a192f';
    g.fillRect(-8, -8, 16, 16);
    // DataMatrix mini pattern
    g.fillStyle = '#00e5ff';
    g.fillRect(-6, -6, 4, 4);
    g.fillRect(2, -6, 4, 4);
    g.fillRect(-6, 2, 4, 4);
    g.fillRect(0, 0, 3, 3);
    g.fillRect(3, 3, 3, 3);
    g.restore();
  }

  return {defs, draw, fish, update, ground, projectiles, helmet};
})();
