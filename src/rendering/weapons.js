import { weaponDefinitions } from '../../data/weapons.js';
import { effectiveStats } from '../systems/queries/abilities.js';
import { projectilePainters } from './projectiles.js';
import { orbitShape, auraRadius, weaponEvolution } from '../systems/queries/weapons.js';
import { inBox } from '../core/math.js';

const TAU = Math.PI * 2;

// What an owned weapon draws around the hero, by weapon kind (data/weapons.js `kind`), and
// on which layer: 'ground' under the actors, 'air' over them.
const weaponPainters = {
  orbiter: {
    layer: 'air',
    draw(g, s, w, st, evo) {
      const { count, radius, size } = orbitShape(w, st),
        color = weaponDefinitions[w.id].color;
      if (evo?.ring) {
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
    },
  },
  // The evolved pulse's standing aura.
  pulse: {
    layer: 'ground',
    draw(g, s, w, st, evo) {
      if (!evo?.aura) return;
      const r = auraRadius(w, st),
        color = weaponDefinitions[w.id].color;
      g.strokeStyle = color + '66';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(s.p.x, s.p.y - 6, r, 0, TAU);
      g.stroke();
      g.fillStyle = color + '12';
      g.fill();
    },
  },
};

// What the weapons spawned (`s.wfx`), by effect kind: their shots and the mines and zones.
const effectPainters = {
  ...projectilePainters,
  landmine: {
    layer: 'ground',
    draw(g, f) {
      const blink = f.arm > 0 || Math.floor(f.life * 4) % 2 === 0;
      g.fillStyle = '#1b1f24';
      g.fillRect(f.x - 9, f.y - 9, 18, 18);
      g.fillStyle = blink ? f.color : '#ffffff';
      g.fillRect(f.x - 6, f.y - 6, 4, 4);
      g.fillRect(f.x + 2, f.y - 6, 4, 4);
      g.fillRect(f.x - 6, f.y + 2, 4, 4);
      g.fillRect(f.x + 2, f.y + 2, 4, 4);
    },
  },
  zone: {
    layer: 'ground',
    draw(g, f) {
      g.globalAlpha = Math.min(1, f.life / 0.4) * 0.9;
      g.fillStyle = f.color + '26';
      g.strokeStyle = f.color;
      g.lineWidth = 2;
      g.beginPath();
      g.rect(f.x - f.radius, f.y - f.radius * 0.6, f.radius * 2, f.radius * 1.2);
      g.fill();
      g.stroke();
      g.globalAlpha = 1;
    },
  },
};

// Owned weapons (`s.weapons`) and what they spawned (`s.wfx`) on one `layer`. `bounds` is
// the world rectangle on screen.
export function drawWeapons(g, s, bounds, layer = 'ground') {
  if (!s?.weapons) return;
  const st = effectiveStats(s);
  for (const w of s.weapons) {
    const painter = weaponPainters[weaponDefinitions[w.id].kind];
    if (painter?.layer === layer) painter.draw(g, s, w, st, weaponEvolution(w));
  }
  for (const f of s.wfx) {
    const painter = effectPainters[f.kind];
    if (painter.layer !== layer) continue;
    if (!inBox(f, bounds, 80)) continue;
    painter.draw(g, f);
  }
}
