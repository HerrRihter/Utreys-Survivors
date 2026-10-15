import { unitDefinitions } from '../../data/enemies/units.js';

export function drawEnemySpeech(g, state, viewport) {
  g.save();
  g.font = 'bold 12px Consolas, monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const e of state.enemies) {
    if (!e.speech || e.hp <= 0 || e.speech.until <= state.t) continue;
    if (
      e.x < viewport.x ||
      e.x > viewport.x + viewport.width ||
      e.y < viewport.y ||
      e.y > viewport.y + viewport.height
    )
      continue;
    const text = e.speech.text;
    const width = Math.min(g.measureText(text).width + 20, viewport.width - 24);
    const x = Math.max(
      viewport.x + width / 2 + 8,
      Math.min(viewport.x + viewport.width - width / 2 - 8, e.x),
    );
    const y = Math.max(viewport.y + 16, e.y - Math.max(unitDefinitions[e.unit].r + 28, 60) - 34);
    g.globalAlpha = Math.min(1, (e.speech.until - state.t) * 3);
    g.fillStyle = '#0b1c22f2';
    g.fillRect(x - width / 2, y - 13, width, 26);
    g.strokeStyle = '#508c98';
    g.lineWidth = 1;
    g.strokeRect(x - width / 2, y - 13, width, 26);
    g.beginPath();
    g.moveTo(x - 4, y + 13);
    g.lineTo(x, y + 18);
    g.lineTo(x + 4, y + 13);
    g.stroke();
    g.fillStyle = '#b9e2df';
    g.fillText(text, x, y, width - 12);
  }
  g.restore();
}
