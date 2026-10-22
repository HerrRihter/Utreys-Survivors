import { unitDefinitions } from '../../data/enemies/units.js';
import { enemyPhrases, speechSettings } from '../../data/enemies/phrases.js';
import { drawNodes } from './node-objectives.js';
import { drawCollision } from './collision.js';
import { drawEnemySpeech } from './enemy-speech.js';
import { drawEnemyShot } from './projectiles.js';

// The catalog pages' pictures: the arena plan, the bestiary's unit cards and its radar map.
// Nothing here runs in a game; the pages pass the arena, floor and nodes they show.

// The whole arena (or its central core) on the 1320 × 1000 plan canvas.
export function drawArenaPlan(g, { floor, arena, nodes, close, labels, bounds }) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);

  const scale = close ? 0.95 : 0.43;
  g.translate(660, 500);
  g.scale(scale, scale);
  g.translate(-1100, close ? -1070 : -1090);

  floor.draw(g, arena);
  drawNodes(g, nodes);

  const { accent } = floor.palette();
  if (bounds && arena.collision) {
    drawCollision(g, arena.collision.outlines);
    g.strokeStyle = accent;
    g.lineWidth = 5;
    g.strokeRect(0, 0, arena.size, arena.size);
  }

  if (labels) {
    g.fillStyle = accent;
    g.font = 'bold 24px monospace';
    g.textAlign = 'center';
    g.fillText('ЯДРО UTRACE', arena.size / 2, arena.size / 2);
  }
}

// The arena at a quarter scale with a radar pulse from the core; `t` is the pulse clock.
export function drawRadar(g, { floor, arena, nodes, t }) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, g.canvas.width, g.canvas.height);
  g.setTransform(0.25, 0, 0, 0.25, 0, 0);
  floor.draw(g, arena);
  drawNodes(g, nodes);

  // Radar pulses from core
  const { accent } = floor.palette();
  const pulse = 24 + ((t * 22) % 75);
  g.globalAlpha = Math.max(0, 1 - (pulse - 24) / 75) * 0.45;
  g.strokeStyle = accent;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(1100, 1100, pulse, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  // Center Core
  g.fillStyle = accent;
  g.beginPath();
  g.arc(1100, 1100, 22, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = 3;
  g.stroke();

  g.setTransform(1, 0, 0, 1, 0, 0);
}

// One unit on its bestiary card: walking, attacking (with its role's telegraph, hazard or
// projectile) or hurt, facing right or, with `reverse`, left; its phrases cycle every 10 s.
export function drawOpponentCard(g, enemies, { unit, motion, phase, reverse }) {
  const u = unitDefinitions[unit];
  if (!u) return;
  const { width, height } = g.canvas;
  g.clearRect(0, 0, width, height);
  g.imageSmoothingEnabled = false;

  // Draw datacenter grid background inside preview
  g.fillStyle = '#08171a';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = '#123038';
  g.lineWidth = 1;
  g.beginPath();
  for (let x = 0; x < width; x += 25) {
    g.moveTo(x, 0);
    g.lineTo(x, height);
  }
  for (let y = 0; y < height; y += 25) {
    g.moveTo(0, y);
    g.lineTo(width, y);
  }
  g.stroke();

  const cx = width / 2;
  const cy = height * 0.65;
  const bob = motion === 'walk' ? Math.sin(phase * 8) * 3 : 0;
  const lunge =
    motion === 'attack' ? (reverse ? -1 : 1) * Math.max(0, Math.sin(phase * 6) * 14) : 0;
  const shudder = motion === 'hurt' ? Math.sin(phase * 28) * 2.5 : 0;
  const isHit = motion === 'hurt' && Math.sin(phase * 12) > 0.1 ? 1 : 0;

  const aimX = cx + (reverse ? -130 : 130);
  const mockEnemy = {
    x: cx + lunge + shudder,
    y: cy + bob,
    unit,
    animationTime: phase,
    heading: reverse ? Math.PI : 0,
    hit: isHit,
    action: motion === 'attack' ? { aim: { x: aimX, y: cy }, hit: false } : null,
  };

  if (motion === 'attack') {
    // Role previews: the charger's lunge line and the artillery mark.
    if (u.dash)
      enemies.telegraph(g, {
        ...mockEnemy,
        action: null,
        dash: { phase: 'wind', dx: reverse ? -1 : 1, dy: 0 },
      });
    else enemies.telegraph(g, mockEnemy);
    if (u.mortar)
      enemies.hazard(g, {
        kind: 'blast',
        x: aimX,
        y: cy,
        r: u.mortar.radius,
        t: phase % u.mortar.delay,
        delay: u.mortar.delay,
        color: u.color,
      });

    // Unique functioning attack actions and projectiles
    if (u.burst) {
      g.strokeStyle = u.burst.ring.color;
      g.beginPath();
      g.arc(cx, cy, u.burst.ring.r, 0, Math.PI * 2);
      g.stroke();
    } else if (u.attack === 'pulse') {
      const waveR = 24 + ((phase * 80) % u.range);
      const waveAlpha = Math.max(0, 1 - waveR / u.range) * 0.75;
      g.strokeStyle =
        u.color +
        Math.round(waveAlpha * 255)
          .toString(16)
          .padStart(2, '0');
      g.lineWidth = 3;
      g.beginPath();
      g.arc(cx, cy - 16, waveR, 0, Math.PI * 2);
      g.stroke();
    } else if ('frontDamageMultiplier' in u) {
      g.strokeStyle = u.color + 'd9';
      g.lineWidth = 3.5;
      g.beginPath();
      const arcAngle = reverse ? Math.PI : 0;
      g.arc(cx + (reverse ? -26 : 26), cy - 14, 22, arcAngle - 1.1, arcAngle + 1.1);
      g.stroke();
    } else if (u.attack === 'projectile') {
      const prog = (phase * 1.8) % 1;
      const px = cx + (reverse ? -1 : 1) * (prog * 115);
      drawEnemyShot(g, { x: px, y: cy - 10, kind: unit });
    }
  }

  enemies.draw(g, mockEnemy);
  const phrases = enemyPhrases[unit];
  const cycle = Math.floor(phase / 10);
  if (phrases?.length && phase % 10 < speechSettings.duration) {
    drawEnemySpeech(
      g,
      {
        t: phase,
        enemies: [
          {
            ...mockEnemy,
            hp: 1,
            speech: {
              text: phrases[cycle % phrases.length],
              until: cycle * 10 + speechSettings.duration,
            },
          },
        ],
      },
      { x: 0, y: 0, width, height },
    );
  }
}
