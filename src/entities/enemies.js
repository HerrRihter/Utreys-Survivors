import { unitDefinitions } from '../../data/enemies/units.js';
import { neonStroke } from '../rendering/neon.js';
import { clientEmblems, drawClientEmblem } from '../rendering/art/client-emblems.js';
import { enemyArt } from '../rendering/art/enemy-art.js';
import { browserCanvas } from '../rendering/offscreen.js';

// Enemy data plus rendering with per-device-ratio sprite caches. `createCanvas` makes the
// offscreen canvases; without one (headless tests) everything is painted directly.
export function createEnemies({ createCanvas = browserCanvas } = {}) {
  const units = unitDefinitions;
  const labels = new Map();

  function drawLabel(g, u, x, y) {
    let label = labels.get(u);
    const canvas = label ? null : createCanvas(1, 1),
      ctx = canvas?.getContext('2d');
    if (!label && ctx) {
      ctx.font = 'bold 11px monospace';
      const width = Math.ceil(ctx.measureText(u.name).width) + 8,
        height = 20;
      canvas.width = width * 2;
      canvas.height = height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = '#0b1612e0';
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = u.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = u.color;
      ctx.fillText(u.name, width / 2, 14);
      label = { canvas, width, height };
      labels.set(u, label);
    }
    if (label) {
      g.drawImage(label.canvas, x - label.width / 2, y - 14, label.width, label.height);
    } else {
      g.fillStyle = u.color;
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.fillText(u.name, x, y);
    }
  }

  function mitigation(e, p) {
    const multiplier = units[e.unit]?.frontDamageMultiplier;
    if (multiplier == null) return 1;
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    return Math.cos(a - (e.heading || 0)) > 0.15 ? multiplier : 1;
  }

  function telegraph(g, e) {
    if (!e.action || e.action.hit) return;
    const u = units[e.unit];
    if (!u) return;
    const a = e.action,
      angle = Math.atan2(a.aim.y - e.y, a.aim.x - e.x);
    g.save();
    g.translate(e.x, e.y);
    g.rotate(angle);
    g.fillStyle = u.color + '40';
    g.strokeStyle = u.color;
    g.lineWidth = 2;
    if (u.attack === 'pulse') {
      // 360 degree regulatory shockwave zone
      g.beginPath();
      g.arc(0, 0, u.range, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (u.attack === 'projectile') {
      g.fillRect(0, -12, u.range, 24);
      g.strokeRect(0, -12, u.range, 24);
    } else {
      g.beginPath();
      g.arc(0, 0, u.range, -0.9, 0.9);
      g.lineTo(0, 0);
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  function projectile(g, b) {
    g.save();
    g.translate(b.x, b.y);
    g.fillStyle = units[b.kind]?.color || '#ff5252';
    g.beginPath();
    g.arc(0, 0, 6, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffeb3b';
    g.lineWidth = 2;
    g.stroke();
    g.restore();
  }

  // Body art drawn around the origin (feet at 0,0). Everything here depends only on the
  // sprite key (unit, facing, hit flash, LED phase), so it is cached per device ratio below.
  function paintBody(g, e, u) {
    g.save();

    // Shadow
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    g.ellipse(0, 4, u.r, u.r * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    neonStroke(g, u.color, 0.8, 4);

    const hitFlash = e.hit > 0;
    const angle = e.heading || 0;
    // Brand emblems are logos and are never mirrored; other bodies mirror to show facing.
    const flip = !clientEmblems[e.unit] && Math.cos(angle) < 0;
    if (flip) g.scale(-1, 1);

    // Brand-specific skins share the same renderer in gameplay and previews.
    if (!drawClientEmblem(g, e)) {
      enemyArt(e.unit, u).draw(g, u, hitFlash, flip, e);
    }

    g.restore();
  }

  // Parts that change every frame stay live: the seal's attack ring.
  function paintLive(g, e, u) {
    if (u.attack === 'pulse' && e.action && !clientEmblems[e.unit]) {
      g.strokeStyle = '#ffd600bb';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -16, 46, 0, Math.PI * 2);
      g.stroke();
    }
  }

  const spriteBox = { left: 72, top: 100, width: 144, height: 140 },
    sprites = new Map();
  function spriteKey(e, u) {
    const frame = enemyArt(e.unit, u)?.frame;
    return (
      e.unit +
      (!clientEmblems[e.unit] && Math.cos(e.heading || 0) < 0 ? '|l' : '|r') +
      (e.hit > 0 ? '|h' : '') +
      (frame ? '|' + frame(e) : '')
    );
  }
  function cachedSprite(e, u, ratio) {
    const key = spriteKey(e, u) + '@' + ratio;
    let canvas = sprites.get(key);
    if (!canvas) {
      if (sprites.size > 600) sprites.clear();
      canvas = createCanvas(
        Math.ceil(spriteBox.width * ratio),
        Math.ceil(spriteBox.height * ratio),
      );
      const c = canvas?.getContext('2d');
      if (!c) return null;
      c.scale(ratio, ratio);
      c.translate(spriteBox.left, spriteBox.top);
      paintBody(c, e, u);
      sprites.set(key, canvas);
    }
    return canvas;
  }

  function draw(g, e) {
    const u = units[e.unit];
    if (!u) return;
    const x = Math.round(e.x),
      y = Math.round(e.y);
    // Cache at the target's device-pixel scale so drawImage copies pixels 1:1.
    const scale = g.getTransform?.()?.a;
    const ratio = scale > 0 ? Math.round(scale * 4) / 4 : 0;
    const sprite = ratio ? cachedSprite(e, u, ratio) : null;
    g.save();
    g.translate(x, y);
    if (sprite)
      g.drawImage(sprite, -spriteBox.left, -spriteBox.top, spriteBox.width, spriteBox.height);
    else paintBody(g, e, u);
    paintLive(g, e, u);
    g.restore();

    // Draw unit name label above
    const labelOffset = clientEmblems[e.unit] ? Math.max(u.r + 28, 60) : u.r + 28;
    drawLabel(g, u, e.x, e.y - labelOffset);
  }

  return { units, mitigation, telegraph, draw, projectile };
}

// Shared instance for React previews (bestiary, arena view); the game session makes its own.
export const Enemies = createEnemies();
