import { workaroundRadius, workaroundSeconds } from '../../data/enemies/nodes.js';
import { neonStroke } from './neon.js';

export function drawNodes(g, nodes) {
  for (const node of nodes || []) {
    const guarded = node.status === 'guarded';
    g.save();
    g.translate(node.x, node.y);
    g.strokeStyle = guarded ? '#ffb74d' : '#64ffda';
    g.fillStyle = '#102026';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, workaroundRadius, 0, Math.PI * 2);
    neonStroke(g, g.strokeStyle, 1.5, 6);
    g.fillRect(-34, -28, 68, 56);
    g.strokeRect(-34, -28, 68, 56);
    g.beginPath();
    g.rect(-34, -28, 68, 56);
    neonStroke(g, g.strokeStyle, 1.5, 5);
    g.fillStyle = g.strokeStyle;
    g.font = 'bold 12px monospace';
    g.textAlign = 'center';
    g.fillText(node.id, 0, -90);
    g.font = '11px monospace';
    g.fillText(
      guarded
        ? 'Уничтожьте баг или стойте в круге 6 с'
        : node.status === 'destroyed'
          ? 'Баг уничтожен'
          : 'Воркэраунд найден',
      0,
      100,
    );
    g.fillText(
      guarded ? Math.floor((node.progress / (node.need ?? workaroundSeconds)) * 100) + '%' : 'OK',
      0,
      4,
    );
    if (guarded && node.guardian) {
      g.fillStyle = '#ff5252';
      g.fillRect(75, -60, 70 * Math.max(0, node.guardian.hp / node.guardian.max), 5);
    }
    g.restore();
  }
}
