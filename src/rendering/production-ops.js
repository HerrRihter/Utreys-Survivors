import { mapDefinitions } from '../../data/maps/maps.js';
import { incidentRules } from '../../data/incident-rules.js';
import { inBox } from '../core/math.js';
import {
  badShare,
  componentDef,
  opStuck,
  receiverDown,
  shiftMinute,
} from '../systems/queries/incident.js';

// The incident shift on the floor (docs/INCIDENT-ESCALATION-PLAN.md): the pipes along which the
// components feed each other, every room's panel of operations and the outside receiver's lamp.
// Operations read by colour and by shape: grey with a dot in progress, an hourglass when stuck,
// green with a tick when done, red with a cross when failed. Animation runs on the run's time.

const colors = {
  busy: '#7d8790',
  stuck: '#4a5158',
  done: '#43d17a',
  error: '#ff4d4d',
  pipe: '#24414b',
  flow: '#64ffda',
  blocked: '#ff5252',
};
const CARD_W = 22,
  CARD_H = 28,
  GAP = 6;

/** The pipe of a feed: down from its source's panel to its lane, across, up to the receiver. */
function pipePoints(shift, feed, lane) {
  const a = shift.rooms[feed.from].panel,
    b = shift.rooms[feed.to].panel;
  return [a, { x: a.x, y: lane }, { x: b.x, y: lane }, b];
}

function drawPipe(g, points, flow, blocked, t) {
  g.save();
  g.lineWidth = 6;
  g.strokeStyle = colors.pipe;
  g.beginPath();
  points.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
  g.stroke();
  // Packets along the pipe: they move with the source's healthy share and stop when it fails.
  const spacing = 70;
  const offset = blocked ? spacing / 3 : (t * 90 * flow) % spacing;
  g.fillStyle = blocked ? colors.blocked : colors.flow;
  g.globalAlpha = blocked ? 0.55 : 0.4 + 0.5 * flow;
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i],
      len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = (spacing - ((walked - offset) % spacing)) % spacing; d < len; d += spacing) {
      const k = d / len;
      g.fillRect(a.x + (b.x - a.x) * k - 3, a.y + (b.y - a.y) * k - 3, 6, 6);
    }
    walked += len;
  }
  g.restore();
}

function drawCard(g, x, y, kind, t) {
  g.fillStyle = colors[kind];
  g.fillRect(x, y, CARD_W, CARD_H);
  g.strokeStyle = '#0b1416';
  g.lineWidth = 2;
  g.strokeRect(x, y, CARD_W, CARD_H);
  const cx = x + CARD_W / 2,
    cy = y + CARD_H / 2;
  g.strokeStyle = '#0b1416';
  g.fillStyle = '#0b1416';
  g.lineWidth = 2.5;
  g.beginPath();
  if (kind === 'done') {
    g.moveTo(cx - 6, cy);
    g.lineTo(cx - 2, cy + 5);
    g.lineTo(cx + 6, cy - 5);
    g.stroke();
  } else if (kind === 'error') {
    // A failed card pulses.
    g.globalAlpha = 0.6 + 0.4 * Math.abs(Math.sin(t * 5));
    g.moveTo(cx - 5, cy - 5);
    g.lineTo(cx + 5, cy + 5);
    g.moveTo(cx + 5, cy - 5);
    g.lineTo(cx - 5, cy + 5);
    g.stroke();
    g.globalAlpha = 1;
  } else if (kind === 'stuck') {
    g.strokeStyle = '#c8ccd0';
    g.moveTo(cx - 5, cy - 8);
    g.lineTo(cx + 5, cy - 8);
    g.lineTo(cx - 5, cy + 8);
    g.lineTo(cx + 5, cy + 8);
    g.closePath();
    g.stroke();
  } else {
    // In progress: a dot running around.
    const a = t * 4;
    g.arc(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5, 2.5, 0, Math.PI * 2);
    g.fill();
  }
}

