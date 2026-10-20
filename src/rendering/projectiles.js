import { unitDefinitions } from '../../data/enemies/units.js';
import { neonStroke } from './neon.js';

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
