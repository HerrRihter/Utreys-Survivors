import { weaponDefinitions } from '../../data/weapons.js';
import { effectiveStats } from '../systems/queries/abilities.js';
import { orbitShape, auraRadius } from '../systems/queries/weapons.js';

const TAU = Math.PI * 2;
const groundKinds = new Set(['mine', 'zone']);

// Owned weapons (`s.weapons`) and what they spawned (`s.wfx`). `layer` 'ground' draws mines,
// zones and the firewall under the actors; 'air' draws the orbit and projectiles over them.
// `bounds` is the world rectangle on screen.
export function drawWeapons(g, s, bounds, layer = 'ground') {
  if (!s?.weapons) return;
  const st = effectiveStats(s);
  const air = layer === 'air';
  for (const w of s.weapons) {
    if (w.id === 'orbit' && air) {
      const { count, radius, size } = orbitShape(w, st),
        color = weaponDefinitions.orbit.color;
      if (w.evolved) {
        g.strokeStyle = color + '55';
        g.lineWidth = size;
        g.beginPath();
        g.arc(s.p.x, s.p.y - 10, radius, 0, TAU);
        g.stroke();
      }
      g.fillStyle = color;
      for (let k = 0; k < count; k++) {
        const a = w.phase + (k / count) * TAU;
        g.fillRect(
          s.p.x + Math.cos(a) * radius - size / 2,
          s.p.y - 10 + Math.sin(a) * radius - size / 2,
          size,
          size,
        );
      }
    } else if (w.id === 'ping' && w.evolved && !air) {
      const r = auraRadius(w, st);
      g.strokeStyle = '#80deea66';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(s.p.x, s.p.y - 6, r, 0, TAU);
      g.stroke();
      g.fillStyle = '#80deea12';
      g.fill();
    }
  }
  for (const f of s.wfx) {
    if (groundKinds.has(f.kind) === air) continue;
    if (f.x < bounds.minX - 80 || f.x > bounds.maxX + 80) continue;
    if (f.y < bounds.minY - 80 || f.y > bounds.maxY + 80) continue;
    if (f.kind === 'homing') {
      g.fillStyle = f.color;
      g.beginPath();
      g.arc(f.x, f.y, f.r, 0, TAU);
      g.fill();
      g.strokeStyle = f.color + '66';
      g.lineWidth = f.r;
      g.beginPath();
      g.moveTo(f.x, f.y);
      g.lineTo(f.x - f.vx * 0.04, f.y - f.vy * 0.04);
      g.stroke();
    } else if (f.kind === 'mine') {
      const blink = f.arm > 0 || Math.floor(f.life * 4) % 2 === 0;
      g.fillStyle = '#1b1f24';
      g.fillRect(f.x - 9, f.y - 9, 18, 18);
      g.fillStyle = blink ? f.color : '#ffffff';
      g.fillRect(f.x - 6, f.y - 6, 4, 4);
      g.fillRect(f.x + 2, f.y - 6, 4, 4);
      g.fillRect(f.x - 6, f.y + 2, 4, 4);
      g.fillRect(f.x + 2, f.y + 2, 4, 4);
    } else if (f.kind === 'label') {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.life * 9);
      g.fillStyle = '#f5f5f5';
      g.fillRect(-f.r, -f.r * 0.65, f.r * 2, f.r * 1.3);
      g.fillStyle = f.color;
      g.fillRect(-f.r + 2, -2, f.r * 2 - 4, 4);
      g.restore();
    } else if (f.kind === 'boomerang') {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.spin);
      g.strokeStyle = f.color;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, f.r, 0.3, Math.PI * 1.4);
      g.stroke();
      g.restore();
    } else if (f.kind === 'zone') {
      g.globalAlpha = Math.min(1, f.life / 0.4) * 0.9;
      g.fillStyle = f.color + '26';
      g.strokeStyle = f.color;
      g.lineWidth = 2;
      g.beginPath();
      g.rect(f.x - f.radius, f.y - f.radius * 0.6, f.radius * 2, f.radius * 1.2);
      g.fill();
      g.stroke();
      g.globalAlpha = 1;
    }
  }
}
