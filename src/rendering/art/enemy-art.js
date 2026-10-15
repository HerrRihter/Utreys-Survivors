import { clientEmblems } from './client-emblems.js';

// Enemy bodies drawn around the feet (0, 0), facing right; the caller mirrors (`flip`) and
// caches them.
// Lookup order: brand emblem (client-emblems.js) → unit art below → attack-style art → node.
// `frame(e)` names the animation phase that is part of a cached sprite's key.

const ledTick = (e) => Math.floor(((e.animationTime ?? 0) * 1000) / 180);

// Mirroring conveys facing for the body only; lettering is always drawn upright.
function uprightText(g, flip, text, x, y) {
  if (!flip) {
    g.fillText(text, x, y);
    return;
  }
  g.save();
  g.scale(-1, 1);
  g.fillText(text, -x, y);
  g.restore();
}

export const unitArt = {
  // Пепси — Iconic Blue / White / Red Client Sphere
  pepsi: {
    draw(g, u, hitFlash, flip) {
      const r = 21;
      g.save();
      g.translate(0, -17);
      // Outer border
      g.fillStyle = hitFlash ? '#ffffff' : '#004b93';
      g.beginPath();
      g.arc(0, 0, r, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 2.5;
      g.strokeStyle = '#ffffff';
      g.stroke();

      // Top red half
      g.fillStyle = hitFlash ? '#ffffff' : '#e32934';
      g.beginPath();
      g.arc(0, 0, r - 2, Math.PI, 0);
      g.closePath();
      g.fill();

      // Bottom blue half
      g.fillStyle = hitFlash ? '#ffffff' : '#004b93';
      g.beginPath();
      g.arc(0, 0, r - 2, 0, Math.PI);
      g.closePath();
      g.fill();

      // White wave in middle
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(0, 0, r - 2, 5.5, 0.2, 0, Math.PI * 2);
      g.fill();

      // Bubbles & data sparkles
      g.fillStyle = '#ffffffaa';
      g.fillRect(-5, -9, 2.5, 2.5);
      g.fillRect(4, 5, 2.5, 2.5);

      g.restore();
    },
  },
  // Инбев — Heavy Industrial Brewery Tanker
  inbev: {
    draw(g, u, hitFlash, flip) {
      const w = 38,
        h = 30;
      g.fillStyle = hitFlash ? '#ffffff' : '#1c1512';
      g.fillRect(-w / 2 - 2, -h - 4, w + 4, h + 8);
      g.fillStyle = hitFlash ? '#ffffff' : '#d4af37';
      g.fillRect(-w / 2, -h - 2, w, h + 4);
      g.lineWidth = 2;
      g.strokeStyle = '#660000';
      g.strokeRect(-w / 2, -h - 2, w, h + 4);

      // Gold badge & label
      g.fillStyle = '#660000';
      g.fillRect(-w / 2 + 4, -h + 2, w - 8, h - 4);
      g.fillStyle = '#ffd700';
      g.font = 'bold 9px sans-serif';
      g.textAlign = 'center';
      uprightText(g, flip, 'INBEV', 0, -h / 2);
    },
  },
  // L3 — Green High-Tech Gateway Server Node with blinking activity LEDs (period of 12 ticks).
  l3: {
    frame: (e) => ledTick(e) % 12,
    draw(g, u, hitFlash, flip, e) {
      const w = 24,
        h = 28;
      g.fillStyle = hitFlash ? '#ffffff' : '#081c13';
      g.fillRect(-w / 2, -h, w, h);
      g.lineWidth = 2;
      g.strokeStyle = '#00e676';
      g.strokeRect(-w / 2, -h, w, h);

      // Server LEDs (blinking activity indicators)
      const tick = ledTick(e);
      g.fillStyle = tick % 2 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 4, -h + 4, 3, 3);
      g.fillStyle = tick % 3 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 10, -h + 4, 3, 3);
      g.fillStyle = tick % 4 === 0 ? '#00e676' : '#69f0ae';
      g.fillRect(-w / 2 + 16, -h + 4, 3, 3);

      // Status bar line
      g.fillStyle = '#00e67688';
      g.fillRect(-w / 2 + 3, -h + 10, w - 6, 2);

      g.fillStyle = '#69f0ae';
      g.font = 'bold 12px monospace';
      g.textAlign = 'center';
      uprightText(g, flip, 'L3', 0, -h + 21);
    },
  },
};

export const styleArt = {
  // Regulatory emblem / bug fortress.
  pulse: {
    draw(g, u, hitFlash, flip) {
      const size = 36;
      g.fillStyle = hitFlash ? '#ffffff' : u.color;
      g.beginPath();
      // Hexagonal regulatory seal
      for (let i = 0; i < 6; i++) {
        const rad = (i * Math.PI) / 3;
        const hx = Math.cos(rad) * size;
        const hy = Math.sin(rad) * size - 16;
        if (i === 0) g.moveTo(hx, hy);
        else g.lineTo(hx, hy);
      }
      g.closePath();
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#102026';
      g.stroke();

      // Inner seal
      g.fillStyle = '#102026';
      g.beginPath();
      g.arc(0, -16, size * 0.68, 0, Math.PI * 2);
      g.fill();

      // CRPT emblem mark
      g.fillStyle = '#ffd600';
      g.font = 'bold 16px Consolas, monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      uprightText(g, flip, u.mark, 0, -16);
    },
  },
  // Red bold FMCG box (Марс and other shooters without a brand emblem).
  projectile: {
    draw(g, u, hitFlash, flip) {
      const size = 23;
      g.fillStyle = hitFlash ? '#ffffff' : u.color;
      g.fillRect(-size, -size * 1.5, size * 2, size * 1.5);
      g.lineWidth = 2;
      g.strokeStyle = '#ffeb3b';
      g.strokeRect(-size, -size * 1.5, size * 2, size * 1.5);

      // Mars Gold Text
      g.fillStyle = '#ffeb3b';
      g.font = 'italic 900 13px sans-serif';
      g.textAlign = 'center';
      uprightText(g, flip, u.mark, 0, -size * 0.7);
    },
  },
};

// Data-driven client node: any unit without dedicated art.
export const nodeArt = {
  draw(g, u, hitFlash, flip) {
    const w = u.r * 1.6,
      h = u.r * 1.8;
    g.fillStyle = hitFlash ? '#ffffff' : '#0f272d';
    g.fillRect(-w / 2, -h, w, h);
    g.strokeStyle = u.color;
    g.lineWidth = 1.5;
    g.strokeRect(-w / 2, -h, w, h);
    g.fillStyle = u.color;
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    uprightText(g, flip, u.mark || 'NODE', 0, -h / 2);
  },
};

export function enemyArt(id, u) {
  if (clientEmblems[id]) return null;
  return unitArt[id] || styleArt[u.attack] || nodeArt;
}
