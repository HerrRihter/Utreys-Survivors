import { eventSpec } from '../systems/queries/events.js';

const TAU = Math.PI * 2;

// The running event on the ground, by its kind (src/systems/run-events.js).
export function drawEvent(g, s) {
  eventPainters[eventSpec(s)?.kind]?.(g, s.event);
}

const eventPainters = { hold: drawHoldPoint };

// The point to hold and the hold progress.
function drawHoldPoint(g, e) {
  g.save();
  g.strokeStyle = '#ff5252';
  g.fillStyle = '#ff525218';
  g.lineWidth = 3;
  g.setLineDash?.([10, 8]);
  g.beginPath();
  g.arc(e.x, e.y, e.radius, 0, TAU);
  g.fill();
  g.stroke();
  g.setLineDash?.([]);
  g.strokeStyle = '#ffd54f';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(e.x, e.y, e.radius + 8, -Math.PI / 2, -Math.PI / 2 + (TAU * e.progress) / e.need);
  g.stroke();
  g.restore();
}
