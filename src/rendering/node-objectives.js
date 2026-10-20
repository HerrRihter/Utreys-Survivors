import { workaroundRadius, workaroundSeconds } from '../../data/enemies/nodes.js';
import { neonStroke } from './neon.js';
import { nodeGuardian } from '../systems/queries/nodes.js';

// A service desk is drawn as an enemy; the ground only marks its spot and status.
function drawDesk(g, node, guardian) {
  const open = node.status === 'guarded';
  g.save();
  g.translate(node.x, node.y);
  g.strokeStyle = open ? '#2f7cf6' : '#64ffda';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(0, 0, 58, 0, Math.PI * 2);
  neonStroke(g, g.strokeStyle, 1.5, 6);
  g.fillStyle = g.strokeStyle;
  g.font = 'bold 12px monospace';
  g.textAlign = 'center';
  g.fillText(node.label, 0, -118);
  g.font = '11px monospace';
  g.fillText(open ? 'Снеси, чтобы закрыть бэклог' : 'Бэклог закрыт', 0, 78);
  if (open && guardian) {
    g.fillStyle = '#ff5252';
    g.fillRect(-40, -112, 80 * Math.max(0, guardian.hp / guardian.max), 5);
  }
  g.restore();
}

// A learning terminal: guarded (its workaround circle and progress, the guard's health), open
// for its test, or passed.
function drawTerminal(g, node, guardian) {
  const guarded = node.status === 'guarded',
    done = node.status === 'completed';
  g.save();
  g.translate(node.x, node.y);
  g.strokeStyle = done ? '#64ffda' : guarded ? '#ffb74d' : '#55bfff';
  if (guarded) {
    g.lineWidth = 2;
    g.beginPath();
    g.arc(0, 0, workaroundRadius, 0, Math.PI * 2);
    neonStroke(g, g.strokeStyle, 1.5, 6);
  }
  g.fillStyle = '#102634';
  g.lineWidth = 3;
  g.fillRect(-40, -35, 80, 70);
  g.strokeRect(-40, -35, 80, 70);
  g.fillStyle = g.strokeStyle;
  g.font = 'bold 22px monospace';
  g.textAlign = 'center';
  g.fillText(
    done
      ? '✓'
      : guarded
        ? Math.floor((node.progress / (node.need ?? workaroundSeconds)) * 100) + '%'
        : '?',
    0,
    8,
  );
  g.font = '12px sans-serif';
  g.fillText(node.label, 0, -55);
  g.fillText(
    done ? 'Тест пройден' : guarded ? 'Победи стража или постой в круге' : 'Подойди и начни тест',
    0,
    65,
  );
  if (guarded && guardian) {
    g.fillStyle = '#ff5252';
    g.fillRect(-40, -48, 80 * Math.max(0, guardian.hp / guardian.max), 5);
  }
  g.restore();
}

// `enemies` holds the node guardians; previews draw bare nodes without them.
export function drawNodes(g, nodes, enemies = []) {
  for (const node of nodes || []) {
    const guardian = nodeGuardian({ enemies }, node);
    if (node.kind === 'learning-terminal') {
      drawTerminal(g, node, guardian);
      continue;
    }
    if (node.kind === 'desk') {
      drawDesk(g, node, guardian);
      continue;
    }
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
    g.fillText(node.label, 0, -90);
    g.font = '11px monospace';
    g.fillText(
      guarded
        ? 'Уничтожь баг или стой в круге 6 с'
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
    if (guarded && guardian) {
      g.fillStyle = '#ff5252';
      g.fillRect(75, -60, 70 * Math.max(0, guardian.hp / guardian.max), 5);
    }
    g.restore();
  }
}
