const TAU = Math.PI * 2;

// The incident's point and its hold progress, drawn on the ground.
export function drawEvent(g, s) {
  const e = s?.event;
  if (e?.type !== 'incident') return;
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
