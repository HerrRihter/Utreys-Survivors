import { unitDefinitions } from '../../data/enemies/units.js';
import { neonStroke } from './neon.js';
import { clientEmblems, drawClientEmblem } from './art/client-emblems.js';
import { enemyArt } from './art/enemy-art.js';
import { drawPenzaOutfit, penzaLook } from './art/penza-outfits.js';
import { browserCanvas, trimCanvas } from './offscreen.js';

// Enemy bodies, name labels, attack telegraphs and ground hazards, with per-device-ratio
// sprite and label caches. Each view (game session, bestiary) makes its own renderer.
// `createCanvas` makes the offscreen canvases; without one (headless tests) everything is
// painted directly. `penza()` puts the hidden Penza mode's outfits (art/penza-outfits.js) on
// over the usual art.
export function createEnemyRenderer({ createCanvas = browserCanvas, penza = () => false } = {}) {
  const units = unitDefinitions;
  const labels = new Map();

  function drawLabel(g, u, x, y, ratio = 2) {
    const key = u.name + '|' + u.color + '@' + ratio;
    let label = labels.get(key);
    const canvas = label ? null : createCanvas(1, 1),
      ctx = canvas?.getContext('2d');
    if (!label && ctx) {
      if (labels.size > 600) labels.clear();
      ctx.font = 'bold 11px monospace';
      const width = Math.ceil(ctx.measureText(u.name).width) + 8,
        height = 20;
      canvas.width = Math.ceil(width * ratio);
      canvas.height = Math.ceil(height * ratio);
      ctx.scale(ratio, ratio);
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
      labels.set(key, label);
    }
    if (label) {
      g.drawImage(
        label.canvas,
        x - label.width / 2,
        y - 14,
        label.canvas.width / ratio,
        label.canvas.height / ratio,
      );
    } else {
      g.fillStyle = u.color;
      g.font = 'bold 10px monospace';
      g.textAlign = 'center';
      g.fillText(u.name, x, y);
    }
  }

  function telegraph(g, e) {
    const u = units[e.unit];
    if (!u) return;
    if (u.aura) {
      // A guard's cover zone is always visible.
      g.save();
      g.strokeStyle = u.color + '55';
      g.setLineDash?.([6, 6]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(e.x, e.y, u.aura.radius, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    if (e.dash?.phase === 'wind') {
      // The lunge line: where the charger will run.
      const length = u.dash.speed * u.dash.time;
      g.save();
      g.translate(e.x, e.y);
      g.rotate(Math.atan2(e.dash.dy, e.dash.dx));
      g.fillStyle = u.color + '40';
      g.strokeStyle = '#00e5ff';
      g.lineWidth = 2;
      g.fillRect(0, -14, length, 28);
      g.strokeRect(0, -14, length, 28);
      g.restore();
      return;
    }
    if (!e.action || e.action.hit) return;
    const a = e.action,
      angle = Math.atan2(a.aim.y - e.y, a.aim.x - e.x);
    g.save();
    g.translate(e.x, e.y);
    g.rotate(angle);
    g.fillStyle = u.color + '40';
    g.strokeStyle = u.color;
    g.lineWidth = 2;
    if (u.attack === 'mortar') {
      // Aiming: a thin line toward the target; the mark itself appears on release.
      g.setLineDash?.([4, 8]);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.hypot(a.aim.x - e.x, a.aim.y - e.y), 0);
      g.stroke();
    } else if (u.attack === 'pulse') {
      // 360 degree regulatory shockwave zone
      g.beginPath();
      g.arc(0, 0, u.range, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (u.attack === 'projectile' && u.shots?.radial) {
      for (let i = 0; i < u.shots.count; i++) {
        const turn = (i * Math.PI * 2) / u.shots.count;
        g.beginPath();
        g.moveTo(Math.cos(turn) * 30, Math.sin(turn) * 30);
        g.lineTo(Math.cos(turn) * 90, Math.sin(turn) * 90);
        g.stroke();
      }
    } else if (u.attack === 'projectile') {
      const count = u.shots?.count || 1,
        spread = u.shots?.spread || 0;
      for (let i = 0; i < (spread ? count : 1); i++) {
        g.save();
        g.rotate((i - (count - 1) / 2) * spread);
        g.fillRect(0, -12, u.range, 24);
        g.strokeRect(0, -12, u.range, 24);
        g.restore();
      }
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

  // Ground marks: a blast fills up until it goes off; a pool glows while it lasts.
  function hazard(g, h) {
    g.save();
    g.strokeStyle = h.color;
    g.lineWidth = 2;
    if (h.kind === 'blast') {
      const k = Math.min(1, h.t / h.delay);
      g.fillStyle = h.color + '30';
      g.beginPath();
      g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      g.fill();
      g.stroke();
      g.fillStyle = h.color + '70';
      g.beginPath();
      g.arc(h.x, h.y, h.r * k, 0, Math.PI * 2);
      g.fill();
    } else {
      const fade = Math.min(1, (h.life - h.t) / 0.5);
      g.globalAlpha = Math.max(0.2, fade) * (h.t < h.arm ? 0.5 : 1);
      g.fillStyle = h.color + '45';
      g.beginPath();
      g.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      g.fill();
      g.setLineDash?.([5, 5]);
      g.stroke();
    }
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
    const flip = flipped(e);
    if (flip) g.scale(-1, 1);
    // Art drawn at the usual size and enlarged for a bigger body (the learning bosses).
    if (u.artScale) g.scale(u.artScale, u.artScale);

    paintArt(g, e, u, hitFlash, flip);
    if (penza()) drawPenzaOutfit(g, artBox(e, u), penzaLook(e, u), hitFlash);

    g.restore();
  }

  function paintArt(g, e, u, hitFlash, flip) {
    // Brand-specific skins share the same renderer in gameplay and previews.
    if (!drawClientEmblem(g, e)) {
      enemyArt(e.unit, u).draw(g, u, hitFlash, flip, e);
    }
  }

  // Brand emblems are logos and are never mirrored; other bodies mirror to show facing.
  function flipped(e) {
    return !clientEmblems[e.unit] && Math.cos(e.heading || 0) < 0;
  }

  // The unit art's drawn bounds around the feet, measured once per unit from its pixels,
  // so the Penza outfits sit on each body's own shoulders and top. Without a canvas (headless
  // tests) the bounds are guessed from the body radius.
  const boxes = new Map();
  function artBox(e, u) {
    let box = boxes.get(e.unit);
    if (box) return box;
    box = { left: -u.r, right: u.r, top: -u.r * 2.2, bottom: 0 };
    const size = 200,
      canvas = createCanvas(size, size),
      c = canvas?.getContext('2d');
    if (c?.getImageData) {
      c.translate(size / 2, size * 0.75);
      paintArt(c, { unit: e.unit, heading: 0, hit: 0, animationTime: 0 }, u, false, false);
      const pixels = c.getImageData(0, 0, size, size).data;
      let left = size,
        right = -1,
        top = size,
        bottom = -1;
      for (let y = 0; y < size; y++)
        for (let x = 0; x < size; x++)
          if (pixels[(y * size + x) * 4 + 3] > 40) {
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
      if (right >= 0)
        box = {
          left: left - size / 2,
          right: right - size / 2,
          top: top - size * 0.75,
          bottom: Math.min(0, bottom - size * 0.75),
        };
    }
    boxes.set(e.unit, box);
    return box;
  }

  // Parts that change every frame stay live: the seal's attack ring and a boss's ward.
  function paintLive(g, e, u) {
    const k = u.artScale ?? 1;
    if (u.attack === 'pulse' && e.action && !clientEmblems[e.unit]) {
      g.strokeStyle = '#ffd600bb';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -16 * k, 46 * k, 0, Math.PI * 2);
      g.stroke();
    }
    if (e.warded) {
      g.strokeStyle = u.ward.color;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, -16 * k, e.r + 26, 0, Math.PI * 2);
      neonStroke(g, u.ward.color, 1.5, 8);
    }
  }

  const baseBox = { left: 72, top: 100, width: 144, height: 140 },
    sprites = new Map();
  // The sprite canvas around the feet, grown with the unit's art scale.
  const spriteBox = (u) => {
    const k = u.artScale ?? 1;
    return k === 1
      ? baseBox
      : {
          left: baseBox.left * k,
          top: baseBox.top * k,
          width: baseBox.width * k,
          height: baseBox.height * k,
        };
  };
  function spriteKey(e, u) {
    const side = (flipped(e) ? '|l' : '|r') + (e.hit > 0 ? '|h' : '');
    const frame = enemyArt(e.unit, u)?.frame;
    return (
      e.unit + side + (frame ? '|' + frame(e) : '') + (penza() ? '|pz' + penzaLook(e, u).key : '')
    );
  }
  function cachedSprite(e, u, ratio) {
    const key = spriteKey(e, u) + '@' + ratio;
    let sprite = sprites.get(key);
    if (!sprite) {
      if (sprites.size > 600) sprites.clear();
      const box = spriteBox(u);
      const canvas = createCanvas(Math.ceil(box.width * ratio), Math.ceil(box.height * ratio));
      const c = canvas?.getContext('2d');
      if (!c) return null;
      c.scale(ratio, ratio);
      c.translate(box.left, box.top);
      paintBody(c, e, u);
      // Crop in backing pixels; the reciprocal ratio below preserves their positions.
      sprite = trimCanvas(canvas, createCanvas);
      sprites.set(key, sprite);
    }
    return sprite;
  }

  function draw(g, e) {
    const u = units[e.unit];
    if (!u) return;
    const x = Math.round(e.x),
      y = Math.round(e.y);
    // Match the actual transform, including portrait zoom and elite scaling.
    // Quantizing it forces Firefox to resample every sprite on every frame.
    const scale = g.getTransform?.()?.a;
    const ratio = scale > 0 ? scale : 0;
    const sprite = ratio ? cachedSprite(e, u, ratio) : null;
    g.save();
    g.translate(x, y);
    if (sprite) {
      const sx = 1 / ratio,
        sy = 1 / ratio,
        box = spriteBox(u);
      g.drawImage(
        sprite.canvas,
        -box.left + sprite.x * sx,
        -box.top + sprite.y * sy,
        sprite.canvas.width * sx,
        sprite.canvas.height * sy,
      );
    } else paintBody(g, e, u);
    paintLive(g, e, u);
    g.restore();

    // Draw unit name label above
    const labelOffset = u.labelAbove ?? (clientEmblems[e.unit] ? Math.max(u.r + 28, 60) : u.r + 28);
    // A Penza cap sits above the art: the label moves up to clear it.
    drawLabel(g, u, e.x, e.y - labelOffset - (penza() ? 12 : 0), ratio || 2);
  }

  return { telegraph, draw, hazard };
}
