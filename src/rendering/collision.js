// Debug overlay of the arena's ground outlines (`collision.outlines`) in the arena view.
export function drawCollision(g, outlines) {
  g.save();
  g.lineWidth = 2;
  for (const points of outlines) {
    g.beginPath();
    points.forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
    g.closePath();
    g.fillStyle = '#f25d4540';
    g.strokeStyle = '#ffcf85';
    g.fill();
    g.stroke();
  }
  g.restore();
}
