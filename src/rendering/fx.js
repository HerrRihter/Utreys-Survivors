import { neonStroke } from './neon.js';

// Short-lived effects in `s.fx`, one painter per kind. A painter draws one effect with the
// fade (`life / max`) already applied as the global alpha; a kind without a painter is drawn
// as an arc (`drawArcFx`), like rings and slashes.

function link(g, f) {
  g.strokeStyle = f.color;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(f.x, f.y);
  g.lineTo(f.toX, f.toY);
  neonStroke(g, f.color, 4, 10);
  const progress = 1 - f.life / f.max;
  g.fillStyle = '#d1fff1';
  for (let i = 0; i < 3; i++) {
    const t = (progress * 2 + i / 3) % 1;
    const x = f.x + (f.toX - f.x) * t;
    const y = f.y + (f.toY - f.y) * t;
    g.fillRect(x - 3, y - 3, 6, 6);
  }
  g.beginPath();
  g.arc(f.toX, f.toY, 8, 0, Math.PI * 2);
  neonStroke(g, f.color, 2, 5);
}

function scanFrame(g, f) {
  const r = f.r;
  g.beginPath();
  g.rect(f.x - r, f.y - r, r * 2, r * 2);
  neonStroke(g, f.color, 2, 6);
}

function scan(g, f) {
  scanFrame(g, f);
  const r = f.r;
  const y = f.y - r + 2 * r * (1 - f.life / f.max);
  g.fillStyle = '#79edbd12';
  g.fillRect(f.x - r, f.y - r, r * 2, r * 2);
  g.beginPath();
  g.moveTo(f.x - r, y);
  g.lineTo(f.x + r, y);
  neonStroke(g, f.color, 3, 5);
}

function scanTarget(g, f) {
  scanFrame(g, f);
  g.beginPath();
  g.moveTo(f.x - 6, f.y);
  g.lineTo(f.x + 6, f.y);
  g.moveTo(f.x, f.y - 6);
  g.lineTo(f.x, f.y + 6);
  neonStroke(g, f.color, 1, 3);
}

function line(g, f) {
  g.strokeStyle = f.color;
  g.lineWidth = f.width * (f.life / f.max);
  g.beginPath();
  g.moveTo(f.x, f.y);
  g.lineTo(f.toX, f.toY);
  neonStroke(g, f.color, f.width * 0.5 * (f.life / f.max), 6);
}

function spark(g, f) {
  g.fillStyle = f.color || '#00e5ff';
  g.fillRect(f.x, f.y, 3, 3);
}

// Rings, slashes, hurt marks and any kind without its own painter: an arc that grows as it
// fades; a slash is a wide arc with an inner edge.
function drawArcFx(g, f) {
  const slash = f.kind === 'slash';
  g.strokeStyle = f.color || (slash ? '#00e5ff' : f.kind === 'ring' ? '#64ffda' : '#ff5252');
  g.lineWidth = slash ? 7 : 3;
  g.beginPath();
  const r = f.r * (1 - (f.life / f.max) * 0.3);
  const half = f.half || Math.PI / 4;
  g.arc(f.x, f.y, r, slash ? f.angle - half : 0, slash ? f.angle + half : Math.PI * 2);
  neonStroke(g, g.strokeStyle, slash ? 3 : 1.5, 6);
  if (slash) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(f.x, f.y, r - 12, f.angle - half, f.angle + half);
    g.stroke();
  }
}

const fxPainters = {
  link,
  scan,
  scanTarget,
  line,
  spark,
  ring: drawArcFx,
  slash: drawArcFx,
  hurt: drawArcFx,
};

export function drawFx(g, list) {
  for (const f of list) {
    g.save();
    g.globalAlpha = f.life / f.max;
    (fxPainters[f.kind] || drawArcFx)(g, f);
    g.restore();
  }
}