function drawPanel(g, inc, def, spot, minute, t) {
  const c = inc.components[def.id];
  const cols = Math.ceil(def.ops / 2);
  const width = cols * (CARD_W + GAP) + GAP,
    height = 2 * (CARD_H + GAP) + GAP;
  const x0 = spot.x - width / 2,
    y0 = spot.y - height / 2;
  const bad = badShare(inc, def.id, minute);
  g.fillStyle = '#0d1d22';
  g.fillRect(x0, y0, width, height);
  g.lineWidth = 3;
  g.strokeStyle = bad >= incidentRules.cascade.share ? colors.error : '#3c6b78';
  g.strokeRect(x0, y0, width, height);
  const reboot = c.reboots.at(-1);
  const rebootDown =
    Object.values(incidentRules.faults).find((f) => f.kind === 'reboot')?.down ?? 0;
  const down = reboot != null && minute - reboot < rebootDown;
  c.ops.forEach((op, i) => {
    const kind = opStuck(op, def, minute) ? 'stuck' : op.status;
    drawCard(
      g,
      x0 + GAP + (i % cols) * (CARD_W + GAP),
      y0 + GAP + Math.floor(i / cols) * (CARD_H + GAP),
      kind,
      t + i * 0.3,
    );
  });
  g.textAlign = 'center';
  g.textBaseline = 'bottom';
  g.font = 'bold 18px monospace';
  g.fillStyle = '#e0f7fa';
  g.fillText(def.label, spot.x, y0 - 8);
  g.textBaseline = 'top';
  g.font = '13px monospace';
  const errors = c.ops.filter((op) => op.status === 'error').length,
    stuck = c.ops.filter((op) => opStuck(op, def, minute)).length;
  const lines = [];
  if (down) lines.push('ПЕРЕЗАПУСК');
  if (errors || stuck) lines.push(`Ошибок: ${errors} · Зависло: ${stuck}`);
  if (def.queue) lines.push('Очередь: ' + Math.round(c.queue));
  g.fillStyle = errors || stuck || down ? '#ffab91' : '#9fb8be';
  lines.forEach((line, i) => g.fillText(line, spot.x, y0 + height + 8 + i * 16));
}

function drawLamp(g, inc, spot, minute, t) {
  const down = receiverDown(inc, minute);
  g.save();
  g.translate(spot.x, spot.y);
  g.fillStyle = down ? '#3a1010' : '#0f3a26';
  g.beginPath();
  g.arc(0, 0, 30, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = down ? colors.error : colors.done;
  g.globalAlpha = down ? 0.5 + 0.5 * Math.abs(Math.sin(t * 4)) : 1;
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = '#e0f7fa';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 13px monospace';
  g.fillText(incidentRules.receiver.label, 0, 0);
  g.font = '12px monospace';
  g.fillStyle = down ? '#ff8a80' : '#9fe8b8';
  g.fillText(down ? 'нет данных' : 'принимает', 0, 44);
  g.restore();
}

// Draws the shift of `s` when its map has a shift floor; `bounds` is the visible world box.
export function drawShift(g, s, bounds) {
  const shift = mapDefinitions[s.map]?.shift;
  const inc = s.incident;
  if (!shift || !inc) return;
  const minute = shiftMinute(s);
  incidentRules.feeds.forEach((feed, i) => {
    const flow = Math.max(0, 1 - badShare(inc, feed.from, minute));
    const blocked = badShare(inc, feed.from, minute) >= incidentRules.cascade.share;
    drawPipe(g, pipePoints(shift, feed, shift.lanes[i]), flow, blocked, s.t);
  });
  for (const def of incidentRules.components) {
    const spot = shift.rooms[def.id].panel;
    if (inBox(spot, bounds, 200)) drawPanel(g, inc, componentDef(def.id), spot, minute, s.t);
  }
  if (inBox(shift.lamp, bounds, 80)) drawLamp(g, inc, shift.lamp, minute, s.t);
}
