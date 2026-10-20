import { unitDefinitions } from '../../data/enemies/units.js';
import { neonStroke } from './neon.js';

const TAU = Math.PI * 2;

// The hero's packets (`s.shots`): a glowing block turned along its flight.
export function drawShot(g, b) {
  g.save();
  g.translate(b.x, b.y);
  g.rotate(Math.atan2(b.vy, b.vx));
  g.fillStyle = b.color || '#009dbb';
  g.fillRect(-10, -6, 20, 12);
  g.beginPath();
  g.rect(-10, -6, 20, 12);
  neonStroke(g, b.color || '#00e5ff', 1, 5);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) g.fillRect(-7 + i * 4, -4, 2, 8);
  g.restore();
}

// The player's projectiles by kind (src/systems/projectiles.js) and the layer they fly on.
export const projectilePainters = {
  packet: { layer: 'air', draw: drawShot },
  seeker: {
    layer: 'air',
    draw(g, f) {
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
    },
  },
  label: {
    layer: 'air',
    draw(g, f) {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.life * 9);
      g.fillStyle = '#f5f5f5';
      g.fillRect(-f.r, -f.r * 0.65, f.r * 2, f.r * 1.3);
      g.fillStyle = f.color;
      g.fillRect(-f.r + 2, -2, f.r * 2 - 4, 4);
      g.restore();
    },
  },
  boomerang: {
    layer: 'air',
    draw(g, f) {
      g.save();
      g.translate(f.x, f.y);
      g.rotate(f.spin);
      g.strokeStyle = f.color;
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, 0, f.r, 0.3, Math.PI * 1.4);
      g.stroke();
      g.restore();
    },
  },
};

// Enemy shots (`s.enemyShots`) in the colour of the unit that fired them; a shot still
// waiting to leave is not drawn.
export function drawEnemyShot(g, b) {
  if (b.wait > 0) return;
  g.save();
  g.translate(b.x, b.y);
  g.fillStyle = unitDefinitions[b.kind]?.color || '#ff5252';
  g.beginPath();
  g.arc(0, 0, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffeb3b';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}
