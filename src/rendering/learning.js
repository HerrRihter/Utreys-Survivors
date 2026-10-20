import { neonStroke } from './neon.js';
import { currentLayout, currentRoom, doorOpen, roomNodes } from '../systems/queries/learning.js';

// A maze's door: shut while terminals remain, open (and pointed at) once they are all passed.
export function drawDoor(g, s) {
  if (!currentRoom(s)?.maze) return;
  const { exit } = currentLayout(s),
    open = doorOpen(s),
    left = roomNodes(s).filter((n) => n.status !== 'completed').length;
  g.save();
  g.translate(exit.x, exit.y);
  g.strokeStyle = open ? '#64ffda' : '#ff7a7a';
  g.fillStyle = open ? '#0f2f2b' : '#2a1416';
  g.lineWidth = 3;
  g.fillRect(-46, -46, 92, 92);
  g.beginPath();
  g.rect(-46, -46, 92, 92);
  neonStroke(g, g.strokeStyle, 2, open ? 10 : 4);
  g.fillStyle = g.strokeStyle;
  g.textAlign = 'center';
  g.font = 'bold 14px monospace';
  g.fillText(open ? 'ДВЕРЬ →' : 'ЗАКРЫТО', 0, 5);
  g.font = '11px monospace';
  g.fillText(open ? 'Подойди и войди' : `Осталось терминалов: ${left}`, 0, 66);
  g.restore();
}
