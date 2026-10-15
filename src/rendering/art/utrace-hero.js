import { neonStroke } from '../neon.js';
// Isometric U built from the supplied coral/cyan/navy company mark.
export function drawUtraceHero(g, id, x, y, size, flip, phase) {
  g.save();
  g.translate(x, y);
  g.scale((flip ? -1 : 1) * size, size);
  const bob = Math.sin(phase * Math.PI * 2) * 0.6;
  g.fillStyle = '#00000055';
  g.beginPath();
  g.ellipse(0, 1, 10, 3, 0, 0, Math.PI * 2);
  g.fill();
  neonStroke(g, '#398e9b', 0.35, 0.8);
  g.translate(0, bob);
  const face = (points, color) => {
    g.beginPath();
    points.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fillStyle = color;
    g.fill();
    neonStroke(g, color === '#b94d46' ? '#c9786b' : '#549fac', 0.25, 0.75);
  };
  face(
    [
      [-12, -29],
      [-8, -30.5],
      [-4, -29],
      [-8, -27.5],
    ],
    '#292e49',
  );
  face(
    [
      [-12, -29],
      [-8, -27.5],
      [-4, -29],
      [-4, -15],
      [-12, -18],
    ],
    '#b94d46',
  );
  face(
    [
      [4, -29],
      [8, -30.5],
      [12, -29],
      [8, -27.5],
    ],
    '#b94d46',
  );
  face(
    [
      [4, -29],
      [8, -27.5],
      [8, -9],
      [4, -7.5],
    ],
    '#087d91',
  );
  face(
    [
      [8, -27.5],
      [12, -29],
      [12, -10.5],
      [8, -9],
    ],
    '#292e49',
  );
  face(
    [
      [-12, -18],
      [-4, -15],
      [0, -13.5],
      [-12, -9],
    ],
    '#087d91',
  );
  face(
    [
      [-12, -9],
      [0, -13.5],
      [0, -6],
      [-8, -9],
    ],
    '#292e49',
  );
  face(
    [
      [0, -13.5],
      [4, -15],
      [4, -7.5],
      [0, -6],
    ],
    '#b94d46',
  );
  // Hover jets retain the original ground anchor used by portraits and combat.
  g.fillStyle = '#70afb9';
  g.fillRect(-8, -4, 3, 2 + Math.abs(bob));
  g.fillRect(5, -4, 3, 2 + Math.abs(bob));
  g.lineWidth = 1;
  if (id === 'traceability') {
    g.strokeStyle = '#539e92';
    g.beginPath();
    g.ellipse(0, -17, 16, 11, -0.3, 0, Math.PI * 2);
    g.stroke();
    for (const [px, py] of [
      [-15, -14],
      [0, -28],
      [15, -20],
    ]) {
      g.fillStyle = '#539e92';
      g.fillRect(px - 1.5, py - 1.5, 3, 3);
    }
  } else if (id === 'serialization') {
    g.fillStyle = '#9dbbbc';
    g.fillRect(-7, -18, 14, 6);
    g.fillStyle = '#292e49';
    for (const px of [-6, -4, -1, 1, 4, 5]) g.fillRect(px, -17, 1, 4);
    g.strokeStyle = '#b94d46';
    g.strokeRect(-15, -22, 3, 10);
    g.strokeRect(12, -22, 3, 10);
  } else if (id === 'ba') {
    face(
      [
        [-18, -23],
        [-8, -21],
        [-8, -9],
        [-18, -11],
      ],
      '#343653',
    );
    g.fillStyle = '#b49a5e';
    for (let i = 0; i < 3; i++) g.fillRect(-16 + i * 2.5, -14 - i * 2, 1.5, 3 + i * 2);
    g.strokeStyle = '#b49a5e';
    g.beginPath();
    g.moveTo(11, -20);
    g.lineTo(17, -20);
    g.lineTo(17, -12);
    g.stroke();
    g.fillStyle = '#b49a5e';
    g.fillRect(15, -13, 4, 4);
  } else if (id === 'qa') {
    face(
      [
        [7, -23],
        [17, -20],
        [16, -11],
        [12, -7],
        [7, -11],
      ],
      '#174f4a',
    );
    g.strokeStyle = '#68ae91';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(9, -15);
    g.lineTo(12, -12);
    g.lineTo(16, -18);
    g.stroke();
    g.strokeStyle = '#68ae91';
    g.beginPath();
    g.arc(-10, -24, 5, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
  return true;
}
